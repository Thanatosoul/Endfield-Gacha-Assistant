#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod webdav;

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

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

fn with_dir(path: &Path, sub: &str) -> Result<PathBuf, String> {
    let d = path.join(sub);
    std::fs::create_dir_all(&d)
        .map_err(|e| format!("mkdir {}: {e}", d.display()))?;
    Ok(d)
}

// ─── Tauri commands ───────────────────────────────────────────────

#[tauri::command]
fn app_paths() -> Result<AppPaths, String> {
    let data_dir = resolve_portable_data_dir()?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|error| format!("failed to create app data dir: {error}"))?;

    // Clean up legacy artifacts
    let exe_dir = data_dir.parent().ok_or_else(|| "no parent of data dir".to_string())?;
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

    let database_url = format!("sqlite:{}", data_dir.join("endfield-gacha-assistant.db").display());
    Ok(AppPaths { data_dir: data_dir.display().to_string(), database_url })
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
    let path = pool_data_root()?.join("data").join(format!("{pool_id}.json"));
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

// ─── Entrypoint ───────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            app_paths,
            quit_app,
            pool_source_dir,
            pool_read_json,
            pool_write_json,
            pool_json_exists,
            webdav::webdav_test,
            webdav::webdav_backup,
            webdav::webdav_list_backups,
            webdav::webdav_restore,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
