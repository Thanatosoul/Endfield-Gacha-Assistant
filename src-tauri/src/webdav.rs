use reqwest::blocking::Client;

const REMOTE_DIR: &str = "endfield-gacha-backups";
const BACKUP_PREFIX: &str = "endfield-backup-";

fn webdav_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    let path = path.trim_start_matches('/');
    format!("{base}/{path}")
}

fn webdav_client(
    username: &str,
    password: &str,
    timeout_secs: u64,
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
            headers.insert(
                reqwest::header::USER_AGENT,
                reqwest::header::HeaderValue::from_static("Endfield-Gacha-Assistant"),
            );
            headers
        })
        // NAS/self-hosted WebDAV servers commonly use self-signed certificates that
        // browsers accept after a warning. Accept them so HTTPS works like the browser.
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("failed to create HTTP client: {e}"))
}

// ─── Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn webdav_test(url: String, username: String, password: String) -> Result<String, String> {
    let client = webdav_client(&username, &password, 20)?;
    let req_url = webdav_url(&url, "/");

    let resp = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &req_url)
        .header("Depth", "0")
        .send()
        .map_err(|e| format!("connection failed: {e}\nURL: {req_url}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!(
            "HTTP {}: {}",
            status.as_u16(),
            resp.text().unwrap_or_default()
        ));
    }

    Ok(format!("连接成功 — HTTP {}", status.as_u16()))
}

/// Upload a portable backup (already serialized by the frontend) to WebDAV.
#[tauri::command]
pub fn webdav_backup(
    url: String,
    username: String,
    password: String,
    remote_name: String,
    text: String,
) -> Result<String, String> {
    if text.is_empty() {
        return Err("备份内容为空，已取消上传".to_string());
    }

    let client = webdav_client(&username, &password, 300)?;

    // Ensure the backup directory exists (ignore "already exists" responses).
    let parent_url = webdav_url(&url, REMOTE_DIR);
    let _ = client
        .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &parent_url)
        .send();

    let remote = format!("{REMOTE_DIR}/{remote_name}");
    let upload_url = webdav_url(&url, &remote);

    let resp = client
        .put(&upload_url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(text)
        .send()
        .map_err(|e| format!("上传失败: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!(
            "上传失败 HTTP {}: {}",
            status.as_u16(),
            resp.text().unwrap_or_default()
        ));
    }

    Ok(remote)
}

#[tauri::command]
pub fn webdav_list_backups(
    url: String,
    username: String,
    password: String,
) -> Result<Vec<String>, String> {
    let client = webdav_client(&username, &password, 60)?;
    let list_url = webdav_url(&url, REMOTE_DIR);

    let resp = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &list_url)
        .header("Depth", "1")
        .send()
        .map_err(|e| format!("list failed: {e}"))?;

    if resp.status().as_u16() == 404 {
        return Ok(Vec::new());
    }
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let body = resp.text().map_err(|e| format!("read body: {e}"))?;
    let mut names: Vec<String> = extract_hrefs(&body)
        .into_iter()
        .filter_map(|href| {
            let trimmed = href.trim_end_matches('/');
            if !trimmed.ends_with(".json") {
                return None;
            }
            let decoded = percent_decode(trimmed.rsplit('/').next().unwrap_or(trimmed));
            if decoded.starts_with(BACKUP_PREFIX) {
                Some(decoded)
            } else {
                None
            }
        })
        .collect();
    names.sort();
    names.dedup();
    names.reverse();
    Ok(names)
}

/// Download a backup from WebDAV and return its raw text to the frontend.
#[tauri::command]
pub fn webdav_restore(
    url: String,
    username: String,
    password: String,
    backup_name: String,
) -> Result<String, String> {
    let client = webdav_client(&username, &password, 300)?;
    let remote_url = webdav_url(&url, &format!("{REMOTE_DIR}/{backup_name}"));

    let resp = client
        .get(&remote_url)
        .send()
        .map_err(|e| format!("下载失败: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("下载失败 HTTP {}", status.as_u16()));
    }

    resp.text().map_err(|e| format!("读取备份内容失败: {e}"))
}

// ─── Parsing helpers ──────────────────────────────────────────────

/// Extract href values from a WebDAV multistatus response, namespace-agnostic.
fn extract_hrefs(body: &str) -> Vec<String> {
    let lower = body.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let mut result = Vec::new();
    let mut search = 0usize;

    while let Some(pos) = lower[search..].find("href") {
        let idx = search + pos;
        // Must be a tag of the form <...href> — '>' immediately follows.
        let after = idx + 4;
        if bytes.get(after) == Some(&b'>') {
            if let Some(gt_rel) = body[after..].find('>') {
                let content_start = after + gt_rel + 1;
                if let Some(lt_rel) = body[content_start..].find('<') {
                    let href = body[content_start..content_start + lt_rel].trim();
                    result.push(href.to_string());
                    search = content_start + lt_rel;
                    continue;
                }
            }
        }
        search = after;
        if search >= body.len() {
            break;
        }
    }

    result
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                out.push(value);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
