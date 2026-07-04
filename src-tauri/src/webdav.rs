use reqwest::blocking::Client;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

fn webdav_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    let path = path.trim_start_matches('/');
    format!("{base}/{path}")
}

fn webdav_client(
    username: &str,
    password: &str,
) -> Result<Client, String> {
    let auth = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        format!("{username}:{password}"),
    );

    Client::builder()
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&format!("Basic {auth}"))
                    .map_err(|e| format!("invalid auth header: {e}"))?,
            );
            headers
        })
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("failed to create HTTP client: {e}"))
}

// ─── Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn webdav_test(url: String, username: String, password: String) -> Result<String, String> {
    let client = webdav_client(&username, &password)?;
    let req_url = webdav_url(&url, "/");

    let resp = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &req_url)
        .header("Depth", "0")
        .send()
        .map_err(|e| format!("connection failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status().as_u16(), resp.text().unwrap_or_default()));
    }

    Ok(format!("Connected — status {}", resp.status().as_u16()))
}

#[tauri::command]
pub fn webdav_backup(
    url: String,
    username: String,
    password: String,
    data_dir: String,
) -> Result<String, String> {
    let data_root = PathBuf::from(&data_dir);
    let tmp = std::env::temp_dir().join("endfield-gacha-backup");
    fs::create_dir_all(&tmp).map_err(|e| format!("mkdir tmp: {e}"))?;

    let zip_path = tmp.join("backup.zip");
    let file = fs::File::create(&zip_path).map_err(|e| format!("create zip: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = zip::write::FileOptions::<()>::default();

    // Add source/ directory
    let source = data_root.join("source");
    if source.exists() {
        add_dir_to_zip(&mut zip, &source, &source, opts)?;
    }

    // Add DB files (in data/ subdirectory)
    for db_name in &["endfield-gacha-assistant.db", "endfield-gacha-assistant.db-wal", "endfield-gacha-assistant.db-shm"] {
        let db_path = data_root.join("data").join(db_name);
        if db_path.exists() {
            zip.start_file(format!("data/{db_name}"), opts)
                .map_err(|e| format!("zip start {db_name}: {e}"))?;
            let bytes = fs::read(&db_path).map_err(|e| format!("read {db_name}: {e}"))?;
            zip.write_all(&bytes).map_err(|e| format!("zip write {db_name}: {e}"))?;
        }
    }

    zip.finish().map_err(|e| format!("finish zip: {e}"))?;

    // Upload
    let client = webdav_client(&username, &password)?;
    let now = chrono_now();
    let remote_name = format!("endfield-gacha-backups/backup_{now}.zip");
    let upload_url = webdav_url(&url, &remote_name);

    // Ensure directory exists
    let parent_url = webdav_url(&url, "endfield-gacha-backups");
    client
        .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &parent_url)
        .send()
        .ok(); // ignore if already exists

    let zip_bytes = fs::read(&zip_path).map_err(|e| format!("read zip: {e}"))?;
    client
        .put(&upload_url)
        .body(zip_bytes)
        .send()
        .map_err(|e| format!("upload failed: {e}"))?;

    fs::remove_dir_all(&tmp).ok();
    Ok(remote_name)
}

#[tauri::command]
pub fn webdav_list_backups(
    url: String,
    username: String,
    password: String,
) -> Result<Vec<String>, String> {
    let client = webdav_client(&username, &password)?;
    let list_url = webdav_url(&url, "endfield-gacha-backups");

    let resp = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &list_url)
        .header("Depth", "1")
        .send()
        .map_err(|e| format!("list failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let body = resp.text().map_err(|e| format!("read body: {e}"))?;
    let mut names: Vec<String> = Vec::new();

    // Simple XML parse: find all href elements
    for cap in body.split("<D:href>").skip(1) {
        if let Some(end) = cap.find("</D:href>") {
            let href = cap[..end].trim_end_matches('/').to_string();
            if href.ends_with(".zip") {
                let name = href.rsplit('/').next().unwrap_or(&href).to_string();
                names.push(name);
            }
        }
    }

    Ok(names)
}

#[tauri::command]
pub fn webdav_restore(
    url: String,
    username: String,
    password: String,
    data_dir: String,
    backup_name: String,
) -> Result<(), String> {
    let client = webdav_client(&username, &password)?;
    let remote_url = webdav_url(&url, &format!("endfield-gacha-backups/{backup_name}"));

    let resp = client
        .get(&remote_url)
        .send()
        .map_err(|e| format!("download failed: {e}"))?;

    let zip_bytes = resp.bytes().map_err(|e| format!("read response: {e}"))?;

    let tmp = std::env::temp_dir().join("endfield-gacha-restore");
    fs::create_dir_all(&tmp).map_err(|e| format!("mkdir tmp: {e}"))?;
    let zip_path = tmp.join("restore.zip");
    fs::write(&zip_path, &zip_bytes).map_err(|e| format!("write tmp zip: {e}"))?;

    // Extract
    let file = fs::File::open(&zip_path).map_err(|e| format!("open zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("open archive: {e}"))?;

    let data_root = PathBuf::from(&data_dir);
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("zip entry {i}: {e}"))?;
        let name = entry.name().to_string();
        if name.contains("..") || name.starts_with('/') {
            continue; // path traversal guard
        }
        let dest = data_root.join(&name);
        if entry.is_dir() {
            fs::create_dir_all(&dest).ok();
        } else {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut out = fs::File::create(&dest).map_err(|e| format!("create {name}: {e}"))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| format!("extract {name}: {e}"))?;
        }
    }

    fs::remove_dir_all(&tmp).ok();
    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────

fn add_dir_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    root: &Path,
    dir: &Path,
    opts: zip::write::FileOptions<()>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| format!("read dir {}: {e}", dir.display()))? {
        let entry = entry.map_err(|e| format!("dir entry: {e}"))?;
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|e| format!("strip prefix: {e}"))?;

        if path.is_dir() {
            let dir_name = relative.to_string_lossy().replace('\\', "/");
            zip.add_directory(format!("{dir_name}/"), opts)
                .map_err(|e| format!("zip add dir: {e}"))?;
            add_dir_to_zip(zip, root, &path, opts)?;
        } else {
            let name = relative.to_string_lossy().replace('\\', "/");
            zip.start_file(name, opts)
                .map_err(|e| format!("zip start: {e}"))?;
            let bytes = fs::read(&path).map_err(|e| format!("read {}: {e}", path.display()))?;
            zip.write_all(&bytes).map_err(|e| format!("zip write: {e}"))?;
        }
    }
    Ok(())
}

fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    // YYYYMMDD_HHMMSS
    let days = secs / 86400;
    let time = secs % 86400;
    let hours = time / 3600;
    let mins = (time % 3600) / 60;
    let sec = time % 60;

    // Simple date calculation from Unix epoch
    let mut y = 1970i64;
    let mut remaining = days as i64;
    loop {
        let year_days = if is_leap(y) { 366 } else { 365 };
        if remaining < year_days {
            break;
        }
        remaining -= year_days;
        y += 1;
    }
    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut mo = 1usize;
    for md in month_days {
        if remaining < md {
            break;
        }
        remaining -= md;
        mo += 1;
    }
    let d = remaining + 1;

    format!("{y:04}{mo:02}{d:02}_{hours:02}{mins:02}{sec:02}")
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
