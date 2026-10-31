// DLPHub Deadlock LAN Process Supervisor & Local Network Interface Helper
// Manages dedicated server lifecycle with a dedicated visible console window
// and client match launch.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::lan_proxy::{start_udp_proxy, ProxyConfig, ProxyHandle};

pub static IS_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn is_server_running() -> bool {
    IS_SERVER_RUNNING.load(Ordering::Relaxed)
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn default_true() -> bool {
    true
}
fn default_two() -> u8 {
    2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalIpInfo {
    pub interface_name: String,
    pub ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanHostConfig {
    pub host_ip: String,
    pub public_port: u16,
    pub internal_port: u16,
    pub map_name: String,
    pub max_players: u8,
    #[serde(default)]
    pub enable_bots: bool,
    #[serde(default)]
    pub bot_count: u8,
    #[serde(default)]
    pub street_brawl: bool,
    #[serde(default)]
    pub enable_cheats: bool,
    #[serde(default)]
    pub duplicate_heroes: bool,
    #[serde(default)]
    pub unlock_flex_slots: bool,
    #[serde(default)]
    pub hero_draft: bool,
    #[serde(default)]
    pub active_lane: u8,
    #[serde(default)]
    pub server_mode: String,
    #[serde(default)]
    pub enable_sdr: bool,
    #[serde(default = "default_true")]
    pub offline_mode: bool,
    #[serde(default)]
    pub disable_autokick: bool,
    #[serde(default)]
    pub use_modded_server: bool,
    #[serde(default = "default_true", alias = "dlp_game_manager")]
    pub mod_match_start: bool,
    #[serde(default)]
    pub mod_auto_match: bool,
    #[serde(default = "default_true")]
    pub mod_admin_tools: bool,
    #[serde(default, alias = "ability_brawl")]
    pub mod_ability_brawl: bool,
    #[serde(default, alias = "cursed_arena")]
    pub mod_cursed_arena: bool,
    #[serde(default = "default_true")]
    pub pregame_lobby: bool,
    #[serde(default)]
    pub start_paused: bool,
    #[serde(default = "default_two")]
    pub min_players: u8,
}

impl Default for LanHostConfig {
    fn default() -> Self {
        Self {
            host_ip: "0.0.0.0".to_string(),
            public_port: 27005,
            internal_port: 27006,
            map_name: "dl_midtown".to_string(),
            max_players: 12,
            enable_bots: false,
            bot_count: 0,
            street_brawl: false,
            enable_cheats: false,
            duplicate_heroes: false,
            unlock_flex_slots: false,
            hero_draft: false,
            active_lane: 0,
            disable_autokick: true,
            use_modded_server: true,
            mod_match_start: true,
            mod_auto_match: false,
            mod_admin_tools: true,
            mod_ability_brawl: false,
            mod_cursed_arena: false,
            pregame_lobby: true,
            start_paused: false,
            min_players: 2,
            enable_sdr: false,
            offline_mode: false,
            server_mode: "vanilla".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanServerStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub host_ip: String,
    pub public_port: u16,
    pub map_name: String,
    #[serde(default)]
    pub crashed: bool,
    #[serde(default)]
    pub exit_code: Option<i32>,
}

struct ServerRuntime {
    child: Option<Child>,
    elevated_pid: Option<u32>,
    proxy: Option<ProxyHandle>,
    config: LanHostConfig,
    crashed: bool,
    last_exit_code: Option<i32>,
    user_stopped: bool,
}

// Thread-safe singleton for running server state
static SERVER_STATE: std::sync::OnceLock<Arc<Mutex<ServerRuntime>>> = std::sync::OnceLock::new();

fn get_server_state() -> &'static Arc<Mutex<ServerRuntime>> {
    SERVER_STATE.get_or_init(|| {
        Arc::new(Mutex::new(ServerRuntime {
            child: None,
            elevated_pid: None,
            proxy: None,
            config: LanHostConfig::default(),
            crashed: false,
            last_exit_code: None,
            user_stopped: false,
        }))
    })
}

/// Enumerate local IPv4 network interfaces (Ethernet, Wi-Fi, VPN adapters like PacketCraft, Radmin, etc.)
pub fn get_local_ipv4_addresses() -> Vec<LocalIpInfo> {
    let mut results = Vec::new();

    #[cfg(windows)]
    {
        let script = r#"
            Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object { $_.AddressState -eq "Preferred" -and $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254*" } |
            Select-Object InterfaceAlias, IPAddress |
            ConvertTo-Json -Compress
        "#;

        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    // Could be a single object or an array of objects
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        let items = if val.is_array() {
                            val.as_array().cloned().unwrap_or_default()
                        } else {
                            vec![val]
                        };

                        for item in items {
                            if let (Some(alias), Some(ip)) = (
                                item.get("InterfaceAlias").and_then(|v| v.as_str()),
                                item.get("IPAddress").and_then(|v| v.as_str()),
                            ) {
                                results.push(LocalIpInfo {
                                    interface_name: alias.to_string(),
                                    ip: ip.to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if results.is_empty() {
        results.push(LocalIpInfo {
            interface_name: "Localhost / All Interfaces".to_string(),
            ip: "0.0.0.0".to_string(),
        });
    }

    results
}

/// Start Deadlock dedicated server with visible Windows console + UDP Loopback Proxy
pub async fn start_dedicated_server(config: LanHostConfig) -> Result<LanServerStatus, String> {
    // Stop any stale proxy and kill any lingering server processes
    {
        let state_arc = get_server_state();
        let mut state = state_arc.lock().map_err(|e| e.to_string())?;

        if let Some(p) = state.proxy.take() {
            p.stop();
        }

        if let Some(mut child) = state.child.take() {
            let _ = child.kill();
        }
        let old_pid = state.elevated_pid.take();
        kill_server_processes(old_pid);
    }

    // 1. Locate Deadlock game folder
    let found = dlp_core::discovery::find_game()
        .ok_or_else(|| "Deadlock installation folder not found".to_string())?;

    let deadlock_root = Path::new(&found.deadlock);

    // Deploy Deadworks and selected mod mode from DLPHubStorage!
    let server_mode = if !config.server_mode.trim().is_empty() {
        config.server_mode.clone()
    } else if config.mod_cursed_arena {
        "cursed_arena".to_string()
    } else if config.mod_ability_brawl {
        "ability_brawl".to_string()
    } else if config.mod_auto_match {
        "automatch".to_string()
    } else {
        "vanilla".to_string()
    };

    if let Err(e) = crate::storage::deploy_deadworks_to_game(deadlock_root, &server_mode) {
        eprintln!("[lan_supervisor] deploy_deadworks_to_game notice: {e}");
    }
    if let Err(e) = backup_and_patch_gameinfo(deadlock_root) {
        eprintln!("[lan_supervisor] backup_and_patch_gameinfo notice: {e}");
    }

    let win64_dir = deadlock_root.join("game").join("bin").join("win64");
    let deadworks_exe = win64_dir.join("deadworks.exe");
    let deadlock_exe = win64_dir.join("deadlock.exe");

    let exe_path = if deadworks_exe.is_file() {
        deadworks_exe
    } else {
        deadlock_exe
    };

    if !exe_path.is_file() {
        return Err(format!("Server executable not found at {}", exe_path.display()));
    }

    ensure_lan_firewall_rules(&exe_path, config.public_port, config.internal_port);

    // 2. Prepare Dedicated Server arguments (Deadworks enhanced runtime)
    let is_cursed_arena = server_mode == "cursed_arena" || server_mode == "cursedarena" || config.mod_cursed_arena;

    let mut args: Vec<String> = vec![
        "-dedicated".into(),
        "-console".into(),
        "-condebug".into(),
        "-insecure".into(),
        "-allow_no_lobby_connect".into(),
    ];

    if is_cursed_arena {
        args.extend(vec![
            "+sv_cheats".into(), "1".into(),
            "+citadel_allow_purchasing_anywhere".into(), "0".into(),
            "+citadel_trooper_spawn_enabled".into(), "0".into(),
            "+citadel_neutral_spawn_enabled".into(), "0".into(),
            "+citadel_crate_spawn_enabled".into(), "0".into(),
            "+citadel_pickup_spawner_enabled".into(), "0".into(),
            "+citadel_powerup_spawn_enabled".into(), "0".into(),
            "+citadel_npc_spawn_enabled".into(), "0".into(),
            "+tv_citadel_auto_record".into(), "0".into(),
            "+spec_replay_enable".into(), "0".into(),
            "+tv_enable".into(), "0".into(),
            "+citadel_upload_replay_enabled".into(), "0".into(),
        ]);
    }

    let map_to_use = if is_cursed_arena && (config.map_name.trim().is_empty() || config.map_name == "dl_streets") {
        "dl_midtown".to_string()
    } else {
        config.map_name.clone()
    };

    args.extend(vec![
        "-port".into(),
        config.internal_port.to_string(),
        "+hostport".into(),
        config.internal_port.to_string(),
        "+sv_hibernate_when_empty".into(),
        "0".into(),
        "+net_limit_sv_message_process_time_ms_drop_burst".into(),
        "60000".into(),
        "+net_limit_sv_message_process_time_ms_drop_rate".into(),
        "60000".into(),
        "+map".into(),
        map_to_use,
        "-maxplayers".into(),
        config.max_players.to_string(),
        // Competitive 64-tick & Network Rate tuning
        "+rate".into(),
        "786432".into(),
        "+sv_minrate".into(),
        "786432".into(),
        "+sv_maxrate".into(),
        "786432".into(),
        "+sv_minupdaterate".into(),
        "64".into(),
        "+sv_maxupdaterate".into(),
        "64".into(),
        "+sv_mincmdrate".into(),
        "64".into(),
        "+sv_maxcmdrate".into(),
        "64".into(),
        "+sv_client_cmdrate_difference".into(),
        "0".into(),
        "+net_splitpacket_maxrate".into(),
        "786432".into(),
        "+sv_clockcorrection_msecs".into(),
        "15".into(),
    ]);

    if config.offline_mode {
        args.push("+sv_lan".into());
        args.push("1".into());
        args.push("+sv_setsteamaccount".into());
        args.push("0".into());
    }

    if config.enable_sdr {
        args.push("+net_p2p_listen_dedicated".into());
        args.push("1".into());
    }

    if config.enable_cheats && !is_cursed_arena {
        args.push("+sv_cheats".into());
        args.push("1".into());
    }

    if config.street_brawl && !is_cursed_arena {
        args.push("+citadel_gamemode_streetbrawl_enabled".into());
        args.push("true".into());
    }

    if config.enable_bots && config.bot_count > 0 && !is_cursed_arena {
        args.push("+citadel_spawn_practice_bots".into());
        args.push("true".into());
        args.push("+citadel_spawn_practice_bots_count".into());
        args.push(config.bot_count.to_string());
    }

    // 3. Launch process with a visible interactive console window
    let mut cmd = Command::new(&exe_path);
    cmd.args(&args);
    cmd.current_dir(exe_path.parent().unwrap_or_else(|| Path::new(&found.deadlock)));

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NEW_CONSOLE);
    }

    let (child_opt, pid_opt) = match cmd.spawn() {
        Ok(c) => {
            let pid = c.id();
            (Some(c), Some(pid))
        }
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("740") || err_str.contains("elevation") {
                // Deadlock requires elevation (e.g. RUNASADMIN flag). Elevate via PowerShell Start-Process -Verb RunAs.
                let arg_list = args
                    .iter()
                    .map(|a| format!("'{}'", a.replace('\'', "''")))
                    .collect::<Vec<_>>()
                    .join(", ");
                let work_dir = exe_path
                    .parent()
                    .unwrap_or_else(|| Path::new(&found.deadlock))
                    .to_string_lossy()
                    .replace('\'', "''");
                let script = format!(
                    "$p = Start-Process -FilePath '{}' -ArgumentList @({}) -WorkingDirectory '{}' -Verb RunAs -PassThru; if ($p) {{ $p.Id }}",
                    exe_path.to_string_lossy().replace('\'', "''"),
                    arg_list,
                    work_dir
                );

                let mut ps_cmd = Command::new("powershell");
                ps_cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
                #[cfg(windows)]
                {
                    ps_cmd.creation_flags(CREATE_NO_WINDOW);
                }

                let out = ps_cmd
                    .output()
                    .map_err(|pe| format!("Failed to request elevation: {pe}"))?;
                if !out.status.success() {
                    let err_txt = String::from_utf8_lossy(&out.stderr).to_string();
                    return Err(format!(
                        "Administrator elevation required: {}",
                        if err_txt.trim().is_empty() {
                            "User canceled elevation prompt or permission denied".into()
                        } else {
                            err_txt
                        }
                    ));
                }

                let pid_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let pid = pid_str.lines().last().and_then(|l| l.trim().parse::<u32>().ok());
                (None, pid)
            } else {
                return Err(format!("Failed to launch dedicated server console: {e}"));
            }
        }
    };

    // 4. Start the UDP Loopback Identity Proxy
    let proxy_cfg = ProxyConfig {
        bind_ip: if config.host_ip.trim().is_empty() {
            "0.0.0.0".to_string()
        } else {
            config.host_ip.clone()
        },
        public_port: config.public_port,
        internal_port: config.internal_port,
    };

    let proxy_handle = match start_udp_proxy(proxy_cfg).await {
        Ok(h) => h,
        Err(e) => {
            if let Some(mut c) = child_opt {
                let _ = c.kill();
            } else if let Some(pid) = pid_opt {
                #[cfg(windows)]
                {
                    let _ = Command::new("taskkill")
                        .args(["/F", "/PID", &pid.to_string()])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();
                }
            }
            return Err(format!("Server launched, but UDP proxy failed: {e}"));
        }
    };

    {
        let state_arc = get_server_state();
        let mut state = state_arc.lock().map_err(|e| e.to_string())?;
        state.child = child_opt;
        state.elevated_pid = pid_opt;
        state.proxy = Some(proxy_handle);
        state.config = config.clone();
        state.crashed = false;
        state.user_stopped = false;
        state.last_exit_code = None;
    }

    // 5. Spawn Dedicated Server Crash Guard / Watchdog
    let watchdog_pid = pid_opt;
    tokio::spawn(async move {
        println!("[Watchdog] Dedicated Server Crash Guard initialized for PID {:?}", watchdog_pid);
        loop {
            tokio::time::sleep(Duration::from_millis(1500)).await;
            let state_arc = get_server_state();
            let mut state = match state_arc.lock() {
                Ok(s) => s,
                Err(_) => break,
            };

            if state.user_stopped || (state.child.is_none() && state.elevated_pid.is_none()) {
                break;
            }

            let mut process_dead = false;
            let mut exit_code = None;

            if let Some(child) = state.child.as_mut() {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        process_dead = true;
                        exit_code = status.code();
                    }
                    Ok(None) => {}
                    Err(_) => {
                        process_dead = true;
                    }
                }
            } else if let Some(pid) = state.elevated_pid {
                #[cfg(windows)]
                {
                    let is_alive = Command::new("tasklist")
                        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output()
                        .map(|o| {
                            let s = String::from_utf8_lossy(&o.stdout);
                            s.contains(&pid.to_string())
                        })
                        .unwrap_or(false);
                    if !is_alive {
                        process_dead = true;
                    }
                }
            }

            if process_dead {
                if !state.user_stopped {
                    println!("[Watchdog] Dedicated server process terminated unexpectedly! (Crash detected, exit_code: {:?})", exit_code);
                    state.crashed = true;
                    state.last_exit_code = exit_code;
                }
                state.child = None;
                state.elevated_pid = None;
                if let Some(p) = state.proxy.take() {
                    p.stop();
                }
                break;
            }
        }
    });

    IS_SERVER_RUNNING.store(true, Ordering::Relaxed);
    Ok(LanServerStatus {
        is_running: true,
        pid: pid_opt,
        host_ip: config.host_ip,
        public_port: config.public_port,
        map_name: config.map_name,
        crashed: false,
        exit_code: None,
    })
}

/// Kill deadworks/deadlock server processes cleanly, escalating to elevated taskkill if necessary
pub fn kill_server_processes(specific_pid: Option<u32>) {
    #[cfg(windows)]
    {
        if let Some(pid) = specific_pid {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string(), "/T"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }

        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "deadworks.exe", "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        // Check if deadworks.exe is still alive (e.g. running elevated with Access Denied to standard user)
        let check_script = "$p = Get-Process -Name deadworks -ErrorAction SilentlyContinue; if ($p) { exit 42 } else { exit 0 }";
        let mut check_cmd = Command::new("powershell");
        check_cmd.args(["-NoProfile", "-NonInteractive", "-Command", check_script]);
        check_cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(check_out) = check_cmd.output() {
            if check_out.status.code() == Some(42) {
                // deadworks.exe is still running! Force kill via elevated PowerShell
                let kill_script = "Start-Process taskkill -ArgumentList '/F /IM deadworks.exe /T' -Verb RunAs -Wait";
                let mut kill_cmd = Command::new("powershell");
                kill_cmd.args(["-NoProfile", "-NonInteractive", "-Command", kill_script]);
                kill_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = kill_cmd.output();
            }
        }
    }
}

/// Closes any running Deadlock client instance cleanly to prevent file locks during patching or vanilla restoration
pub fn close_deadlock_game() {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "deadlock.exe", "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

/// Stop running dedicated server and proxy
pub fn stop_dedicated_server() -> Result<(), String> {
    let state_arc = get_server_state();
    let mut state = state_arc.lock().map_err(|e| e.to_string())?;

    state.user_stopped = true;
    state.crashed = false;

    if let Some(proxy) = state.proxy.take() {
        proxy.stop();
    }

    let elevated_pid = state.elevated_pid.take();
    if let Some(mut child) = state.child.take() {
        let _ = child.kill();
    }

    kill_server_processes(elevated_pid);

    if let Some(found) = dlp_core::discovery::find_game() {
        let _ = restore_gameinfo_vanilla(Path::new(&found.deadlock));
    }

    IS_SERVER_RUNNING.store(false, Ordering::Relaxed);
    Ok(())
}

/// Check current server status
pub fn get_server_status() -> LanServerStatus {
    let status = (|| {
        let state_arc = get_server_state();
        if let Ok(mut state) = state_arc.lock() {
            if let Some(child) = state.child.as_mut() {
                match child.try_wait() {
                    Ok(None) => {
                        return LanServerStatus {
                            is_running: true,
                            pid: Some(child.id()),
                            host_ip: state.config.host_ip.clone(),
                            public_port: state.config.public_port,
                            map_name: state.config.map_name.clone(),
                            crashed: false,
                            exit_code: None,
                        };
                    }
                    Ok(Some(status)) => {
                        let exit_code = status.code();
                        if !state.user_stopped {
                            state.crashed = true;
                            state.last_exit_code = exit_code;
                        }
                        state.child = None;
                        if let Some(p) = state.proxy.take() {
                            p.stop();
                        }
                    }
                    Err(_) => {
                        if !state.user_stopped {
                            state.crashed = true;
                        }
                        state.child = None;
                        if let Some(p) = state.proxy.take() {
                            p.stop();
                        }
                    }
                }
            } else if state.proxy.is_some() {
                // Elevated server running with active proxy
                let is_alive = if let Some(pid) = state.elevated_pid {
                    Command::new("tasklist")
                        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output()
                        .map(|o| {
                            let s = String::from_utf8_lossy(&o.stdout);
                            s.contains(&pid.to_string())
                        })
                        .unwrap_or(false)
                } else {
                    false
                };

                if is_alive {
                    return LanServerStatus {
                        is_running: true,
                        pid: state.elevated_pid,
                        host_ip: state.config.host_ip.clone(),
                        public_port: state.config.public_port,
                        map_name: state.config.map_name.clone(),
                        crashed: false,
                        exit_code: None,
                    };
                } else {
                    if !state.user_stopped {
                        state.crashed = true;
                    }
                    state.elevated_pid = None;
                    if let Some(p) = state.proxy.take() {
                        p.stop();
                    }
                }
            }

            return LanServerStatus {
                is_running: false,
                pid: None,
                host_ip: String::new(),
                public_port: state.config.public_port,
                map_name: state.config.map_name.clone(),
                crashed: state.crashed,
                exit_code: state.last_exit_code,
            };
        }

        LanServerStatus {
            is_running: false,
            pid: None,
            host_ip: String::new(),
            public_port: 27015,
            map_name: String::new(),
            crashed: false,
            exit_code: None,
        }
    })();

    IS_SERVER_RUNNING.store(status.is_running, Ordering::Relaxed);
    status
}

/// Connect client player directly to target server
pub fn launch_deadlock_client(ip: &str, port: u16) -> Result<(), String> {
    let clean_ip = ip.trim();
    if clean_ip.is_empty()
        || clean_ip.len() > 128
        || !clean_ip.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
    {
        return Err(format!("Invalid IP or hostname format: '{clean_ip}'"));
    }

    let found = dlp_core::discovery::find_game()
        .ok_or_else(|| "Deadlock installation folder not found".to_string())?;

    let target_dir = Path::new(&found.deadlock);

    let exe_path = target_dir
        .join("game")
        .join("bin")
        .join("win64")
        .join("deadlock.exe");

    if !exe_path.is_file() {
        return Err(format!("deadlock.exe not found at {}", exe_path.display()));
    }

    let connect_arg = format!("+connect {clean_ip}:{port}");
    let args = [
        "-dev",
        "-insecure",
        "-novid",
        "+closecaption",
        "1",
        "-allow_no_lobby_connect",
        "+rate",
        "786432",
        "+cl_updaterate",
        "64",
        "+cl_interp_ratio",
        "1",
        "+cl_interp",
        "0.015625",
        &connect_arg,
    ];

    let mut cmd = Command::new(&exe_path);
    cmd.args(&args);
    cmd.current_dir(exe_path.parent().unwrap_or_else(|| Path::new(&found.deadlock)));

    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("740") || err_str.contains("elevation") {
                let arg_list = args
                    .iter()
                    .map(|a| format!("'{}'", a.replace('\'', "''")))
                    .collect::<Vec<_>>()
                    .join(", ");
                let work_dir = exe_path
                    .parent()
                    .unwrap_or_else(|| Path::new(&found.deadlock))
                    .to_string_lossy()
                    .replace('\'', "''");
                let script = format!(
                    "Start-Process -FilePath '{}' -ArgumentList @({}) -WorkingDirectory '{}' -Verb RunAs",
                    exe_path.to_string_lossy().replace('\'', "''"),
                    arg_list,
                    work_dir
                );

                let mut ps_cmd = Command::new("powershell");
                ps_cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
                #[cfg(windows)]
                {
                    ps_cmd.creation_flags(CREATE_NO_WINDOW);
                }
                let out = ps_cmd.output().map_err(|pe| format!("Elevation failed: {pe}"))?;
                if !out.status.success() {
                    return Err("Deadlock client requires elevation. User canceled prompt.".into());
                }
                Ok(())
            } else {
                Err(format!("Failed to launch Deadlock client: {e}"))
            }
        }
    }
}

/// Check if Deadlock client process is currently running
pub fn is_deadlock_running() -> bool {
    #[cfg(windows)]
    {
        let output = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq deadlock.exe", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        if let Ok(out) = output {
            let s = String::from_utf8_lossy(&out.stdout);
            return s.to_lowercase().contains("deadlock.exe");
        }
    }
    false
}

/// Activates and brings the Deadlock game window to the foreground
pub fn activate_deadlock_window() {
    #[cfg(windows)]
    {
        let script = r#"
        $p = Get-Process -Name deadlock -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($p -and $p.MainWindowHandle -ne 0) {
            Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            public class User32 {
                [DllImport("user32.dll")]
                public static extern bool SetForegroundWindow(IntPtr hWnd);
                [DllImport("user32.dll")]
                public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            }
"@ -ErrorAction SilentlyContinue
            [User32]::ShowWindow($p.MainWindowHandle, 9)
            [User32]::SetForegroundWindow($p.MainWindowHandle)
        }
        "#;
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
}

/// Checks if client-side mod assets and active search paths are already fully configured on disk
pub fn is_mod_environment_ready(deadlock_dir: &Path, mode: &str) -> bool {
    let clean_mode = mode.trim().to_lowercase();
    if clean_mode == "none" || clean_mode.is_empty() {
        return true;
    }

    let citadel_dir = deadlock_dir.join("game").join("citadel");
    let gameinfo_path = citadel_dir.join("gameinfo.gi");

    // Check if gameinfo.gi has ACTIVE (uncommented) search paths
    if let Ok(content) = std::fs::read_to_string(&gameinfo_path) {
        let has_active_dw = content.lines().any(|l| {
            let t = l.trim();
            !t.starts_with("//") && t.contains("citadel/deadworks_mods")
        });
        if !has_active_dw {
            return false;
        }
    } else {
        return false;
    }

    // Check bootstrap VPK
    if !citadel_dir.join("deadworks_mods").join("pak01_dir.vpk").is_file() {
        return false;
    }

    // Check addon VPK
    if clean_mode == "ability_brawl" {
        if !citadel_dir.join("addons").join("pak45_dir.vpk").is_file() {
            return false;
        }
    } else if clean_mode == "cursed_arena" || clean_mode == "cursedarena" {
        if !citadel_dir.join("addons").join("pak84_dir.vpk").is_file() {
            return false;
        }
    }

    true
}

pub fn launch_deadlock_target(target: &str) -> Result<(), String> {
    let clean = target.trim().trim_start_matches("connect ").trim();
    if clean.is_empty() || !clean.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == ':' || c == '-') {
        return Err("Invalid connect target format".into());
    }
    let parts: Vec<&str> = clean.split(':').collect();
    if parts.len() > 2 {
        return Err("Invalid connect target format".into());
    }
    let ip = parts.first().copied().unwrap_or("127.0.0.1");
    let port: u16 = if parts.len() == 2 {
        parts[1].parse().map_err(|_| "Invalid port number in target".to_string())?
    } else {
        27015
    };

    // In-Game Console Pipe: If Deadlock is already running, connect directly via Steam URI pipe without restarting
    if is_deadlock_running() {
        println!("[lan_supervisor] Deadlock is already running! Triggering in-game connect pipe via steam://connect/{ip}:{port}");
        #[cfg(windows)]
        {
            let steam_url = format!("steam://connect/{ip}:{port}");
            let _ = open::that(&steam_url);
            activate_deadlock_window();
        }
        return Ok(());
    }

    launch_deadlock_client(ip, port)
}

pub const SEARCHPATH_BLOCK_START: &str = "// Deadworks Launcher - Start";
pub const SEARCHPATH_BLOCK_END: &str = "// Deadworks Launcher - End";
pub const DLP_OFF_TAG: &str = "// #DLP_OFF# ";

/// Back up gameinfo.gi to gameinfo.gi.dlp_backup and inject/uncomment SearchPaths for Deadworks mods and addons
pub fn backup_and_patch_gameinfo(deadlock_dir: &Path) -> Result<(), String> {
    let citadel_dir = deadlock_dir.join("game").join("citadel");
    let gameinfo_path = citadel_dir.join("gameinfo.gi");
    let backup_path = citadel_dir.join("gameinfo.gi.dlp_backup");

    if !gameinfo_path.is_file() {
        return Err(format!("gameinfo.gi not found at {}", gameinfo_path.display()));
    }

    // 1. Create clean backup if not present
    if !backup_path.is_file() {
        let _ = std::fs::copy(&gameinfo_path, &backup_path);
    }

    // 2. Read content
    let content = std::fs::read_to_string(&gameinfo_path)
        .map_err(|e| format!("Failed to read gameinfo.gi: {e}"))?;

    // 3. Comment Toggle Check: If block already exists, re-activate by stripping // #DLP_OFF#
    if content.contains(SEARCHPATH_BLOCK_START) {
        if content.contains(DLP_OFF_TAG) {
            let uncommented = content.replace(DLP_OFF_TAG, "");
            std::fs::write(&gameinfo_path, uncommented)
                .map_err(|e| format!("Failed to uncomment SearchPaths in gameinfo.gi: {e}"))?;
            println!("[lan_supervisor] Re-activated Deadworks SearchPaths via comment toggle");
            return Ok(());
        }
        // Already active
        return Ok(());
    }

    // 4. Inject SearchPaths right inside SearchPaths {
    let patch_block = "\r\n\t\t\t// Deadworks Launcher - Start\r\n\t\t\tGame_LowViolence\tcitadel/custom\r\n\t\t\tGame\t\t\t\tcitadel/custom\r\n\t\t\tMod\t\t\t\t\tcitadel/custom\r\n\t\t\tAddon\t\t\t\tcitadel/custom\r\n\t\t\tGame_LowViolence\tcitadel/deadworks_mods\r\n\t\t\tGame\t\t\t\tcitadel/deadworks_mods\r\n\t\t\tMod\t\t\t\t\tcitadel/deadworks_mods\r\n\t\t\tAddon\t\t\t\tcitadel/deadworks_mods\r\n\t\t\tGame_LowViolence\tcitadel/addons\r\n\t\t\tGame\t\t\t\tcitadel/addons\r\n\t\t\tMod\t\t\t\t\tcitadel/addons\r\n\t\t\tAddon\t\t\t\tcitadel/addons\r\n\t\t\t// Deadworks Launcher - End";

    if let Some(pos) = content.find("SearchPaths") {
        if let Some(brace_pos) = content[pos..].find('{') {
            let insert_at = pos + brace_pos + 1;
            let mut patched = content.clone();
            patched.insert_str(insert_at, patch_block);
            std::fs::write(&gameinfo_path, patched)
                .map_err(|e| format!("Failed to write patched gameinfo.gi: {e}"))?;
            println!("[lan_supervisor] Successfully injected Deadworks search paths into gameinfo.gi");
            return Ok(());
        }
    }

    // Fallback: append before the last closing brace
    if let Some(last_brace) = content.rfind('}') {
        let mut patched = content.clone();
        patched.insert_str(last_brace, patch_block);
        std::fs::write(&gameinfo_path, patched)
            .map_err(|e| format!("Failed to write patched gameinfo.gi: {e}"))?;
        return Ok(());
    }

    Err("Could not find SearchPaths in gameinfo.gi to patch".into())
}

/// Restores gameinfo.gi to vanilla via atomic comment toggling (prefixing paths with // #DLP_OFF#)
/// so official matchmaking runs clean without corrupting files or deleting installed mods.
pub fn restore_gameinfo_vanilla(deadlock_dir: &Path) -> Result<(), String> {
    let citadel_dir = deadlock_dir.join("game").join("citadel");
    let gameinfo_path = citadel_dir.join("gameinfo.gi");
    let backup_path = citadel_dir.join("gameinfo.gi.dlp_backup");

    // Comment toggle: Prefix path lines inside block with // #DLP_OFF# so Source 2 treats them as comments
    if let Ok(content) = std::fs::read_to_string(&gameinfo_path) {
        if content.contains(SEARCHPATH_BLOCK_START) && content.contains(SEARCHPATH_BLOCK_END) {
            if let (Some(start_idx), Some(end_idx)) = (content.find(SEARCHPATH_BLOCK_START), content.find(SEARCHPATH_BLOCK_END)) {
                let prefix = &content[..start_idx];
                let block_raw = &content[start_idx..end_idx + SEARCHPATH_BLOCK_END.len()];
                let suffix = &content[end_idx + SEARCHPATH_BLOCK_END.len()..];

                let mut commented_lines = Vec::new();
                for line in block_raw.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty()
                        || trimmed.starts_with(SEARCHPATH_BLOCK_START)
                        || trimmed.starts_with(SEARCHPATH_BLOCK_END)
                        || trimmed.starts_with(DLP_OFF_TAG.trim())
                    {
                        commented_lines.push(line.to_string());
                    } else if trimmed.starts_with("Game") || trimmed.starts_with("Mod") || trimmed.starts_with("Addon") {
                        commented_lines.push(format!("\t\t\t{}{}", DLP_OFF_TAG, trimmed));
                    } else {
                        commented_lines.push(line.to_string());
                    }
                }
                let commented_block = commented_lines.join("\r\n");
                let new_content = format!("{}{}{}", prefix, commented_block, suffix);
                if let Ok(_) = std::fs::write(&gameinfo_path, new_content) {
                    println!("[lan_supervisor] Safely toggled Deadworks search paths to commented-out (vanilla)");
                    return Ok(());
                }
            }
        }
    }

    // Fallback: restore from backup if present
    if backup_path.is_file() {
        let _ = std::fs::copy(&backup_path, &gameinfo_path);
        println!("[lan_supervisor] Restored gameinfo.gi from backup");
    }

    Ok(())
}

/// Prepares client files for joining a Deadworks or modded match (downloads on-demand & stages)
pub async fn prepare_modded_client(mode: &str) -> Result<(), String> {
    let found = dlp_core::discovery::find_game()
        .ok_or_else(|| "Deadlock installation folder not found".to_string())?;
    let deadlock_root = Path::new(&found.deadlock);

    // If mod files and active search paths are ALREADY ready and active, do NOT close running game!
    if is_mod_environment_ready(deadlock_root, mode) {
        println!("[lan_supervisor] Mod environment for '{mode}' is already active. Preserving running game!");
        return Ok(());
    }

    // Only close Deadlock if we actually need to patch gameinfo or deploy files that may be locked
    if is_deadlock_running() {
        let msg = format!(
            "To join the '{}' game mode, Deadlock must be restarted with custom mod files.\n\n\
             Would you like to close Deadlock now to apply the mod?",
            mode
        );
        if !crate::storage::prompt_user_to_close_deadlock_custom(&msg, "DLPHub - Restart Deadlock for Mod Mode?") {
            return Err("Operation cancelled: Deadlock was kept running.".into());
        }
        println!("[lan_supervisor] User confirmed closing Deadlock to apply mod search paths...");
        close_deadlock_game();
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    let found = dlp_core::discovery::find_game()
        .ok_or_else(|| "Deadlock installation folder not found".to_string())?;
    let deadlock_root = Path::new(&found.deadlock);

    // 1. Ensure client bootstrap VPK is cached
    crate::storage::ensure_client_bootstrap_available(None).await?;

    // 2. If mode requires addon VPK (e.g. ability_brawl, cursed_arena), ensure it is cached
    let clean_mode = mode.trim().to_lowercase();
    if clean_mode == "ability_brawl" {
        crate::storage::ensure_client_addon_available("ability_brawl", None).await?;
    } else if clean_mode == "cursed_arena" || clean_mode == "cursedarena" {
        crate::storage::ensure_client_addon_available("cursed_arena", None).await?;
    }

    // 3. Deploy client assets to game
    crate::storage::deploy_client_modded_assets(deadlock_root, &clean_mode)?;

    // 4. Backup & patch gameinfo.gi
    backup_and_patch_gameinfo(deadlock_root)?;

    Ok(())
}

pub async fn setup_host_server_environment(mode: &str) -> Result<(), String> {
    let found = dlp_core::discovery::find_game()
        .ok_or_else(|| "Deadlock installation folder not found".to_string())?;
    let deadlock_root = Path::new(&found.deadlock);

    let clean_mode = mode.trim().to_lowercase();
    let server_mode = if clean_mode == "cursed_arena" || clean_mode == "cursedarena" {
        "cursed_arena"
    } else if clean_mode == "ability_brawl" {
        "ability_brawl"
    } else if clean_mode == "automatch" {
        "automatch"
    } else {
        "vanilla"
    };

    // 1. Ensure server loader and assets
    let _ = crate::storage::ensure_server_loader_available(None).await;
    let _ = crate::storage::ensure_client_bootstrap_available(None).await;
    if server_mode == "ability_brawl" {
        let _ = crate::storage::ensure_client_addon_available("ability_brawl", None).await;
    } else if server_mode == "cursed_arena" {
        let _ = crate::storage::ensure_client_addon_available("cursed_arena", None).await;
    }

    // 2. Deploy deadworks server binaries and plugins
    crate::storage::deploy_deadworks_to_game(deadlock_root, server_mode)?;

    // 3. Deploy client modded assets for this mode
    crate::storage::deploy_client_modded_assets(deadlock_root, server_mode)?;

    // 4. Backup & patch gameinfo.gi
    backup_and_patch_gameinfo(deadlock_root)?;

    // 5. Ensure firewall rules for deadworks and deadlock
    let win64_dir = deadlock_root.join("game").join("bin").join("win64");
    let deadworks_exe = win64_dir.join("deadworks.exe");
    if deadworks_exe.is_file() {
        ensure_lan_firewall_rules(&deadworks_exe, 27005, 27006);
    }
    let deadlock_exe = win64_dir.join("deadlock.exe");
    if deadlock_exe.is_file() {
        ensure_lan_firewall_rules(&deadlock_exe, 27005, 27006);
    }

    Ok(())
}

#[allow(dead_code)]
pub fn ensure_vanilla_clean(deadlock_dir: &Path) {
    let _ = restore_gameinfo_vanilla(deadlock_dir);
}

#[allow(dead_code)]
pub fn ensure_client_bootstrap(deadlock_dir: &Path) {
    let _ = backup_and_patch_gameinfo(deadlock_dir);
}

#[allow(dead_code)]
pub async fn deploy_modded_server_loader(
    deadlock_dir: &str,
    _config: &LanHostConfig,
) -> Result<(), String> {
    let _ = restore_gameinfo_vanilla(Path::new(deadlock_dir));
    Ok(())
}

#[allow(dead_code)]
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Ok(());
    }
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let target = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else {
            let _ = std::fs::copy(&path, &target);
        }
    }
    Ok(())
}

fn ensure_lan_firewall_rules(exe_path: &Path, public_port: u16, internal_port: u16) {
    #[cfg(windows)]
    {
        let ports = format!("{public_port},{internal_port},27005-27020");
        let rule_port_udp = "DLPHub LAN Game UDP";
        let rule_port_tcp = "DLPHub LAN Game TCP";
        let exe_name = exe_path.file_name().and_then(|n| n.to_str()).unwrap_or("server");
        let rule_prog_udp = format!("DLPHub Server UDP ({exe_name})");
        let rule_prog_tcp = format!("DLPHub Server TCP ({exe_name})");

        let rules_to_delete = [
            "DLPHub LAN Game",
            "DLPHub Modded Server",
            rule_port_udp,
            rule_port_tcp,
            &rule_prog_udp,
            &rule_prog_tcp,
        ];

        for rname in rules_to_delete {
            let _ = Command::new("netsh")
                .args(["advfirewall", "firewall", "delete", "rule", &format!("name={rname}")])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }

        // 1. Inbound UDP ports (27005-27020, public_port, internal_port)
        let _ = Command::new("netsh")
            .args([
                "advfirewall", "firewall", "add", "rule",
                &format!("name={rule_port_udp}"),
                "protocol=UDP",
                &format!("localport={ports}"),
                "dir=in",
                "action=allow",
                "profile=any",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        // 2. Inbound TCP ports (Matchmaking, Steam query)
        let _ = Command::new("netsh")
            .args([
                "advfirewall", "firewall", "add", "rule",
                &format!("name={rule_port_tcp}"),
                "protocol=TCP",
                &format!("localport={ports}"),
                "dir=in",
                "action=allow",
                "profile=any",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        // 3. Program rule for executable (UDP)
        let _ = Command::new("netsh")
            .args([
                "advfirewall", "firewall", "add", "rule",
                &format!("name={rule_prog_udp}"),
                "protocol=UDP",
                "dir=in",
                "action=allow",
                &format!("program={}", exe_path.display()),
                "profile=any",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        // 4. Program rule for executable (TCP)
        let _ = Command::new("netsh")
            .args([
                "advfirewall", "firewall", "add", "rule",
                &format!("name={rule_prog_tcp}"),
                "protocol=TCP",
                "dir=in",
                "action=allow",
                &format!("program={}", exe_path.display()),
                "profile=any",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

fn get_all_lan_matches_dirs() -> Vec<PathBuf> {
    let mut raw_dirs = vec![
        crate::storage::get_lan_matches_dir(),
    ];

    if let Some(found) = dlp_core::discovery::find_game() {
        let root = Path::new(&found.deadlock);
        raw_dirs.push(root.join("game").join("bin").join("win64").join("lan_matches"));
        raw_dirs.push(root.join("game").join("citadel").join("lan_matches"));
    }

    // STRICT: Never allow any directory inside src-tauri!
    let mut dirs = Vec::new();
    for d in raw_dirs {
        let s = d.to_string_lossy().to_lowercase();
        if !s.contains("src-tauri") && !dirs.contains(&d) {
            dirs.push(d);
        }
    }

    dirs
}

pub fn list_lan_matches() -> Vec<String> {
    let mut matches = Vec::new();
    let search_dirs = get_all_lan_matches_dirs();

    for dir in &search_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "json") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        if stem != "lobby_status" && !matches.contains(&stem.to_string()) {
                            matches.push(stem.to_string());
                        }
                    }
                }
            }
        }
    }
    matches
}

pub fn get_lan_match_metadata(match_id: &str) -> Option<String> {
    let clean_id = match_id.trim();
    if clean_id.is_empty() || clean_id.contains('/') || clean_id.contains('\\') || clean_id.contains("..") {
        return None;
    }
    for dir in get_all_lan_matches_dirs() {
        let p = dir.join(format!("{clean_id}.json"));
        if let Ok(content) = std::fs::read_to_string(p) {
            return Some(content);
        }
    }
    None
}

pub fn send_server_command(command: &str) -> Result<(), String> {
    for dir in get_all_lan_matches_dirs() {
        let _ = std::fs::create_dir_all(&dir);
        let cmd_file = dir.join("server_cmd.txt");
        let _ = std::fs::write(&cmd_file, command.trim());
    }

    Ok(())
}

pub fn get_lobby_status() -> Option<String> {
    for dir in get_all_lan_matches_dirs() {
        let status_file = dir.join("lobby_status.json");
        if status_file.exists() {
            if let Ok(content) = std::fs::read_to_string(&status_file) {
                return Some(content);
            }
        }
    }

    None
}



