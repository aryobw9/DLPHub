// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod native_cursor;
mod webview_check;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // First-run guidance: if the WebView2 Evergreen Runtime is missing the
    // window would fail silently — show the guided download dialog instead.
    #[cfg(windows)]
    if webview_check::runtime_version().is_none() {
        webview_check::guide_download_and_exit();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Updater: silent-tolerant on 404 (no release yet) — endpoint errors
        // surface only when a check is requested.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Flame cursors on the native resize border (WM_SETCURSOR subclass).
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                native_cursor::install(&win);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::find_game,
            commands::pick_game,
            commands::detect_tier_cmd,
            commands::check_running,
            commands::install_mode,
            commands::do_backup_cmd,
            commands::list_backups,
            commands::delete_backup_cmd,
            commands::do_restore,
            commands::revert_original_cmd,
            commands::get_settings,
            commands::set_settings,
            commands::reset_settings_cmd,
            commands::get_diagnostics,
            commands::launch_game,
            commands::running_from_pkg,
            commands::ping_valve_servers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
