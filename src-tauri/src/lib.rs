mod commands;
mod deadlock_sync;
mod hwid;
mod lan_proxy;
mod lan_query;
mod lan_engine;
mod lan_relay;
mod lan_supervisor;
mod lan_vip;
mod latency;
mod mod_cache;
mod native_cursor;
pub mod storage;

/// Global safe shutdown handler: stops server, terminates VPN tunnels, and wipes all custom mods
pub fn perform_safe_shutdown_cleanup() {
    static CLEANED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if CLEANED.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return;
    }

    println!("[shutdown] Performing safe application shutdown...");

    // 1. Stop dedicated server and proxy if running
    let _ = crate::lan_supervisor::stop_dedicated_server();

    // 2. Stop VPN / relay / tunnels
    crate::lan_engine::stop_lan_engine();
    crate::lan_relay::stop_relay();

    // 3. Clean custom game mode mods and restore vanilla gameinfo
    crate::storage::clean_all_mods_and_restore_vanilla();

    println!("[shutdown] Safe shutdown cleanup completed.");
}

#[cfg(windows)]
fn register_console_ctrl_handler() {
    unsafe extern "system" fn handler(_ctrl_type: u32) -> i32 {
        crate::perform_safe_shutdown_cleanup();
        0 // FALSE: continue to default exit handler
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn SetConsoleCtrlHandler(
            handler_routine: Option<unsafe extern "system" fn(u32) -> i32>,
            add: i32,
        ) -> i32;
    }

    unsafe {
        let _ = SetConsoleCtrlHandler(Some(handler), 1);
    }
}
mod webview_check;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // First-run guidance: if the WebView2 Evergreen Runtime is missing the
    // window would fail silently — show the guided download dialog instead.
    #[cfg(windows)]
    {
        register_console_ctrl_handler();
        webview_check::ensure_embedded_dlls();

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

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                perform_safe_shutdown_cleanup();
            }
        })
        // Flame cursors on the native resize border (WM_SETCURSOR subclass).
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                native_cursor::install(&win);
            }
            let data_dir = dlp_core::settings::data_dir();
            dlp_core::backup::purge_legacy_addon_backups(&data_dir);

            // Startup Auto-Recovery: if a previous run crashed or was force-closed
            // while custom mods were deployed, cleanly restore vanilla gameinfo & files.
            crate::storage::clean_all_mods_and_restore_vanilla();
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
            commands::check_admin_status,
            commands::check_firewall_status,
            commands::enable_firewall_cmd,
            commands::restart_as_admin,
            commands::get_valve_clusters,
            commands::ping_valve_clusters,
            commands::deep_benchmark_clusters_cmd,
            commands::toggle_cluster_block,
            commands::apply_top5_clusters,
            commands::unblock_all_clusters,
            commands::apply_cluster_preset_cmd,
            commands::get_dns_profiles,
            commands::ping_dns_profiles,
            commands::deep_benchmark_dns_cmd,
            commands::apply_dns_profile,
            commands::reset_dns_dhcp,
            commands::flush_dns_cmd,
            commands::apply_latency_tweaks_cmd,
            commands::revert_latency_tweaks_cmd,
            commands::check_for_updates,
            commands::open_download_url,
            commands::open_logs_folder,
            commands::log_client_error,
            commands::get_app_version,
            commands::get_cvar_test_states,
            commands::apply_cvar_test_states,
            deadlock_sync::sync_last_match,
            deadlock_sync::get_last_match_id,
            commands::get_lan_local_ips,
            commands::start_lan_server,
            commands::stop_lan_server,
            commands::get_lan_server_status,
            commands::connect_lan_client,
            commands::list_lan_matches,
            commands::get_lan_match_metadata,
            commands::send_lan_server_command,
            commands::get_lan_lobby_status,
            commands::query_lan_server,
            commands::create_vip_room_cmd,
            commands::join_vip_room_cmd,
            commands::get_vip_room_status_cmd,
            commands::leave_vip_room_cmd,
            commands::kick_vip_peer_cmd,
            commands::ban_vip_peer_cmd,
            commands::unban_vip_peer_cmd,
            commands::list_vip_rooms_cmd,
            commands::prepare_modded_client_cmd,
            commands::setup_host_server_env_cmd,
            commands::close_deadlock_game_cmd,
            commands::is_deadlock_running_cmd,
            commands::restore_vanilla_client_cmd,
            commands::auto_join_deadlock_cmd,
            commands::check_deadworks_env_cmd,
            commands::check_vip_binaries_cmd,
            commands::launch_deadlock_target_cmd,
            commands::redeem_vip_key_cmd,
            commands::check_vip_status_cmd,
            commands::get_machine_hwid_cmd,
            commands::get_mod_cache_status_cmd,
            commands::clear_mod_cache_cmd,
            commands::apply_perf_optimization_cmd,
            commands::revert_perf_optimization_cmd,
            commands::detect_perf_optimization_cmd,
            commands::apply_fov_only_cmd,
            commands::apply_fps_only_cmd,
            commands::get_storage_path_cmd,
            commands::ensure_server_loader_cmd,
        ])
        ;

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                perform_safe_shutdown_cleanup();
            }
            _ => {}
        }
    });
}
