# Backend Architecture Map: Rust Core (`src-tauri` & `dlp-core`)

This document is the authoritative structural map of DLPBooster's Rust backend. All paths are exact relative paths from the repository root.

---

## 1. Entry & Application Lifecycle

### Entry Points
- **Executable Entry:** [`src-tauri/src/main.rs`](../src-tauri/src/main.rs)
  Calls `tauri_app_lib::run()` (defined in `lib.rs`).
- **Core Library & Builder:** [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
  Configures plugins, window setup hooks, IPC handlers, safe shutdown handlers, and the main event loop.

### Lifecycle Sequence & Hooks
1. **Pre-Window Bootstrap (`lib.rs:run()`):**
   - `register_console_ctrl_handler()`: Installs a Windows console control handler via Win32 `SetConsoleCtrlHandler` to intercept `CTRL_C_EVENT`, `CTRL_BREAK_EVENT`, and `CTRL_CLOSE_EVENT`.
   - `webview_check::ensure_embedded_dlls()`: Extracts embedded WebView2 / VC runtime helper binaries if missing.
   - `webview_check::runtime_version()`: Verifies that Microsoft Edge WebView2 Evergreen Runtime is installed; calls `webview_check::guide_download_and_exit()` if absent.
   - **WebView2 RAM Optimization:** Sets `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` to:
     - Cap V8 heap to 64MB (`--max-old-space-size=64 --optimize-for-size`)
     - Limit renderer process count to 1 (`--renderer-process-limit=1`)
     - Disable telemetry, background networking, and unneeded Chromium services.
2. **Setup Hook (`builder.setup()`):**
   - `native_cursor::install(&win)`: Subclasses the native Win32 `HWND` for the `main` window to render custom animated flame resize cursors via `WM_SETCURSOR`.
   - `dlp_core::backup::purge_legacy_addon_backups(&data_dir)`: Cleans out deprecated backup formats.
   - `storage::clean_all_mods_and_restore_vanilla()`: **Crash Recovery:** If the app crashed or was force-closed while custom mods were deployed, this automatically restores vanilla `gameinfo.gi` and deletes active mod symlinks/files.
3. **Safe Shutdown Protocol (`perform_safe_shutdown_cleanup()`):**
   - Protected by `static CLEANED: AtomicBool` to guarantee idempotency across window close, CTRL+C, or OS shutdown.
   - **Step 1:** Stops dedicated server and local proxy via `lan_supervisor::stop_dedicated_server()`.
   - **Step 2:** Shuts down P2P Wintun tunnel and UDP relay via `lan_engine::stop_lan_engine()` and `lan_relay::stop_relay()`.
   - **Step 3:** Restores vanilla `gameinfo.gi` and wipes custom mod staging via `storage::clean_all_mods_and_restore_vanilla()`.

---

## 2. Managed State & Concurrency Model

> [!NOTE]
> DLPBooster does **not** use `tauri::State` via `.manage(...)`. To facilitate zero-cost access across asynchronous tokio tasks, Win32 event hooks, and Tauri commands, all shared state is maintained via thread-safe static globals and synchronization primitives.

| Module | Global Variable | Concurrency Primitive | Description / Owned State |
| :--- | :--- | :--- | :--- |
| [`src-tauri/src/lan_supervisor.rs`](../src-tauri/src/lan_supervisor.rs) | `DEDICATED_PROCESS` | `std::sync::Mutex<Option<Child>>` | Active `deadlock.exe` dedicated server console subprocess handle. |
| [`src-tauri/src/lan_supervisor.rs`](../src-tauri/src/lan_supervisor.rs) | `RUNNING_STATUS` | `std::sync::Mutex<LanServerStatus>` | Current dedicated server runtime metadata, player count, and uptime. |
| [`src-tauri/src/lan_supervisor.rs`](../src-tauri/src/lan_supervisor.rs) | `PROXY_HANDLE` | `std::sync::Mutex<Option<ProxyHandle>>` | A2S and UDP proxy bridge handle forwarding between client and server. |
| [`src-tauri/src/lan_engine.rs`](../src-tauri/src/lan_engine.rs) | `ENGINE_HANDLE` | `std::sync::Mutex<Option<LanEngineHandle>>` | Active Wintun virtual network adapter and P2P mesh tunnel state. |
| [`src-tauri/src/lan_engine.rs`](../src-tauri/src/lan_engine.rs) | `CLIENT_RUNNING` | `std::sync::atomic::AtomicBool` | Flag indicating whether the client mesh VPN tunnel is active. |
| [`src-tauri/src/lan_relay.rs`](../src-tauri/src/lan_relay.rs) | `RELAY_ACTIVE` | `std::sync::atomic::AtomicBool` | Flag indicating whether driverless high-speed UDP relay is running. |
| [`src-tauri/src/lan_relay.rs`](../src-tauri/src/lan_relay.rs) | `RELAY_TASK` | `std::sync::Mutex<Option<JoinHandle<()>>>` | Background Tokio task handle executing the UDP relay packet loop. |
| [`src-tauri/src/storage.rs`](../src-tauri/src/storage.rs) | `ACTIVE_SESSION_MODS` | `std::sync::Mutex<Option<String>>` | Identifier of the currently deployed custom game mode / mod pack. |
| [`src-tauri/src/storage.rs`](../src-tauri/src/storage.rs) | `MANIFEST_CACHE` | `std::sync::Mutex<Option<DeadworksManifest>>` | Cached Deadworks server/mod manifest. |
| [`src-tauri/src/mod_cache.rs`](../src-tauri/src/mod_cache.rs) | `CACHE_LOCK` | `tokio::sync::Mutex<()>` | Asynchronous lock preventing concurrent mod downloads/extractions. |
| [`src-tauri/src/latency.rs`](../src-tauri/src/latency.rs) | `BLOCKED_CLUSTERS` | `std::sync::RwLock<HashSet<String>>` | Cached set of currently blocked Valve SDR clusters. |
| [`src-tauri/src/latency.rs`](../src-tauri/src/latency.rs) | `SYSTEM_TWEAKS_BACKUP` | `std::sync::Mutex<Option<LatencyTweaksState>>` | Snapshot of original network registry settings before latency tweaks. |
| [`src-tauri/src/native_cursor.rs`](../src-tauri/src/native_cursor.rs) | `CURSORS` | `std::sync::OnceLock<Cursors>` | Win32 `HCURSOR` handles for custom animated flame resize cursors. |
| [`src-tauri/src/native_cursor.rs`](../src-tauri/src/native_cursor.rs) | `ORIGINAL_WNDPROC` | `std::sync::atomic::AtomicIsize` | Original Win32 window procedure pointer for the main window. |

---

## 3. Module Directory by Domain

### Main Application Layer (`src-tauri/src/`)

#### Orchestration & System Bridge
- **[`commands.rs`](../src-tauri/src/commands.rs):**
  - **Structs:** `FoundDto`, `BackupInfo`, `RestoreReportDto`, `SettingsDto`, `SettingsPatch`.
  - **Functions (82):** Primary IPC command handlers bridging `ui/app.js` to `dlp-core` and networking modules.
- **[`lib.rs`](../src-tauri/src/lib.rs):**
  - **Functions:** `perform_safe_shutdown_cleanup()`, `register_console_ctrl_handler()`, `run()`.
- **[`main.rs`](../src-tauri/src/main.rs):**
  - Minimal binary wrapper calling `dlpbooster_lib::run()`.
- **[`hwid.rs`](../src-tauri/src/hwid.rs):**
  - **Functions:** `get_hardware_id()`, `compute_machine_hash()`. Computes a stable machine identifier from CPU, motherboard, and disk serials.
- **[`native_cursor.rs`](../src-tauri/src/native_cursor.rs):**
  - **Structs:** `Cursors`, Win32 geometry structs (`POINT`, `RECT`, `MONITORINFO`).
  - **Functions:** `install(window: &WebviewWindow)`. Subclasses window procedure for flame cursors on resize borders.
- **[`webview_check.rs`](../src-tauri/src/webview_check.rs):**
  - **Functions:** `runtime_version()`, `ensure_embedded_dlls()`, `guide_download_and_exit()`.

#### LAN & Dedicated Server Networking
- **[`lan_supervisor.rs`](../src-tauri/src/lan_supervisor.rs):**
  - **Structs:** `LocalIpInfo`, `LanHostConfig`, `LanServerStatus`, `ServerRuntime`.
  - **Functions:** `start_dedicated_server()`, `stop_dedicated_server()`, `send_console_command()`, `get_local_ips()`.
- **[`lan_engine.rs`](../src-tauri/src/lan_engine.rs):**
  - **Structs:** `LanEngineHandle`.
  - **Functions:** `start_lan_engine()`, `stop_lan_engine()`, `is_lan_running()`. Manages Wintun mesh adapter and P2P encryption.
- **[`lan_proxy.rs`](../src-tauri/src/lan_proxy.rs):**
  - **Structs:** `ProxyConfig`, `ProxyHandle`, `ClientSession`.
  - **Functions:** `start_proxy()`, `stop_proxy()`. Directs local UDP traffic to dedicated server ports.
- **[`lan_query.rs`](../src-tauri/src/lan_query.rs):**
  - **Structs:** `A2SServerInfo`.
  - **Functions:** `query_server_a2s()`. Sends Valve Source Engine A2S_INFO query packets over UDP.
- **[`lan_relay.rs`](../src-tauri/src/lan_relay.rs):**
  - **Functions:** `start_relay()`, `stop_relay()`. Handles users connecting via fallback relay servers without Wintun drivers.
- **[`lan_vip.rs`](../src-tauri/src/lan_vip.rs):**
  - **Structs:** `VipSession`, `VipCreateResponse`, `VipJoinResponse`, `VipStatusResponse`.
  - **Functions:** `create_room()`, `join_room()`, `leave_room()`, `get_status()`, `kick_peer()`, `ban_peer()`. Communicates with Iran VPS room coordinator.

#### Storage, Modding & Asset Management
- **[`storage.rs`](../src-tauri/src/storage.rs):**
  - **Structs:** `ServerLoaderProgressEvent`, `PackageMeta`, `DeadworksManifest`.
  - **Functions:** `deploy_deadworks_server()`, `deploy_custom_mode()`, `clean_all_mods_and_restore_vanilla()`, `ensure_server_package()`.
- **[`mod_cache.rs`](../src-tauri/src/mod_cache.rs):**
  - **Structs:** `ModMeta`, `ModStatusDto`, `ModDownloadProgressEvent`.
  - **Functions:** `ensure_mod_downloaded()`, `clear_cache()`, `get_cache_status()`.
  - **Verified Addons:** `pak01_dir.vpk` (Brightness), `pak02_dir.vpk` (Clutter), `pak03_dir.vpk` (Breakables), `pak04_dir.vpk` (Essential Fixes), `pak05_dir.vpk` (Anti Clutter), `pak06_dir.vpk` (Doorman Portal Fix), `pak31_dir.vpk` (Potato Textures), `pak33_dir.vpk` (Hero Potato).

#### Optimization & Telemetry
- **[`latency.rs`](../src-tauri/src/latency.rs):**
  - **Structs:** `ValveCluster`, `RawClusterDef`, `DnsProfile`, `LatencyTweaksState`.
  - **Functions:** `ping_clusters()`, `block_cluster()`, `apply_top5()`, `apply_dns()`, `apply_system_tweaks()`, `revert_system_tweaks()`.
- **[`deadlock_sync.rs`](../src-tauri/src/deadlock_sync.rs):**
  - **Structs:** `MatchSyncResult`, `MatchWebhookPayload`.
  - **Functions:** `sync_match()`, `read_last_match_id()`. Reads match telemetry files to track player stats.

---

### Core Engine Crate (`src-tauri/dlp-core/src/`)

- **[`discovery.rs`](../src-tauri/dlp-core/src/discovery.rs):** Steam library locator (`libraryfolders.vdf`, registry scans). Returns `Found { path, is_running }`.
- **[`detect.rs`](../src-tauri/dlp-core/src/detect.rs):** Hardware benchmark analyzing CPU cores, RAM, and GPU to categorize into `Tier` (Low, Medium, High, Ultra).
- **[`backup.rs`](../src-tauri/dlp-core/src/backup.rs):** Creates and manages timestamped zip backups of game configs (`gameinfo.gi`, `cfg/`).
- **[`install.rs`](../src-tauri/dlp-core/src/install.rs):** Patches Deadlock with graphics presets (`Competitive`, `Ultra`, etc.), modifying `video.txt` and `gameinfo.gi`.
- **[`kvedit.rs`](../src-tauri/dlp-core/src/kvedit.rs):** Low-level Valve KeyValues (KV1 / VDF) tokenizer, parser, and serializer.
- **[`perf_overlay.rs`](../src-tauri/dlp-core/src/perf_overlay.rs):** Deep convar performance overlay engine. Injects targeted cvars into `machine_convars.vcfg`.
- **[`fov.rs`](../src-tauri/dlp-core/src/fov.rs):** Surgical patching for camera field of view and aspect ratio.
- **[`guard.rs`](../src-tauri/dlp-core/src/guard.rs):** Validates game executable running status to prevent corrupting locked files.
- **[`settings.rs`](../src-tauri/dlp-core/src/settings.rs):** `Settings` struct managing persistent configuration stored in `dlp_settings.json`.
- **[`logger.rs`](../src-tauri/dlp-core/src/logger.rs):** App-wide disk logger writing to `logs/dlpbooster.log`.
- **[`payload.rs`](../src-tauri/dlp-core/src/payload.rs):** Manages compiled/embedded asset payloads and initial extraction.
- **[`match_id.rs`](../src-tauri/dlp-core/src/match_id.rs):** Deadlock replay file inspector.
- **[`addons.rs`](../src-tauri/dlp-core/src/addons.rs):** Legacy addon scanner and analyzer.

---

## 4. Disk, Config & External Paths

### Application Data Directory (`%APPDATA%\DLPHub\` or `data_dir()`)
- `dlp_settings.json`: JSON configuration holding user preferences (language, FOV, paths, FPS).
- `backups/`: Directory storing timestamped zip archives of vanilla configs and game files.
- `logs/dlpbooster.log`: Persistent logging output for debugging and diagnostics.
- `deadworks/`: Installed Deadworks dedicated server binaries and custom mod files.
- `mods_cache/`: Downloaded zip archives and extracted mod bundles.

### Deadlock Installation Paths (Discovered via Steam)
- `game/citadel/gameinfo.gi`: Valve Source 2 engine search-path manifest (modified when mods are active; restored to vanilla on exit).
- `game/citadel/cfg/machine_convars.vcfg`: Deadlock engine video and rendering configuration.
- `game/citadel/cfg/user_convars.vcfg`: User convar overrides.
- `game/citadel/addons/`: Addons directory used by Deadworks.
- `game/bin/win64/deadlock.exe`: Deadlock game executable (client and dedicated server console).
- `game/bin/win64/deadworks.exe`: Optional Deadworks dedicated server wrapper executable.

### Windows Registry Keys Read/Written
- `HKLM\SOFTWARE\WOW6432Node\Valve\Steam` (`InstallPath`): Auto-detects Steam root.
- `HKCU\Software\Valve\Steam` (`SteamPath`): User-level Steam detection fallback.
- `HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\{adapter}`:
  - `TcpAckFrequency` (DWORD = 1)
  - `TCPNoDelay` (DWORD = 1)
- `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile`:
  - `NetworkThrottlingIndex` (DWORD = 0xFFFFFFFF)
  - `SystemResponsiveness` (DWORD = 0)

### External Network Endpoints
- **Iran VPS Coordinator:** `http://5.57.32.52:48080/api/...` (Lobby sync, VIP room coordinator, TS verification).
- **GitHub API:** `https://api.github.com/repos/aryobw9/dlpbooster/releases` (Update checks).
- **Valve SDR Relays:** ICMP/UDP ping sweeps across Valve datacenters (e.g., `fra`, `vie`, `dxb`, `lhr`).
