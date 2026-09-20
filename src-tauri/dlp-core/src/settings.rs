// %APPDATA%\DLPBooster\settings.json — lang, tester unlock, last path,
// unit-status autoexec option. Root overridable via DLPB_DATA_DIR (tests).
use std::path::PathBuf;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(default)]
pub struct Settings {
    pub lang: String,     // "fa" | "en"
    pub unlocked: bool,   // tester TEMP modes unlocked
    pub last_path: Option<String>,
    pub unit_status_new: bool, // citadel_unit_status_use_new autoexec block
    pub fov: u32,              // per-user draft FOV 70..=120, applied on install
    pub reflex_mode: u8,       // 0: default/off, 1: on, 2: on+boost
    pub fps_max: u32,          // 0: uncapped
    pub vsync: bool,           // false
    pub reduce_flash: bool,    // true
    pub texture_bias: u8,      // 0 = preset default, 4 = heavy, 6 = med, 8 = light, 10 = potato
    pub ragdoll_gib_limit: bool, // true
    pub custom_autoexec: String, // custom user lines
    pub renderer: String,        // "default" | "dx11" | "vulkan"
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            lang: "fa".into(),
            unlocked: false,
            last_path: None,
            unit_status_new: false,
            fov: 90,
            reflex_mode: 1,
            fps_max: 0,
            vsync: false,
            reduce_flash: true,
            texture_bias: 0,
            ragdoll_gib_limit: true,
            custom_autoexec: String::new(),
            renderer: "default".into(),
        }
    }
}

impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if !["fa", "en"].contains(&self.lang.as_str()) { return Err("lang must be fa or en".into()); }
        if !(70..=120).contains(&self.fov) || self.fov % 5 != 0 { return Err("fov must be 70..120 in steps of 5".into()); }
        if self.reflex_mode > 2 { return Err("reflex_mode must be 0..2".into()); }
        if self.fps_max > 1000 { return Err("fps_max must be 0..1000".into()); }
        if ![0, 4, 6, 8, 10].contains(&self.texture_bias) { return Err("invalid texture_bias".into()); }
        if self.custom_autoexec.len() > 65536 || self.custom_autoexec.contains('\0') { return Err("invalid custom_autoexec".into()); }
        if !["default", "dx11", "vulkan"].contains(&self.renderer.as_str()) { return Err("renderer must be default, dx11, or vulkan".into()); }
        Ok(())
    }
}

pub fn load_checked_from(dir: &std::path::Path) -> Result<Settings, String> {
    let s: Settings = match std::fs::read(dir.join("settings.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| format!("settings.json: {e}; file preserved"))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Settings::default(),
        Err(e) => return Err(format!("settings.json: {e}")),
    };
    s.validate()?;
    Ok(s)
}

/// Data root: %APPDATA%\DLPHub (or $DLPB_DATA_DIR in tests).
pub fn data_dir() -> PathBuf {
    if let Ok(d) = std::env::var("DLPB_DATA_DIR") {
        return PathBuf::from(d);
    }
    #[cfg(windows)]
    {
        let base = std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| {
            dirs::home_dir().unwrap_or_else(std::env::temp_dir)
        });
        let target = base.join("DLPHub");
        let legacy = base.join("DLPBooster");
        if !target.exists() && legacy.exists() {
            let _ = std::fs::rename(&legacy, &target);
        }
        target
    }
    #[cfg(not(windows))]
    {
        let base = dirs::home_dir().unwrap_or_else(std::env::temp_dir);
        let target = base.join(".dlphub");
        let legacy = base.join(".dlpbooster");
        if !target.exists() && legacy.exists() {
            let _ = std::fs::rename(&legacy, &target);
        }
        target
    }
}

pub fn load_from(dir: &std::path::Path) -> Settings {
    match std::fs::read(dir.join("settings.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

fn save_to(dir: &PathBuf, s: &Settings) -> std::io::Result<()> {
    s.validate().map_err(std::io::Error::other)?;
    load_checked_from(dir).map_err(std::io::Error::other)?;
    std::fs::create_dir_all(dir)?;
    use std::io::Write;
    let tmp = dir.join("settings.json.tmp");
    let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&tmp)?;
    let result = (|| {
        file.write_all(serde_json::to_string_pretty(s)?.as_bytes())?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&tmp, dir.join("settings.json"))
    })();
    if result.is_err() { let _ = std::fs::remove_file(&tmp); }
    result?;
    Ok(())
}

pub fn load() -> Settings {
    load_from(&data_dir())
}

pub fn save(s: &Settings) -> std::io::Result<()> {
    save_to(&data_dir(), s)
}

pub fn reset() -> std::io::Result<Settings> {
    let s = Settings::default();
    let dir = data_dir();
    std::fs::create_dir_all(&dir)?;
    let tmp = dir.join("settings.json.tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(&s)?)?;
    std::fs::rename(&tmp, dir.join("settings.json"))?;
    Ok(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fov_setting_roundtrip_and_validation() {
        let tmp = std::env::temp_dir().join("dlpb_fov_contract");
        crate::backup::rm_ro(&tmp);
        let s: Settings = serde_json::from_str(r#"{"fov":110}"#).unwrap();
        save_to(&tmp, &s).unwrap();
        let stored = serde_json::to_value(load_checked_from(&tmp).unwrap()).unwrap();
        assert_eq!(stored.get("fov"), Some(&serde_json::json!(110)));
        let invalid: Settings = serde_json::from_str(r#"{"fov":111}"#).unwrap();
        assert!(save_to(&tmp, &invalid).is_err());
        crate::backup::rm_ro(&tmp);
    }

    #[test]
    fn rejects_invalid_settings_and_preserves_corrupt_file() {
        let tmp = std::env::temp_dir().join("dlpb_settings_validation");
        crate::backup::rm_ro(&tmp);
        let mut s = Settings::default();
        s.reflex_mode = 3;
        assert!(save_to(&tmp, &s).is_err());
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("settings.json"), "bad json").unwrap();
        assert!(save_to(&tmp, &Settings::default()).is_err());
        assert_eq!(std::fs::read_to_string(tmp.join("settings.json")).unwrap(), "bad json");
        crate::backup::rm_ro(&tmp);
    }

    #[test]
    fn load_missing_defaults() {
        let tmp = std::env::temp_dir().join("dlpb_settings_missing");
        crate::backup::rm_ro(&tmp);
        let s = load_from(&tmp);
        assert_eq!(s.lang, "fa");
        assert!(!s.unlocked);
        assert!(s.last_path.is_none());
        assert!(!s.unit_status_new);
        assert_eq!(s.reflex_mode, 1);
        assert_eq!(s.fps_max, 0);
        assert!(!s.vsync);
        assert!(s.reduce_flash);
        assert_eq!(s.texture_bias, 0);
        assert!(s.ragdoll_gib_limit);
        assert!(s.custom_autoexec.is_empty());
        crate::backup::rm_ro(&tmp);
    }

    #[test]
    fn save_reload_roundtrip() {
        let tmp = std::env::temp_dir().join("dlpb_settings_rt");
        crate::backup::rm_ro(&tmp);
        let s = Settings {
            lang: "en".into(),
            unlocked: true,
            last_path: Some("D:\\SteamLibrary\\steamapps\\common\\Deadlock".into()),
            unit_status_new: true,
            fov: 110,
            reflex_mode: 2,
            fps_max: 165,
            vsync: true,
            reduce_flash: false,
            texture_bias: 4,
            ragdoll_gib_limit: false,
            custom_autoexec: "bind f6 kill".into(),
            renderer: "vulkan".into(),
        };
        save_to(&tmp, &s).unwrap();
        let s2 = load_from(&tmp);
        assert_eq!(s2.lang, "en");
        assert!(s2.unlocked);
        assert_eq!(s2.last_path.as_deref(), Some("D:\\SteamLibrary\\steamapps\\common\\Deadlock"));
        assert!(s2.unit_status_new);
        assert_eq!(s2.reflex_mode, 2);
        assert_eq!(s2.fps_max, 165);
        assert!(s2.vsync);
        assert!(!s2.reduce_flash);
        assert_eq!(s2.texture_bias, 4);
        assert!(!s2.ragdoll_gib_limit);
        assert_eq!(s2.custom_autoexec, "bind f6 kill");
        assert_eq!(s2.renderer, "vulkan");
        crate::backup::rm_ro(&tmp);
    }

    #[test]
    fn failed_save_leaves_previous_settings_intact() {
        let tmp = std::env::temp_dir().join("dlpb_settings_atomic");
        crate::backup::rm_ro(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("settings.json"), b"{\"lang\":\"en\"}").unwrap();
        // Read-only target file makes the rename fail.
        std::fs::create_dir(tmp.join("settings.json.tmp")).unwrap();
        assert!(save_to(&tmp, &Settings::default()).is_err());
        assert_eq!(load_from(&tmp).lang, "en");
        std::fs::remove_dir(tmp.join("settings.json.tmp")).unwrap();
        crate::backup::rm_ro(&tmp);
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults() {
        let tmp = std::env::temp_dir().join("dlpb_settings_bad");
        crate::backup::rm_ro(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("settings.json"), b"{not json").unwrap();
        assert_eq!(load_from(&tmp).lang, "fa");
        crate::backup::rm_ro(&tmp);
    }
}
