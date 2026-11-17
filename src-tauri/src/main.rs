#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod monitor;
mod shortcuts;
mod storage;
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(monitor::Monitor::start())
        .manage(shortcuts::Hotkey(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            monitor::telemetry,
            monitor::set_interval,
            storage::load_config,
            storage::save_config,
            storage::import_config,
            storage::export_config,
            shortcuts::launch_shortcut,
            shortcuts::pick_app,
            shortcuts::pick_icon,
            shortcuts::app_icon,
            shortcuts::open_overlay,
            shortcuts::set_hotkey
        ])
        .on_window_event(|w, e| {
            if w.label() == "main" && matches!(e, tauri::WindowEvent::Destroyed) {
                use tauri::Manager;
                w.app_handle().exit(0)
            }
        })
        .run(tauri::generate_context!())
        .expect("Relay could not start");
}
