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

fn pak_number(name: &str) -> Option<u32> {
    let rest = name.strip_prefix("pak")?;
    let rest = rest.strip_suffix("_dir.vpk")?;
    rest.parse::<u32>().ok()
}

fn split_list(s: &str) -> Vec<String> {
    s.split(',')
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect()
}

/// Port of addons.ps1 main flow. `only`/`exclude` are comma lists ("" = none).
pub fn install_addons(src: &Path, dst: &Path, only: &str, exclude: &str) -> std::io::Result<AddonReport> {
    std::fs::create_dir_all(dst)?;
    let only_list = split_list(only);
    let excl_list = split_list(exclude);

    let mut rep = AddonReport::default();

    let man = dst.parent().unwrap_or(dst).join("addons_manifest.txt");
    let mut owned = match std::fs::read_to_string(&man) {
        Ok(s) => s.lines().map(str::to_string).collect::<Vec<_>>(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => vec![],
        Err(e) => return Err(e),
    };
    for fname in owned.clone() {
        if excl_list.contains(&fname) || (!only_list.is_empty() && !only_list.contains(&fname)) {
            if fname.contains(['/', '\\', ':']) || fname.contains("..") {
                return Err(std::io::Error::other("invalid addon manifest"));
            }
            match std::fs::remove_file(dst.join(&fname)) {
                Ok(()) => rep.removed.push(fname.clone()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(e),
            }
            owned.retain(|n| n != &fname);
        }
    }
    if man.exists() { std::fs::write(&man, owned.join("\n") + "\n")?; }

    // ceiling: highest pak number in destination OR source
    let mut max_n = 0u32;
    for dir in [dst, src] {
        for entry in std::fs::read_dir(dir)?.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(n) = pak_number(&name) {
                max_n = max_n.max(n);
            }
        }
    }

    let mut installed: Vec<String> = Vec::new();

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
        let target = dst.join(&fname);
        if !target.exists() {
            std::fs::copy(entry.path(), &target)?;
            rep.added.push(fname.clone());
            installed.push(fname);
            continue;
        }
        let dst_len = std::fs::metadata(&target)?.len();
        if dst_len == src_len && std::fs::read(&target)? == std::fs::read(entry.path())? {
            rep.skipped.push(fname);
            continue;
        }
        if let Some(_n) = pak_number(&fname) {
            let mut new = max_n + 1;
            let mut new_name = format!("pak{new:02}_dir.vpk");
            while dst.join(&new_name).exists() {
                new += 1;
                new_name = format!("pak{new:02}_dir.vpk");
            }
            max_n = new;
            std::fs::copy(entry.path(), dst.join(&new_name))?;
            rep.renumbered.push((fname, new_name.clone()));
            installed.push(new_name);
        } else {
            rep.kept_user.push(fname);
        }
    }

    if !installed.is_empty() {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new().create(true).append(true).open(man)?;
        for name in &installed {
            writeln!(f, "{name}")?;
        }
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
        install_addons(&src, &dst, "", "pak01_dir.vpk").unwrap();
        assert_eq!(std::fs::read(dst.join("pak01_dir.vpk")).unwrap(), b"user");
        let rep = install_addons(&src, &dst, "", "").unwrap();
        assert!(rep.skipped.is_empty());
        assert_eq!(rep.renumbered.len(), 1);
        assert_eq!(std::fs::read(dst.join("pak01_dir.vpk")).unwrap(), b"user");
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
        assert!(man.contains("pak04_dir.vpk"));
    }

    #[test]
    fn identical_size_skipped_not_in_manifest() {
        let (src, dst) = setup("same");
        touch(&src.join("pak04_dir.vpk"), 10);
        touch(&dst.join("pak04_dir.vpk"), 10);
        let rep = install_addons(&src, &dst, "", "").unwrap();
        assert!(rep.skipped.contains(&"pak04_dir.vpk".to_string()));
        assert!(rep.added.is_empty());
        assert!(!dst.parent().unwrap().join("addons_manifest.txt").exists());
    }

    #[test]
    fn conflict_renumbers_above_ceiling() {
        let (src, dst) = setup("conflict");
        // user has pak04 (20 B); our pak04 is 10 B -> conflict
        touch(&dst.join("pak04_dir.vpk"), 20);
        // user also has pak09 -> ceiling must cover BOTH dst and src
        touch(&dst.join("pak09_dir.vpk"), 5);
        touch(&src.join("pak04_dir.vpk"), 10);
        touch(&src.join("pak07_dir.vpk"), 10);
        let rep = install_addons(&src, &dst, "", "").unwrap();
        // pak04 conflicts (renumbered above dst max 09); pak07 absent in dst = plain add
        assert_eq!(rep.renumbered.len(), 1);
        assert_eq!(rep.renumbered[0], ("pak04_dir.vpk".into(), "pak10_dir.vpk".into()));
        assert!(rep.added.contains(&"pak07_dir.vpk".to_string()));
        // user's pak04 untouched
        assert_eq!(std::fs::metadata(dst.join("pak04_dir.vpk")).unwrap().len(), 20);
        let man = std::fs::read_to_string(dst.parent().unwrap().join("addons_manifest.txt")).unwrap();
        assert!(man.contains("pak10_dir.vpk"));
        assert!(man.contains("pak07_dir.vpk"));
    }

    #[test]
    fn exclude_list_honored_and_wins_over_only() {
        let (src, dst) = setup("exclude");
        touch(&src.join("pak04_dir.vpk"), 10);
        touch(&src.join("pak05_dir.vpk"), 10);
        touch(&src.join("pak06_dir.vpk"), 10);
        let rep = install_addons(&src, &dst, "pak04_dir.vpk,pak05_dir.vpk,pak06_dir.vpk", "pak05_dir.vpk").unwrap();
        assert_eq!(rep.added.len(), 2);
        assert!(!dst.join("pak05_dir.vpk").exists());
        assert!(dst.join("pak04_dir.vpk").exists());
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

        // 1. Install Potato mode (only pak01, pak02)
        let rep_pot = install_addons(&src, &dst, "pak01_dir.vpk,pak02_dir.vpk", "").unwrap();
        assert!(dst.join("pak01_dir.vpk").exists());
        assert!(dst.join("pak02_dir.vpk").exists());
        assert!(!dst.join("pak04_dir.vpk").exists());
        assert_eq!(rep_pot.added.len(), 2);

        // 2. Switch to Tier 2 (excludes pak01, pak02; installs pak04)
        let rep_t2 = install_addons(&src, &dst, "", "pak01_dir.vpk,pak02_dir.vpk").unwrap();
        assert!(!dst.join("pak01_dir.vpk").exists());
        assert!(!dst.join("pak02_dir.vpk").exists());
        assert!(dst.join("pak04_dir.vpk").exists());
        assert_eq!(rep_t2.removed, vec!["pak01_dir.vpk", "pak02_dir.vpk"]);
        assert_eq!(rep_t2.added, vec!["pak04_dir.vpk"]);
    }
}
