// DLPHub Universal Storage & Asset Manager
// Manages DLPHubStorage folder created alongside the application executable.
// Handles on-demand downloading of modded server loader (Deadworks + plugins) and VPK mods from VPS.

use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerLoaderProgressEvent {
    pub current_bytes: u64,
    pub total_bytes: u64,
    pub percent: u8,
    pub speed_kbps: u64,
    pub status: String, // "downloading", "extracting", "completed", "error"
}

#[derive(Debug, Clone)]
pub struct PackageMeta {
    pub filename: &'static str,
    pub size_bytes: u64,
    pub sha256: &'static str,
}

pub const OFFICIAL_SERVER_LOADER: PackageMeta = PackageMeta {
    filename: "server_loader.zip",
    size_bytes: 5_677_952,
    sha256: "27d4bc4b38f30d61c8b9b6541c8e801d0d9cd09b34097d4af7addfa5a2aeb27f",
};

pub const OFFICIAL_CLIENT_BOOTSTRAP: PackageMeta = PackageMeta {
    filename: "client_bootstrap.zip",
    size_bytes: 342_339,
    sha256: "976f2077099008c078365e4f4476af041129bf75ce39369097fb2b36e2a86293",
};

pub const OFFICIAL_CLIENT_ABILITY_BRAWL: PackageMeta = PackageMeta {
    filename: "client_ability_brawl.zip",
    size_bytes: 422_990,
    sha256: "58bbb5d9f00e55774beae6f693060ca3db997944e34b6b53866b3c438939b942",
};

pub const OFFICIAL_CLIENT_CURSED_ARENA: PackageMeta = PackageMeta {
    filename: "client_cursed_arena.zip",
    size_bytes: 262_193,
    sha256: "a1541de1c15513312a14c42159300a1b066bff1cb77f64c1bb1b3b15d256d33e",
};

/// Returns the central storage directory alongside the executable: `<exe_dir>/DLPHubStorage`
pub fn get_storage_dir() -> PathBuf {
    if let Ok(custom) = std::env::var("DLPHUB_STORAGE_DIR") {
        let p = PathBuf::from(custom);
        let _ = std::fs::create_dir_all(&p);
        return p;
    }

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));

    // 1. Direct check: <exe_dir>/DLPHubStorage with contents
    let direct_storage = exe_dir.join("DLPHubStorage");
    if direct_storage.join("client_assets").exists() || direct_storage.join("server_loader").exists() {
        let _ = std::fs::create_dir_all(&direct_storage);
        return direct_storage;
    }

    // 2. Scan ancestors for a repository root that contains DLPHubStorage
    if let Some(root) = exe_dir.ancestors().find(|a| {
        a.join("DLPHubStorage").join("client_assets").exists()
            || a.join("DLPHubStorage").join("server_loader").exists()
            || (a.join("src-tauri").is_dir() && a.join("DLPHubStorage").is_dir())
    }) {
        let storage = root.join("DLPHubStorage");
        let _ = std::fs::create_dir_all(&storage);
        return storage;
    }

    let _ = std::fs::create_dir_all(&direct_storage);
    direct_storage
}

/// Returns `<storage_dir>/mods` for caching downloaded VPK mod files
pub fn get_mods_storage_dir() -> PathBuf {
    let p = get_storage_dir().join("mods");
    let _ = std::fs::create_dir_all(&p);

    // One-time legacy migration from %APPDATA%/DLPHub/cache/addons
    let legacy = dlp_core::settings::data_dir().join("cache").join("addons");
    if legacy.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&legacy) {
            for entry in entries.flatten() {
                let src = entry.path();
                if src.is_file() {
                    let dst = p.join(entry.file_name());
                    if !dst.exists() {
                        let _ = std::fs::copy(&src, &dst);
                    }
                }
            }
        }
    }

    p
}

/// Returns `<storage_dir>/client_assets`
pub fn get_client_assets_dir() -> PathBuf {
    let p = get_storage_dir().join("client_assets");
    let _ = std::fs::create_dir_all(&p);
    p
}

pub fn get_client_bootstrap_file() -> PathBuf {
    get_client_assets_dir().join("bootstrap").join("pak01_dir.vpk")
}

pub fn get_client_addon_file(mode: &str) -> PathBuf {
    let clean = mode.trim().to_lowercase();
    let vpk_name = if clean == "cursed_arena" || clean == "cursedarena" {
        "pak84_dir.vpk"
    } else {
        "pak45_dir.vpk"
    };
    get_client_assets_dir().join("addons").join(clean).join(vpk_name)
}

pub fn get_client_addon_loose_dir(mode: &str) -> PathBuf {
    let clean = mode.trim().to_lowercase();
    get_client_assets_dir().join("addons").join(clean).join("loose_files")
}

/// Returns `<storage_dir>/server_loader`
pub fn get_server_loader_dir() -> PathBuf {
    let p = get_storage_dir().join("server_loader");
    let _ = std::fs::create_dir_all(&p);
    p
}

/// Returns `<storage_dir>/lan_matches`
pub fn get_lan_matches_dir() -> PathBuf {
    let p = get_storage_dir().join("lan_matches");
    let _ = std::fs::create_dir_all(&p);
    p
}

/// Copies a directory tree recursively
pub fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
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

pub fn check_dotnet10_installed() -> bool {
    let mut cmd = std::process::Command::new("dotnet");
    cmd.arg("--list-runtimes");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    if let Ok(out) = cmd.output() {
        let text = String::from_utf8_lossy(&out.stdout);
        return text.contains("Microsoft.NETCore.App 10.") || text.contains("Microsoft.WindowsDesktop.App 10.");
    }
    false
}

/// Ensures the modded server loader (deadworks + plugins) is available locally.
/// If not already in DLPHubStorage/server_loader, downloads the clean official
/// server_loader.zip package from the VPS and extracts it.
pub async fn ensure_server_loader_available(app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
    let loader_dir = get_server_loader_dir();
    let deadworks_exe = loader_dir.join("deadworks").join("game").join("bin").join("win64").join("deadworks.exe");
    let alt_deadworks_exe = loader_dir.join("bin").join("deadworks.exe");

    if deadworks_exe.is_file() || alt_deadworks_exe.is_file() {
        return Ok(loader_dir);
    }

    // 1. Dynamic local repository check
    if let Ok(exe) = std::env::current_exe() {
        if let Some(root) = exe.ancestors().find(|a| a.join("src-tauri").is_dir() && a.join("DLPHubStorage").is_dir()) {
            let dev_loader = root.join("DLPHubStorage").join("server_loader");
            if dev_loader.join("deadworks").join("game").join("bin").join("win64").join("deadworks.exe").is_file() {
                let _ = copy_dir_recursive(&dev_loader, &loader_dir);
                if deadworks_exe.is_file() {
                    return Ok(loader_dir);
                }
            }
        }
    }

    // 2. Download clean official server loader package from VPS
    let vps_url = format!("{}/api/server-loader/download", crate::lan_vip::DEFAULT_VIP_API);
    println!("[Storage] Downloading clean server_loader package from {vps_url}...");

    if let Some(app) = app_handle {
        let _ = app.emit("server-loader-progress", ServerLoaderProgressEvent {
            current_bytes: 0,
            total_bytes: 2_720_000,
            percent: 0,
            speed_kbps: 0,
            status: "downloading".to_string(),
        });
    }

    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let mut response = client.get(&vps_url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to VPS at {vps_url}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("VPS returned HTTP {} for server_loader.zip", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(3_000_000);
    let tmp_zip = loader_dir.join("server_loader.download.tmp");
    let _ = std::fs::remove_file(&tmp_zip);

    let mut file = tokio::fs::File::create(&tmp_zip)
        .await
        .map_err(|e| format!("Failed to create temporary file {tmp_zip:?}: {e}"))?;

    use tokio::io::AsyncWriteExt;
    let mut downloaded: u64 = 0;
    let start_time = Instant::now();
    let mut last_emit = Instant::now();

    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Network read error: {e}"))? {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Disk write error: {e}"))?;

        downloaded += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 150 || downloaded == total_bytes {
            last_emit = Instant::now();
            let elapsed_sec = start_time.elapsed().as_secs_f64().max(0.001);
            let speed_kbps = ((downloaded as f64 / 1024.0) / elapsed_sec) as u64;
            let percent = if total_bytes > 0 {
                ((downloaded as f64 / total_bytes as f64) * 100.0).min(100.0) as u8
            } else {
                0
            };

            if let Some(app) = app_handle {
                let evt = ServerLoaderProgressEvent {
                    current_bytes: downloaded,
                    total_bytes,
                    percent,
                    speed_kbps,
                    status: "downloading".to_string(),
                };
                let _ = app.emit("server-loader-progress", evt);
            }
        }
    }

    file.flush().await.map_err(|e| format!("Disk flush error: {e}"))?;
    drop(file);

    // Cryptographic SHA-256 integrity verification
    if !crate::mod_cache::verify_file_sha256(&tmp_zip, OFFICIAL_SERVER_LOADER.sha256) {
        let _ = std::fs::remove_file(&tmp_zip);
        if let Some(app) = app_handle {
            let _ = app.emit("server-loader-progress", ServerLoaderProgressEvent {
                current_bytes: downloaded,
                total_bytes,
                percent: 100,
                speed_kbps: 0,
                status: "error".to_string(),
            });
        }
        return Err("SHA-256 cryptographic verification failed for server_loader.zip. Download rejected for security.".into());
    }

    // Extract zip
    let zip_file = File::open(&tmp_zip).map_err(|e| format!("Open zip failed: {e}"))?;
    let mut archive = zip::ZipArchive::new(BufReader::new(zip_file))
        .map_err(|e| format!("Corrupt zip archive: {e}"))?;

    archive.extract(&loader_dir)
        .map_err(|e| format!("Failed to extract server loader: {e}"))?;

    let _ = std::fs::remove_file(&tmp_zip);

    if let Some(app) = app_handle {
        let _ = app.emit("server-loader-progress", ServerLoaderProgressEvent {
            current_bytes: downloaded,
            total_bytes,
            percent: 100,
            speed_kbps: 0,
            status: "completed".to_string(),
        });
    }

    Ok(loader_dir)
}

/// Ensures Deadworks client bootstrap VPK is downloaded into DLPHubStorage/client_assets/bootstrap/
pub async fn ensure_client_bootstrap_available(_app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
    let target_vpk = get_client_bootstrap_file();
    if target_vpk.is_file() {
        return Ok(target_vpk);
    }

    let boot_dir = target_vpk.parent().unwrap();
    let _ = std::fs::create_dir_all(boot_dir);

    let vps_url = format!("{}/api/deadworks/client-bootstrap/download", crate::lan_vip::DEFAULT_VIP_API);
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mut response = client.get(&vps_url).send().await
        .map_err(|e| format!("Failed to reach VPS at {vps_url}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("VPS returned HTTP {} for client bootstrap", response.status()));
    }

    let tmp_zip = boot_dir.join("bootstrap.download.tmp");
    let mut file = tokio::fs::File::create(&tmp_zip).await.map_err(|e| e.to_string())?;

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // Cryptographic SHA-256 integrity verification
    if !crate::mod_cache::verify_file_sha256(&tmp_zip, OFFICIAL_CLIENT_BOOTSTRAP.sha256) {
        let _ = std::fs::remove_file(&tmp_zip);
        return Err("SHA-256 cryptographic verification failed for client_bootstrap.zip. Download rejected for security.".into());
    }

    let zip_file = File::open(&tmp_zip).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(BufReader::new(zip_file)).map_err(|e| e.to_string())?;
    archive.extract(boot_dir).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp_zip);

    if !target_vpk.is_file() {
        return Err("Bootstrap extraction did not produce pak01_dir.vpk".into());
    }

    Ok(target_vpk)
}

/// Ensures client addon VPK (e.g. Ability Brawl pak45_dir.vpk) is available in DLPHubStorage/client_assets/addons/{mode}/
pub async fn ensure_client_addon_available(mode: &str, _app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
    let clean_mode = mode.trim().to_lowercase();
    let target_vpk = get_client_addon_file(&clean_mode);
    let addon_dir = target_vpk.parent().unwrap();
    let _ = std::fs::create_dir_all(addon_dir);

    if target_vpk.is_file() {
        return Ok(target_vpk);
    }

    // Local discovery fallback from game folder
    let mut candidates = Vec::new();
    if let Some(found) = dlp_core::discovery::find_game() {
        let root = Path::new(&found.deadlock);
        candidates.push(root.join("game").join("citadel").join("custom").join("pak84_dir.vpk"));
        candidates.push(root.join("game").join("citadel").join("addons").join("pak84_dir.vpk"));
    }

    for c in candidates {
        if c.is_file() && (clean_mode == "cursed_arena" || clean_mode == "cursedarena") {
            let _ = std::fs::copy(&c, &target_vpk);
            if target_vpk.is_file() {
                return Ok(target_vpk);
            }
        }
    }

    let expected_hash = if clean_mode == "ability_brawl" {
        OFFICIAL_CLIENT_ABILITY_BRAWL.sha256
    } else if clean_mode == "cursed_arena" || clean_mode == "cursedarena" {
        OFFICIAL_CLIENT_CURSED_ARENA.sha256
    } else {
        return Err(format!("Unknown or unauthorized addon requested: '{clean_mode}'"));
    };

    let vps_url = format!("{}/api/deadworks/client-addon/{clean_mode}/download", crate::lan_vip::DEFAULT_VIP_API);
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mut response = client.get(&vps_url).send().await
        .map_err(|e| format!("Failed to reach VPS at {vps_url}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("VPS returned HTTP {} for addon {clean_mode}", response.status()));
    }

    let tmp_zip = addon_dir.join("addon.download.tmp");
    let mut file = tokio::fs::File::create(&tmp_zip).await.map_err(|e| e.to_string())?;

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // Cryptographic SHA-256 integrity verification
    if !crate::mod_cache::verify_file_sha256(&tmp_zip, expected_hash) {
        let _ = std::fs::remove_file(&tmp_zip);
        return Err(format!("SHA-256 cryptographic verification failed for addon {clean_mode}. Download rejected for security."));
    }

    let zip_file = File::open(&tmp_zip).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(BufReader::new(zip_file)).map_err(|e| e.to_string())?;
    archive.extract(addon_dir).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp_zip);

    if !target_vpk.is_file() {
        return Err(format!("Addon extraction did not produce {:?} for {clean_mode}", target_vpk.file_name().unwrap_or_default()));
    }

    Ok(target_vpk)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeadworksManifest {
    pub deployed_files: Vec<String>,
}

pub fn resolve_open_pak_slot(
    dst_dir: &Path,
    preferred_name: &str,
    src_len: u64,
    deployed_files: &[String],
    deadlock_dir: &Path,
) -> String {
    let target = dst_dir.join(preferred_name);
    let rel_target = target
        .strip_prefix(deadlock_dir)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| target.to_string_lossy().replace('\\', "/"));

    // If destination does not exist, or we already deployed it in this session:
    if !target.exists() || deployed_files.contains(&rel_target) {
        return preferred_name.to_string();
    }

    // If it exists with identical length: reuse it without collision
    if let Ok(m) = target.metadata() {
        if m.len() == src_len {
            return preferred_name.to_string();
        }
    }

    // Destination exists and has different size (user's mod!).
    // Never touch, move, or overwrite user's mod. Find an open slot in pak(11..=90).rev()
    for n in (11..=90).rev() {
        let candidate = format!("pak{:02}_dir.vpk", n);
        let candidate_path = dst_dir.join(&candidate);
        let rel_candidate = candidate_path
            .strip_prefix(deadlock_dir)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| candidate_path.to_string_lossy().replace('\\', "/"));

        if !candidate_path.exists() && !deployed_files.contains(&rel_candidate) {
            return candidate;
        }
    }

    // Fallback: search 91..=99
    for n in 91..=99 {
        let candidate = format!("pak{:02}_dir.vpk", n);
        let candidate_path = dst_dir.join(&candidate);
        let rel_candidate = candidate_path
            .strip_prefix(deadlock_dir)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| candidate_path.to_string_lossy().replace('\\', "/"));

        if !candidate_path.exists() && !deployed_files.contains(&rel_candidate) {
            return candidate;
        }
    }

    preferred_name.to_string()
}

/// Copies a file with smart version/size checking. If destination already exists with
/// the exact same byte size, the copy is skipped completely for instant staging.
pub fn link_or_copy_file(src: &Path, dst: &Path) -> Result<(), String> {
    if let Some(parent) = dst.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // If destination already exists:
    if dst.is_file() {
        if let (Ok(sm), Ok(dm)) = (src.metadata(), dst.metadata()) {
            if sm.len() > 0 && sm.len() == dm.len() {
                // Exact same size already present on disk, nothing to do!
                return Ok(());
            }
        }
        // Different size/version, remove existing file before copying fresh one
        let _ = std::fs::remove_file(dst);
    }

    std::fs::copy(src, dst)
        .map_err(|e| format!("Failed to copy {:?} to {:?}: {e}", src, dst))?;
    Ok(())
}

impl DeadworksManifest {
    pub fn manifest_path(deadlock_dir: &Path) -> PathBuf {
        deadlock_dir.join("game").join("citadel").join("deadworks_manifest.json")
    }

    pub fn load(deadlock_dir: &Path) -> Self {
        let path = Self::manifest_path(deadlock_dir);
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(m) = serde_json::from_str::<Self>(&data) {
                return m;
            }
        }
        Self::default()
    }

    pub fn save(&self, deadlock_dir: &Path) {
        let path = Self::manifest_path(deadlock_dir);
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(data) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(path, data);
        }
    }

    pub fn deploy_vpk_slot(
        &mut self,
        deadlock_dir: &Path,
        src: &Path,
        dst_dir: &Path,
        preferred_name: &str,
    ) -> Result<PathBuf, String> {
        let src_len = src.metadata().map_err(|e| e.to_string())?.len();
        let slot_name = resolve_open_pak_slot(dst_dir, preferred_name, src_len, &self.deployed_files, deadlock_dir);
        let dst = dst_dir.join(&slot_name);

        let rel_dst = dst.strip_prefix(deadlock_dir)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| dst.to_string_lossy().replace('\\', "/"));

        // If target exists and has exact same length, skip copying
        if dst.exists() {
            if let Ok(m) = dst.metadata() {
                if m.len() == src_len {
                    if !self.deployed_files.contains(&rel_dst) {
                        self.deployed_files.push(rel_dst);
                    }
                    return Ok(dst);
                }
            }
        }

        link_or_copy_file(src, &dst)?;

        if !self.deployed_files.contains(&rel_dst) {
            self.deployed_files.push(rel_dst);
        }
        Ok(dst)
    }

    pub fn deploy_file(&mut self, deadlock_dir: &Path, src: &Path, dst: &Path) -> Result<(), String> {
        let rel_dst = dst.strip_prefix(deadlock_dir)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| dst.to_string_lossy().replace('\\', "/"));

        // Smart Version Check: If destination exists and has exact same byte size, skip copying!
        if dst.is_file() {
            if let (Ok(sm), Ok(dm)) = (src.metadata(), dst.metadata()) {
                if sm.len() > 0 && sm.len() == dm.len() {
                    if !self.deployed_files.contains(&rel_dst) {
                        self.deployed_files.push(rel_dst);
                    }
                    return Ok(());
                }
            }
        }

        // If destination exists and was NOT deployed by us, check if it's a VPK
        if dst.is_file() && !self.deployed_files.contains(&rel_dst) {
            let fname = dst.file_name().unwrap_or_default().to_string_lossy();
            if fname.starts_with("pak") && fname.ends_with("_dir.vpk") {
                if let Some(dst_dir) = dst.parent() {
                    let _ = self.deploy_vpk_slot(deadlock_dir, src, dst_dir, &fname)?;
                    return Ok(());
                }
            }
        }

        link_or_copy_file(src, dst)?;

        if !self.deployed_files.contains(&rel_dst) {
            self.deployed_files.push(rel_dst);
        }
        Ok(())
    }

    pub fn deploy_dir_recursive(&mut self, deadlock_dir: &Path, src: &Path, dst: &Path) -> Result<(), String> {
        if !src.is_dir() {
            return Ok(());
        }
        let _ = std::fs::create_dir_all(dst);
        for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
            let path = entry.path();
            let target = dst.join(entry.file_name());
            if path.is_dir() {
                self.deploy_dir_recursive(deadlock_dir, &path, &target)?;
            } else if path.is_file() {
                self.deploy_file(deadlock_dir, &path, &target)?;
            }
        }
        Ok(())
    }
}

/// Stages Deadworks dedicated server runtime and the specific chosen plugin into Deadlock installation
pub fn deploy_deadworks_to_game(deadlock_dir: &Path, mode: &str) -> Result<(), String> {
    let mut manifest = DeadworksManifest::load(deadlock_dir);

    let loader_dir = get_server_loader_dir();
    let deadworks_src = loader_dir.join("deadworks").join("game");
    let alt_src = loader_dir.join("game");
    let actual_src = if deadworks_src.is_dir() {
        Some(deadworks_src)
    } else if alt_src.is_dir() {
        Some(alt_src)
    } else {
        None
    };

    let target_game = deadlock_dir.join("game");

    // 1. Copy base deadworks files into Deadlock/game
    if let Some(src) = actual_src {
        manifest.deploy_dir_recursive(deadlock_dir, &src, &target_game)?;
    } else {
        let existing = target_game.join("bin").join("win64").join("deadworks.exe");
        if !existing.is_file() {
            return Err("Deadworks base files not found in DLPHubStorage".into());
        }
    }

    // 2. Plugins target folder
    let plugins_target = target_game.join("bin").join("win64").join("managed").join("plugins");
    let _ = std::fs::create_dir_all(&plugins_target);

    // 3. Stage selected plugin from DLPHubStorage
    let clean_mode = mode.trim().to_lowercase();
    if clean_mode == "ability_brawl" {
        let ab_plugins = loader_dir.join("plugins").join("ability_brawl");
        if ab_plugins.is_dir() {
            manifest.deploy_dir_recursive(deadlock_dir, &ab_plugins, &plugins_target)?;
        }
    } else if clean_mode == "automatch" {
        let am_plugins = loader_dir.join("plugins").join("automatch");
        if am_plugins.is_dir() {
            manifest.deploy_dir_recursive(deadlock_dir, &am_plugins, &plugins_target)?;
        }
    } else if clean_mode == "cursed_arena" || clean_mode == "cursedarena" {
        let ca_plugins = loader_dir.join("plugins").join("cursed_arena");
        if ca_plugins.is_dir() {
            manifest.deploy_dir_recursive(deadlock_dir, &ca_plugins, &plugins_target)?;
        }
    }

    manifest.save(deadlock_dir);

    // 4. Also stage client bootstrap & addon for the host player
    deploy_client_modded_assets(deadlock_dir, &clean_mode)?;

    Ok(())
}

/// Deploys client-side bootstrap, addon VPKs, and loose files mirror from DLPHubStorage to game folders
pub fn deploy_client_modded_assets(deadlock_dir: &Path, mode: &str) -> Result<(), String> {
    let mut manifest = DeadworksManifest::load(deadlock_dir);

    let boot_vpk = get_client_bootstrap_file();
    if boot_vpk.is_file() {
        let client_boot_dir = deadlock_dir.join("game").join("citadel").join("deadworks_mods");
        let _ = std::fs::create_dir_all(&client_boot_dir);
        let dst = client_boot_dir.join("pak01_dir.vpk");
        manifest.deploy_file(deadlock_dir, &boot_vpk, &dst)?;
    }

    let clean_mode = mode.trim().to_lowercase();
    if clean_mode == "ability_brawl" {
        let addon_vpk = get_client_addon_file("ability_brawl");
        if addon_vpk.is_file() {
            let client_addon_dir = deadlock_dir.join("game").join("citadel").join("addons");
            let _ = std::fs::create_dir_all(&client_addon_dir);
            manifest.deploy_vpk_slot(deadlock_dir, &addon_vpk, &client_addon_dir, "pak45_dir.vpk")?;
        }
    } else if clean_mode == "cursed_arena" || clean_mode == "cursedarena" {
        let addon_vpk = get_client_addon_file("cursed_arena");
        if addon_vpk.is_file() {
            let custom_dir = deadlock_dir.join("game").join("citadel").join("custom");
            let _ = std::fs::create_dir_all(&custom_dir);
            manifest.deploy_vpk_slot(deadlock_dir, &addon_vpk, &custom_dir, "pak84_dir.vpk")?;

            let client_addon_dir = deadlock_dir.join("game").join("citadel").join("addons");
            let _ = std::fs::create_dir_all(&client_addon_dir);
            manifest.deploy_vpk_slot(deadlock_dir, &addon_vpk, &client_addon_dir, "pak84_dir.vpk")?;
        }

        let loose_dir = get_client_addon_loose_dir("cursed_arena");
        let custom_dir = deadlock_dir.join("game").join("citadel").join("custom");
        if loose_dir.is_dir() {
            manifest.deploy_dir_recursive(deadlock_dir, &loose_dir, &custom_dir)?;
        }
    }

    manifest.save(deadlock_dir);
    Ok(())
}
