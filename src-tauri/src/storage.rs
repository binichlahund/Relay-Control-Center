use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

fn path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = std::env::var_os("RELAY_PROFILE_DIR") {
        return Ok(PathBuf::from(dir).join("settings-v2.json"));
    }
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("settings-v2.json"))
}
fn read(file: &Path) -> Result<Value, String> {
    if fs::metadata(file).map_err(|e| e.to_string())?.len() > 8_000_000 {
        return Err("Configuration is too large.".into());
    }
    let text = fs::read_to_string(file).map_err(|e| e.to_string())?;
    serde_json::from_str(text.trim_start_matches('\u{feff}')).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<Option<Value>, String> {
    let current = path(&app)?;
    if current.exists() {
        return read(&current).map(Some);
    }
    if std::env::var_os("RELAY_PROFILE_DIR").is_some() {
        return Ok(None);
    }
    for env in ["LOCALAPPDATA", "APPDATA"] {
        if let Some(root) = std::env::var_os(env) {
            let legacy = PathBuf::from(root).join("Relay/Control Center/settings.json");
            if legacy.exists() {
                return read(&legacy).map(Some);
            }
        }
    }
    Ok(None)
}
fn write(file: &Path, data: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    if bytes.len() > 8_000_000 {
        return Err("Configuration exceeds 8 MB.".into());
    }
    let parent = file.parent().ok_or("Missing parent folder")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(&bytes)
        .and_then(|_| temp.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    temp.persist(file).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn save_config(app: AppHandle, data: Value) -> Result<(), String> {
    write(&path(&app)?, &data)
}
#[tauri::command]
pub async fn import_config(app: AppHandle) -> Result<Option<Value>, String> {
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("Relay configuration", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    read(&file.into_path().map_err(|e| e.to_string())?).map(Some)
}
#[tauri::command]
pub async fn export_config(app: AppHandle, data: Value) -> Result<bool, String> {
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name("relay-settings.json")
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = file.into_path().map_err(|e| e.to_string())?;
    if !path
        .extension()
        .is_some_and(|x| x.eq_ignore_ascii_case("json"))
    {
        return Err("Use a .json filename.".into());
    }
    write(&path, &data)?;
    Ok(true)
}
