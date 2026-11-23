// Port of install.bat discovery block: find the Deadlock install folder.
// Registry HKCU\Software\Valve\Steam SteamPath -> steamapps\libraryfolders.vdf
// "path" lines -> prefer a library owning appmanifest_1422450.acf, fall back to
// orphan (citadel present, no manifest), then C..G drive scans (SteamLibrary,
// then Steam). Manual picker = frontend passes a path; backend validates.
use std::path::{Path, PathBuf};

pub const STEAM_REG_KEY: &str = r"Software\Valve\Steam";
pub const APPMANIFEST: &str = "appmanifest_1422450.acf";

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct Found {
    pub deadlock: String,
    /// true = library has appmanifest_1422450.acf (real Steam install)
    pub owned: bool,
}

/// Parse "path" values out of libraryfolders.vdf (regex-free: line scan,
/// unescape `\\` -> `\`). VDF crate not needed for one key.
pub fn parse_library_paths(vdf: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in vdf.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("\"path\"") {
            let v = rest.trim().trim_matches('"');
            if !v.is_empty() {
                out.push(v.replace("\\\\", "\\"));
            }
        }
    }
    out
}

fn library_deadlock(lib: &str) -> Option<(PathBuf, bool)> {
    let base = Path::new(lib).join("steamapps").join("common").join("Deadlock");
    if !base.join("game").join("citadel").is_dir() {
        return None;
    }
    let owned = base.join("steamapps").join(APPMANIFEST).is_file()
        || Path::new(lib).join("steamapps").join(APPMANIFEST).is_file();
    Some((base, owned))
}

/// Scan one library root list; first `owned` wins, else first orphan.
fn pick(candidates: &[String]) -> Option<Found> {
    let mut orphan = None;
    for c in candidates {
        if let Some((base, owned)) = library_deadlock(c) {
            if owned {
                return Some(Found { deadlock: base.to_string_lossy().into_owned(), owned: true });
            }
            if orphan.is_none() {
                orphan = Some(Found { deadlock: base.to_string_lossy().into_owned(), owned: false });
            }
        }
    }
    orphan
}

fn registry_steam_path() -> Option<String> {
    #[cfg(windows)]
    {
        let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        let key = hkcu.open_subkey(STEAM_REG_KEY).ok()?;
        key.get_value::<String, _>("SteamPath").ok()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

fn drive_scan_candidates() -> Vec<String> {
    let mut v = Vec::new();
    for d in ["C", "D", "E", "F", "G"] {
        v.push(format!("{d}:\\SteamLibrary"));
        v.push(format!("{d}:\\Steam"));
    }
    v
}

/// Full discovery: registry libraries (owned wins over orphan), then drive scan.
pub fn find_game() -> Option<Found> {
    let mut libs = Vec::new();
    if let Some(steam) = registry_steam_path() {
        let vdf = Path::new(&steam).join("steamapps").join("libraryfolders.vdf");
        if let Ok(text) = std::fs::read_to_string(&vdf) {
            libs = parse_library_paths(&text);
        }
    }
    if let Some(f) = pick(&libs) {
        return Some(f);
    }
    pick(&drive_scan_candidates())
}

/// Manual folder picker: validate `<path>\game\citadel` exists.
/// Resilient to trailing separators and user picking either the Deadlock root,
/// the `game` folder, or the `game\citadel` folder.
pub fn validate_manual(path: &str) -> Option<Found> {
    let raw = path.trim();
    if raw.is_empty() {
        return None;
    }
    let trimmed = raw.trim_end_matches(['/', '\\']);
    // Preserve trailing backslash for Windows drive roots like "D:" -> "D:\"
    let owned_path;
    let clean = if trimmed.len() == 2 && trimmed.as_bytes()[1] == b':' {
        owned_path = format!("{trimmed}\\");
        &owned_path
    } else if trimmed.is_empty() {
        raw
    } else {
        trimmed
    };

    let p = Path::new(clean);
    if p.join("game").join("citadel").is_dir() {
        return Some(Found { deadlock: clean.to_string(), owned: true });
    }
    if p.file_name().map_or(false, |n| n.eq_ignore_ascii_case("game")) && p.join("citadel").is_dir() {
        if let Some(parent) = p.parent() {
            let parent_str = parent.to_string_lossy();
            let parent_clean = if parent_str.len() == 2 && parent_str.as_bytes()[1] == b':' {
                format!("{parent_str}\\")
            } else {
                parent_str.into_owned()
            };
            return Some(Found { deadlock: parent_clean, owned: true });
        }
    }
    if p.file_name().map_or(false, |n| n.eq_ignore_ascii_case("citadel")) {
        if let Some(game_dir) = p.parent() {
            if game_dir.file_name().map_or(false, |n| n.eq_ignore_ascii_case("game")) {
                if let Some(root) = game_dir.parent() {
                    let root_str = root.to_string_lossy();
                    let root_clean = if root_str.len() == 2 && root_str.as_bytes()[1] == b':' {
                        format!("{root_str}\\")
                    } else {
                        root_str.into_owned()
                    };
                    return Some(Found { deadlock: root_clean, owned: true });
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vdf_parse_two_libraries_unescape() {
        let vdf = r#""libraryfolders"
{
	"0"
	{
		"path"		"C:\\Program Files (x86)\\Steam"
	}
	"1"
	{
		"path"		"D:\\SteamLibrary"
	}
}"#;
        let v = parse_library_paths(vdf);
        assert_eq!(v, vec!["C:\\Program Files (x86)\\Steam", "D:\\SteamLibrary"]);
    }

    #[test]
    fn vdf_parse_empty() {
        assert!(parse_library_paths("no paths here").is_empty());
    }

    #[test]
    fn owned_library_beats_orphan() {
        let tmp = std::env::temp_dir().join("dlpb_disc_test");
        let _ = std::fs::remove_dir_all(&tmp);
        let orphan = tmp.join("libA");
        let owned = tmp.join("libB");
        for (lib, manifest) in [(&orphan, false), (&owned, true)] {
            let c = lib.join("steamapps").join("common").join("Deadlock").join("game").join("citadel");
            std::fs::create_dir_all(&c).unwrap();
            if manifest {
                std::fs::write(lib.join("steamapps").join(APPMANIFEST), b"").unwrap();
            }
        }
        let found = pick(&[orphan.to_string_lossy().into_owned(), owned.to_string_lossy().into_owned()]);
        assert_eq!(found.unwrap().deadlock, owned.join("steamapps").join("common").join("Deadlock").to_string_lossy());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn orphan_fallback() {
        let tmp = std::env::temp_dir().join("dlpb_disc_orphan");
        let _ = std::fs::remove_dir_all(&tmp);
        let orphan = tmp.join("libA");
        let c = orphan.join("steamapps").join("common").join("Deadlock").join("game").join("citadel");
        std::fs::create_dir_all(&c).unwrap();
        let found = pick(&[orphan.to_string_lossy().into_owned()]);
        assert!(!found.unwrap().owned);
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn none_when_no_citadel() {
        assert!(pick(&["C:\\definitely-not-here".into()]).is_none());
    }

    #[test]
    fn manual_validates_citadel() {
        let tmp = std::env::temp_dir().join("dlpb_disc_manual");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("game").join("citadel")).unwrap();
        let p = tmp.to_string_lossy().into_owned();
        assert!(validate_manual(&p).is_some());
        assert!(validate_manual(&format!("{p}\\")).is_some());
        assert_eq!(validate_manual(&format!("{p}\\game")).unwrap().deadlock, p);
        assert_eq!(validate_manual(&format!("{p}\\game\\citadel")).unwrap().deadlock, p);
        assert!(validate_manual(p.replace("dlpb_disc_manual", "dlpb_nope").as_str()).is_none());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[cfg(windows)]
    #[test]
	#[ignore = "requires local Deadlock installation"]
    fn find_game_smoke_this_machine() {
        // Aryo's box has a real Deadlock install; smoke test only.
        let f = find_game();
        assert!(f.is_some(), "discovery found nothing on this machine");
        assert!(validate_manual(&f.unwrap().deadlock).is_some());
    }
}
