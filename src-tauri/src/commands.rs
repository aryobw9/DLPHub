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

#[tauri::command]
pub fn get_mod_cache_status_cmd() -> Vec<crate::mod_cache::ModStatusDto> {
    crate::mod_cache::get_all_mod_statuses()
}

#[tauri::command]
pub fn clear_mod_cache_cmd() -> Result<u64, String> {
    crate::mod_cache::clear_mod_cache()
}

#[tauri::command]
pub async fn apply_perf_optimization_cmd(
    app: tauri::AppHandle,
    req: dlp_core::perf_overlay::OptimizationRequest,
) -> Result<Vec<install::StepLog>, String> {
    let deadlock = resolve_path(&req.deadlock_path)?;
    let mut req_mut = req;
    req_mut.deadlock_path = deadlock;

    // Check which VPKs are required based on level
    let mut required_addons: Vec<&str> = Vec::new();
    if req_mut.level == 2 {
        // Level 2: Cpu + Gpu Optimization (Level 2 mods: Essential Fixes, Anti Clutter, Doorman Fix)
        required_addons.push("pak04_dir.vpk");
        required_addons.push("pak05_dir.vpk");
        required_addons.push("pak06_dir.vpk");
        if req_mut.higher_brightness { required_addons.push("pak01_dir.vpk"); }
        if req_mut.reduce_clutter { required_addons.push("pak02_dir.vpk"); }
        if req_mut.better_breakables { required_addons.push("pak03_dir.vpk"); }
    } else if req_mut.level >= 3 {
        // Level 3: Potato Mode (pak31 downscaled textures + optional hero potato + level 2 mods)
        required_addons.push("pak31_dir.vpk");
        if req_mut.hero_potato {
            required_addons.push("pak33_dir.vpk");
        }
        required_addons.push("pak04_dir.vpk");
        required_addons.push("pak05_dir.vpk");
        required_addons.push("pak06_dir.vpk");
        if req_mut.higher_brightness { required_addons.push("pak01_dir.vpk"); }
        if req_mut.reduce_clutter { required_addons.push("pak02_dir.vpk"); }
        if req_mut.better_breakables { required_addons.push("pak03_dir.vpk"); }
    }

    if !required_addons.is_empty() {
        crate::mod_cache::ensure_mods_cached(&required_addons, Some(&app)).await?;
    }

    let cache_dir = crate::mod_cache::get_cache_dir();
    let data_dir = settings::data_dir();

    tauri::async_runtime::spawn_blocking(move || {
        dlp_core::perf_overlay::apply_optimization_flow(req_mut, &data_dir, &cache_dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn revert_perf_optimization_cmd(path: String) -> Result<Vec<install::StepLog>, String> {
    let deadlock = resolve_path(&path)?;
    let data_dir = settings::data_dir();
    dlp_core::perf_overlay::revert_optimization_flow(&deadlock, &data_dir)
}

#[tauri::command]
pub fn detect_perf_optimization_cmd(path: String) -> Result<dlp_core::perf_overlay::DetectPerfStatus, String> {
    let deadlock = resolve_path(&path)?;
    Ok(dlp_core::perf_overlay::detect_optimization_flow(&deadlock))
}

#[tauri::command]
pub fn apply_fov_only_cmd(
    path: String,
    fov: u32,
    aspect_ratio: String,
    aspect_ratio_enabled: bool,
) -> Result<String, String> {
    let deadlock = resolve_path(&path)?;
    let data_dir = settings::data_dir();
    dlp_core::perf_overlay::apply_fov_only_flow(
        std::path::Path::new(&deadlock),
        fov,
        &aspect_ratio,
        aspect_ratio_enabled,
        Some(&data_dir),
    )
}

#[tauri::command]
pub fn apply_fps_only_cmd(
    path: String,
    fps_limit: Option<String>,
) -> Result<String, String> {
    let deadlock = resolve_path(&path)?;
    let data_dir = settings::data_dir();
    let limit = fps_limit.unwrap_or_else(|| "DEFAULT".to_string());
    dlp_core::perf_overlay::apply_fps_only_flow(
        std::path::Path::new(&deadlock),
        &limit,
        Some(&data_dir),
    )
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
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
    {
        return Err("invalid backup name".into());
    }
    let data_dir = settings::data_dir();
    if backup::is_main_backup(&data_dir, trimmed) {
        return Err("Cannot delete the initial original game backup".into());
    }
    let bdir = backup::backups_root(&data_dir).join(trimmed);
    if !bdir.is_dir() {
        return Err(format!("backup not found: {trimmed}"));
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
    pub last_path: Option<String>,
    pub better_breakables: bool,
    pub higher_brightness: bool,
    pub reduce_clutter: bool,
    pub fov: u32,
    pub aspect_ratio: String,
    pub aspect_ratio_enabled: bool,
    pub reduced_motion: bool,
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
            last_path: s.last_path,
            better_breakables: s.better_breakables,
            higher_brightness: s.higher_brightness,
            reduce_clutter: s.reduce_clutter,
            fov: s.fov,
            aspect_ratio: s.aspect_ratio,
            aspect_ratio_enabled: s.aspect_ratio_enabled,
            reduced_motion: s.reduced_motion,
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
    pub last_path: Option<String>,
    pub better_breakables: Option<bool>,
    pub higher_brightness: Option<bool>,
    pub reduce_clutter: Option<bool>,
    pub fov: Option<u32>,
    pub aspect_ratio: Option<String>,
    pub aspect_ratio_enabled: Option<bool>,
    pub reduced_motion: Option<bool>,
    pub fps_max: Option<i32>, // -1: None (default/untouched), >=0: Some(n)
    pub custom_autoexec: Option<String>,
    pub renderer: Option<String>,
    pub stop_cloth_anim: Option<bool>,
    pub ragdoll_fade: Option<bool>,
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
    if let Some(p) = patch.last_path {
        s.last_path = if p.trim().is_empty() { None } else { Some(p) };
    }
    if let Some(fov) = patch.fov { s.fov = fov.min(90); }
    if let Some(ar) = patch.aspect_ratio { s.aspect_ratio = ar; }
    if let Some(are) = patch.aspect_ratio_enabled { s.aspect_ratio_enabled = are; }
    if let Some(rm) = patch.reduced_motion { s.reduced_motion = rm; }
    if let Some(b) = patch.better_breakables {
        s.better_breakables = b;
    }
    if let Some(hb) = patch.higher_brightness {
        s.higher_brightness = hb;
    }
    if let Some(rc) = patch.reduce_clutter {
        s.reduce_clutter = rc;
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
    diag.push_str(&format!("Settings: lang={}, last_path={:?}, fov={}, aspect_ratio={}, aspect_ratio_enabled={}, reduced_motion={}, fps_max={:?}, better_breakables={}, higher_brightness={}, reduce_clutter={}, stop_cloth_anim={}, ragdoll_fade={}\n",
        s.lang, s.last_path, s.fov, s.aspect_ratio, s.aspect_ratio_enabled, s.reduced_motion, s.fps_max, s.better_breakables, s.higher_brightness, s.reduce_clutter, s.stop_cloth_anim, s.ragdoll_fade
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
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") {
        return Err("Only https:// URLs are allowed".into());
    }
    open::that(trimmed).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_logs_folder() -> Result<(), String> {
    let data_dir = settings::data_dir();
    let logs_dir = data_dir.join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    open::that(&logs_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_client_error(level: String, message: String) -> Result<(), String> {
    let data_dir = settings::data_dir();
    dlp_core::logger::log(&data_dir, &level, &message);
    Ok(())
}

// ---------- misc ----------
#[tauri::command]
pub fn launch_game() -> Result<(), String> {
    let s = settings::load();
    let uri = match s.renderer.as_str() {
        "dx11" => "steam://run/1422450//-dx11%20-condebug%20-conclearlog/",
        "vulkan" => "steam://run/1422450//-vulkan%20-condebug%20-conclearlog/",
        _ => "steam://run/1422450//-condebug%20-conclearlog/",
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

// ---------- Latency & Server Picker Commands ----------

#[tauri::command]
pub fn check_admin_status() -> bool {
    crate::latency::is_elevated()
}

#[tauri::command]
pub fn check_firewall_status() -> bool {
    crate::latency::is_firewall_enabled()
}

#[tauri::command]
pub async fn enable_firewall_cmd() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(crate::latency::enable_windows_firewall)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn restart_as_admin() -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Ok(exe) = std::env::current_exe() {
            let path_str = exe.to_string_lossy().replace('\'', "''");
            let _ = std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", &format!("Start-Process -FilePath '{}' -Verb RunAs", path_str)])
                .spawn();
            std::process::exit(0);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_valve_clusters() -> Result<Vec<crate::latency::ValveCluster>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let blocked = crate::latency::get_firewall_blocked_clusters_raw();
        let mut list = Vec::new();
        for def in crate::latency::VALVE_CLUSTERS_RAW {
            let is_blocked = blocked.contains(def.id);
            list.push(crate::latency::ValveCluster {
                id: def.id.to_string(),
                name: def.name.to_string(),
                name_fa: def.name_fa.to_string(),
                region: def.region.to_string(),
                region_name: def.region_name.to_string(),
                region_name_fa: def.region_name_fa.to_string(),
                primary_ip: def.primary_ip.to_string(),
                relay_ips: def.relay_ips.iter().map(|s| s.to_string()).collect(),
                ping_ms: None,
                avg_ms: None,
                jitter_ms: None,
                loss_pct: 0.0,
                stability: None,
                is_blocked,
                is_top5: false,
            });
        }
        list
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ping_valve_clusters() -> Result<Vec<crate::latency::ValveCluster>, String> {
    tauri::async_runtime::spawn_blocking(crate::latency::benchmark_clusters_parallel)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn deep_benchmark_clusters_cmd(duration_secs: Option<u32>) -> Result<Vec<crate::latency::ValveCluster>, String> {
    let secs = duration_secs.unwrap_or(30);
    tauri::async_runtime::spawn_blocking(move || crate::latency::deep_benchmark_clusters(secs))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_cluster_block(id: String, blocked: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if blocked {
            if let Some(def) = crate::latency::VALVE_CLUSTERS_RAW.iter().find(|c| c.id == id) {
                let ips: Vec<String> = def.relay_ips.iter().map(|s| s.to_string()).collect();
                crate::latency::block_cluster_relay(&id, &ips)?;
            }
        } else {
            crate::latency::unblock_cluster_relay(&id)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn apply_top5_clusters(top5_ids: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::latency::apply_top5_firewall_rules(&top5_ids)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn unblock_all_clusters() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(crate::latency::unblock_all_clusters_relays)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn apply_cluster_preset_cmd(blocked_ids: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::latency::apply_cluster_preset_rules(&blocked_ids)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_dns_profiles() -> Result<Vec<crate::latency::DnsProfile>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let active_ips = crate::latency::get_active_dns_ips();
        let mut list = Vec::new();
        for &(id, name, name_fa, desc, desc_fa, tag, tag_fa, primary, secondary) in crate::latency::DNS_PROFILES_RAW {
            let is_active = active_ips.iter().any(|ip| ip == primary || ip == secondary);
            list.push(crate::latency::DnsProfile {
                id: id.to_string(),
                name: name.to_string(),
                name_fa: name_fa.to_string(),
                desc: desc.to_string(),
                desc_fa: desc_fa.to_string(),
                tag: tag.to_string(),
                tag_fa: tag_fa.to_string(),
                primary: primary.to_string(),
                secondary: secondary.to_string(),
                is_active,
                ping_ms: None,
            });
        }
        list
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ping_dns_profiles() -> Result<Vec<crate::latency::DnsProfile>, String> {
    tauri::async_runtime::spawn_blocking(crate::latency::benchmark_dns_profiles_parallel)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn deep_benchmark_dns_cmd(duration_secs: Option<u32>) -> Result<Vec<crate::latency::DnsProfile>, String> {
    let secs = duration_secs.unwrap_or(30);
    tauri::async_runtime::spawn_blocking(move || crate::latency::deep_benchmark_dns_profiles(secs))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn apply_dns_profile(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(&(_, _, _, _, _, _, _, primary, secondary)) =
            crate::latency::DNS_PROFILES_RAW.iter().find(|p| p.0 == id)
        {
            crate::latency::apply_dns_to_adapters(primary, secondary)
        } else {
            Err("DNS profile not found".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn reset_dns_dhcp() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(crate::latency::reset_dns_to_dhcp_adapters)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn flush_dns_cmd() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(crate::latency::flush_dns_cache)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn apply_latency_tweaks_cmd(tweaks: crate::latency::LatencyTweaksState) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let deadlock_path = settings::load().last_path;
        crate::latency::apply_latency_tweaks(&tweaks, deadlock_path.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn revert_latency_tweaks_cmd() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let deadlock_path = settings::load().last_path;
        crate::latency::revert_latency_tweaks(deadlock_path.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}


// ---------- LAN Connection ----------
use crate::lan_supervisor::{self, LanHostConfig, LanServerStatus, LocalIpInfo};
use crate::lan_query::{self, A2SServerInfo};
use crate::lan_vip::{self, VipCreateResponse, VipJoinResponse, VipRedeemResponse, VipRoomStatus, VipStatusResponse};

#[tauri::command]
pub fn get_lan_local_ips() -> Vec<LocalIpInfo> {
    lan_supervisor::get_local_ipv4_addresses()
}

#[tauri::command]
pub async fn start_lan_server(config: LanHostConfig) -> Result<LanServerStatus, String> {
    lan_supervisor::start_dedicated_server(config).await
}

#[tauri::command]
pub fn stop_lan_server() -> Result<(), String> {
    lan_supervisor::stop_dedicated_server()
}

#[tauri::command]
pub fn get_lan_server_status() -> LanServerStatus {
    lan_supervisor::get_server_status()
}


#[tauri::command]
pub fn list_lan_matches() -> Vec<String> {
    lan_supervisor::list_lan_matches()
}

#[tauri::command]
pub fn get_lan_match_metadata(
    match_id: Option<String>,
    #[allow(non_snake_case)] matchId: Option<String>,
) -> Result<String, String> {
    let id = match_id.or(matchId).ok_or_else(|| "Missing matchId parameter".to_string())?;
    lan_supervisor::get_lan_match_metadata(&id)
        .ok_or_else(|| format!("Match report {} not found", id))
}

#[tauri::command]
pub fn send_lan_server_command(command: String) -> Result<(), String> {
    lan_supervisor::send_server_command(&command)
}

#[tauri::command]
pub fn get_lan_lobby_status() -> Option<String> {
    lan_supervisor::get_lobby_status()
}

#[tauri::command]
pub async fn query_lan_server(ip: String, port: u16) -> Result<A2SServerInfo, String> {
    lan_query::query_a2s_info(&ip, port).await
}

#[tauri::command]
pub async fn create_vip_room_cmd(
    api_url: Option<String>,
    nickname: String,
    mode: Option<String>,
    is_modded: Option<bool>,
    mod_mode: Option<String>,
    enable_sdr: Option<bool>,
    room_name: Option<String>,
    is_hidden: Option<bool>,
    password: Option<String>,
    max_players: Option<usize>,
    account_token: Option<String>,
) -> Result<VipCreateResponse, String> {
    lan_vip::create_vip_room(api_url, nickname, mode, is_modded, mod_mode, enable_sdr, room_name, is_hidden, password, max_players, account_token).await
}

#[tauri::command]
pub async fn join_vip_room_cmd(
    api_url: Option<String>,
    room_code: String,
    nickname: String,
    password: Option<String>,
    account_token: Option<String>,
) -> Result<VipJoinResponse, String> {
    lan_vip::join_vip_room(api_url, room_code, nickname, password, account_token).await
}

#[tauri::command]
pub async fn get_vip_room_status_cmd(
    api_url: Option<String>,
    room_code: String,
) -> Result<VipRoomStatus, String> {
    lan_vip::get_vip_room_status(api_url, room_code).await
}

#[tauri::command]
pub async fn leave_vip_room_cmd(
    api_url: Option<String>,
    room_code: String,
    account_token: Option<String>,
) -> Result<(), String> {
    lan_vip::leave_vip_room(api_url, room_code, account_token).await
}

#[tauri::command]
pub async fn kick_vip_peer_cmd(
    api_url: Option<String>,
    room_code: String,
    peer_name: String,
    account_token: Option<String>,
) -> Result<(), String> {
    lan_vip::kick_vip_peer(api_url, room_code, peer_name, account_token).await
}

#[tauri::command]
pub async fn ban_vip_peer_cmd(
    api_url: Option<String>,
    room_code: String,
    peer_name: String,
    account_token: Option<String>,
) -> Result<(), String> {
    lan_vip::ban_vip_peer(api_url, room_code, peer_name, account_token).await
}

#[tauri::command]
pub async fn unban_vip_peer_cmd(
    api_url: Option<String>,
    room_code: String,
    peer_name: String,
    account_token: Option<String>,
) -> Result<(), String> {
    lan_vip::unban_vip_peer(api_url, room_code, peer_name, account_token).await
}

#[tauri::command]
pub async fn list_vip_devices_cmd(
    api_url: Option<String>,
    account_token: Option<String>,
) -> Result<Vec<lan_vip::VipDevice>, String> {
    lan_vip::list_vip_devices(api_url, account_token).await
}

#[tauri::command]
pub async fn unbind_vip_device_cmd(
    api_url: Option<String>,
    hwid: String,
    account_token: Option<String>,
) -> Result<(), String> {
    lan_vip::unbind_vip_device(api_url, hwid, account_token).await
}

#[tauri::command]
pub async fn list_vip_rooms_cmd(
    api_url: Option<String>,
) -> Result<Vec<lan_vip::VipRoomSummary>, String> {
    lan_vip::list_vip_rooms(api_url).await
}

#[tauri::command]
pub async fn prepare_modded_client_cmd(mode: String) -> Result<(), String> {
    lan_supervisor::prepare_modded_client(&mode).await
}

#[tauri::command]
pub async fn setup_host_server_env_cmd(mode: String) -> Result<(), String> {
    lan_supervisor::setup_host_server_environment(&mode).await
}

#[tauri::command]
pub fn close_deadlock_game_cmd() -> Result<(), String> {
    lan_supervisor::close_deadlock_game();
    Ok(())
}

#[tauri::command]
pub fn is_deadlock_running_cmd() -> bool {
    lan_supervisor::is_deadlock_running()
}

#[tauri::command]
pub fn restore_vanilla_client_cmd() -> Result<(), String> {
    if let Some(_found) = dlp_core::discovery::find_game() {
        crate::storage::clean_all_mods_and_restore_vanilla();
        Ok(())
    } else {
        Err("Deadlock installation folder not found".into())
    }
}

#[tauri::command]
pub async fn auto_join_deadlock_cmd(connect_target: String, mode: Option<String>) -> Result<(), String> {
    if let Some(m) = mode {
        if !m.trim().is_empty() {
            let _ = lan_supervisor::prepare_modded_client(&m).await;
        }
    }
    lan_supervisor::launch_deadlock_target(&connect_target)
}

#[tauri::command]
pub fn check_deadworks_env_cmd() -> serde_json::Value {
    let dotnet_ok = crate::storage::check_dotnet10_installed();
    let found = dlp_core::discovery::find_game();
    let game_found = found.is_some();
    let bootstrap_cached = crate::storage::get_client_bootstrap_file().is_file();
    let ability_brawl_cached = crate::storage::get_client_addon_file("ability_brawl").is_file();
    let cursed_arena_cached = crate::storage::get_client_addon_file("cursed_arena").is_file()
        || crate::storage::get_client_addon_loose_dir("cursed_arena").is_dir();
    let automatch_cached = crate::storage::get_server_loader_dir().join("plugins").join("automatch").exists();

    let mut gameinfo_patched = false;
    if let Some(ref g) = found {
        let gi_path = std::path::Path::new(&g.deadlock).join("game").join("citadel").join("gameinfo.gi");
        if let Ok(c) = std::fs::read_to_string(gi_path) {
            gameinfo_patched = c.contains("citadel/custom") && c.contains("deadworks_mods");
        }
    }

    serde_json::json!({
        "dotnet10": dotnet_ok,
        "game_found": game_found,
        "bootstrap_cached": bootstrap_cached,
        "ability_brawl_cached": ability_brawl_cached,
        "cursed_arena_cached": cursed_arena_cached,
        "automatch_cached": automatch_cached,
        "gameinfo_patched": gameinfo_patched
    })
}

#[tauri::command]
pub fn check_vip_binaries_cmd() -> bool {
    lan_vip::check_vip_binaries_installed()
}


#[tauri::command]
pub async fn redeem_vip_key_cmd(
    api_url: Option<String>,
    key: String,
    nickname: Option<String>,
    account_token: Option<String>,
) -> Result<VipRedeemResponse, String> {
    lan_vip::redeem_vip_license(api_url, key, nickname, account_token).await
}

#[tauri::command]
pub async fn check_vip_status_cmd(
    api_url: Option<String>,
    account_token: Option<String>,
) -> Result<VipStatusResponse, String> {
    lan_vip::check_vip_license_status(api_url, account_token).await
}

#[tauri::command]
pub fn get_machine_hwid_cmd() -> String {
    crate::hwid::get_machine_hwid()
}



