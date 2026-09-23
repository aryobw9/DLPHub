// Port of addons.ps1 - collision-aware addon installer.
// Deadlock loads pakNN_dir.vpk in filename-number order. For each vpk we ship:
//   not present          -> copy as-is
//   same name, same size -> skip (user already has identical file)
//   same name, DIFF size -> user's addon stays; ours gets the next free number
//                           ABOVE max(existing user paks AND our paks)
//                           (computed upfront - no cascade collisions)
// -Only = allowlist, -Exclude = blocklist (exclude wins). Manifest of names we
// installed is appended to addons_manifest.txt in the citadel root (parent of
// addons dir) so revert can remove exactly what we added.
use std::path::Path;

#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct AddonReport {
    pub added: Vec<String>,
    pub removed: Vec<String>,
    pub skipped: Vec<String>,
    pub renumbered: Vec<(String, String)>, // (src name, installed as)
    pub kept_user: Vec<String>,
    pub not_selected: usize,
}

pub fn high_slot_name(name: &str) -> String {
    match name {
        "pak01_dir.vpk" => "pak91_dir.vpk".to_string(),
        "pak02_dir.vpk" => "pak92_dir.vpk".to_string(),
        "pak03_dir.vpk" => "pak93_dir.vpk".to_string(),
        "pak04_dir.vpk" => "pak94_dir.vpk".to_string(),
        "pak05_dir.vpk" => "pak95_dir.vpk".to_string(),
        "pak06_dir.vpk" => "pak96_dir.vpk".to_string(),
        "pak08_dir.vpk" => "pak97_dir.vpk".to_string(),
        "pak26_dir.vpk" => "pak98_dir.vpk".to_string(),
        "pak54_dir.vpk" => "pak99_dir.vpk".to_string(),
        other => other.to_string(),
    }
}

fn pak_number(name: &str) -> Option<u32> {
    if !name.starts_with("pak") || !name.ends_with("_dir.vpk") {
        return None;
    }
    name.strip_prefix("pak")?
        .strip_suffix("_dir.vpk")?
        .parse::<u32>()
        .ok()
}

pub fn resolve_slot_name(fname: &str, src_len: u64, dst: &Path, owned: &[String], in_use: &[String]) -> String {
    let pref = high_slot_name(fname);
    let target = dst.join(&pref);
    if !target.exists() || owned.contains(&pref) {
        return pref;
    }
    if let Ok(m) = target.metadata() {
        if m.len() == src_len {
            return pref;
        }
    }
    if pak_number(&pref).is_none() {
        return pref;
    }
    for n in (11..=90).rev() {
        let candidate = format!("pak{:02}_dir.vpk", n);
        if !dst.join(&candidate).exists() && !owned.contains(&candidate) && !in_use.contains(&candidate) {
            return candidate;
        }
    }
    pref
}

fn split_list(s: &str) -> Vec<String> {
    s.split(',')
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect()
}

/// Installs DLPHub optimization addons into isolated high slots (pak91..pak99)
/// so they never collide with or touch user community mods (pak01..pak90).
pub fn install_addons(src: &Path, dst: &Path, only: &str, exclude: &str) -> std::io::Result<AddonReport> {
    std::fs::create_dir_all(dst)?;
    let only_list = split_list(only);
    let excl_list = split_list(exclude);

    let mut rep = AddonReport::default();

    let man = dst.parent().unwrap_or(dst).join("addons_manifest.txt");
    let owned = match std::fs::read_to_string(&man) {
        Ok(s) => s.lines().map(str::to_string).collect::<Vec<_>>(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => vec![],
        Err(e) => return Err(e),
    };

    let mut remaining_owned = owned.clone();
    for fname in owned.clone() {
        let is_selected = (only_list.is_empty() || only_list.iter().any(|o| high_slot_name(o) == fname || o == &fname))
            && !excl_list.iter().any(|e| high_slot_name(e) == fname || e == &fname);
        if !is_selected {
            let p = dst.join(&fname);
            if p.is_file() {
                let _ = std::fs::remove_file(&p);
                rep.removed.push(fname.clone());
            }
            remaining_owned.retain(|n| n != &fname);
        }
    }
    if man.exists() {
        std::fs::write(&man, remaining_owned.join("\n") + "\n")?;
    }

    let mut installed: Vec<String> = remaining_owned;
    let mut srcs: Vec<std::fs::DirEntry> = std::fs::read_dir(src)?.flatten().collect();
    srcs.sort_by_key(|e| e.file_name());

    for entry in srcs {
        let fname = entry.file_name().to_string_lossy().into_owned();
        if !fname.ends_with(".vpk") {
            continue;
        }
        if !only_list.is_empty() && !only_list.contains(&fname) {
            rep.not_selected += 1;
            continue;
        }
        if excl_list.contains(&fname) {
            rep.not_selected += 1;
            continue;
        }

        let src_len = entry.metadata()?.len();
        let target_name = resolve_slot_name(&fname, src_len, dst, &owned, &installed);
        if target_name != high_slot_name(&fname) {
            rep.renumbered.push((fname.clone(), target_name.clone()));
        }
        let target = dst.join(&target_name);

        if target.is_file() {
            if !owned.contains(&target_name) && pak_number(&target_name).is_none() {
                if let Ok(m) = target.metadata() {
                    if m.len() != src_len {
                        rep.kept_user.push(fname.clone());
                        continue;
                    }
                }
            }
            if let Ok(m) = target.metadata() {
                if m.len() == src_len {
                    rep.skipped.push(target_name.clone());
                    if !installed.contains(&target_name) {
                        installed.push(target_name);
                    }
                    continue;
                }
            }
        }

        std::fs::copy(entry.path(), &target)?;
        rep.added.push(target_name.clone());
        if !installed.contains(&target_name) {
            installed.push(target_name);
        }
    }

    if !installed.is_empty() {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(&man)?;
        for name in &installed {
            writeln!(f, "{name}")?;
        }
    } else if man.exists() {
        let _ = std::fs::remove_file(&man);
    }
    Ok(rep)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(p: &Path, size: usize) {
        std::fs::write(p, vec![b'x'; size]).unwrap();
    }

    fn setup(tag: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let base = std::env::temp_dir().join(format!("dlpb_addon_{tag}"));
        crate::backup::rm_ro(&base);
        let src = base.join("src");
        let dst = base.join("cit").join("addons");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::create_dir_all(&dst).unwrap();
        (src, dst)
    }

    #[test]
    fn equal_size_user_addons_are_never_owned_or_identical() {
        let (src, dst) = setup("ownership");
        std::fs::write(src.join("pak01_dir.vpk"), "ours").unwrap();
        std::fs::write(dst.join("pak01_dir.vpk"), "user").unwrap();
        let rep = install_addons(&src, &dst, "", "").unwrap();
        assert_eq!(rep.added, vec!["pak91_dir.vpk"]);
        // User's pak01_dir.vpk is completely untouched
        assert_eq!(std::fs::read(dst.join("pak01_dir.vpk")).unwrap(), b"user");
        assert_eq!(std::fs::read(dst.join("pak91_dir.vpk")).unwrap(), b"ours");
        crate::backup::rm_ro(src.parent().unwrap());
    }

    #[test]
    fn fresh_install_copies_all_and_manifest() {
        let (src, dst) = setup("fresh");
        for n in ["pak04_dir.vpk", "pak05_dir.vpk", "extra.vpk"] {
            touch(&src.join(n), 10);
        }
        let rep = install_addons(&src, &dst, "", "").unwrap();
        assert_eq!(rep.added.len(), 3);
        let man = std::fs::read_to_string(dst.parent().unwrap().join("addons_manifest.txt")).unwrap();
        assert_eq!(man.lines().count(), 3);
        assert!(man.contains("pak94_dir.vpk"));
        assert!(man.contains("pak95_dir.vpk"));
        assert!(man.contains("extra.vpk"));
    }

    #[test]
    fn identical_size_skipped_not_in_manifest() {
        let (src, dst) = setup("same");
        touch(&src.join("pak04_dir.vpk"), 10);
        touch(&dst.join("pak94_dir.vpk"), 10);
        let rep = install_addons(&src, &dst, "", "").unwrap();
        assert!(rep.skipped.contains(&"pak94_dir.vpk".to_string()));
        assert!(rep.added.is_empty());
        let man = std::fs::read_to_string(dst.parent().unwrap().join("addons_manifest.txt")).unwrap();
        assert!(man.contains("pak94_dir.vpk"));
    }

    #[test]
    fn conflict_renumbers_above_ceiling() {
        let (src, dst) = setup("conflict");
        // user has their own pak94 (20 B); our pak04 maps to pak94 (10 B) -> conflict with user high slot
        touch(&dst.join("pak94_dir.vpk"), 20);
        touch(&src.join("pak04_dir.vpk"), 10);
        touch(&src.join("pak05_dir.vpk"), 10);
        let rep = install_addons(&src, &dst, "", "").unwrap();
        // pak04 renumbers to pak90; pak05 installs into pak95
        assert_eq!(rep.renumbered.len(), 1);
        assert_eq!(rep.renumbered[0], ("pak04_dir.vpk".into(), "pak90_dir.vpk".into()));
        assert!(rep.added.contains(&"pak95_dir.vpk".to_string()));
        // user's pak94 untouched
        assert_eq!(std::fs::metadata(dst.join("pak94_dir.vpk")).unwrap().len(), 20);
        let man = std::fs::read_to_string(dst.parent().unwrap().join("addons_manifest.txt")).unwrap();
        assert!(man.contains("pak90_dir.vpk"));
        assert!(man.contains("pak95_dir.vpk"));
    }

    #[test]
    fn exclude_list_honored_and_wins_over_only() {
        let (src, dst) = setup("exclude");
        touch(&src.join("pak04_dir.vpk"), 10);
        touch(&src.join("pak05_dir.vpk"), 10);
        touch(&src.join("pak06_dir.vpk"), 10);
        let rep = install_addons(&src, &dst, "pak04_dir.vpk,pak05_dir.vpk,pak06_dir.vpk", "pak05_dir.vpk").unwrap();
        assert_eq!(rep.added.len(), 2);
        assert!(!dst.join("pak95_dir.vpk").exists());
        assert!(dst.join("pak94_dir.vpk").exists());
        assert_eq!(rep.not_selected, 1);
    }

    #[test]
    fn non_pak_diff_size_kept_user() {
        let (src, dst) = setup("nonpak");
        touch(&src.join("custom.vpk"), 10);
        touch(&dst.join("custom.vpk"), 20);
        let rep = install_addons(&src, &dst, "", "").unwrap();
        assert_eq!(rep.kept_user, vec!["custom.vpk".to_string()]);
        assert_eq!(std::fs::metadata(dst.join("custom.vpk")).unwrap().len(), 20);
    }

    #[test]
    fn potato_to_tier2_removes_potato_addons() {
        let (src, dst) = setup("potato_switch");
        touch(&src.join("pak01_dir.vpk"), 100);
        touch(&src.join("pak02_dir.vpk"), 100);
        touch(&src.join("pak04_dir.vpk"), 200);

        // 1. Install Potato mode (pak01, pak02 -> pak91, pak92)
        let rep_pot = install_addons(&src, &dst, "pak01_dir.vpk,pak02_dir.vpk", "").unwrap();
        assert!(dst.join("pak91_dir.vpk").exists());
        assert!(dst.join("pak92_dir.vpk").exists());
        assert!(!dst.join("pak94_dir.vpk").exists());
        assert_eq!(rep_pot.added.len(), 2);

        // 2. Switch to Tier 2 (excludes pak01, pak02; installs pak04 -> pak94)
        let rep_t2 = install_addons(&src, &dst, "", "pak01_dir.vpk,pak02_dir.vpk").unwrap();
        assert!(!dst.join("pak91_dir.vpk").exists());
        assert!(!dst.join("pak92_dir.vpk").exists());
        assert!(dst.join("pak94_dir.vpk").exists());
        assert_eq!(rep_t2.removed, vec!["pak91_dir.vpk", "pak92_dir.vpk"]);
        assert_eq!(rep_t2.added, vec!["pak94_dir.vpk"]);
    }
}
