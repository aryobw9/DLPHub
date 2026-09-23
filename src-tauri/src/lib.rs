mod commands;
mod native_cursor;
mod webview_check;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // First-run guidance: if the WebView2 Evergreen Runtime is missing the
    // window would fail silently — show the guided download dialog instead.
    #[cfg(windows)]
    {
        if webview_check::runtime_version().is_none() {
            webview_check::guide_download_and_exit();
        }

        // Optimize WebView2 RAM footprint without disabling any feature:
        // - Cap V8 JS heap to 64MB & optimize for size instead of pre-allocating 1.4GB+
        // - Limit renderer process count to 1
        // - Disable unneeded background services (translation, feed suggestions, domain reliability)
        if std::env::var_os("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_none() {
            std::env::set_var(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                "--js-flags=\"--max-old-space-size=64 --optimize-for-size\" \
                 --renderer-process-limit=1 \
                 --disable-background-networking \
                 --disable-component-update \
                 --disable-domain-reliability \
                 --disable-features=TranslateUI,InterestFeedContentSuggestions,CalculateNativeWinOcclusion \
                 --disable-hang-monitor",
            );
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Flame cursors on the native resize border (WM_SETCURSOR subclass).
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                native_cursor::install(&win);
            }
            let data_dir = dlp_core::settings::data_dir();
            dlp_core::backup::purge_legacy_addon_backups(&data_dir);
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
            commands::check_for_updates,
            commands::open_download_url,
            commands::get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
