// Embedded console payload (tier dirs + addons). Extracted fresh per action —
// never reused across runs (stale stable-copy trap from the console .bat).
pub static PAYLOAD_ZIP: &[u8] = include_bytes!("../../payload.zip");

pub fn extract() -> std::io::Result<std::path::PathBuf> {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(std::io::Error::other)?.as_nanos();
    let dir = std::env::temp_dir().join(format!("DLPBoosterPkg_{}_{}_{}", std::process::id(), stamp, NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)));
    match extract_to(&dir) {
        Ok(p) => Ok(p),
        Err(e) => { crate::backup::rm_ro(&dir); Err(e) }
    }
}

/// Extract into an explicit dir (tests use per-test dirs — the default dir is
/// shared process-global and parallel tests would race on the wipe).
pub fn extract_to(dir: &std::path::Path) -> std::io::Result<std::path::PathBuf> {
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    std::fs::create_dir_all(dir)?;
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(PAYLOAD_ZIP))?;
    zip.extract(dir)?;
    Ok(dir.to_path_buf())
}

/// Stable read-only extraction for queries (detect_tier). Extracted once per
/// process into a dedicated cache dir; subsequent calls return the same dir
/// without re-unzipping 14MB on every badge refresh.
pub fn extract_cached() -> std::io::Result<std::path::PathBuf> {
    static CACHE: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();
    if let Some(dir) = CACHE.get() {
        return Ok(dir.clone());
    }
    let dir = std::env::temp_dir().join(format!("DLPBoosterPkg_cache_{}", std::process::id()));
    let extracted = extract_to(&dir);
    match extracted {
        Ok(p) => { let _ = CACHE.set(p.clone()); Ok(p) }
        Err(e) => { crate::backup::rm_ro(&dir); Err(e) }
    }
}

pub fn payload_dir(pkg: &std::path::Path, name: &str) -> std::path::PathBuf {
    pkg.join(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cached_extraction_reuses_dir_without_wipe() {
        let first = extract_cached().unwrap();
        std::fs::write(first.join("marker.txt"), b"keep").unwrap();
        let second = extract_cached().unwrap();
        assert!(second.join("marker.txt").is_file(), "cached dir must not be wiped between calls");
    }

    #[test]
    fn extraction_paths_never_share_state() {
        let first = extract().unwrap();
        std::fs::write(first.join("operation-marker"), "keep").unwrap();
        let second = extract().unwrap();
        assert_ne!(first, second);
        assert!(first.join("operation-marker").exists());
        crate::backup::rm_ro(&first);
        crate::backup::rm_ro(&second);
    }

    #[test]
    fn fresh_extract_wipes_stale_files() {
        let tmp = std::env::temp_dir().join("dlpb_payload_stale");
        crate::backup::rm_ro(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("stale.vpk"), "stale").unwrap();
        let pkg = extract_to(&tmp).unwrap();
        assert!(!tmp.join("stale.vpk").exists());
        assert!(pkg.join("addons/pak04_dir.vpk").is_file());
        crate::backup::rm_ro(&tmp);
    }

    #[test]
    fn payload_contains_tiers_and_addons() {
        let pkg = extract().unwrap();
        for d in ["t1", "t2", "t3", "potato", "addons"] {
            assert!(pkg.join(d).is_dir(), "missing {d}");
        }
        assert!(pkg.join("t1").join("gameinfo.gi").is_file());
        assert!(pkg.join("addons").join("pak04_dir.vpk").is_file());
        crate::backup::rm_ro(&pkg);
    }
}
