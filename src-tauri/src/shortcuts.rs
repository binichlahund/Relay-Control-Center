use base64::{engine::general_purpose::STANDARD, Engine};
use std::{ffi::OsStr, os::windows::ffi::OsStrExt, path::PathBuf, ptr};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use windows_sys::Win32::{
    Graphics::Gdi::*,
    UI::{
        Shell::{SHGetFileInfoW, ShellExecuteW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON},
        WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL},
    },
};

fn wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(Some(0)).collect()
}
fn resolve(target: &str) -> Result<PathBuf, String> {
    let mut name = target.to_owned();
    for key in [
        "ProgramFiles",
        "ProgramFiles(x86)",
        "LOCALAPPDATA",
        "SystemRoot",
    ] {
        if let Ok(v) = std::env::var(key) {
            name = name.replace(&format!("%{key}%"), &v)
        }
    }
    let mut path = PathBuf::from(&name);
    if name.eq_ignore_ascii_case("calc.exe") {
        path = PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into()))
            .join("System32/calc.exe")
    }
    if !path.is_file()
        && path
            .file_name()
            .is_some_and(|v| v.eq_ignore_ascii_case("brave.exe"))
    {
        for key in ["LOCALAPPDATA", "ProgramFiles(x86)"] {
            if let Some(v) = std::env::var_os(key) {
                let alt =
                    PathBuf::from(v).join("BraveSoftware/Brave-Browser/Application/brave.exe");
                if alt.is_file() {
                    path = alt;
                    break;
                }
            }
        }
    }
    if !path.is_absolute()
        || !path.is_file()
        || !path
            .extension()
            .is_some_and(|v| v.eq_ignore_ascii_case("exe") || v.eq_ignore_ascii_case("lnk"))
    {
        return Err("Application unavailable. Edit its path or choose an installed app.".into());
    }
    Ok(path)
}

#[tauri::command]
pub fn launch_shortcut(app: AppHandle, id: String) -> Result<(), String> {
    let data = super::storage::load_config(app)?.ok_or("Save the shortcut first.")?;
    let item = data["shortcuts"]
        .as_array()
        .and_then(|a| a.iter().find(|e| e["id"].as_str() == Some(&id)))
        .ok_or("Shortcut no longer exists.")?;
    let target = item["target"].as_str().ok_or("Missing destination")?;
    let destination = if let Ok(u) = tauri::Url::parse(target) {
        match u.scheme() {
            "https" | "http" if u.host_str().is_some() => target.to_owned(),
            "discord" | "steam" | "battlenet"
                if target.starts_with(&format!("{}://", u.scheme())) =>
            {
                target.to_owned()
            }
            _ => resolve(target)?.to_string_lossy().into_owned(),
        }
    } else {
        resolve(target)?.to_string_lossy().into_owned()
    };
    let name = wide(OsStr::new(&destination));
    let code = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            ptr::null(),
            name.as_ptr(),
            ptr::null(),
            ptr::null(),
            1,
        )
    } as isize;
    if code <= 32 {
        Err("Windows could not open this shortcut. Check the app installation or its path.".into())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn pick_app(app: AppHandle) -> Result<Option<String>, String> {
    Ok(app
        .dialog()
        .file()
        .add_filter("Application", &["exe", "lnk"])
        .blocking_pick_file()
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned()))
}
fn png(rgba: Vec<u8>, w: u32, h: u32) -> Result<String, String> {
    use image::ImageEncoder;
    let mut bytes = vec![];
    image::codecs::png::PngEncoder::new(&mut bytes)
        .write_image(&rgba, w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| e.to_string())?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}
#[tauri::command]
pub async fn pick_icon(app: AppHandle) -> Result<Option<String>, String> {
    let Some(f) = app
        .dialog()
        .file()
        .add_filter("PNG image", &["png"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let p = f.into_path().map_err(|e| e.to_string())?;
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() > 2_000_000 {
        return Err("Choose a PNG under 2 MB.".into());
    }
    let reader = image::ImageReader::open(&p).map_err(|e| e.to_string())?;
    let (w, h) = reader.into_dimensions().map_err(|e| e.to_string())?;
    if w > 2048 || h > 2048 {
        return Err("Choose an icon up to 2048 pixels wide and tall.".into());
    }
    let img = image::open(p)
        .map_err(|e| e.to_string())?
        .thumbnail(64, 64)
        .to_rgba8();
    let (w, h) = img.dimensions();
    png(img.into_raw(), w, h).map(Some)
}
#[tauri::command]
pub async fn app_icon(target: String) -> Option<String> {
    let path = wide(resolve(&target).ok()?.as_os_str());
    // Draw the shell-owned file icon into a top-down, 32-bit DIB.
    unsafe {
        let mut info: SHFILEINFOW = std::mem::zeroed();
        if SHGetFileInfoW(
            path.as_ptr(),
            0,
            &mut info,
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        ) == 0
        {
            return None;
        }
        let dc = CreateCompatibleDC(ptr::null_mut());
        let mut bitmap: BITMAPINFO = std::mem::zeroed();
        bitmap.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bitmap.bmiHeader.biWidth = 32;
        bitmap.bmiHeader.biHeight = -32;
        bitmap.bmiHeader.biPlanes = 1;
        bitmap.bmiHeader.biBitCount = 32;
        let mut bits = ptr::null_mut();
        let dib = CreateDIBSection(dc, &bitmap, DIB_RGB_COLORS, &mut bits, ptr::null_mut(), 0);
        let result = if dib.is_null() || bits.is_null() {
            None
        } else {
            let old = SelectObject(dc, dib);
            DrawIconEx(dc, 0, 0, info.hIcon, 32, 32, 0, ptr::null_mut(), DI_NORMAL);
            GdiFlush();
            let mut rgba = std::slice::from_raw_parts(bits as *const u8, 4096).to_vec();
            for p in rgba.chunks_exact_mut(4) {
                p.swap(0, 2)
            }
            SelectObject(dc, old);
            png(rgba, 32, 32).ok()
        };
        DeleteObject(dib);
        DeleteDC(dc);
        DestroyIcon(info.hIcon);
        result
    }
}

#[tauri::command]
pub async fn open_overlay(app: AppHandle) -> Result<(), String> {
    let win = match app.get_webview_window("overlay") {
        Some(w) => w,
        None => WebviewWindowBuilder::new(
            &app,
            "overlay",
            WebviewUrl::App("index.html?overlay=1".into()),
        )
        .title("Relay Quick Launcher")
        .inner_size(520., 390.)
        .decorations(false)
        .resizable(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?,
    };
    use tauri::Emitter;
    win.emit("launcher-open", ()).map_err(|e| e.to_string())?;
    win.show()
        .and_then(|_| win.set_focus())
        .map_err(|e| e.to_string())
}

pub struct Hotkey(pub std::sync::Mutex<Option<String>>);
#[tauri::command]
pub fn set_hotkey(app: AppHandle, key: String, state: tauri::State<Hotkey>) -> Result<(), String> {
    if !["", "Alt+Space", "Ctrl+Shift+Space", "Ctrl+Alt+K"].contains(&key.as_str()) {
        return Err("Unsupported shortcut".into());
    }
    let mut active = state.0.lock().unwrap();
    if active.as_deref().unwrap_or("") == key {
        return Ok(());
    }
    let manager = app.global_shortcut();
    if !key.is_empty() {
        manager
            .on_shortcut(key.as_str(), |app, _, ev| {
                if ev.state == ShortcutState::Pressed {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move { let _ = open_overlay(handle).await; });
                }
            })
            .map_err(|e| format!("Hotkey unavailable: {e}"))?;
    }
    if let Some(old) = active.take() {
        let _ = manager.unregister(old.as_str());
    }
    if !key.is_empty() {
        *active = Some(key)
    }
    Ok(())
}
