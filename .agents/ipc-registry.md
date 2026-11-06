# Tauri IPC Registry & Event Bus Reference

This document is the **authoritative reference** for all Tauri IPC commands and real-time events in DLPBooster. Every command listed here is registered in [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) and exposed to the frontend.

## Tauri IPC Commands Table (84 Commands)

| Command Name | Rust Handler Path | State / Dependencies Used | Frontend Caller(s) | 1-Line Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `find_game` | [`find_game`](../src-tauri/src/commands.rs#L20) | None (Stateless/Global) | `ui/app.js:487` | Auto-detects Deadlock game install directory across Steam library drives and registry. |
| `pick_game` | [`pick_game`](../src-tauri/src/commands.rs#L25) | None (Stateless/Global) | `ui/app.js:493`<br>`ui/app.js:544` | Validates and sets a custom Deadlock game directory picked by user. |
| `detect_tier_cmd` | [`detect_tier_cmd`](../src-tauri/src/commands.rs#L31) | None (Stateless/Global) | `ui/app.js:600` | Benchmarks/detects system hardware tier (Low, Medium, High, Ultra) to suggest graphics preset. |
| `check_running` | [`check_running`](../src-tauri/src/commands.rs#L43) | None (Stateless/Global) | `ui/app.js:511`<br>`ui/app.js:942`<br>`ui/app.js:1089`<br>+2 more | Checks if Deadlock (`deadlock.exe`) process is currently running. |
| `install_mode` | [`install_mode`](../src-tauri/src/commands.rs#L49) | tauri::AppHandle | *Direct / Internal CLI* | Applies graphics preset mode (Competitive, Ultra, etc.) and patches game video/cvar configs. |
| `do_backup_cmd` | [`do_backup_cmd`](../src-tauri/src/commands.rs#L220) | None (Stateless/Global) | `ui/app.js:1018` | Creates a timestamped backup of the current Deadlock configuration, gameinfo, and cvars. |
| `list_backups` | [`list_backups`](../src-tauri/src/commands.rs#L231) | None (Stateless/Global) | `ui/app.js:1040` | Lists all available config and addon backups stored in app data. |
| `delete_backup_cmd` | [`delete_backup_cmd`](../src-tauri/src/commands.rs#L243) | None (Stateless/Global) | `ui/app.js:1127` | Permanently deletes a specified backup archive by ID. |
| `do_restore` | [`do_restore`](../src-tauri/src/commands.rs#L275) | None (Stateless/Global) | `ui/app.js:1102` | Restores Deadlock configs and files from a specified backup archive. |
| `revert_original_cmd` | [`revert_original_cmd`](../src-tauri/src/commands.rs#L295) | None (Stateless/Global) | `ui/app.js:1524` | Reverts all patches, restoring Deadlock to pure vanilla game files. |
| `get_settings` | [`get_settings`](../src-tauri/src/commands.rs#L386) | None (Stateless/Global) | `ui/app.js:277` | Reads current DLPBooster application settings (language, FOV, paths, FPS). |
| `set_settings` | [`set_settings`](../src-tauri/src/commands.rs#L391) | None (Stateless/Global) | `ui/app.js:222`<br>`ui/app.js:429`<br>`ui/app.js:438`<br>+11 more | Saves updated DLPBooster user settings to JSON storage. |
| `reset_settings_cmd` | [`reset_settings_cmd`](../src-tauri/src/commands.rs#L444) | None (Stateless/Global) | `ui/app.js:1362` | Resets application settings to clean factory defaults. |
| `get_diagnostics` | [`get_diagnostics`](../src-tauri/src/commands.rs#L451) | None (Stateless/Global) | `ui/app.js:1392` | Collects system info, Deadlock path verification, and graphics hardware diagnostic report. |
| `launch_game` | [`launch_game`](../src-tauri/src/commands.rs#L606) | open | `ui/app.js:1568` | Launches Deadlock via Steam URL protocol (`steam://rungameid/1422450`). |
| `running_from_pkg` | [`running_from_pkg`](../src-tauri/src/commands.rs#L618) | None (Stateless/Global) | `ui/app.js:302` | Checks whether the application executable is running unpacked or from a package. |
| `ping_valve_servers` | [`ping_valve_servers`](../src-tauri/src/commands.rs#L787) | None (Stateless/Global) | *Direct / Internal CLI* | Sends ICMP/UDP pings to Valve Deadlock match routing datacenters. |
| `check_admin_status` | [`check_admin_status`](../src-tauri/src/commands.rs#L855) | latency | `ui/app.js:2660` | Checks if the current DLPBooster process has Windows Administrator elevation. |
| `check_firewall_status` | [`check_firewall_status`](../src-tauri/src/commands.rs#L860) | latency | `ui/app.js:2707` | Queries Windows Firewall to check if Deadlock inbound/outbound rules are active. |
| `enable_firewall_cmd` | [`enable_firewall_cmd`](../src-tauri/src/commands.rs#L865) | latency | `ui/app.js:2726` | Adds Deadlock and server ports to Windows Defender Firewall rules. |
| `restart_as_admin` | [`restart_as_admin`](../src-tauri/src/commands.rs#L872) | latency | `ui/app.js:2691` | Relaunches DLPBooster with Windows UAC Administrator prompt (`runas`). |
| `get_valve_clusters` | [`get_valve_clusters`](../src-tauri/src/commands.rs#L887) | latency | `ui/app.js:3739` | Returns the complete list of known Valve SDR datacenter clusters and geo-locations. |
| `ping_valve_clusters` | [`ping_valve_clusters`](../src-tauri/src/commands.rs#L918) | latency | `ui/app.js:2781` | Measures real-time latency and jitter across all Valve SDR datacenter relays. |
| `deep_benchmark_clusters_cmd` | [`deep_benchmark_clusters_cmd`](../src-tauri/src/commands.rs#L925) | latency | `ui/app.js:2860` | Executes high-accuracy multi-packet latency benchmark on selected clusters. |
| `toggle_cluster_block` | [`toggle_cluster_block`](../src-tauri/src/commands.rs#L933) | latency | `ui/app.js:2969` | Blocks or unblocks a specific Valve SDR cluster using Windows Firewall routing rules. |
| `apply_top5_clusters` | [`apply_top5_clusters`](../src-tauri/src/commands.rs#L950) | latency | `ui/app.js:3024`<br>`ui/app.js:3065`<br>`ui/app.js:3431` | Blocks all Valve clusters except the top 5 lowest-latency clusters for the player. |
| `unblock_all_clusters` | [`unblock_all_clusters`](../src-tauri/src/commands.rs#L959) | latency | `ui/app.js:3085`<br>`ui/app.js:3507` | Removes all cluster firewall blocks, restoring unrestricted global matchmaking. |
| `apply_cluster_preset_cmd` | [`apply_cluster_preset_cmd`](../src-tauri/src/commands.rs#L966) | latency | `ui/app.js:3250` | Applies a predefined regional cluster blocking preset (e.g. EU only, Middle East only). |
| `get_dns_profiles` | [`get_dns_profiles`](../src-tauri/src/commands.rs#L975) | latency | `ui/app.js:3743` | Returns list of curated gaming and privacy DNS profiles (Cloudflare, Google, Electro, Shecan). |
| `ping_dns_profiles` | [`ping_dns_profiles`](../src-tauri/src/commands.rs#L1002) | latency | `ui/app.js:2782` | Benchmarks latency to primary/secondary DNS servers across profiles. |
| `deep_benchmark_dns_cmd` | [`deep_benchmark_dns_cmd`](../src-tauri/src/commands.rs#L1009) | latency | `ui/app.js:2861` | Executes detailed DNS resolution time benchmark across all profiles. |
| `apply_dns_profile` | [`apply_dns_profile`](../src-tauri/src/commands.rs#L1017) | latency | `ui/app.js:3324`<br>`ui/app.js:3417` | Applies selected DNS profile to active Windows network adapters via netsh/WMI. |
| `reset_dns_dhcp` | [`reset_dns_dhcp`](../src-tauri/src/commands.rs#L1032) | latency | `ui/app.js:3341`<br>`ui/app.js:3515` | Reverts adapter DNS configuration to automatic DHCP from router. |
| `flush_dns_cmd` | [`flush_dns_cmd`](../src-tauri/src/commands.rs#L1039) | latency | `ui/app.js:3356`<br>`ui/app.js:3523` | Flushes Windows local DNS resolver cache (`ipconfig /flushdns`). |
| `apply_latency_tweaks_cmd` | [`apply_latency_tweaks_cmd`](../src-tauri/src/commands.rs#L1046) | latency | `ui/app.js:3591` | Applies Windows network/kernel latency tweaks (Nagle disabled, NetworkThrottlingIndex). |
| `revert_latency_tweaks_cmd` | [`revert_latency_tweaks_cmd`](../src-tauri/src/commands.rs#L1056) | latency | `ui/app.js:3618` | Restores Windows network and registry settings to default values. |
| `check_for_updates` | [`check_for_updates`](../src-tauri/src/commands.rs#L539) | reqwest, tauri::AppHandle | `ui/app.js:321`<br>`ui/app.js:1299` | Checks GitHub releases API for newer DLPBooster versions. |
| `open_download_url` | [`open_download_url`](../src-tauri/src/commands.rs#L581) | open | `ui/app.js:330`<br>`ui/app.js:1324` | Opens the download URL or releases page in the default web browser. |
| `open_logs_folder` | [`open_logs_folder`](../src-tauri/src/commands.rs#L590) | open | `ui/app.js:2017` | Opens the application crash and error log folder in Windows File Explorer. |
| `log_client_error` | [`log_client_error`](../src-tauri/src/commands.rs#L598) | open | `ui/app.js:1887` | Appends a frontend JavaScript error or exception to backend persistent log file. |
| `get_app_version` | [`get_app_version`](../src-tauri/src/commands.rs#L495) | tauri::AppHandle | `ui/app.js:307` | Returns the current semantic version string of DLPBooster. |
| `get_cvar_test_states` | [`get_cvar_test_states`](../src-tauri/src/commands.rs#L1104) | None (Stateless/Global) | `ui/app.js:2129` | Reads active test convar override flags for graphics debugging. |
| `apply_cvar_test_states` | [`apply_cvar_test_states`](../src-tauri/src/commands.rs#L1122) | None (Stateless/Global) | `ui/app.js:2239` | Writes test convar overrides directly into Deadlock game engine. |
| `sync_last_match` | [`sync_last_match`](../src-tauri/src/deadlock_sync.rs#L67) | None (Stateless/Global) | `ui/app.js:1430` | Parses latest Deadlock match replay / telemetry to sync match ID and stats. |
| `get_last_match_id` | [`get_last_match_id`](../src-tauri/src/deadlock_sync.rs#L59) | None (Stateless/Global) | *Direct / Internal CLI* | Reads the most recently played match ID stored on disk. |
| `get_lan_local_ips` | [`get_lan_local_ips`](../src-tauri/src/commands.rs#L1244) | lan_supervisor | `ui/app.js:4454` | Enumerates local IPv4 network adapter addresses for LAN hosting. |
| `start_lan_server` | [`start_lan_server`](../src-tauri/src/commands.rs#L1249) | lan_supervisor | `ui/app.js:4980` | Launches Deadlock dedicated server console subprocess (`deadlock.exe` / Deadworks). |
| `stop_lan_server` | [`stop_lan_server`](../src-tauri/src/commands.rs#L1254) | lan_supervisor | `ui/app.js:4850`<br>`ui/app.js:5018` | Terminates the running Deadlock dedicated server and cleans up resources. |
| `get_lan_server_status` | [`get_lan_server_status`](../src-tauri/src/commands.rs#L1259) | lan_supervisor | `ui/app.js:4486`<br>`ui/app.js:5191` | Polls real-time state, player count, and uptime of the local dedicated server. |
| `connect_lan_client` | [`connect_lan_client`](../src-tauri/src/commands.rs#L1264) | lan_supervisor | *Direct / Internal CLI* | Launches game client and issues console connect command to target LAN IP:port. |
| `list_lan_matches` | [`list_lan_matches`](../src-tauri/src/commands.rs#L1269) | lan_supervisor | *Direct / Internal CLI* | Scans local subnet or broadcasts for active LAN matches. |
| `get_lan_match_metadata` | [`get_lan_match_metadata`](../src-tauri/src/commands.rs#L1274) | lan_supervisor | *Direct / Internal CLI* | Retrieves details (map, players, mode, server version) of a discovered LAN match. |
| `send_lan_server_command` | [`send_lan_server_command`](../src-tauri/src/commands.rs#L1284) | lan_supervisor, lan_vip | `ui/app.js:4628`<br>`ui/app.js:5068`<br>`ui/app.js:8423` | Sends an admin/rcon console command to the running dedicated server (VConsole2). |
| `get_lan_lobby_status` | [`get_lan_lobby_status`](../src-tauri/src/commands.rs#L1289) | lan_supervisor, lan_vip | `ui/app.js:4583` | Fetches current roster and status of the active LAN lobby. |
| `query_lan_server` | [`query_lan_server`](../src-tauri/src/commands.rs#L1294) | lan_vip | `ui/app.js:5458` | Performs Valve A2S_INFO query to retrieve live server status and latency. |
| `create_vip_room_cmd` | [`create_vip_room_cmd`](../src-tauri/src/commands.rs#L1299) | lan_vip | `ui/app.js:5547` | Creates a private dedicated room on Iran VPS coordinator with room code. |
| `join_vip_room_cmd` | [`join_vip_room_cmd`](../src-tauri/src/commands.rs#L1315) | lan_vip | `ui/app.js:5623` | Joins a private room using a 6-digit room code and establishes VPN/relay link. |
| `get_vip_room_status_cmd` | [`get_vip_room_status_cmd`](../src-tauri/src/commands.rs#L1325) | lan_vip | `ui/app.js:5221`<br>`ui/app.js:5669` | Polls real-time peer roster, ping, and status of active VIP room from VPS. |
| `leave_vip_room_cmd` | [`leave_vip_room_cmd`](../src-tauri/src/commands.rs#L1333) | lan_vip | `ui/app.js:4844` | Leaves current VIP room and shuts down peer VPN tunnel / relay connection. |
| `kick_vip_peer_cmd` | [`kick_vip_peer_cmd`](../src-tauri/src/commands.rs#L1341) | lan_vip | `ui/app.js:5260` | Host kicks a peer player from the VIP room by peer ID. |
| `ban_vip_peer_cmd` | [`ban_vip_peer_cmd`](../src-tauri/src/commands.rs#L1350) | lan_supervisor, lan_vip | `ui/app.js:5271` | Host bans a peer player from the VIP room by HWID / peer ID. |
| `unban_vip_peer_cmd` | [`unban_vip_peer_cmd`](../src-tauri/src/commands.rs#L1359) | lan_supervisor, lan_vip | *Direct / Internal CLI* | Host unbans a previously banned player from the VIP room. |
| `list_vip_rooms_cmd` | [`list_vip_rooms_cmd`](../src-tauri/src/commands.rs#L1368) | lan_supervisor, lan_vip, storage, dlp_core::discovery | `ui/app.js:5752` | Retrieves list of public / unhidden VIP rooms from the VPS coordinator. |
| `prepare_modded_client_cmd` | [`prepare_modded_client_cmd`](../src-tauri/src/commands.rs#L1375) | lan_supervisor, storage, dlp_core::discovery | `ui/app.js:4807` | Prepares and links Deadworks custom mods/assets into game client directory. |
| `setup_host_server_env_cmd` | [`setup_host_server_env_cmd`](../src-tauri/src/commands.rs#L1380) | lan_supervisor, storage, dlp_core::discovery | `ui/app.js:5344` | Sets up dedicated server directory, addons, gameinfo, and launch script. |
| `close_deadlock_game_cmd` | [`close_deadlock_game_cmd`](../src-tauri/src/commands.rs#L1385) | lan_supervisor, storage, dlp_core::discovery | `ui/app.js:5320` | Force-terminates running Deadlock game processes to allow file patching. |
| `is_deadlock_running_cmd` | [`is_deadlock_running_cmd`](../src-tauri/src/commands.rs#L1391) | lan_supervisor, storage, dlp_core::discovery | `ui/app.js:4881`<br>`ui/app.js:4894`<br>`ui/app.js:5055` | Quick boolean check whether `deadlock.exe` is currently running. |
| `restore_vanilla_client_cmd` | [`restore_vanilla_client_cmd`](../src-tauri/src/commands.rs#L1396) | lan_supervisor, storage, dlp_core::discovery | `ui/app.js:4838`<br>`ui/app.js:5019`<br>`ui/app.js:5900` | Restores client `gameinfo.gi` and wipes all deployed server/mod files. |
| `auto_join_deadlock_cmd` | [`auto_join_deadlock_cmd`](../src-tauri/src/commands.rs#L1406) | lan_supervisor, storage, dlp_core::discovery | `ui/app.js:4885`<br>`ui/app.js:4914`<br>`ui/app.js:5060` | Automates game launch with `+connect` arguments to directly join room server. |
| `check_deadworks_env_cmd` | [`check_deadworks_env_cmd`](../src-tauri/src/commands.rs#L1416) | lan_vip, storage, dlp_core::discovery | `ui/app.js:4798`<br>`ui/app.js:4808` | Verifies existence and checksums of Deadworks server binaries in app data. |
| `check_vip_binaries_cmd` | [`check_vip_binaries_cmd`](../src-tauri/src/commands.rs#L1446) | lan_supervisor, lan_vip, storage, hwid | `ui/app.js:5525` | Checks whether Wintun driver and VPN binaries are properly installed. |
| `launch_deadlock_target_cmd` | [`launch_deadlock_target_cmd`](../src-tauri/src/commands.rs#L1451) | lan_supervisor, lan_vip, storage, hwid | *Direct / Internal CLI* | Launches Deadlock with custom launch options, resolution, and console args. |
| `redeem_vip_key_cmd` | [`redeem_vip_key_cmd`](../src-tauri/src/commands.rs#L1456) | lan_vip, storage, hwid | `ui/app.js:4343`<br>`ui/app.js:4371` | Validates and redeems a VIP subscription key with the licensing server. |
| `check_vip_status_cmd` | [`check_vip_status_cmd`](../src-tauri/src/commands.rs#L1465) | lan_vip, storage, hwid | `ui/app.js:4279` | Queries licensing server to check user's VIP subscription tier and expiry. |
| `get_machine_hwid_cmd` | [`get_machine_hwid_cmd`](../src-tauri/src/commands.rs#L1472) | storage, hwid | `ui/app.js:4272` | Calculates unique machine hardware ID (CPU, motherboard, disk hash). |
| `get_mod_cache_status_cmd` | [`get_mod_cache_status_cmd`](../src-tauri/src/commands.rs#L106) | mod_cache, dlp_core::perf_overlay | `ui/app.js:1149` | Returns download and cache status for modded game assets. |
| `clear_mod_cache_cmd` | [`clear_mod_cache_cmd`](../src-tauri/src/commands.rs#L111) | mod_cache, dlp_core::perf_overlay | `ui/app.js:1216` | Clears downloaded mod cache to free disk space or force re-download. |
| `apply_perf_optimization_cmd` | [`apply_perf_optimization_cmd`](../src-tauri/src/commands.rs#L116) | mod_cache, dlp_core::perf_overlay, tauri::AppHandle | `ui/app.js:976` | Applies custom engine convar performance overlay tweaks to video configs. |
| `revert_perf_optimization_cmd` | [`revert_perf_optimization_cmd`](../src-tauri/src/commands.rs#L154) | dlp_core::perf_overlay | `ui/app.js:6972` | Reverts performance overlay convar optimizations back to standard. |
| `detect_perf_optimization_cmd` | [`detect_perf_optimization_cmd`](../src-tauri/src/commands.rs#L161) | dlp_core::perf_overlay | `ui/app.js:6954` | Detects if performance optimization convar overrides are currently active. |
| `apply_fov_only_cmd` | [`apply_fov_only_cmd`](../src-tauri/src/commands.rs#L167) | dlp_core::perf_overlay | `ui/app.js:7011` | Surgically modifies Deadlock camera field of view in game config files. |
| `apply_fps_only_cmd` | [`apply_fps_only_cmd`](../src-tauri/src/commands.rs#L185) | dlp_core::perf_overlay | `ui/app.js:7037` | Surgically updates Deadlock FPS limit (`fps_max`) in game config files. |
| `get_storage_path_cmd` | [`get_storage_path_cmd`](../src-tauri/src/commands.rs#L1477) | storage | *Direct / Internal CLI* | Returns the absolute path to the DLPBooster local application data directory. |
| `ensure_server_loader_cmd` | [`ensure_server_loader_cmd`](../src-tauri/src/commands.rs#L1482) | storage, tauri::AppHandle | *Direct / Internal CLI* | Verifies and downloads Deadworks server package if not already cached. |

---

## Event Bus Table

| Event Name | Emitter (Rust File & Line) | Payload Struct / Type | Listener (Frontend File & Line) | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `mod-download-progress` | [`src-tauri/src/mod_cache.rs:232,242,257,280`](../src-tauri/src/mod_cache.rs#L232) | `ModDownloadProgressEvent { mod_id: String, stage: String, progress_pct: u8, speed_kbps: u64, error: Option<String> }` | [`ui/app.js:1257`](../ui/app.js#L1257) | Emits real-time progress, speed (KB/s), and stages (downloading, extracting) during mod downloads. |
| `server-loader-progress` | [`src-tauri/src/storage.rs:215,277,289,311`](../src-tauri/src/storage.rs#L215) | `ServerLoaderProgressEvent { stage: String, progress_pct: u8, speed_kbps: u64, error: Option<String> }` | [`ui/app.js:1260`](../ui/app.js#L1260) | Emits progress and download status while fetching the Deadworks server package. |
