// DLPHub Cryptographic Verified Mod Cache Manager
// Manages on-demand downloading, local caching, and SHA-256 verification of official Deadlock mods.

use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModMeta {
    pub filename: &'static str,
    pub display_name_fa: &'static str,
    pub display_name_en: &'static str,
    pub size_bytes: u64,
    pub sha256: &'static str,
}

pub const OFFICIAL_MODS: &[ModMeta] = &[
    ModMeta {
        filename: "pak01_dir.vpk",
        display_name_fa: "روشنایی بیشتر",
        display_name_en: "Higher Brightness",
        size_bytes: 8_538_815,
        sha256: "f85de14dac40a8a2297a1516159774a0c5ae5925e5d8a48341a3c771ac8e75c9",
    },
    ModMeta {
        filename: "pak02_dir.vpk",
        display_name_fa: "کاهش شلوغی محیط",
        display_name_en: "Reduce Clutter",
        size_bytes: 5_593_087,
        sha256: "774a68d473ef38bbd212ce68669fc1cce716236b4a8fd38b4f0c897cf758a9dc",
    },
    ModMeta {
        filename: "pak03_dir.vpk",
        display_name_fa: "دید واضح‌تر جعبه‌ها",
        display_name_en: "Better Breakables",
        size_bytes: 102_990_771,
        sha256: "65e676367df25968a809401bebd63de5d28ff255722f022b922262972118f23a",
    },
    ModMeta {
        filename: "pak04_dir.vpk",
        display_name_fa: "اصلاحات ضروری (Essential Fixes)",
        display_name_en: "Essential Fixes (Level 2)",
        size_bytes: 2_123_337,
        sha256: "9915f861f2f90aedf88da39368772000ada526b39b637e6dd148f2d51c926f48",
    },
    ModMeta {
        filename: "pak05_dir.vpk",
        display_name_fa: "حذف عناصر اضافه (Anti Clutter)",
        display_name_en: "Anti Clutter (Level 2)",
        size_bytes: 8_066_673,
        sha256: "54f185301a674c0d0105b7d404a20b35a070d355e21a8a9cd39d3022ad3e0f89",
    },
    ModMeta {
        filename: "pak06_dir.vpk",
        display_name_fa: "اصلاح پورتال دورمن (Doorman Portal Fix)",
        display_name_en: "Doorman Portal Fix (Level 2 and 3)",
        size_bytes: 21_683,
        sha256: "95a3f96dafd193a97fd714658f9bcda77f91f18b496fa2dc67362a295aa3b685",
    },
    ModMeta {
        filename: "pak31_dir.vpk",
        display_name_fa: "گرافیک ذغالی استاندارد",
        display_name_en: "Potato Graphics",
        size_bytes: 4_135_302,
        sha256: "a469bd7980a88f11baab52ee4166104dcc16204b268fe269d112c829cec40c61",
    },
    ModMeta {
        filename: "pak33_dir.vpk",
        display_name_fa: "هیرو ذغالی",
        display_name_en: "Hero Potato",
        size_bytes: 5_714_638,
        sha256: "5d2aa2d721525a20da4b5971da4c65047a2e609ec42bee5c92c0d3919a5d0517",
    },
];

pub fn find_mod(filename: &str) -> Option<&'static ModMeta> {
    OFFICIAL_MODS.iter().find(|m| m.filename.eq_ignore_ascii_case(filename))
}

/// Marker the UI matches on so a missing bundle is reported as
/// "not available" instead of as a generic HTTP error.
const BUNDLE_UNAVAILABLE_MARKER: &str = "MOD_BUNDLE_UNAVAILABLE";

fn bundle_label(meta: &ModMeta) -> String {
    format!("{} ({})", meta.display_name_en, meta.filename)
}

/// Probes every required bundle before any transfer starts, so room prep fails
/// immediately with a clear message instead of dying on a 404 halfway through
/// the download loop. Bundles whose hosts never answered are skipped: that is a
/// connection problem, not a missing-file problem.
async fn find_unavailable_bundles(required: &[&str]) -> Vec<String> {
    let Ok(client) = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(std::time::Duration::from_secs(6))
        .timeout(std::time::Duration::from_secs(15))
        .build()
    else {
        return Vec::new();
    };
    let candidates = crate::lan_vip::ordered_candidates();
    let mut missing = Vec::new();

    for &fname in required {
        // `find_mod` already rejects blank and unknown names.
        let Some(meta) = find_mod(fname.trim()) else { continue };
        if is_mod_cached(meta.filename) {
            continue;
        }

        let mut probes = 0usize;
        let mut available = false;
        for base in &candidates {
            let url = format!("{}/api/mods/download/{}", base.trim_end_matches('/'), meta.filename);
            // The coordinator only routes GET (HEAD answers 405), so probe with
            // a one-byte Range request: 200/206 means present, 404 means the
            // file was never uploaded to that node.
            if let Ok(resp) = client
                .get(&url)
                .header(reqwest::header::RANGE, "bytes=0-0")
                .send()
                .await
            {
                probes += 1;
                if resp.status().is_success() {
                    available = true;
                    break;
                }
            }
        }
        if !available && probes == 0 {
            // Nothing answered at all: that is a connectivity problem, not a
            // missing bundle. Stop probing so the user gets the real error fast.
            return Vec::new();
        }
        // Only a bundle every endpoint actively denied is reported missing; a
        // silent endpoint falls through to the normal download path so the user
        // sees that error instead.
        if !available && probes == candidates.len() {
            missing.push(bundle_label(meta));
        }
    }
    missing
}

pub fn get_cache_dir() -> PathBuf {
    crate::storage::get_mods_storage_dir()
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn verify_file_sha256(path: &Path, expected_hex: &str) -> bool {
    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        match std::io::Read::read(&mut file, &mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(_) => return false,
        }
    }
    let digest = hasher.finalize();
    let calculated = hex_encode(&digest);
    calculated.eq_ignore_ascii_case(expected_hex)
}

pub fn is_mod_cached(filename: &str) -> bool {
    let meta = match find_mod(filename) {
        Some(m) => m,
        None => return false,
    };
    let path = get_cache_dir().join(filename);
    if !path.is_file() {
        return false;
    }
    if let Ok(metadata) = path.metadata() {
        if metadata.len() != meta.size_bytes {
            let _ = std::fs::remove_file(&path);
            return false;
        }
    } else {
        return false;
    }
    if !verify_file_sha256(&path, meta.sha256) {
        let _ = std::fs::remove_file(&path);
        return false;
    }
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModStatusDto {
    pub filename: String,
    pub display_name_fa: String,
    pub display_name_en: String,
    pub size_bytes: u64,
    pub is_cached: bool,
}

pub fn get_all_mod_statuses() -> Vec<ModStatusDto> {
    OFFICIAL_MODS.iter().map(|m| {
        ModStatusDto {
            filename: m.filename.to_string(),
            display_name_fa: m.display_name_fa.to_string(),
            display_name_en: m.display_name_en.to_string(),
            size_bytes: m.size_bytes,
            is_cached: is_mod_cached(m.filename),
        }
    }).collect()
}

pub fn clear_mod_cache() -> Result<u64, String> {
    let dir = get_cache_dir();
    let mut freed_bytes: u64 = 0;
    if dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    if let Ok(m) = p.metadata() {
                        freed_bytes += m.len();
                    }
                    let _ = std::fs::remove_file(&p);
                }
            }
        }
    }
    Ok(freed_bytes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModDownloadProgressEvent {
    pub filename: String,
    pub display_name_fa: String,
    pub display_name_en: String,
    pub current_bytes: u64,
    pub total_bytes: u64,
    pub percent: u8,
    pub speed_kbps: u64,
    pub status: String, // "downloading", "verifying", "completed", "error"
}

pub async fn download_single_mod(
    meta: &'static ModMeta,
    cache_dir: &Path,
    app_handle: Option<&tauri::AppHandle>,
) -> Result<(), String> {
    let target_path = cache_dir.join(meta.filename);
    let tmp_path = cache_dir.join(format!("{}.download.tmp", meta.filename));

    // If tmp already exists and is already the full size, check hash
    if tmp_path.is_file() {
        if let Ok(meta_file) = tmp_path.metadata() {
            if meta_file.len() == meta.size_bytes && verify_file_sha256(&tmp_path, meta.sha256) {
                let _ = std::fs::remove_file(&target_path);
                std::fs::rename(&tmp_path, &target_path)
                    .map_err(|e| format!("Failed to move verified mod to {target_path:?}: {e}"))?;
                if let Some(app) = app_handle {
                    let _ = app.emit("mod-download-progress", ModDownloadProgressEvent {
                        filename: meta.filename.to_string(),
                        display_name_fa: meta.display_name_fa.to_string(),
                        display_name_en: meta.display_name_en.to_string(),
                        current_bytes: meta.size_bytes,
                        total_bytes: meta.size_bytes,
                        percent: 100,
                        speed_kbps: 0,
                        status: "completed".to_string(),
                    });
                }
                return Ok(());
            } else if meta_file.len() > meta.size_bytes {
                let _ = std::fs::remove_file(&tmp_path);
            }
        }
    }

    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let total_bytes = meta.size_bytes;

    const MAX_RETRIES: usize = 6;
    let mut retry_count = 0;
    let mut last_error = String::new();

    // Every failure inside the loop is recoverable: record why, then retry on
    // the next endpoint after a short backoff (a partial file resumes via Range).
    macro_rules! retry {
        ($($arg:tt)*) => {{
            last_error = format!($($arg)*);
            eprintln!("[Mod Cache] {last_error}, attempting fallback...");
            retry_count += 1;
            tokio::time::sleep(std::time::Duration::from_millis(500 * retry_count as u64)).await;
            continue;
        }};
    }

    use tokio::io::AsyncWriteExt;

    let candidates = crate::lan_vip::ordered_candidates();
    let mut winning_base = None;

    while retry_count < MAX_RETRIES {
        let current_base = &candidates[retry_count % candidates.len()];
        let url = format!("{}/api/mods/download/{}", current_base.trim_end_matches('/'), meta.filename);

        let mut existing_bytes: u64 = 0;
        if tmp_path.is_file() {
            if let Ok(m) = tmp_path.metadata() {
                existing_bytes = m.len();
            }
        }

        if existing_bytes > total_bytes {
            // Leftover from an older bundle revision: restart from scratch.
            let _ = std::fs::remove_file(&tmp_path);
            existing_bytes = 0;
        }
        if existing_bytes == total_bytes {
            winning_base = Some(current_base.clone());
            break;
        }

        let mut req_builder = client.get(&url);
        if existing_bytes > 0 {
            req_builder = req_builder.header(reqwest::header::RANGE, format!("bytes={existing_bytes}-"));
        }

        let response_res = tokio::time::timeout(
            std::time::Duration::from_secs(20),
            req_builder.send()
        ).await;

        let response = match response_res {
            Ok(Ok(resp)) => resp,
            Ok(Err(e)) => retry!("Connection error to {url}: {e}"),
            Err(_) => retry!("Connection timed out connecting to {url}"),
        };

        let status = response.status();
        if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
            let _ = std::fs::remove_file(&tmp_path);
            retry!("Server rejected the resume range for {url}");
        }

        if status == reqwest::StatusCode::NOT_FOUND {
            retry!(
                "{BUNDLE_UNAVAILABLE_MARKER}|Mod bundle '{label}' is not available on the server (HTTP 404 from {url})",
                label = bundle_label(meta)
            );
        }

        // Any other refusal may be specific to this node, so try the other one.
        if !status.is_success() {
            retry!("Server returned HTTP {status} from {url}");
        }

        let is_partial = status == reqwest::StatusCode::PARTIAL_CONTENT;

        let mut file = if is_partial && existing_bytes > 0 {
            tokio::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&tmp_path)
                .await
                .map_err(|e| format!("Failed to open temporary file {tmp_path:?}: {e}"))?
        } else {
            existing_bytes = 0;
            tokio::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(&tmp_path)
                .await
                .map_err(|e| format!("Failed to create temporary file {tmp_path:?}: {e}"))?
        };

        let mut downloaded = existing_bytes;
        let mut response = response;
        let mut last_emit = Instant::now();
        let mut window_start = Instant::now();
        let mut window_bytes: u64 = 0;
        let mut speed_kbps: u64 = 0;
        let mut stream_interrupted = false;

        loop {
            let chunk_res = tokio::time::timeout(
                std::time::Duration::from_secs(35),
                response.chunk()
            ).await;

            match chunk_res {
                Ok(Ok(Some(chunk))) => {
                    if let Err(e) = file.write_all(&chunk).await {
                        let _ = file.flush().await;
                        return Err(format!("Disk write error: {e}"));
                    }
                    downloaded += chunk.len() as u64;
                    window_bytes += chunk.len() as u64;

                    if last_emit.elapsed().as_millis() >= 150 || downloaded == total_bytes {
                        let window_elapsed = window_start.elapsed().as_secs_f64();
                        if window_elapsed >= 0.5 {
                            speed_kbps = ((window_bytes as f64 / 1024.0) / window_elapsed) as u64;
                            window_start = Instant::now();
                            window_bytes = 0;
                        }
                        last_emit = Instant::now();
                        let percent = if total_bytes > 0 {
                            ((downloaded as f64 / total_bytes as f64) * 100.0).min(100.0) as u8
                        } else {
                            0
                        };

                        if let Some(app) = app_handle {
                            let evt = ModDownloadProgressEvent {
                                filename: meta.filename.to_string(),
                                display_name_fa: meta.display_name_fa.to_string(),
                                display_name_en: meta.display_name_en.to_string(),
                                current_bytes: downloaded,
                                total_bytes,
                                percent,
                                speed_kbps,
                                status: "downloading".to_string(),
                            };
                            let _ = app.emit("mod-download-progress", evt);
                        }
                    }
                }
                Ok(Ok(None)) => {
                    break;
                }
                Ok(Err(e)) => {
                    last_error = format!("Network read error: {e}");
                    stream_interrupted = true;
                    break;
                }
                Err(_) => {
                    last_error = "Network stream idle timeout (no data for 35s)".to_string();
                    stream_interrupted = true;
                    break;
                }
            }
        }

        let _ = file.flush().await;
        drop(file);

        if !stream_interrupted && downloaded >= total_bytes {
            winning_base = Some(current_base.clone());
            break;
        }

        retry_count += 1;
        tokio::time::sleep(std::time::Duration::from_millis(1000 * retry_count as u64)).await;
    }

    if !tmp_path.is_file() {
        return Err(format!("Download failed after {MAX_RETRIES} attempts: {last_error}"));
    }

    // A slow link can exhaust the retries while the file is still partial. Keep
    // the `.download.tmp` so the next run resumes with a Range request instead
    // of hashing the partial bytes and reporting the bundle as corrupt.
    if let Ok(m) = tmp_path.metadata() {
        if m.len() != total_bytes {
            return Err(format!(
                "Download incomplete after {MAX_RETRIES} attempts ({} of {total_bytes} bytes): {last_error}. Partial file kept for resume.",
                m.len()
            ));
        }
    }

    // Cryptographic SHA-256 Verification
    if let Some(app) = app_handle {
        let _ = app.emit("mod-download-progress", ModDownloadProgressEvent {
            filename: meta.filename.to_string(),
            display_name_fa: meta.display_name_fa.to_string(),
            display_name_en: meta.display_name_en.to_string(),
            current_bytes: total_bytes,
            total_bytes,
            percent: 100,
            speed_kbps: 0,
            status: "verifying".to_string(),
        });
    }

    if !verify_file_sha256(&tmp_path, meta.sha256) {
        let _ = std::fs::remove_file(&tmp_path);
        if let Some(app) = app_handle {
            let _ = app.emit("mod-download-progress", ModDownloadProgressEvent {
                filename: meta.filename.to_string(),
                display_name_fa: meta.display_name_fa.to_string(),
                display_name_en: meta.display_name_en.to_string(),
                current_bytes: total_bytes,
                total_bytes,
                percent: 100,
                speed_kbps: 0,
                status: "error".to_string(),
            });
        }
        return Err(format!(
            "SHA-256 integrity verification failed for {}. Download was rejected.",
            meta.filename
        ));
    }

    if let Some(base) = winning_base {
        crate::lan_vip::mark_vip_api_success(&base);
    }

    // Atomic Move (On Windows ensure existing destination is removed first)
    let _ = std::fs::remove_file(&target_path);
    std::fs::rename(&tmp_path, &target_path)
        .map_err(|e| format!("Failed to move verified mod to {target_path:?}: {e}"))?;

    if let Some(app) = app_handle {
        let _ = app.emit("mod-download-progress", ModDownloadProgressEvent {
            filename: meta.filename.to_string(),
            display_name_fa: meta.display_name_fa.to_string(),
            display_name_en: meta.display_name_en.to_string(),
            current_bytes: total_bytes,
            total_bytes,
            percent: 100,
            speed_kbps: 0,
            status: "completed".to_string(),
        });
    }

    Ok(())
}

pub async fn ensure_mods_cached(
    required_filenames: &[&str],
    app_handle: Option<&tauri::AppHandle>,
) -> Result<PathBuf, String> {
    let cache_dir = get_cache_dir();

    // Fail before touching anything if the coordinator never got the bundles.
    let missing = find_unavailable_bundles(required_filenames).await;
    if !missing.is_empty() {
        return Err(format!(
            "{BUNDLE_UNAVAILABLE_MARKER}|Mod bundle not available on the server: {}. \
             The coordinator is missing these files, so no room or game files were changed. \
             Ask the host to upload them, or use an unmodded room.",
            missing.join(", ")
        ));
    }

    for &fname in required_filenames {
        let clean = fname.trim();
        if clean.is_empty() {
            continue;
        }
        let meta = match find_mod(clean) {
            Some(m) => m,
            None => return Err(format!("Unknown or unauthorized mod requested: '{clean}'")),
        };

        if !is_mod_cached(clean) {
            download_single_mod(meta, &cache_dir, app_handle).await?;
        }
    }
    Ok(cache_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_mod() {
        assert!(find_mod("pak01_dir.vpk").is_some());
        assert!(find_mod("PAK01_DIR.VPK").is_some());
        assert!(find_mod("pak99_dir.vpk").is_none());
        assert!(find_mod("../malicious.exe").is_none());
    }

    #[test]
    fn test_sha256_verification() {
        let tmp = std::env::temp_dir().join("dlpb_sha256_test.txt");
        std::fs::write(&tmp, b"hello deadlock").unwrap();
        // sha256("hello deadlock") = 5601ff7a641178619bc9ea0a2c0c73e0a2d216f40776bdfa73a5a54b35e7c8ec
        let valid_hash = "5601ff7a641178619bc9ea0a2c0c73e0a2d216f40776bdfa73a5a54b35e7c8ec";
        assert!(verify_file_sha256(&tmp, valid_hash));
        assert!(!verify_file_sha256(&tmp, "0000000000000000000000000000000000000000000000000000000000000000"));
        let _ = std::fs::remove_file(&tmp);
    }
}
