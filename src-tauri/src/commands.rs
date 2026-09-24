// Tauri commands: IPC layer over dlp-core.
use serde::{Deserialize, Serialize};

use dlp_core::{backup, detect, discovery, guard, install, payload, settings};

// ---------- discovery ----------
#[derive(Serialize)]
pub struct FoundDto {
    pub deadlock: String,
    pub owned: bool,
}

impl From<discovery::Found> for FoundDto {
    fn from(f: discovery::Found) -> Self {
        FoundDto { deadlock: f.deadlock, owned: f.owned }
    }
}

#[tauri::command]
pub fn find_game() -> Option<FoundDto> {
    discovery::find_game().map(Into::into)
}

#[tauri::command]
pub fn pick_game(path: String) -> Option<FoundDto> {
    discovery::validate_manual(&path).map(Into::into)
}

// ---------- detect ----------
#[tauri::command]
pub fn detect_tier_cmd(citadel: String) -> String {
    let pkg_dir = payload::extract_cached().unwrap_or_default();
    let pkg = payload_dir_or(&pkg_dir);
    detect::detect_tier(std::path::Path::new(&citadel), &pkg).as_str().to_string()
}

fn payload_dir_or(p: &std::path::Path) -> std::path::PathBuf {
    if p.is_dir() { p.to_path_buf() } else { std::env::temp_dir().join("DLPHubPkg") }
}

// ---------- guard ----------
#[tauri::command]
pub fn check_running() -> Vec<String> {
    guard::game_running()
}

// ---------- install ----------
#[tauri::command]
pub async fn install_mode(mode: String, fov: u32, path: String) -> Result<Vec<install::StepLog>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let m = match mode.as_str() {
            "T1" => install::Mode::T1,
            "T2" => install::Mode::T2,
            "T3" => install::Mode::T3,
            "POTATO" => install::Mode::Potato,
            "T1MODS" => install::Mode::T1Mods,
            "T2MODS" => install::Mode::T2Mods,
            other => return Err(format!("unknown mode: {other}")),
        };
        let deadlock = resolve_path(&path)?;
        let pkg = payload::extract_cached().map_err(|e| e.to_string())?;
        let data = settings::data_dir();
        install::install(m, fov, &deadlock, &pkg, &data)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn resolve_path(path: &str) -> Result<String, String> {
    let p = if path.trim().is_empty() {
        settings::load().last_path.unwrap_or_default()
    } else {
        path.to_string()
    };
    if p.is_empty() || !std::path::Path::new(&p).join("game").join("citadel").is_dir() {
        return Err("no valid Deadlock path — locate the game first".into());
    }
    Ok(p)
}

// ---------- backup / restore ----------
#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub size_bytes: u64,
    pub is_main: bool,
}

#[tauri::command]
pub async fn do_backup_cmd(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let deadlock = resolve_path(&path)?;
        let cit = std::path::Path::new(&deadlock).join("game").join("citadel");
        backup::do_backup(&cit, &settings::data_dir())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn list_backups() -> Vec<BackupInfo> {
    backup::list_backups_with_details(&settings::data_dir())
        .into_iter()
        .map(|b| BackupInfo {
            name: b.name,
            size_bytes: b.size_bytes,
            is_main: b.is_main,
        })
        .collect()
}

#[tauri::command]
pub fn delete_backup_cmd(name: String) -> Result<(), String> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("invalid backup name".into());
    }
    let data_dir = settings::data_dir();
    if backup::is_main_backup(&data_dir, &name) {
        return Err("Cannot delete the initial original game backup".into());
    }
    let bdir = backup::backups_root(&data_dir).join(&name);
    if !bdir.is_dir() {
        return Err(format!("backup not found: {name}"));
    }
    backup::rm_ro(&bdir);
    Ok(())
}

#[derive(Serialize)]
pub struct RestoreReportDto {
    pub restored_gi: bool,
    pub restored_video: bool,
    pub removed_addons: Vec<String>,
    pub restored_addons: usize,
}

#[tauri::command]
pub async fn do_restore(name: String, path: String) -> Result<RestoreReportDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let running = guard::game_running();
        if !running.is_empty() {
            return Err(format!("game running: {} — close Deadlock first", running.join(", ")));
        }
        let deadlock = resolve_path(&path)?;
        let cit = std::path::Path::new(&deadlock).join("game").join("citadel");
        backup::restore(&cit, &settings::data_dir(), &name).map(|r| RestoreReportDto {
            restored_gi: r.restored_gi,
            restored_video: r.restored_video,
            removed_addons: r.removed_addons,
            restored_addons: r.restored_addons,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn revert_original_cmd(path: String) -> Result<RestoreReportDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let running = guard::game_running();
        if !running.is_empty() {
            return Err(format!("game running: {} — close Deadlock first", running.join(", ")));
        }
        let deadlock = resolve_path(&path)?;
        let cit = std::path::Path::new(&deadlock).join("game").join("citadel");
        backup::revert_original(&cit).map(|r| RestoreReportDto {
            restored_gi: r.restored_gi,
            restored_video: r.restored_video,
            removed_addons: r.removed_addons,
            restored_addons: r.restored_addons,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- settings ----------
#[derive(Serialize)]
pub struct SettingsDto {
    pub lang: String,
    pub unlocked: bool,
    pub last_path: Option<String>,
    pub unit_status_new: bool,
    pub fov: u32,
    pub fps_max: Option<u32>,
    pub custom_autoexec: String,
    pub renderer: String,
    pub stop_cloth_anim: bool,
    pub ragdoll_fade: bool,
}

impl From<settings::Settings> for SettingsDto {
    fn from(s: settings::Settings) -> Self {
        SettingsDto {
            lang: s.lang,
            unlocked: s.unlocked,
            last_path: s.last_path,
            unit_status_new: s.unit_status_new,
            fov: s.fov,
            fps_max: s.fps_max,
            custom_autoexec: s.custom_autoexec,
            renderer: s.renderer,
            stop_cloth_anim: s.stop_cloth_anim,
            ragdoll_fade: s.ragdoll_fade,
        }
    }
}

#[derive(Deserialize)]
pub struct SettingsPatch {
    pub lang: Option<String>,
    pub unlock_code: Option<String>,
    pub last_path: Option<String>,
    pub unit_status_new: Option<bool>,
    pub fov: Option<u32>,
    pub fps_max: Option<i32>, // -1: None (default/untouched), >=0: Some(n)
    pub custom_autoexec: Option<String>,
    pub renderer: Option<String>,
    pub stop_cloth_anim: Option<bool>,
    pub ragdoll_fade: Option<bool>,
}

fn verify_vip_code(input: &str) -> bool {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return false;
    }
    let digest = detect::md5_hex(trimmed.as_bytes());
    let expected = std::env::var("DLPHUB_VIP_HASH").unwrap_or_else(|_| "e2fc714c4727ee9395f324cd2e7f331f".to_string());
    digest.eq_ignore_ascii_case(&expected)
}

#[tauri::command]
pub fn get_settings() -> SettingsDto {
    settings::load().into()
}

#[tauri::command]
pub fn set_settings(patch: SettingsPatch) -> Result<SettingsDto, String> {
    let mut s = settings::load();
    if let Some(lang) = patch.lang {
        if lang != "fa" && lang != "en" {
            return Err("lang must be fa or en".into());
        }
        s.lang = lang;
    }
    if let Some(code) = patch.unlock_code {
        if !verify_vip_code(&code) {
            return Err("invalid unlock code".into());
        }
        s.unlocked = true;
    }
    if let Some(p) = patch.last_path {
        s.last_path = if p.trim().is_empty() { None } else { Some(p) };
    }
    if let Some(fov) = patch.fov { s.fov = fov; }
    if let Some(u) = patch.unit_status_new {
        s.unit_status_new = u;
    }
    if let Some(ca_stop) = patch.stop_cloth_anim {
        s.stop_cloth_anim = ca_stop;
    }
    if let Some(rf) = patch.ragdoll_fade {
        s.ragdoll_fade = rf;
    }
    if let Some(fm) = patch.fps_max {
        s.fps_max = if fm < 0 { None } else { Some(fm as u32) };
    }
    if let Some(ca) = patch.custom_autoexec {
        s.custom_autoexec = ca;
    }
    if let Some(r) = patch.renderer {
        if !["default", "dx11", "vulkan"].contains(&r.as_str()) {
            return Err("renderer must be default, dx11, or vulkan".into());
        }
        s.renderer = r;
    }
    settings::save(&s).map_err(|e| e.to_string())?;
    Ok(s.into())
}

#[tauri::command]
pub fn reset_settings_cmd() -> Result<SettingsDto, String> {
    let s = settings::reset().map_err(|e| format!("Failed to reset settings: {e}"))?;
    dlp_core::logger::log(&settings::data_dir(), "INFO", "Settings reset to defaults by user");
    Ok(s.into())
}

#[tauri::command]
pub fn get_diagnostics() -> String {
    let data_dir = settings::data_dir();
    let mut diag = String::new();
    diag.push_str("=== DLPHub Diagnostics Report ===\n");
    diag.push_str(&format!("OS: {}\n", std::env::consts::OS));
    diag.push_str(&format!("Arch: {}\n", std::env::consts::ARCH));
    diag.push_str(&format!("Data Dir: {:?}\n", data_dir));
    diag.push_str(&format!("Log Path: {:?}\n", dlp_core::logger::log_path(&data_dir)));

    let s = settings::load();
    diag.push_str(&format!("Settings: lang={}, unlocked={}, last_path={:?}, fov={}, fps_max={:?}, unit_status={}, stop_cloth_anim={}, ragdoll_fade={}\n",
        s.lang, s.unlocked, s.last_path, s.fov, s.fps_max, s.unit_status_new, s.stop_cloth_anim, s.ragdoll_fade
    ));

    let vram_bytes = detect::detect_vram_bytes();
    let vram_mb = vram_bytes / (1024 * 1024);
    diag.push_str(&format!("Detected Dedicated VRAM: {} MB ({} bytes)\n", vram_mb, vram_bytes));

    let detected = discovery::find_game();
    diag.push_str(&format!("Deadlock Detected: {:?}\n", detected));

    let running = guard::game_running();
    diag.push_str(&format!("Game Running: {:?}\n", running));

    let backups = backup::list_backups_with_details(&data_dir);
    diag.push_str(&format!("Backups Count: {}\n", backups.len()));
    for b in backups {
        diag.push_str(&format!("  - {}: {} bytes\n", b.name, b.size_bytes));
    }

    diag.push_str("\n=== Recent Logs (Last 50 lines) ===\n");
    let logs = dlp_core::logger::recent_logs(&data_dir, 50);
    if logs.is_empty() {
        diag.push_str("(No logs recorded yet)\n");
    } else {
        for line in logs {
            diag.push_str(&line);
            diag.push('\n');
        }
    }
    diag
}

#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

// ---------- updater ----------
#[derive(Serialize, Deserialize)]
pub struct UpdateCheckDto {
    pub should_update: bool,
    pub current_version: String,
    pub version: String,
    pub body: Option<String>,
    pub download_url: Option<String>,
    pub html_url: Option<String>,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

fn parse_version_numbers(v: &str) -> Vec<u32> {
    v.trim_start_matches('v')
        .split('.')
        .filter_map(|p| p.parse::<u32>().ok())
        .collect()
}

fn is_version_greater(latest: &str, current: &str) -> bool {
    let l = parse_version_numbers(latest);
    let c = parse_version_numbers(current);
    l > c
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateCheckDto, String> {
    let curr = app.package_info().version.to_string();

    let client = reqwest::Client::builder()
        .user_agent("DLPHub")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let res = client
        .get("https://api.github.com/repos/aryobw9/DLPHub/releases/latest")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Network request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Update server returned HTTP {}", res.status()));
    }

    let release: GitHubRelease = res.json().await.map_err(|e| format!("Failed to parse release: {e}"))?;
    let latest_tag = release.tag_name.clone();
    let should = is_version_greater(&latest_tag, &curr);

    let download_url = release
        .assets
        .iter()
        .find(|a| a.name.ends_with(".exe"))
        .map(|a| a.browser_download_url.clone())
        .unwrap_or_else(|| release.html_url.clone());

    Ok(UpdateCheckDto {
        should_update: should,
        current_version: curr,
        version: latest_tag,
        body: release.body,
        download_url: Some(download_url),
        html_url: Some(release.html_url),
    })
}

#[tauri::command]
pub fn open_download_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

// ---------- misc ----------
#[tauri::command]
pub fn launch_game() -> Result<(), String> {
    let s = settings::load();
    let uri = match s.renderer.as_str() {
        "dx11" => "steam://run/1422450//-dx11/",
        "vulkan" => "steam://run/1422450//-vulkan/",
        _ => "steam://rungameid/1422450",
    };
    open::that(uri).map_err(|e| e.to_string())
}

/// Guard: refuse to run if we're executing from the extracted temp package.
#[tauri::command]
pub fn running_from_pkg() -> bool {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let td = std::env::temp_dir();
            return parent.starts_with(td.join("DLPHubPkg")) || parent.starts_with(td.join("DLPBoosterPkg"));
        }
    }
    false
}

// ---------- valve ping ----------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerPing {
    pub id: String,
    pub name: String,
    pub name_fa: String,
    pub region: String,
    pub region_fa: String,
    pub ip: String,
    pub ping_ms: Option<u32>,
    // real-sample telemetry (up to 20 ICMP probes per relay)
    pub samples: Vec<u32>,
    pub avg_ms: Option<u32>,
    pub jitter_ms: Option<u32>,     // mean absolute deviation of samples
    pub loss_pct: f32,              // 0.0 - 100.0
    pub stability: Option<u8>,      // 0-100 score = 100 - jitter/avg blend
}

impl ServerPing {
    fn from_def(s: &ValveServerDef) -> Self {
        ServerPing {
            id: s.id.to_string(),
            name: s.name.to_string(),
            name_fa: s.name_fa.to_string(),
            region: s.region.to_string(),
            region_fa: s.region_fa.to_string(),
            ip: s.ip.to_string(),
            ping_ms: None,
            samples: vec![],
            avg_ms: None,
            jitter_ms: None,
            loss_pct: 100.0,
            stability: None,
        }
    }
}

#[derive(Clone)]
struct ValveServerDef {
    id: &'static str,
    name: &'static str,
    name_fa: &'static str,
    region: &'static str,
    region_fa: &'static str,
    ip: &'static str,
}

const VALVE_SERVERS: &[ValveServerDef] = &[
    ValveServerDef {
        id: "fra",
        name: "Frankfurt",
        name_fa: "فرانکفورت (آلمان)",
        region: "Europe West",
        region_fa: "غرب اروپا",
        ip: "155.133.226.68",
    },
    ValveServerDef {
        id: "vie",
        name: "Vienna",
        name_fa: "وین (اتریش)",
        region: "Europe East",
        region_fa: "شرق اروپا",
        ip: "146.66.155.66",
    },
    ValveServerDef {
        id: "dxb",
        name: "Dubai",
        name_fa: "دبی (امارات)",
        region: "Middle East",
        region_fa: "خاورمیانه",
        ip: "185.25.183.163",
    },
    ValveServerDef {
        id: "sto",
        name: "Stockholm",
        name_fa: "استکهلم (سوئد)",
        region: "Europe North",
        region_fa: "شمال اروپا",
        ip: "162.254.198.41",
    },
    ValveServerDef {
        id: "waw",
        name: "Warsaw",
        name_fa: "ورشو (لهستان)",
        region: "Europe Central",
        region_fa: "مرکز اروپا",
        ip: "155.133.230.98",
    },
    ValveServerDef {
        id: "ams",
        name: "Amsterdam",
        name_fa: "آمستردام (هلند)",
        region: "Europe West",
        region_fa: "غرب اروپا",
        ip: "155.133.248.36",
    },
    ValveServerDef {
        id: "lhr",
        name: "London",
        name_fa: "لندن (انگلیس)",
        region: "Europe West",
        region_fa: "غرب اروپا",
        ip: "162.254.197.37",
    },
    ValveServerDef {
        id: "iad",
        name: "US East",
        name_fa: "شرق آمریکا (ویرجینیا)",
        region: "North America",
        region_fa: "آمریکای شمالی",
        ip: "162.254.192.67",
    },
];

fn ping_single_ip(ip: &str, timeout_ms: u32) -> Option<u32> {
    use std::process::Command;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let mut cmd = Command::new("ping");
    cmd.args(["-n", "1", "-w", &timeout_ms.to_string(), ip]);

    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: prevent CMD window flash

    let output = cmd.output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);

    if text.contains("time<1ms") || text.contains("time<") {
        return Some(1);
    }
    if let Some(pos) = text.find("time=") {
        let rest = &text[pos + 5..];
        let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(ms) = num_str.parse::<u32>() {
            return Some(ms);
        }
    }
    if let Some(pos) = text.find("Average = ") {
        let rest = &text[pos + 10..];
        let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(ms) = num_str.parse::<u32>() {
            return Some(ms);
        }
    }
    for word in text.split_whitespace() {
        if let Some(stripped) = word.strip_suffix("ms") {
            let digits: String = stripped.chars().filter(|c| c.is_ascii_digit()).collect();
            if let Ok(ms) = digits.parse::<u32>() {
                if ms > 0 && ms < 2000 {
                    return Some(ms);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn ping_valve_servers() -> Result<Vec<ServerPing>, String> {
    use std::sync::mpsc;
    use std::thread;

    let (tx, rx) = mpsc::channel();
    let mut handles = vec![];

    const SAMPLES: u32 = 10;
    for s in VALVE_SERVERS {
        let tx = tx.clone();
        let s = s.clone();
        handles.push(thread::spawn(move || {
            let mut p = ServerPing::from_def(&s);
            let mut probes: Vec<u32> = vec![];
            for i in 0..SAMPLES {
                if let Some(ms) = ping_single_ip(s.ip, 1500) {
                    probes.push(ms);
                }
                // Space probes ~150ms apart so ICMP rate-limiting and queue
                // bursts don't distort consecutive samples.
                if i + 1 < SAMPLES {
                    std::thread::sleep(std::time::Duration::from_millis(130));
                }
            }
            p.loss_pct = ((SAMPLES - probes.len() as u32) as f32 / SAMPLES as f32) * 100.0;
            if !probes.is_empty() {
                // Drop the first reply (ARP/route warmup) when we have spares.
                let used: Vec<u32> = if probes.len() > 2 { probes[1..].to_vec() } else { probes.clone() };
                let mut sorted = used.clone();
                sorted.sort_unstable();
                // Trimmed mean: cut top/bottom 20% -> realistic avg, resists spikes.
                let trim = (sorted.len() as f32 * 0.2).floor() as usize;
                let core = if sorted.len() > trim * 2 { sorted[trim..sorted.len() - trim].to_vec() } else { sorted.clone() };
                let n = core.len() as f32;
                let avg = core.iter().map(|&x| x as f32).sum::<f32>() / n;
                // Jitter: standard deviation of the trimmed set (IETF RFC 3550 style).
                let var = core.iter().map(|&x| (x as f32 - avg).powi(2)).sum::<f32>() / n;
                let jitter = var.sqrt();
                p.avg_ms = Some(avg.round() as u32);
                p.jitter_ms = Some(jitter.round() as u32);
                p.ping_ms = probes.iter().min().copied(); // best sample = connectable RTT
                p.samples = probes;
                let jitter_ratio = if avg > 0.0 { jitter / avg } else { 1.0 };
                let score = (100.0 - (jitter_ratio * 140.0) - (p.loss_pct * 0.8)).round().clamp(0.0, 100.0);
                p.stability = Some(score as u8);
            } else {
                p.samples = probes;
            }
            let _ = tx.send(p);
        }));
    }
    drop(tx);

    let mut results = vec![];
    for ping_res in rx {
        results.push(ping_res);
    }
    for h in handles {
        let _ = h.join();
    }

    results.sort_by_key(|r| r.ping_ms.unwrap_or(9999));
    Ok(results)
}

// ---------- Doorman Visual Debug / Test ConVars ----------
const TEST_CVAR_KEYS: [&str; 10] = [
    "cl_ragdoll_limit",
    "g_ragdoll_maxcount",
    "g_ragdoll_important_maxcount",
    "cl_disable_ragdolls",
    "r_particle_model_new8",
    "r_size_cull_threshold",
    "r_physics_particle_op_spawn_scale",
    "r_citadel_npr_outlines_max_dist",
    "r_drawmodeldecals",
    "cl_simulate_dormant_entities",
];

fn extract_cvar_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let line_clean = if let Some(idx) = line.find("//") {
            &line[..idx]
        } else {
            line
        };
        let t = line_clean.trim();
        if t.is_empty() {
            continue;
        }
        let mut tokens = t.split_whitespace();
        if let Some(first) = tokens.next() {
            let first_clean = first.trim_matches('"');
            if first_clean.eq_ignore_ascii_case(key) {
                if let Some(second) = tokens.next() {
                    return Some(second.trim_matches('"').to_string());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn get_cvar_test_states() -> Result<std::collections::HashMap<String, String>, String> {
    let s = settings::load();
    let deadlock_path = s.last_path.ok_or_else(|| "Deadlock folder not set in settings".to_string())?;
    let gi_path = std::path::Path::new(&deadlock_path).join("game").join("citadel").join("gameinfo.gi");
    if !gi_path.exists() {
        return Err(format!("gameinfo.gi not found at {:?}", gi_path));
    }
    let content = std::fs::read_to_string(&gi_path).map_err(|e| format!("read gameinfo.gi: {e}"))?;

    let mut map = std::collections::HashMap::new();
    for &k in &TEST_CVAR_KEYS {
        let val = extract_cvar_value(&content, k).unwrap_or_else(|| "default".to_string());
        map.insert(k.to_string(), val);
    }
    Ok(map)
}

#[tauri::command]
pub fn apply_cvar_test_states(states: std::collections::HashMap<String, String>) -> Result<String, String> {
    let s = settings::load();
    let deadlock_path = s.last_path.ok_or_else(|| "Deadlock folder not set in settings".to_string())?;
    let citadel_dir = std::path::Path::new(&deadlock_path).join("game").join("citadel");
    let gi_path = citadel_dir.join("gameinfo.gi");
    if !gi_path.exists() {
        return Err(format!("gameinfo.gi not found at {:?}", gi_path));
    }
    let content = std::fs::read_to_string(&gi_path).map_err(|e| format!("read gameinfo.gi: {e}"))?;

    let mut new_lines = Vec::new();
    let mut found_keys = std::collections::HashSet::new();

    for line in content.lines() {
        let mut replaced = false;
        let mut comment = "";
        let mut content_part = line;
        if let Some(idx) = line.find("//") {
            comment = &line[idx..];
            content_part = &line[..idx];
        }

        let tokens: Vec<&str> = content_part.split_whitespace().collect();
        if tokens.len() >= 2 {
            let k = tokens[0].trim_matches('"');
            for (test_k, test_v) in &states {
                if k.eq_ignore_ascii_case(test_k) {
                    let lead = &line[..line.len() - line.trim_start().len()];
                    let sep = if comment.is_empty() { "" } else { "\t" };
                    let new_line = format!("{}{tokens_0} {test_v}{sep}{comment}", lead, tokens_0 = tokens[0]);
                    new_lines.push(new_line);
                    found_keys.insert(test_k.clone());
                    replaced = true;
                    break;
                }
            }
        }
        if !replaced {
            new_lines.push(line.to_string());
        }
    }

    // Insert any missing keys into ConVars block
    let missing_keys: Vec<_> = states.keys().filter(|k| !found_keys.contains(*k)).collect();
    if !missing_keys.is_empty() {
        let mut in_convars = false;
        let mut brace_depth = 0;
        let mut insert_idx = None;

        for (idx, l) in new_lines.iter().enumerate() {
            if l.contains("ConVars") && !l.trim().starts_with("//") {
                in_convars = true;
            }
            if in_convars {
                brace_depth += l.matches('{').count() as i32 - l.matches('}').count() as i32;
                if brace_depth == 0 && new_lines[..=idx].iter().any(|s| s.contains('{')) {
                    insert_idx = Some(idx);
                    break;
                }
            }
        }

        if let Some(idx) = insert_idx {
            for k in missing_keys {
                let v = &states[k];
                new_lines.insert(idx, format!("\t\t\"{k}\"\t\t\"{v}\""));
            }
        }
    }

    let mut gi_out = new_lines.join("\r\n");
    if !gi_out.ends_with("\r\n") {
        gi_out.push_str("\r\n");
    }
    std::fs::write(&gi_path, gi_out).map_err(|e| format!("write gameinfo.gi: {e}"))?;

    // Also update cfg/autoexec.cfg with DLP TEST BLOCK
    let cfg_dir = citadel_dir.join("cfg");
    let ae_path = cfg_dir.join("autoexec.cfg");
    let mut ae_content = if ae_path.exists() {
        std::fs::read_to_string(&ae_path).unwrap_or_default()
    } else {
        String::new()
    };

    let start_tag = "// DLP TEST BLOCK START";
    let end_tag = "// DLP TEST BLOCK END";

    let mut test_block = String::new();
    test_block.push_str(start_tag);
    test_block.push('\n');
    for (k, v) in &states {
        test_block.push_str(&format!("\t{} \"{}\"\n", k, v));
    }
    test_block.push_str(end_tag);

    if let (Some(s_idx), Some(e_idx)) = (ae_content.find(start_tag), ae_content.find(end_tag)) {
        if s_idx <= e_idx {
            let after = &ae_content[e_idx + end_tag.len()..];
            let before = &ae_content[..s_idx];
            ae_content = format!("{}{}{}", before, test_block, after);
        }
    } else {
        if !ae_content.is_empty() && !ae_content.ends_with('\n') {
            ae_content.push('\n');
        }
        ae_content.push_str(&test_block);
        ae_content.push('\n');
    }

    let _ = std::fs::create_dir_all(&cfg_dir);
    std::fs::write(&ae_path, ae_content).map_err(|e| format!("write autoexec.cfg: {e}"))?;

    Ok("Applied to gameinfo.gi & autoexec.cfg successfully!".to_string())
}

