#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod webdav;

use serde::Serialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{
    http::{header, Response, StatusCode},
    AppHandle, Emitter, Manager, State,
};

const ASSET_BASE_URL: &str =
    "https://raw.githubusercontent.com/Thanatosoul/Endfield-Gacha-Assets/master/public";

#[derive(Clone, Serialize)]
struct AppPaths {
    data_dir: String,
    database_url: String,
}

// ─── Path resolution ─────────────────────────────────────────────

fn resolve_portable_data_dir() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("failed to resolve current executable path: {error}"))?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "failed to resolve executable directory".to_string())?;
    Ok(exe_dir.join("data"))
}

fn pool_data_root() -> Result<PathBuf, String> {
    Ok(resolve_portable_data_dir()?.join("pool"))
}

struct AssetSyncState(Arc<AtomicBool>);

#[derive(Clone, Serialize)]
struct AssetSyncProgress {
    checked: usize,
    total: usize,
    downloaded: usize,
    skipped: usize,
    failed: usize,
    complete: bool,
}

#[derive(Serialize)]
struct AssetSyncStart {
    started: bool,
}

#[derive(serde::Deserialize)]
struct TreeEntry {
    path: String,
    sha: String,
    #[serde(rename = "type")]
    kind: String,
}

#[derive(serde::Deserialize)]
struct GitTree {
    tree: Vec<TreeEntry>,
}

fn asset_cache_root() -> Result<PathBuf, String> {
    Ok(resolve_portable_data_dir()?.join("assets"))
}

fn asset_manifest_path() -> Result<PathBuf, String> {
    Ok(asset_cache_root()?.join("manifest.json"))
}

fn safe_asset_path(relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    if path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, std::path::Component::ParentDir))
    {
        return Err("invalid asset path".to_string());
    }
    Ok(asset_cache_root()?.join(path))
}

fn legacy_asset_paths(relative_path: &str) -> Result<Vec<PathBuf>, String> {
    let relative = Path::new(relative_path);
    let data_dir = resolve_portable_data_dir()?;
    let mut paths = vec![
        data_dir.join("pool").join(relative),
        data_dir.join("pool").join("source").join(relative),
    ];
    let file_name = relative
        .file_name()
        .ok_or_else(|| "invalid asset path".to_string())?;
    if relative.starts_with("images/character") {
        paths.push(data_dir.join("pool").join("character").join(file_name));
        paths.push(
            data_dir
                .join("pool")
                .join("source")
                .join("character")
                .join(file_name),
        );
    } else if relative.starts_with("images/weapon") {
        paths.push(data_dir.join("pool").join("weapon").join(file_name));
        paths.push(
            data_dir
                .join("pool")
                .join("source")
                .join("weapon")
                .join(file_name),
        );
    } else if relative.starts_with("images/banner") {
        paths.push(data_dir.join("pool").join("background").join(file_name));
        paths.push(
            data_dir
                .join("pool")
                .join("source")
                .join("pool")
                .join("background")
                .join(file_name),
        );
    }
    Ok(paths)
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        _ => "application/octet-stream",
    }
}

fn cache_asset(relative_path: &str, refresh: bool) -> Result<Vec<u8>, String> {
    let local_path = safe_asset_path(relative_path)?;
    if !refresh {
        if let Ok(contents) = std::fs::read(&local_path) {
            return Ok(contents);
        }
        for legacy_path in legacy_asset_paths(relative_path)? {
            if let Ok(contents) = std::fs::read(legacy_path) {
                return Ok(contents);
            }
        }
    }

    let url = format!("{ASSET_BASE_URL}/{}", relative_path.trim_start_matches('/'));
    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|error| format!("create asset client: {error}"))?
        .get(url)
        .send()
        .map_err(|error| format!("download asset: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("download asset: HTTP {}", response.status()));
    }
    let bytes = response
        .bytes()
        .map_err(|error| format!("read asset: {error}"))?
        .to_vec();
    let parent = local_path
        .parent()
        .ok_or_else(|| "asset cache has no parent".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| format!("create asset cache: {error}"))?;
    std::fs::write(&local_path, &bytes).map_err(|error| format!("write asset cache: {error}"))?;
    Ok(bytes)
}

fn with_dir(path: &Path, sub: &str) -> Result<PathBuf, String> {
    let d = path.join(sub);
    std::fs::create_dir_all(&d).map_err(|e| format!("mkdir {}: {e}", d.display()))?;
    Ok(d)
}

// ─── Tauri commands ───────────────────────────────────────────────

#[tauri::command]
fn app_paths() -> Result<AppPaths, String> {
    let data_dir = resolve_portable_data_dir()?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|error| format!("failed to create app data dir: {error}"))?;

    // Clean up legacy artifacts
    let exe_dir = data_dir
        .parent()
        .ok_or_else(|| "no parent of data dir".to_string())?;
    for legacy_dir in &[
        exe_dir.join("source"),
        exe_dir.join("pool"),
        exe_dir.join("public"),
        data_dir.join("pool_legacy"),
    ] {
        if legacy_dir.exists() {
            let _ = std::fs::remove_dir_all(legacy_dir);
        }
    }

    let database_url = format!(
        "sqlite:{}",
        data_dir.join("endfield-gacha-assistant.db").display()
    );
    Ok(AppPaths {
        data_dir: data_dir.display().to_string(),
        database_url,
    })
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("app:quit-requested", ());
    }
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(100));
        app_handle.exit(0);
    });
}

// ─── Pool commands (data/pool/) ───────────────────────────────────

#[tauri::command]
fn pool_source_dir() -> Result<String, String> {
    Ok(resolve_portable_data_dir()?.to_string_lossy().into_owned())
}

#[tauri::command]
fn pool_read_json(pool_id: String) -> Result<String, String> {
    let path = pool_data_root()?
        .join("data")
        .join(format!("{pool_id}.json"));
    std::fs::read_to_string(&path).map_err(|e| format!("read {}: {e}", path.display()))
}

#[tauri::command]
fn pool_write_json(pool_id: String, content: String) -> Result<(), String> {
    let dir = with_dir(&pool_data_root()?, "data")?;
    let path = dir.join(format!("{pool_id}.json"));
    std::fs::write(&path, content.as_bytes()).map_err(|e| format!("write {}: {e}", path.display()))
}

#[tauri::command]
fn pool_json_exists(pool_id: String) -> bool {
    pool_data_root()
        .map(|r| r.join("data").join(format!("{pool_id}.json")).exists())
        .unwrap_or(false)
}

fn sync_asset_cache_task(app: &AppHandle) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("create asset client: {error}"))?;
    let tree = client
        .get("https://api.github.com/repos/Thanatosoul/Endfield-Gacha-Assets/git/trees/master?recursive=1")
        .header(reqwest::header::USER_AGENT, "Endfield-Gacha-Assistant")
        .send()
        .map_err(|error| format!("fetch asset manifest: {error}"))?
        .error_for_status()
        .map_err(|error| format!("fetch asset manifest: {error}"))?
        .json::<GitTree>()
        .map_err(|error| format!("parse asset manifest: {error}"))?;

    let entries = tree
        .tree
        .into_iter()
        .filter_map(|entry| {
            let prefix = "public/";
            (entry.kind == "blob" && entry.path.starts_with("public/images/"))
                .then(|| (entry.path.trim_start_matches(prefix).to_string(), entry.sha))
        })
        .collect::<Vec<_>>();
    let manifest_path = asset_manifest_path()?;
    let mut manifest = std::fs::read_to_string(&manifest_path)
        .ok()
        .and_then(|content| serde_json::from_str::<HashMap<String, String>>(&content).ok())
        .unwrap_or_default();
    let mut progress = AssetSyncProgress {
        checked: 0,
        total: entries.len(),
        downloaded: 0,
        skipped: 0,
        failed: 0,
        complete: false,
    };
    let _ = app.emit("assets:sync-progress", progress.clone());

    for (path, sha) in entries {
        progress.checked += 1;
        let local_exists = safe_asset_path(&path)?.exists();
        if local_exists
            && manifest
                .get(&path)
                .is_none_or(|cached_sha| cached_sha == &sha)
        {
            manifest.insert(path, sha);
            progress.skipped += 1;
        } else {
            match cache_asset(&path, true) {
                Ok(_) => {
                    manifest.insert(path, sha);
                    progress.downloaded += 1;
                }
                Err(_) => progress.failed += 1,
            }
        }
        if progress.checked % 5 == 0 || progress.checked == progress.total {
            let _ = app.emit("assets:sync-progress", progress.clone());
        }
    }
    let parent = manifest_path
        .parent()
        .ok_or_else(|| "asset manifest has no parent".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| format!("create asset manifest: {error}"))?;
    std::fs::write(
        &manifest_path,
        serde_json::to_vec(&manifest)
            .map_err(|error| format!("serialize asset manifest: {error}"))?,
    )
    .map_err(|error| format!("write asset manifest: {error}"))?;
    progress.complete = true;
    let _ = app.emit("assets:sync-progress", progress);
    Ok(())
}

#[tauri::command]
fn sync_asset_cache(app: AppHandle, state: State<'_, AssetSyncState>) -> AssetSyncStart {
    if state.0.swap(true, Ordering::AcqRel) {
        return AssetSyncStart { started: false };
    }
    let syncing = state.0.clone();
    std::thread::spawn(move || {
        let result = sync_asset_cache_task(&app);
        if let Err(error) = result {
            let _ = app.emit("assets:sync-error", error);
        }
        syncing.store(false, Ordering::Release);
    });
    AssetSyncStart { started: true }
}

// ─── Entrypoint ───────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .manage(AssetSyncState(Arc::new(AtomicBool::new(false))))
        .register_asynchronous_uri_scheme_protocol("asset-cache", |_ctx, request, responder| {
            let relative_path = request.uri().path().trim_start_matches('/').to_string();
            std::thread::spawn(move || {
                let response = match cache_asset(&relative_path, false) {
                    Ok(bytes) => Response::builder()
                        .header(
                            header::CONTENT_TYPE,
                            content_type(Path::new(&relative_path)),
                        )
                        .header(header::CACHE_CONTROL, "no-store")
                        .body(bytes)
                        .unwrap(),
                    Err(error) => Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                        .body(error.into_bytes())
                        .unwrap(),
                };
                responder.respond(response);
            });
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            app_paths,
            quit_app,
            pool_source_dir,
            pool_read_json,
            pool_write_json,
            pool_json_exists,
            sync_asset_cache,
            webdav::webdav_test,
            webdav::webdav_backup,
            webdav::webdav_list_backups,
            webdav::webdav_restore,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
