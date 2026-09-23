// Port of detect.ps1: normalize installed gameinfo.gi (strip BOM, drop
// r_aspectratio lines — per-user FOV rewrites them), MD5, compare against the
// embedded tier gameinfo.gi files. POTATO uses gi_tier3, so it detects as T3.
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum Tier {
    T1,
    T2,
    T3,
    Potato,
    Missing,
    Unknown,
}

impl Tier {
    pub fn as_str(self) -> &'static str {
        match self {
            Tier::T1 => "T1",
            Tier::T2 => "T2",
            Tier::T3 => "T3",
            Tier::Potato => "POTATO",
            Tier::Missing => "MISSING",
            Tier::Unknown => "UNKNOWN",
        }
    }
}

/// detect.ps1 Get-NormHash normalization: strip BOM, drop whole
/// "r_aspectratio" "num" lines.
pub fn normalize(text: &str) -> String {
    let t = strip_bom_line(text);
    let mut out = String::with_capacity(t.len());
    for line in t.split_inclusive('\n') {
        // PS1 drops only lines matching "r_aspectratio"\s+"[0-9.]+"\r?\n
        if let Some(rest) = line.trim_start().strip_prefix("\"r_aspectratio\"") {
            let after = rest.trim_start();
            if let Some(v) = after.strip_prefix('"') {
                let num: String = v.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
                if !num.is_empty() && v[num.len()..].starts_with('"') {
                    continue;
                }
            }
        }
        out.push_str(line);
    }
    out
}

fn strip_bom_line(text: &str) -> &str {
    text.strip_prefix('\u{FEFF}').unwrap_or(text)
}

pub fn md5_hex(data: &[u8]) -> String {
    use md5::{Digest, Md5};
    let mut h = Md5::new();
    h.update(data);
    let d = h.finalize();
    d.iter().map(|b| format!("{b:02x}")).collect()
}

fn norm_hash_file(p: &Path) -> Option<String> {
    let bytes = std::fs::read(p).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    Some(md5_hex(normalize(&text).as_bytes()))
}

/// Compare citadel\gameinfo.gi against pkg\{t1,t2,t3,potato}\gameinfo.gi.
pub fn detect_tier(citadel: &Path, pkg: &Path) -> Tier {
    let gi = citadel.join("gameinfo.gi");
    if !gi.is_file() {
        return Tier::Missing;
    }
    let Some(h) = norm_hash_file(&gi) else {
        return Tier::Unknown;
    };
    for (tier, dir) in [
        (Tier::T1, "t1"),
        (Tier::T2, "t2"),
        (Tier::T3, "t3"),
        (Tier::Potato, "potato"),
    ] {
        let p = pkg.join(dir).join("gameinfo.gi");
        if p.is_file() && norm_hash_file(&p).as_deref() == Some(h.as_str()) {
            return tier;
        }
    }
    Tier::Unknown
}

/// Query the Windows display class keys in the registry for the GPU's dedicated VRAM.
/// Returns maximum dedicated VRAM found in bytes (e.g. 10_737_418_240 for 10 GB), or 0 if undetected/non-Windows.
pub fn detect_vram_bytes() -> u64 {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let class_path = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
        let Ok(class_key) = hklm.open_subkey(class_path) else { return 0; };
        let mut max_vram = 0u64;
        for subkey_name in class_key.enum_keys().flatten() {
            if subkey_name.starts_with("00") {
                if let Ok(sub) = class_key.open_subkey(&subkey_name) {
                    if let Ok(qw) = sub.get_value::<u64, _>("HardwareInformation.qwMemorySize") {
                        max_vram = max_vram.max(qw);
                    } else if let Ok(dw) = sub.get_value::<u32, _>("HardwareInformation.MemorySize") {
                        max_vram = max_vram.max(dw as u64);
                    }
                }
            }
        }
        max_vram
    }
    #[cfg(not(windows))]
    {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_drops_aspectratio_and_bom() {
        let gi = "\u{FEFF}\"a\" \"1\"\n\t\"r_aspectratio\"\t\t\t\t\t\t\"2.15\"\n\"b\" \"2\"\n";
        assert_eq!(normalize(gi), "\"a\" \"1\"\n\"b\" \"2\"\n");
    }

    #[test]
    fn normalize_keeps_everything_else() {
        assert_eq!(normalize("\"x\" \"1\"\n"), "\"x\" \"1\"\n");
    }

    #[test]
    fn detect_bom_and_fov_insensitive() {
        let tmp = std::env::temp_dir().join("dlpb_detect_test");
        crate::backup::rm_ro(&tmp);
        let tier1 = tmp.join("t1");
        std::fs::create_dir_all(&tier1).unwrap();
        let base = "\"Version\" \"13\"\n\"r_aspectratio\"\t\t\t\t\t\t\"2.15\"\n";
        std::fs::write(tier1.join("gameinfo.gi"), base).unwrap();

        // BOM + different FOV still detects T1
        let cit = tmp.join("citadel");
        std::fs::create_dir_all(&cit).unwrap();
        std::fs::write(cit.join("gameinfo.gi"), format!("\u{FEFF}\"Version\" \"13\"\n\"r_aspectratio\" \"3.09\"\n")).unwrap();
        assert_eq!(detect_tier(&cit, &tmp), Tier::T1);

        // foreign content -> Unknown
        std::fs::write(cit.join("gameinfo.gi"), "\"totally\" \"different\"\n").unwrap();
        assert_eq!(detect_tier(&cit, &tmp), Tier::Unknown);

        // absent file -> Missing
        let empty = tmp.join("empty_cit");
        std::fs::create_dir_all(&empty).unwrap();
        assert_eq!(detect_tier(&empty, &tmp), Tier::Missing);

        crate::backup::rm_ro(&tmp);
    }
}
