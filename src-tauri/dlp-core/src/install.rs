// Install orchestrator — port of install.bat main flow for the GUI.
// Order: guard -> write test -> .dlp.bak snapshot -> tier gi with FOV swap ->
// addons (per-mode only/exclude) -> video merge (read-only dance) -> optional
// autoexec block. Returns a step log for the frontend progress view.
use std::path::Path;

use crate::addons;
use crate::backup::set_readonly;
use crate::kvedit;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    T1,
    T2,
    T3,
    Potato,
    T1Mods,
    T2Mods,
}

impl Mode {
    pub fn tier_dir(self) -> &'static str {
        match self {
            Mode::T1 | Mode::T1Mods => "t1",
            Mode::T2 | Mode::T2Mods => "t2",
            Mode::T3 => "t3",
            Mode::Potato => "potato",
        }
    }
    pub fn video_dir(self) -> &'static str {
        self.tier_dir()
    }
    /// addons.ps1 -Only / -Exclude per install.bat:
    /// tiers 1-3 exclude the look-changing 01/02/03; potato gets ONLY those;
    /// TEMP mods modes install ALL 9.
    pub fn addon_lists(self) -> (&'static str, &'static str) {
        const LOOK: &str = "pak01_dir.vpk,pak02_dir.vpk,pak03_dir.vpk";
        match self {
            Mode::T1 | Mode::T2 | Mode::T3 => ("", LOOK),
            Mode::Potato => ("", ""),
            Mode::T1Mods | Mode::T2Mods => ("", ""),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct StepLog {
    pub step: String,
    pub detail: String,
    pub skipped: bool,
}

/// UTC timestamp helper (backup folder names; no chrono dep needed).
pub fn timestamp_utc(secs: u64) -> String {
    // days->y/m/d civil algorithm (Howard Hinnant), no external crate
    let days = (secs / 86400) as i64;
    let secs_of_day = secs % 86400;
    let (h, m, s) = (secs_of_day / 3600, (secs_of_day % 3600) / 60, secs_of_day % 60);
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mth = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mth <= 2 { y + 1 } else { y };
    format!("{y:04}-{mth:02}-{d:02}_{h:02}{m:02}{s:02}")
}

pub fn write_test(citadel: &Path) -> Result<(), String> {
    let p = citadel.join("_wtest.tmp");
    match std::fs::write(&p, b"t").and_then(|_| std::fs::remove_file(&p)) {
        Ok(_) => Ok(()),
        Err(_) => Err("NeedsAdmin: cannot write to the game folder - run the app as administrator".into()),
    }
}

fn snapshot_original(citadel: &Path) -> Result<Vec<StepLog>, String> {
    let mut log = vec![];
    let gi = citadel.join("gameinfo.gi");
    let gi_bak = citadel.join("gameinfo.gi.dlp.bak");
    if !gi.is_file() || std::fs::metadata(&gi).map(|m| m.len()).unwrap_or(0) == 0 {
        return Err("gameinfo.gi missing or empty in game folder — please verify Deadlock files in Steam first".into());
    }
    if !gi_bak.exists() {
        std::fs::copy(&gi, &gi_bak).map_err(|e| e.to_string())?;
        log.push(StepLog { step: "backup".into(), detail: "snapshot gameinfo.gi.dlp.bak".into(), skipped: false });
    }

    let vd = citadel.join("cfg").join("video.txt");
    let vd_bak = citadel.join("cfg").join("video.txt.dlp.bak");
    if vd.is_file() && !vd_bak.exists() {
        std::fs::copy(&vd, &vd_bak).map_err(|e| e.to_string())?;
        log.push(StepLog { step: "backup".into(), detail: "snapshot video.txt.dlp.bak".into(), skipped: false });
    }
    Ok(log)
}

pub fn install(mode: Mode, fov: u32, deadlock: &str, pkg: &Path, data_dir: &Path) -> Result<Vec<StepLog>, String> {
    let start_instant = std::time::Instant::now();
    let mut log = vec![];
    let citadel = Path::new(deadlock).join("game").join("citadel");

    // 1) guard (BACKUP/RESTORE exempt — those go through backup.rs, not here).
    // Sandbox tests also count: any DLPB sandbox install dir is not a real game.
    if !cfg!(test) {
        let running = crate::guard::game_running();
        if !running.is_empty() {
            return Err(format!("game running: {} — close Deadlock first", running.join(", ")));
        }
    }

    // Preflight every required template and user encoding before mutation.
    let tpl = std::fs::read_to_string(pkg.join(mode.tier_dir()).join("gameinfo.gi")).map_err(|e| format!("preflight gameinfo template: {e}"))?;
    let tpl_v = std::fs::read_to_string(pkg.join(mode.video_dir()).join("video.txt")).map_err(|e| format!("preflight video template: {e}"))?;
    let user_v = match std::fs::read_to_string(citadel.join("cfg/video.txt")) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("preflight current video: {e}")),
    };
    let existing = match std::fs::read_to_string(citadel.join("cfg/autoexec.cfg")) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("preflight autoexec: {e}")),
    };
    let tier_ae = match std::fs::read_to_string(pkg.join(mode.tier_dir()).join("autoexec.cfg")) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("preflight tier autoexec: {e}")),
    };

    // 2) write test
    write_test(&citadel)?;
    log.push(StepLog { step: "write-test".into(), detail: "game folder writable".into(), skipped: false });

    // 3) .dlp.bak snapshots (permanent restore points, never deleted)
    log.extend(snapshot_original(&citadel)?);

    // Smart backup:
    // Only create an automatic backup if:
    // 1. No backups exist yet (the user's initial baseline backup)
    // 2. OR the current config is NOT one of our presets (vanilla or custom hand-modified files)
    //    AND it is NOT byte-identical to the latest existing backup.
    let existing_backups = crate::backup::list_backups(data_dir);
    let is_ours = crate::backup::is_our_config(&citadel, pkg);
    let should_backup = if existing_backups.is_empty() {
        true
    } else if is_ours {
        false
    } else {
        let latest = crate::backup::backups_root(data_dir).join(&existing_backups[0]);
        !crate::backup::is_identical_to_backup(&citadel, &latest)
    };

    if should_backup {
        let is_first = existing_backups.is_empty();
        let b_name = crate::backup::do_backup_internal(&citadel, data_dir, is_first).map_err(|e| format!("backup: {e}"))?;
        log.push(StepLog { step: "backup".into(), detail: format!("full backup saved ({b_name})"), skipped: false });
    } else {
        log.push(StepLog {
            step: "backup".into(),
            detail: if is_ours {
                "preset switch (tier already installed) - skipping duplicate backup".into()
            } else {
                "identical to latest backup - skipping duplicate backup".into()
            },
            skipped: true,
        });
    }

    // 3b) REVERT FIRST: wipe our previous install (manifest vpks, patched
    // gameinfo.gi/video.txt, managed autoexec) so every apply starts from the
    // user's original files — no incremental drift between modes. The backup
    // above already captured this state, so a failed revert is fatal.
    let rep = crate::backup::revert_original(&citadel)?;
    match rep.removed_addons.len() {
        0 => log.push(StepLog { step: "revert".into(), detail: "no previous install found - nothing to revert".into(), skipped: true }),
        n => log.push(StepLog { step: "revert".into(), detail: format!("cleaned previous install ({n} addons removed)"), skipped: false }),
    }

    // 4) tier gameinfo.gi with per-user FOV swapped in
    let ar = crate::fov::aspect_ratio(fov);
    let staged = kvedit::set_fov(&tpl, ar);
    let dst_gi = citadel.join("gameinfo.gi");
    let current = std::fs::read(&dst_gi).unwrap_or_default();
    if current == staged.as_bytes() {
        log.push(StepLog { step: "gameinfo.gi".into(), detail: format!("already identical - skipped ({})", mode.tier_dir()), skipped: true });
    } else {
        std::fs::write(&dst_gi, &staged).map_err(|e| e.to_string())?;
        log.push(StepLog { step: "gameinfo.gi".into(), detail: format!("replaced with {} (FOV {fov}, AR {ar})", mode.tier_dir()), skipped: false });
    }

    // 5) addons per mode
    let (only, exclude) = mode.addon_lists();
    let rep = addons::install_addons(&pkg.join("addons"), &citadel.join("addons"), only, exclude)
        .map_err(|e| e.to_string())?;
    log.push(StepLog {
        step: "addons".into(),
        detail: format!(
            "{} added, {} removed, {} identical, {} renumbered, {} user-kept",
            rep.added.len(), rep.removed.len(), rep.skipped.len(), rep.renumbered.len(), rep.kept_user.len()
        ),
        skipped: rep.added.is_empty() && rep.removed.is_empty() && rep.renumbered.is_empty(),
    });

    // 6) video merge with read-only dance
    let vd = citadel.join("cfg").join("video.txt");
    if vd.exists() {
        set_readonly(&vd, false).map_err(|e| e.to_string())?;
    } else {
        std::fs::create_dir_all(vd.parent().unwrap()).map_err(|e| e.to_string())?;
    }
    let merged = kvedit::merge_video(&user_v, &tpl_v);

    let s = crate::settings::load_from(data_dir);
    let mut patches: Vec<(&str, String)> = Vec::new();
    if let Some(fps) = s.fps_max {
        patches.push(("setting.fps_max", fps.to_string()));
    }
    let vram = crate::detect::detect_vram_bytes();
    if vram > 0 && vram < 4 * 1024 * 1024 * 1024 {
        patches.push(("setting.gpu_mem_level", "0".to_string()));
        crate::logger::log(
            data_dir,
            "INFO",
            &format!("Detected low VRAM ({} MB) - capping setting.gpu_mem_level to 0", vram / (1024 * 1024)),
        );
    }
    let patch_refs: Vec<(&str, &str)> = patches.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let final_video = kvedit::patch_video_kv(&merged, &patch_refs);

    std::fs::write(&vd, &final_video).map_err(|e| e.to_string())?;
    set_readonly(&vd, true).map_err(|e| e.to_string())?;
    log.push(StepLog { step: "video.txt".into(), detail: "patched + write-protected (backup: video.txt.dlp.bak)".into(), skipped: false });

    // 7) autoexec managed block per settings flag
    let cfg_dir = citadel.join("cfg");
    std::fs::create_dir_all(&cfg_dir).map_err(|e| e.to_string())?;
    let ae = cfg_dir.join("autoexec.cfg");
    let mut full_tier_cmds = tier_ae.clone();
    if !full_tier_cmds.is_empty() && !full_tier_cmds.ends_with('\n') {
        full_tier_cmds.push('\n');
    }
    if let Some(fps) = s.fps_max {
        full_tier_cmds.push_str(&format!("fps_max {}\n", fps));
    }
    let new_ae = kvedit::upsert_autoexec_full(&existing, s.unit_status_new, s.stop_cloth_anim, s.ragdoll_fade, &full_tier_cmds, &s.custom_autoexec);
    let after_revert = match std::fs::read_to_string(&ae) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("autoexec after cleanup: {e}")),
    };
    if after_revert != new_ae {
        std::fs::write(&ae, new_ae).map_err(|e| e.to_string())?;
        log.push(StepLog {
            step: "autoexec.cfg".into(),
            detail: if s.unit_status_new || s.stop_cloth_anim || s.ragdoll_fade || !tier_ae.trim().is_empty() || !s.custom_autoexec.trim().is_empty() {
                "managed block written".into()
            } else {
                "managed block removed".into()
            },
            skipped: false,
        });
    }

    crate::logger::log(data_dir, "INFO", &format!("Successfully installed mode: {:?} in {}ms", mode, start_instant.elapsed().as_millis()));
    Ok(log)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox(tag: &str) -> (std::path::PathBuf, std::path::PathBuf, std::path::PathBuf) {
        let base = std::env::temp_dir().join(format!("dlpb_inst_{tag}"));
        crate::backup::rm_ro(&base);
        // layout must mirror a real install: <deadlock>\game\citadel
        let cit = base.join("game").join("citadel");
        std::fs::create_dir_all(cit.join("cfg")).unwrap();
        std::fs::create_dir_all(cit.join("addons")).unwrap();
        std::fs::write(cit.join("gameinfo.gi"), "\"Version\" \"13\"\n\"r_aspectratio\"\t\t\t\t\t\t\"2.15\"\n").unwrap();
        std::fs::write(cit.join("cfg").join("video.txt"), "\"Version\" \"11\"\n\"setting.defaultres\" \"2560\"\n\"setting.defaultresheight\" \"1440\"\n\"setting.refreshrate_numerator\" \"165\"\n").unwrap();
        let data = base.join("data");
        std::fs::create_dir_all(&data).unwrap();
        let pkg = crate::payload::extract_to(&base.join("pkg")).unwrap();
        (cit, data, pkg)
    }

    #[test]
    fn install_reads_only_explicit_settings_directory() {
        let (cit, data, pkg) = sandbox("settings_isolation");
        let root = cit.parent().unwrap().parent().unwrap();
        std::fs::write(data.join("settings.json"), "{\"custom_autoexec\":\"echo isolated-settings\"}").unwrap();
        install(Mode::T1, 90, root.to_str().unwrap(), &pkg, &data).unwrap();
        assert!(std::fs::read_to_string(cit.join("cfg/autoexec.cfg")).unwrap().contains("echo isolated-settings"));
        crate::backup::rm_ro(root);
    }

    #[test]
    fn failed_revert_stops_install() {
        let (cit, data, pkg) = sandbox("revert_fail");
        let root = cit.parent().unwrap().parent().unwrap();
        std::fs::write(cit.join("addons_manifest.txt"), "blocked\n").unwrap();
        std::fs::create_dir(cit.join("addons/blocked")).unwrap();
        let result = install(Mode::T1, 90, root.to_str().unwrap(), &pkg, &data);
        assert!(result.is_err());
        assert!(cit.join("addons_manifest.txt").is_file());
        crate::backup::rm_ro(root);
    }

    #[test]
    fn failed_backup_stops_install() {
        let (cit, data, pkg) = sandbox("backup_fail");
        let root = cit.parent().unwrap().parent().unwrap();
        std::fs::write(data.join("backups"), "block directory").unwrap();
        let gi = std::fs::read(cit.join("gameinfo.gi")).unwrap();
        assert!(install(Mode::T1, 90, root.to_str().unwrap(), &pkg, &data).is_err());
        assert!(std::fs::read(cit.join("gameinfo.gi")).unwrap() == gi);
        crate::backup::rm_ro(root);
    }

    #[test]
    fn missing_template_cannot_mutate_game() {
        let (cit, data, pkg) = sandbox("preflight");
        let root = cit.parent().unwrap().parent().unwrap();
        let original = std::fs::read(cit.join("gameinfo.gi")).unwrap();
        std::fs::remove_file(pkg.join("t1/video.txt")).unwrap();
        assert!(install(Mode::T1, 90, root.to_str().unwrap(), &pkg, &data).is_err());
        assert_eq!(std::fs::read(cit.join("gameinfo.gi")).unwrap(), original);
        assert!(!cit.join("gameinfo.gi.dlp.bak").exists());
        assert_eq!(std::fs::read_dir(cit.join("addons")).unwrap().count(), 0);
        crate::backup::rm_ro(root);
    }

    #[test]
    fn sandbox_t1_end_to_end() {
        let (cit, data, pkg) = sandbox("t1");
        let deadlock = cit.parent().unwrap().parent().unwrap().to_path_buf(); // <deadlock> root
        let log = install(Mode::T1, 90, deadlock.to_str().unwrap(), &pkg, &data).unwrap();
        // step log lines
        for step in ["write-test", "gameinfo.gi", "addons", "video.txt"] {
            assert!(log.iter().any(|l| l.step == step), "missing {step} in {log:?}");
        }
        // gi contains aspectratio 2.15 (FOV 90)
        let gi = std::fs::read_to_string(cit.join("gameinfo.gi")).unwrap();
        assert!(gi.contains("\"r_aspectratio\"\t\t\t\t\t\t\"2.15\""), "gi: {gi}");
        // permanent snapshots
        assert!(cit.join("gameinfo.gi.dlp.bak").is_file());
        assert!(cit.join("cfg").join("video.txt.dlp.bak").is_file());
        // 6 vpks (9 minus 01/02/03), manifest has entries
        let count = std::fs::read_dir(cit.join("addons")).unwrap().flatten().count();
        assert_eq!(count, 6, "expected 6 vpks");
        let man = std::fs::read_to_string(cit.join("addons_manifest.txt")).unwrap();
        assert_eq!(man.lines().count(), 6);
        // video.txt merged with user identity + read-only
        let v = std::fs::read_to_string(cit.join("cfg").join("video.txt")).unwrap();
        assert!(v.contains("\"Version\"\t\t\"11\""), "Version kept: {v}");
        assert!(v.contains("\"setting.defaultres\"\t\t\"2560\"") || v.contains("\"setting.defaultres\" \"2560\""));
        assert!(std::fs::metadata(cit.join("cfg").join("video.txt")).unwrap().permissions().readonly());
        crate::backup::rm_ro(cit.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn sandbox_potato_nine_vpks() {
        let (cit, data, pkg) = sandbox("pot");
        let deadlock = cit.parent().unwrap().parent().unwrap().to_path_buf(); // <deadlock> root
        install(Mode::Potato, 100, deadlock.to_str().unwrap(), &pkg, &data).unwrap();
        // potato gi = tier3, AR for fov 100 = 2.49
        let gi = std::fs::read_to_string(cit.join("gameinfo.gi")).unwrap();
        assert!(gi.contains("\"r_aspectratio\"\t\t\t\t\t\t\"2.49\""), "gi: {gi}");
        let vpks: Vec<String> = std::fs::read_dir(cit.join("addons")).unwrap().flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(vpks.len(), 9, "Potato must install all 9 addons");
        for n in ["pak91_dir.vpk", "pak92_dir.vpk", "pak93_dir.vpk", "pak94_dir.vpk", "pak95_dir.vpk", "pak96_dir.vpk", "pak97_dir.vpk", "pak98_dir.vpk", "pak99_dir.vpk"] {
            assert!(vpks.iter().any(|v| v == n), "missing {n}");
        }
        crate::backup::rm_ro(cit.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn sandbox_revert_first_then_reapply() {
        // New semantics: every apply first reverts to vanilla (deletes our
        // manifest vpks, restores .dlp.bak gi/video) THEN applies fresh.
        let (cit, data, pkg) = sandbox("rev");
        let deadlock = cit.parent().unwrap().parent().unwrap().to_path_buf();
        install(Mode::T1, 90, deadlock.to_str().unwrap(), &pkg, &data).unwrap();
        let second = install(Mode::T2, 95, deadlock.to_str().unwrap(), &pkg, &data).unwrap();
        // revert step ran
        let rev = second.iter().find(|l| l.step == "revert").unwrap();
        assert!(!rev.skipped, "revert should have cleaned first install: {rev:?}");
        // T2 gi applied (FOV 95 -> 2.32)
        let gi = std::fs::read_to_string(cit.join("gameinfo.gi")).unwrap();
        assert!(gi.contains("\"r_aspectratio\"\t\t\t\t\t\t\"2.32\""), "T2 gi: {gi}");
        // addons: T1's 6 were reverted, then T2's 6 added -> manifest exactly 6
        let man = std::fs::read_to_string(cit.join("addons_manifest.txt")).unwrap();
        assert_eq!(man.lines().count(), 6, "manifest should be exactly T2's 6 after revert-first: {man}");
        let vpks: Vec<String> = std::fs::read_dir(cit.join("addons")).unwrap().flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(vpks.len(), 6, "vpks after revert+T2: {vpks:?}");
        // .dlp.bak snapshots survive (permanent)
        assert!(cit.join("gameinfo.gi.dlp.bak").is_file());
        assert!(cit.join("cfg").join("video.txt.dlp.bak").is_file());
        // Deduplication: switching T1 -> T2 must keep ONLY 1 backup (no duplicate backup created for T2)
        assert_eq!(crate::backup::list_backups(&data).len(), 1, "switching presets must NOT create duplicate backups");
        crate::backup::rm_ro(cit.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn reapply_preserves_enabled_hud_block() {
        let (cit, data, pkg) = sandbox("hud_reapply");
        let root = cit.parent().unwrap().parent().unwrap();
        std::fs::write(data.join("settings.json"), r#"{"unit_status_new":true}"#).unwrap();
        install(Mode::T1, 90, root.to_str().unwrap(), &pkg, &data).unwrap();
        let expected = std::fs::read_to_string(cit.join("cfg/autoexec.cfg")).unwrap();
        assert!(expected.contains("citadel_unit_status_use_new"));
        install(Mode::T1, 90, root.to_str().unwrap(), &pkg, &data).unwrap();
        let actual = std::fs::read_to_string(cit.join("cfg/autoexec.cfg")).unwrap();
        crate::backup::rm_ro(root);
        assert_eq!(actual, expected, "reapply must restore enabled HUD block after cleanup");
    }

    #[test]
    fn timestamp_shape() {
        let ts = timestamp_utc(0);
        assert_eq!(ts, "1970-01-01_000000");
        // 2026-09-12 00:00:00 UTC = 1789171200
        assert_eq!(timestamp_utc(1789171200), "2026-09-12_000000");
    }
}
