// High-fidelity, in-place, non-destructive gameinfo.gi & video.txt overlay engine.
// Ported and adapted from Deadlock Mod Manager (GPL-3.0) for DLPHub / DLPBooster.
// Preserves SearchPaths, comments, line endings, monitor resolutions, and existing mods.

use std::collections::{HashMap, HashSet};

pub const BEGIN_MARKER_PREFIX: &str = "// ==== DLPHub · Performance BEGIN";
pub const END_MARKER: &str = "// ==== DLPHub · Performance END ====";
pub const END_MARKER_PREFIX: &str = "// ==== DLPHub · Performance END";
pub const CREDIT_TAG: &str = "[dlp-perf]";
pub const WAS_TAG: &str = " // dlp-perf was ";
pub const ADDED_TAG: &str = " // dlp-perf added";
pub const REMOVED_TAG: &str = "// dlp-perf removed: ";
pub const OWN_TAG: &str = "dlp-perf";

pub const DENIED_KEYS: [&str; 6] = [
    "sv_cheats",
    "timescale",
    "host_timescale",
    "engine2/renderingpipeline/distancefield",
    "r_render_portals",
    "engine2/localserverclientaccess",
];

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConfigEntry {
    pub path: Vec<String>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoSetting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppliedOverlayInfo {
    pub config_id: String,
    pub level: u8,
    pub line_count: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OptimizationRequest {
    pub level: u8,
    pub preset_id: String,
    pub preset_name: String,
    pub entries: Vec<ConfigEntry>,
    pub video_settings: Vec<VideoSetting>,
    pub include_engine_sections: bool,
    pub fov: Option<u32>,
    pub aspect_ratio: Option<String>,
    pub aspect_ratio_enabled: bool,
    pub fps_limit: Option<String>,
    pub cloth_sim_stop: bool,
    pub ragdoll_fade: bool,
    pub better_breakables: bool,
    pub higher_brightness: bool,
    pub reduce_clutter: bool,
    pub hero_potato: bool,
    pub deadlock_path: String,
}

/// Normalizes a path like ["ConVars", "r_shadows"] to lowercase "convars/r_shadows"
pub fn path_key(path: &[String]) -> String {
    path.iter()
        .map(|s| s.to_ascii_lowercase())
        .collect::<Vec<_>>()
        .join("/")
}

/// Normalizes a value for comparison (e.g. "true" -> "1", "false" -> "0")
pub fn normalize_val(val: &str) -> String {
    let t = val.trim();
    if t.eq_ignore_ascii_case("true") {
        "1".to_string()
    } else if t.eq_ignore_ascii_case("false") {
        "0".to_string()
    } else {
        t.to_string()
    }
}

/// Checks if text contains our markers
pub fn has_overlay(text: &str) -> bool {
    text.contains(BEGIN_MARKER_PREFIX) || text.contains(OWN_TAG)
}

/// Reads information about an applied overlay if present
pub fn read_applied_info(text: &str) -> Option<AppliedOverlayInfo> {
    if !text.contains(BEGIN_MARKER_PREFIX) {
        return None;
    }
    let mut config_id = "unknown".to_string();
    let mut level = 1u8;
    let mut count = 0;

    for line in text.lines() {
        if line.contains(BEGIN_MARKER_PREFIX) {
            if let Some(pos) = line.find("config=") {
                let rest = &line[pos + 7..];
                let end = rest.find(|c: char| c.is_whitespace() || c == ')').unwrap_or(rest.len());
                config_id = rest[..end].to_string();
            }
            if let Some(pos) = line.find("level=") {
                let rest = &line[pos + 6..];
                let end = rest.find(|c: char| c.is_whitespace() || c == ')').unwrap_or(rest.len());
                if let Ok(l) = rest[..end].parse::<u8>() {
                    level = l;
                }
            }
        }
        if line.contains(OWN_TAG) {
            count += 1;
        }
    }

    Some(AppliedOverlayInfo {
        config_id,
        level,
        line_count: count,
    })
}

/// Cleanly removes any existing DLPHub overlay from gameinfo text, restoring original values
pub fn strip_overlay(text: &str) -> (String, Option<AppliedOverlayInfo>) {
    let applied = read_applied_info(text);
    if !has_overlay(text) {
        return (text.to_string(), applied);
    }

    let mut out = String::with_capacity(text.len());
    let mut in_block = false;

    for line in text.split_inclusive('\n') {
        let trimmed = line.trim();

        if trimmed.starts_with(BEGIN_MARKER_PREFIX) {
            in_block = true;
            continue;
        }

        if in_block {
            if trimmed.starts_with(END_MARKER_PREFIX) || trimmed == END_MARKER {
                in_block = false;
            }
            continue;
        }

        // Restore in-place edits: line with `// dlp-perf was "<old_val>"`
        if let Some(was_idx) = line.find(WAS_TAG) {
            let before_was = &line[..was_idx];
            let after_was = &line[was_idx + WAS_TAG.len()..];
            let old_val = after_was.trim();
            if let Some(reconstructed) = restore_line_value(before_was, old_val) {
                out.push_str(&reconstructed);
                if line.ends_with('\n') && !reconstructed.ends_with('\n') {
                    out.push('\n');
                }
                continue;
            }
        }

        if line.contains(ADDED_TAG) {
            continue;
        }

        if let Some(rem_idx) = line.find(REMOVED_TAG) {
            let restored = &line[rem_idx + REMOVED_TAG.len()..];
            out.push_str(restored);
            continue;
        }

        out.push_str(line);
    }

    (out, applied)
}

fn restore_line_value(line: &str, old_val: &str) -> Option<String> {
    let trimmed_right = line.trim_end();
    if trimmed_right.ends_with('"') {
        let without_last_quote = &trimmed_right[..trimmed_right.len() - 1];
        if let Some(open_quote) = without_last_quote.rfind('"') {
            let prefix = &trimmed_right[..open_quote];
            let clean_val = old_val.trim_matches('"');
            return Some(format!("{prefix}\"{clean_val}\""));
        }
    } else if let Some(last_space) = trimmed_right.rfind(|c: char| c == ' ' || c == '\t') {
        let prefix = &trimmed_right[..=last_space];
        let clean_val = old_val.trim_matches('"');
        return Some(format!("{prefix}{clean_val}"));
    }
    None
}

/// Applies the optimization request on top of the live gameinfo.gi text
pub fn apply_overlay(live_text: &str, req: &OptimizationRequest) -> Result<String, String> {
    let (clean_text, _) = strip_overlay(live_text);

    let mut convar_map: HashMap<String, String> = HashMap::new();

    for entry in &req.entries {
        if entry.path.is_empty() {
            continue;
        }
        let full_key = path_key(&entry.path);
        let first_seg = entry.path[0].to_ascii_lowercase();

        if DENIED_KEYS.iter().any(|&d| full_key.contains(d)) {
            continue;
        }

        let val = match &entry.value {
            Some(v) => v.clone(),
            None => continue,
        };

        if first_seg == "convars" && entry.path.len() >= 2 {
            let key = entry.path[1..].join("/");
            convar_map.insert(key.to_ascii_lowercase(), val);
        }
    }

    if let Some(fov) = req.fov {
        convar_map.insert("citadel_camera_hero_fov".to_string(), fov.to_string());
    }

    if req.aspect_ratio_enabled {
        if let Some(ar) = &req.aspect_ratio {
            if !ar.is_empty() {
                convar_map.insert("r_aspectratio".to_string(), ar.clone());
            }
        }
    } else {
        convar_map.remove("r_aspectratio");
    }

    if req.cloth_sim_stop {
        convar_map.insert("cloth_sim_on_tick".to_string(), "0".to_string());
    }
    if req.ragdoll_fade {
        convar_map.insert("cl_ragdoll_limit".to_string(), "0".to_string());
        convar_map.insert("cl_disable_ragdolls".to_string(), "1".to_string());
    }

    let mut existing_convars: HashSet<String> = HashSet::new();
    let mut in_convars_scan = false;
    for line in clean_text.lines() {
        let trimmed = line.trim();
        if !in_convars_scan && (trimmed.eq_ignore_ascii_case("convars") || trimmed.eq_ignore_ascii_case("\"convars\"")) {
            in_convars_scan = true;
            continue;
        }
        if in_convars_scan {
            if trimmed.contains('}') {
                in_convars_scan = false;
                continue;
            }
            if let Some((k, _, _, _)) = parse_convar_line(line) {
                existing_convars.insert(k.to_ascii_lowercase());
            }
        }
    }

    let lines: Vec<&str> = clean_text.lines().collect();
    let mut out = String::with_capacity(clean_text.len() + 8192);

    let mut in_convars = false;
    let mut injected_block = false;
    let eol = if clean_text.contains("\r\n") { "\r\n" } else { "\n" };

    for line in lines {
        let trimmed = line.trim();

        if !in_convars && (trimmed.eq_ignore_ascii_case("convars") || trimmed.eq_ignore_ascii_case("\"convars\"")) {
            in_convars = true;
            out.push_str(line);
            out.push_str(eol);
            continue;
        }

        if in_convars {
            let opens = line.matches('{').count();

            if opens > 0 && !injected_block {
                out.push_str(line);
                out.push_str(eol);

                let mut new_keys: Vec<(&String, &String)> = convar_map
                    .iter()
                    .filter(|(k, _)| !existing_convars.contains(*k))
                    .collect();
                new_keys.sort_by_key(|(k, _)| *k);

                out.push_str(&format!("\t\t{BEGIN_MARKER_PREFIX} (config={} level={}){eol}", req.preset_id, req.level));
                out.push_str(&format!("\t\t// {} {CREDIT_TAG}{eol}", req.preset_name));

                for (k, v) in new_keys {
                    out.push_str(&format!("\t\t\"{k}\"\t\t\t\t\t\t\"{v}\"{eol}"));
                }
                out.push_str(&format!("\t\t{END_MARKER}{eol}"));

                injected_block = true;
                continue;
            }

            if let Some((k, prefix_end, val_str, suffix)) = parse_convar_line(line) {
                let k_lower = k.to_ascii_lowercase();
                if let Some(target_val) = convar_map.get(&k_lower) {
                    if normalize_val(val_str) != normalize_val(target_val) {
                        let prefix = &line[..prefix_end];
                        out.push_str(prefix);
                        out.push_str(&format!("\"{target_val}\"{WAS_TAG}\"{val_str}\"{suffix}{eol}"));
                        continue;
                    }
                }
            }

            if in_convars && trimmed.contains('}') {
                in_convars = false;
            }
        }

        out.push_str(line);
        out.push_str(eol);
    }

    Ok(out)
}

fn parse_convar_line(line: &str) -> Option<(&str, usize, &str, &str)> {
    let trimmed = line.trim_start();
    if trimmed.starts_with("//") || trimmed.is_empty() {
        return None;
    }
    let idx = line.find('"')?;
    let rest = &line[idx + 1..];
    let close = rest.find('"')?;
    let key = &rest[..close];

    let after_key = &line[idx + 1 + close + 1..];
    let gap = after_key.len() - after_key.trim_start().len();
    let val_part = &after_key[gap..];

    if val_part.starts_with('"') {
        let val_close = val_part[1..].find('"')?;
        let val_str = &val_part[1..1 + val_close];
        let prefix_end = idx + 1 + close + 1 + gap;
        let suffix = &val_part[1 + val_close + 1..];
        Some((key, prefix_end, val_str, suffix))
    } else {
        let end_val = val_part.find(|c: char| c.is_whitespace() || c == '/' || c == ';').unwrap_or(val_part.len());
        let val_str = &val_part[..end_val];
        if !val_str.is_empty() {
            let prefix_end = idx + 1 + close + 1 + gap;
            let suffix = &val_part[end_val..];
            Some((key, prefix_end, val_str, suffix))
        } else {
            None
        }
    }
}

/// Merges video settings into the user's video.txt while STRICTLY preserving identity keys
pub fn merge_video_settings(
    user_video: &str,
    video_settings: &[VideoSetting],
    fov: Option<u32>,
    fps_limit: Option<&str>,
) -> String {
    use crate::kvedit::IDENTITY_KEYS;

    let mut setting_map: HashMap<String, String> = HashMap::new();
    for vs in video_settings {
        let key_clean = if vs.key.starts_with("setting.") {
            vs.key.clone()
        } else {
            format!("setting.{}", vs.key)
        };
        setting_map.insert(key_clean, vs.value.clone());
    }

    if let Some(f) = fov {
        setting_map.insert("setting.fov".to_string(), f.min(90).to_string());
    }
    if let Some(fps) = fps_limit {
        if fps != "DEFAULT" && !fps.is_empty() {
            setting_map.insert("setting.fps_max".to_string(), fps.to_string());
        }
    }

    let eol = if user_video.contains("\r\n") { "\r\n" } else { "\n" };
    let mut out = String::with_capacity(user_video.len() + 1024);

    for line in user_video.lines() {
        if let Some((k, _v)) = crate::kvedit::parse_kv(line) {
            if IDENTITY_KEYS.contains(&k) {
                out.push_str(line);
                out.push_str(eol);
                continue;
            }

            if let Some(new_val) = setting_map.get(k) {
                out.push_str(&format!("\"{k}\"\t\t\"{new_val}\"{eol}"));
                continue;
            }
        }
        out.push_str(line);
        out.push_str(eol);
    }

    out
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DetectPerfStatus {
    pub is_installed: bool,
    pub level: u8,
    pub config_id: String,
    pub line_count: usize,
    pub addons_installed: Vec<String>,
}

pub fn apply_optimization_flow(
    req: OptimizationRequest,
    data_dir: &std::path::Path,
    addons_src: &std::path::Path,
) -> Result<Vec<crate::install::StepLog>, String> {
    let mut log = Vec::new();
    let citadel = std::path::Path::new(&req.deadlock_path).join("game").join("citadel");

    if !citadel.exists() {
        return Err(format!("Citadel directory not found at {:?}", citadel));
    }

    if !cfg!(test) {
        let running = crate::guard::game_running();
        if !running.is_empty() {
            return Err(format!("game running: {} — close Deadlock first", running.join(", ")));
        }
    }

    crate::install::write_test(&citadel)?;
    log.push(crate::install::StepLog {
        step: "write-test".into(),
        detail: "game folder writable".into(),
        skipped: false,
    });

    let gi_path = citadel.join("gameinfo.gi");
    let gi_bak = citadel.join("gameinfo.gi.dlp.bak");
    if !gi_bak.exists() && gi_path.is_file() {
        let _ = std::fs::copy(&gi_path, &gi_bak);
    }
    let vd_path = citadel.join("cfg").join("video.txt");
    let vd_bak = citadel.join("cfg").join("video.txt.dlp.bak");
    if !vd_bak.exists() && vd_path.is_file() {
        let _ = std::fs::copy(&vd_path, &vd_bak);
    }

    let live_gi = std::fs::read_to_string(&gi_path)
        .map_err(|e| format!("Failed to read gameinfo.gi: {e}"))?;
    let patched_gi = apply_overlay(&live_gi, &req)?;
    std::fs::write(&gi_path, patched_gi)
        .map_err(|e| format!("Failed to write gameinfo.gi: {e}"))?;
    log.push(crate::install::StepLog {
        step: "gameinfo.gi".into(),
        detail: format!("Level {} overlay applied ({})", req.level, req.preset_name),
        skipped: false,
    });

    if req.level >= 2 || req.fov.is_some() || req.fps_limit.is_some() {
        if vd_path.exists() {
            let _ = crate::backup::set_readonly(&vd_path, false);
            if let Ok(curr_video) = std::fs::read_to_string(&vd_path) {
                let v_settings = if req.level >= 2 {
                    &req.video_settings[..]
                } else {
                    &[][..]
                };
                let merged_v = merge_video_settings(
                    &curr_video,
                    v_settings,
                    req.fov,
                    req.fps_limit.as_deref(),
                );
                let _ = std::fs::write(&vd_path, merged_v);
                let _ = crate::backup::set_readonly(&vd_path, true);
                log.push(crate::install::StepLog {
                    step: "video.txt".into(),
                    detail: if req.level >= 2 {
                        "merged optimized video settings (resolution preserved)".into()
                    } else {
                        "updated fov / fps_max in video.txt".into()
                    },
                    skipped: false,
                });
            }
        }
    }

    let (only, exclude) = if req.level == 1 {
        // Level 1: Cpu Optimization (only gameinfo.gi) -> NO addons/mods
        ("".to_string(), "pak01_dir.vpk,pak02_dir.vpk,pak03_dir.vpk,pak04_dir.vpk,pak05_dir.vpk,pak06_dir.vpk,pak31_dir.vpk,pak33_dir.vpk".to_string())
    } else if req.level == 2 {
        // Level 2: Cpu + Gpu Optimization (Level 2 mods: Essential Fixes, Anti Clutter, Doorman Fix)
        let mut allowed = Vec::new();
        allowed.push("pak04_dir.vpk");
        allowed.push("pak05_dir.vpk");
        allowed.push("pak06_dir.vpk");
        if req.higher_brightness { allowed.push("pak01_dir.vpk"); }
        if req.reduce_clutter { allowed.push("pak02_dir.vpk"); }
        if req.better_breakables { allowed.push("pak03_dir.vpk"); }
        let all = ["pak01_dir.vpk", "pak02_dir.vpk", "pak03_dir.vpk", "pak04_dir.vpk", "pak05_dir.vpk", "pak06_dir.vpk", "pak31_dir.vpk", "pak33_dir.vpk"];
        let excluded: Vec<&str> = all.iter().copied().filter(|k| !allowed.contains(k)).collect();
        (allowed.join(","), excluded.join(","))
    } else {
        // Level 3: Potato Mode (pak31 downscaled textures + optional pak33 hero potato + level 2 mods)
        let mut allowed = vec!["pak31_dir.vpk", "pak04_dir.vpk", "pak05_dir.vpk", "pak06_dir.vpk"];
        if req.hero_potato {
            allowed.push("pak33_dir.vpk");
        }
        if req.higher_brightness { allowed.push("pak01_dir.vpk"); }
        if req.reduce_clutter { allowed.push("pak02_dir.vpk"); }
        if req.better_breakables { allowed.push("pak03_dir.vpk"); }
        let all = ["pak01_dir.vpk", "pak02_dir.vpk", "pak03_dir.vpk", "pak04_dir.vpk", "pak05_dir.vpk", "pak06_dir.vpk", "pak31_dir.vpk", "pak33_dir.vpk"];
        let excluded: Vec<&str> = all.iter().copied().filter(|k| !allowed.contains(k)).collect();
        (allowed.join(","), excluded.join(","))
    };

    if addons_src.exists() {
        let rep = crate::addons::install_addons(addons_src, &citadel.join("addons"), &only, &exclude)
            .map_err(|e| e.to_string())?;
        log.push(crate::install::StepLog {
            step: "addons".into(),
            detail: format!("{} added, {} removed, {} identical", rep.added.len(), rep.removed.len(), rep.skipped.len()),
            skipped: rep.added.is_empty() && rep.removed.is_empty(),
        });
    }

    let mut s = crate::settings::load_from(data_dir);
    if let Some(f) = req.fov { s.fov = f; }
    if let Some(ar) = &req.aspect_ratio { s.aspect_ratio = ar.clone(); }
    s.aspect_ratio_enabled = req.aspect_ratio_enabled;
    s.stop_cloth_anim = req.cloth_sim_stop;
    s.ragdoll_fade = req.ragdoll_fade;
    s.better_breakables = req.better_breakables;
    s.higher_brightness = req.higher_brightness;
    s.reduce_clutter = req.reduce_clutter;
    s.hero_potato = req.hero_potato;
    let _ = crate::settings::save(&s);

    Ok(log)
}

pub fn apply_fov_only_flow(
    deadlock_path: &std::path::Path,
    fov: u32,
    aspect_ratio: &str,
    aspect_ratio_enabled: bool,
    data_dir: Option<&std::path::Path>,
) -> Result<String, String> {
    let vd_path = deadlock_path.join("game").join("citadel").join("cfg").join("video.txt");
    let gi_path = deadlock_path.join("game").join("citadel").join("gameinfo.gi");

    if vd_path.exists() {
        let _ = crate::backup::set_readonly(&vd_path, false);
        if let Ok(curr_video) = std::fs::read_to_string(&vd_path) {
            let merged = merge_video_settings(&curr_video, &[], Some(fov), None);
            let _ = std::fs::write(&vd_path, merged);
            let _ = crate::backup::set_readonly(&vd_path, true);
        }
    }

    if gi_path.exists() {
        let _ = crate::backup::set_readonly(&gi_path, false);
        if let Ok(curr_gi) = std::fs::read_to_string(&gi_path) {
            let ar_target = if aspect_ratio_enabled { Some(aspect_ratio) } else { None };
            let patched_gi = crate::kvedit::set_aspect_ratio(&curr_gi, ar_target);
            let _ = std::fs::write(&gi_path, patched_gi);
        }
    }

    let mut s = if let Some(d) = data_dir { crate::settings::load_from(d) } else { crate::settings::load() };
    s.fov = fov.min(90);
    s.aspect_ratio = aspect_ratio.to_string();
    s.aspect_ratio_enabled = aspect_ratio_enabled;
    let _ = crate::settings::save(&s);

    let ar_display = if aspect_ratio_enabled { aspect_ratio } else { "default" };
    Ok(format!("Applied FOV: {}° and Aspect Ratio: {}", fov, ar_display))
}

pub fn apply_fps_only_flow(
    deadlock_path: &std::path::Path,
    fps_limit: &str,
    data_dir: Option<&std::path::Path>,
) -> Result<String, String> {
    let vd_path = deadlock_path.join("game").join("citadel").join("cfg").join("video.txt");

    if vd_path.exists() {
        let _ = crate::backup::set_readonly(&vd_path, false);
        if let Ok(curr_video) = std::fs::read_to_string(&vd_path) {
            let merged = merge_video_settings(&curr_video, &[], None, Some(fps_limit));
            let _ = std::fs::write(&vd_path, merged);
            let _ = crate::backup::set_readonly(&vd_path, true);
        }
    }

    let mut s = if let Some(d) = data_dir { crate::settings::load_from(d) } else { crate::settings::load() };
    s.fps_max = fps_limit.parse::<u32>().ok();
    let _ = crate::settings::save(&s);

    Ok(format!("Applied FPS Limit: {} to video.txt", fps_limit))
}

pub fn revert_optimization_flow(
    deadlock_path: &str,
    _data_dir: &std::path::Path,
) -> Result<Vec<crate::install::StepLog>, String> {
    let mut log = Vec::new();
    let citadel = std::path::Path::new(deadlock_path).join("game").join("citadel");

    if !citadel.exists() {
        return Err(format!("Citadel directory not found at {:?}", citadel));
    }

    if !cfg!(test) {
        let running = crate::guard::game_running();
        if !running.is_empty() {
            return Err(format!("game running: {} — close Deadlock first", running.join(", ")));
        }
    }

    let gi_path = citadel.join("gameinfo.gi");
    if gi_path.is_file() {
        let text = std::fs::read_to_string(&gi_path).map_err(|e| e.to_string())?;
        let (stripped, applied) = strip_overlay(&text);
        if applied.is_some() || stripped != text {
            std::fs::write(&gi_path, stripped).map_err(|e| e.to_string())?;
            log.push(crate::install::StepLog {
                step: "gameinfo.gi".into(),
                detail: "performance overlay stripped and restored to clean state".into(),
                skipped: false,
            });
        }
    }

    let addons_dir = citadel.join("addons");
    let man = citadel.join("addons_manifest.txt");
    let mut removed_count = 0;
    if man.is_file() {
        if let Ok(content) = std::fs::read_to_string(&man) {
            for ln in content.lines() {
                let n = ln.trim();
                if n.is_empty() || n.contains('/') || n.contains('\\') || n.contains("..") || n == "." {
                    continue;
                }
                let p = addons_dir.join(n);
                if p.is_file() && std::fs::remove_file(&p).is_ok() {
                    removed_count += 1;
                }
            }
        }
        let _ = std::fs::remove_file(&man);
    }
    log.push(crate::install::StepLog {
        step: "addons".into(),
        detail: format!("cleaned up DLPHub addons ({} removed)", removed_count),
        skipped: removed_count == 0,
    });

    Ok(log)
}

pub fn detect_optimization_flow(deadlock_path: &str) -> DetectPerfStatus {
    let citadel = std::path::Path::new(deadlock_path).join("game").join("citadel");
    let gi_path = citadel.join("gameinfo.gi");

    let mut is_installed = false;
    let mut level = 1u8;
    let mut config_id = "none".to_string();
    let mut line_count = 0;

    if let Ok(text) = std::fs::read_to_string(&gi_path) {
        if let Some(info) = read_applied_info(&text) {
            is_installed = true;
            level = info.level;
            config_id = info.config_id;
            line_count = info.line_count;
        }
    }

    let man = citadel.join("addons_manifest.txt");
    let addons_installed = if let Ok(s) = std::fs::read_to_string(&man) {
        s.lines().map(str::to_string).collect()
    } else {
        vec![]
    };

    DetectPerfStatus {
        is_installed,
        level,
        config_id,
        line_count,
        addons_installed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_overlay_strip_and_apply() {
        let base = "GameInfo\n{\n\tgame\t\"citadel\"\n\ttitle\t\"Deadlock\"\n\n\tConVars\n\t{\n\t\t\"r_shadows\"\t\t\"1\"\n\t\t\"fps_max\"\t\t\"400\"\n\t}\n}\n";

        let req = OptimizationRequest {
            level: 2,
            preset_id: "optilock-fps".to_string(),
            preset_name: "OptiLock FPS".to_string(),
            entries: vec![
                ConfigEntry {
                    path: vec!["ConVars".to_string(), "r_shadows".to_string()],
                    value: Some("0".to_string()),
                },
                ConfigEntry {
                    path: vec!["ConVars".to_string(), "cl_retire_low_priority_lights".to_string()],
                    value: Some("1".to_string()),
                },
            ],
            video_settings: vec![],
            include_engine_sections: false,
            fov: Some(90),
            aspect_ratio: Some("2.15".to_string()),
            aspect_ratio_enabled: true,
            fps_limit: Some("144".to_string()),
            cloth_sim_stop: true,
            ragdoll_fade: true,
            better_breakables: true,
            higher_brightness: false,
            reduce_clutter: false,
            hero_potato: false,
            deadlock_path: "".to_string(),
        };

        let patched = apply_overlay(base, &req).unwrap();
        assert!(patched.contains("// ==== DLPHub · Performance BEGIN (config=optilock-fps level=2)"));
        assert!(patched.contains(r#""r_shadows""#));
        assert!(patched.contains(r#"// dlp-perf was "1""#));
        assert!(patched.contains(r#""cl_retire_low_priority_lights""#));
        assert!(patched.contains(r#""r_aspectratio""#));
        assert!(patched.contains(r#""cloth_sim_on_tick""#));

        let (stripped, info) = strip_overlay(&patched);
        assert_eq!(info.unwrap().config_id, "optilock-fps");
        assert!(stripped.contains(r#""r_shadows"		"1""#));
        assert!(stripped.contains(r#""fps_max"		"400""#));
        assert!(!stripped.contains("DLPHub · Performance"));
    }

    #[test]
    fn test_merge_video_preserves_resolution_and_identity() {
        let user_v = "\"video.cfg\"\n{\n\t\"VendorID\"\t\t\"4318\"\n\t\"DeviceID\"\t\t\"9536\"\n\t\"setting.defaultres\"\t\t\"2560\"\n\t\"setting.defaultresheight\"\t\t\"1440\"\n\t\"setting.refreshrate_numerator\"\t\t\"240\"\n\t\"setting.fullscreen\"\t\t\"1\"\n\t\"setting.r_citadel_shadow_quality\"\t\t\"2\"\n\t\"setting.r_citadel_ssao_quality\"\t\t\"3\"\n\t\"setting.fov\"\t\t\"80\"\n}\n";

        let v_settings = vec![
            VideoSetting {
                key: "r_citadel_shadow_quality".to_string(),
                value: "0".to_string(),
            },
            VideoSetting {
                key: "r_citadel_ssao_quality".to_string(),
                value: "0".to_string(),
            },
        ];

        let merged = merge_video_settings(user_v, &v_settings, Some(90), Some("144"));
        assert!(merged.contains(r#""VendorID"		"4318""#));
        assert!(merged.contains(r#""setting.defaultres"		"2560""#));
        assert!(merged.contains(r#""setting.defaultresheight"		"1440""#));
        assert!(merged.contains(r#""setting.refreshrate_numerator"		"240""#));
        assert!(merged.contains(r#""setting.fullscreen"		"1""#));
        assert!(merged.contains(r#""setting.r_citadel_shadow_quality"		"0""#));
        assert!(merged.contains(r#""setting.r_citadel_ssao_quality"		"0""#));
        assert!(merged.contains(r#""setting.fov"		"90""#));
    }
}
