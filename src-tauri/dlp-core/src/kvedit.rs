// Port of merge_video.ps1 + set_fov.ps1.
// merge_video: user's identity values (first occurrence wins) override template
// lines; all other lines byte-identical to template.
// set_fov: replace "r_aspectratio" "<num>" line, 6 tabs indent, no BOM.
pub const IDENTITY_KEYS: [&str; 13] = [
    "Version",
    "VendorID",
    "DeviceID",
    "setting.defaultres",
    "setting.defaultresheight",
    "setting.recommendedheight",
    "setting.refreshrate_numerator",
    "setting.refreshrate_denominator",
    "setting.monitor_index",
    "setting.fullscreen",
    "setting.nowindowborder",
    "setting.aspectratiomode",
    "setting.coop_fullscreen",
];

/// Strip UTF-8 BOM (detect.ps1 parity).
pub fn strip_bom(text: &str) -> &str {
    text.strip_prefix('\u{FEFF}').unwrap_or(text)
}

/// Parse one `"key" "value"` pair (PS1 regex: ^\s*"([^"]+)"\s+"([^"]*)").
/// Returns (key, value).
pub fn parse_kv(line: &str) -> Option<(&str, &str)> {
    let t = line.trim_start();
    if !t.starts_with('"') {
        return None;
    }
    let rest = &t[1..];
    let close = rest.find('"')?;
    let k = &rest[..close];
    let after_key = rest[close + 1..].trim_start();
    let v = after_key.strip_prefix('"')?;
    let vclose = v.find('"')?;
    Some((k, &v[..vclose]))
}

/// Parse a template line into (key, value-opening-quote index, trailing-start
/// index). Mirrors PS1 regex ^(\s*"([^"]+)"\s+)"([^"]*)"(.*)$ — handles both
/// flat key-value files and braced VDF (indented keys under "video.cfg" {).
fn parse_line(ln: &str) -> Option<(&str, usize, usize)> {
    let idx = ln.find('"')?;
    let rest = &ln[idx + 1..];
    let close = rest.find('"')?;
    let k = &rest[..close];
    let after_key = &rest[close + 1..];
    let gap = after_key.len() - after_key.trim_start().len();
    if after_key[gap..].starts_with('"') {
        let prefix_end = idx + 1 + close + 1 + gap; // index of value's opening quote
        let v = &after_key[gap + 1..];
        let vclose = v.find('"')?;
        let trailing_start = idx + 1 + close + 1 + gap + 1 + vclose + 1;
        return Some((k, prefix_end, trailing_start));
    }
    None
}

/// merge_video.ps1: identity keys take user values, everything else template.
pub fn merge_video(user: &str, template: &str) -> String {
    let mut uvals: Vec<(&str, &str)> = Vec::new();
    for ln in strip_bom(user).lines() {
        if let Some((k, v)) = parse_kv(ln) {
            if !uvals.iter().any(|(ek, _)| *ek == k) {
                uvals.push((k, v));
            }
        }
    }
    let mut out = String::with_capacity(template.len() + 64);
    for ln in template.lines() {
        let mut replaced = false;
        if let Some((k, prefix_end, trailing_start)) = parse_line(ln) {
            if IDENTITY_KEYS.contains(&k) {
                if let Some((_, uv)) = uvals.iter().find(|(uk, _)| *uk == k) {
                    out.push_str(&ln[..prefix_end]);
                    out.push('"');
                    out.push_str(uv);
                    out.push('"');
                    out.push_str(&ln[trailing_start..]);
                    out.push('\n');
                    replaced = true;
                }
            }
        }
        if !replaced {
            out.push_str(ln);
            out.push('\n');
        }
    }
    out
}

/// set_aspect_ratio: replace or disable the r_aspectratio value; 6 tabs indent, no BOM.
/// If ar is Some(val), sets "r_aspectratio" to val (uncommenting if previously commented).
/// If ar is None, disables (comments out) "r_aspectratio".
pub fn set_aspect_ratio(gi_content: &str, ar: Option<&str>) -> String {
    let mut out = String::with_capacity(gi_content.len());
    let mut replaced = false;
    for line in strip_bom(gi_content).split_inclusive('\n') {
        let t = line.trim_start();
        let is_target = !replaced && (
            t.starts_with("\"r_aspectratio\"")
            || t.starts_with("r_aspectratio ")
            || t.starts_with("r_aspectratio\t")
            || t.starts_with("r_aspectratio\"")
            || t.starts_with("// \"r_aspectratio\"")
            || t.starts_with("//\"r_aspectratio\"")
            || t.starts_with("// r_aspectratio \"")
            || t.starts_with("//r_aspectratio \"")
            || t.starts_with("// r_aspectratio\"")
            || t.starts_with("//r_aspectratio\"")
            || t.starts_with("// r_aspectratio\t\"")
            || t.starts_with("//r_aspectratio\t\"")
        );
        if is_target {
            let indent = &line[..line.len() - t.len()];
            match ar {
                Some(val) => {
                    out.push_str(indent);
                    out.push_str("\"r_aspectratio\"\t\t\t\t\t\t\"");
                    out.push_str(val);
                    out.push('"');
                    if line.ends_with('\n') {
                        out.push('\n');
                    }
                }
                None => {
                    out.push_str(indent);
                    out.push_str("// \"r_aspectratio\"\t\t\t\t\t\t\"disabled\"");
                    if line.ends_with('\n') {
                        out.push('\n');
                    }
                }
            }
            replaced = true;
        } else {
            out.push_str(line);
        }
    }
    out
}

/// set_fov.ps1: replace the r_aspectratio value; 6 tabs indent, no BOM.
pub fn set_fov(gi_content: &str, ar: &str) -> String {
    set_aspect_ratio(gi_content, Some(ar))
}

/// patch_gameinfo_options:
/// Updates gameinfo.gi directly for user settings:
/// 1) "r_aspectratio" -> ar (or comments it out if None)
/// 2) "cloth_sim_on_tick" -> "0" if stop_cloth_anim else "1"
/// 3) "cl_ragdoll_limit" -> "0" if ragdoll_fade else "-1"
pub fn patch_gameinfo_options(
    gi_content: &str,
    ar: Option<&str>,
    stop_cloth_anim: bool,
    ragdoll_fade: bool,
) -> String {
    let with_ar = set_aspect_ratio(gi_content, ar);
    let mut out = String::with_capacity(with_ar.len());

    let cloth_val = if stop_cloth_anim { "0" } else { "1" };
    let ragdoll_val = if ragdoll_fade { "0" } else { "-1" };

    for line in strip_bom(&with_ar).split_inclusive('\n') {
        let t = line.trim_start();
        if t.starts_with("\"cloth_sim_on_tick\"") || t.starts_with("cloth_sim_on_tick") {
            let indent = &line[..line.len() - t.len()];
            out.push_str(indent);
            out.push_str(&format!("\"cloth_sim_on_tick\"\t\t\t\t\t\t\"{}\"", cloth_val));
            if line.ends_with('\n') {
                out.push('\n');
            }
        } else if t.starts_with("\"cl_ragdoll_limit\"") || t.starts_with("cl_ragdoll_limit") {
            let indent = &line[..line.len() - t.len()];
            out.push_str(indent);
            out.push_str(&format!("\"cl_ragdoll_limit\"\t\t\t\t\t\t\"{}\"", ragdoll_val));
            if line.ends_with('\n') {
                out.push('\n');
            }
        } else {
            out.push_str(line);
        }
    }
    out
}

/// Managed autoexec block. File = user's own content untouched, plus one marked
/// block we own. enabled=false removes the block; user content always preserved.
pub fn upsert_autoexec(existing: &str, enabled: bool) -> String {
    if !enabled {
        let text = strip_bom(existing);
        let mut user_lines: Vec<&str> = Vec::new();
        let mut in_block = false;
        for line in text.lines() {
            if line.trim() == "// DLP BEGIN" {
                in_block = true;
                continue;
            }
            if line.trim() == "// DLP END" {
                in_block = false;
                continue;
            }
            if !in_block {
                user_lines.push(line);
            }
        }
        let mut s = user_lines.join("\n");
        if !s.is_empty() && (text.ends_with('\n') || s.contains('\n')) {
            s.push('\n');
        }
        return s;
    }
    upsert_autoexec_full(existing, "", "")
}

/// Managed autoexec block with optional custom cvars.
pub fn upsert_autoexec_custom(existing: &str, _enabled: bool, custom_commands: &str) -> String {
    let active = !custom_commands.trim().is_empty();
    if !active {
        return upsert_autoexec(existing, false);
    }
    upsert_autoexec_full(existing, "", custom_commands)
}

/// Managed autoexec block with tier commands (e.g. from t1 autoexec.cfg) and custom commands.
pub fn upsert_autoexec_full(
    existing: &str,
    tier_commands: &str,
    custom_commands: &str,
) -> String {
    const BEGIN: &str = "// DLP BEGIN";
    const END: &str = "// DLP END";
    let text = strip_bom(existing);
    let mut user_lines: Vec<&str> = Vec::new();
    let mut in_block = false;
    for line in text.lines() {
        if line.trim() == BEGIN {
            in_block = true;
            continue;
        }
        if line.trim() == END {
            in_block = false;
            continue;
        }
        if !in_block {
            user_lines.push(line);
        }
    }
    let has_tier = tier_commands.lines().any(|l| !l.trim().is_empty());
    let has_custom = custom_commands.lines().any(|l| !l.trim().is_empty());
    if !has_tier && !has_custom {
        let mut s = user_lines.join("\n");
        if !s.is_empty() && (text.ends_with('\n') || s.contains('\n')) {
            s.push('\n');
        }
        return s;
    }
    let mut s = String::new();
    for line in &user_lines {
        s.push_str(line);
        s.push('\n');
    }
    s.push_str(BEGIN);
    s.push('\n');
    s.push_str("\tcon_enable \"1\"\n");
    s.push_str("\tcon_logfile \"console.log\"\n");
    for line in tier_commands.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            s.push('\t');
            s.push_str(trimmed);
            s.push('\n');
        }
    }
    for line in custom_commands.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            s.push('\t');
            s.push_str(trimmed);
            s.push('\n');
        }
    }
    s.push_str(END);
    s.push('\n');
    s
}

/// Patch key-values in a video.txt formatted string.
/// Matches `"setting.<key>"` or `"<key>"`, replacing value while preserving structure.
/// If a patch key does not exist in the file, it is inserted before the closing '}' of "video.cfg".
pub fn patch_video_kv(content: &str, patches: &[(&str, &str)]) -> String {
    let mut out = String::with_capacity(content.len() + 64);
    let mut matched_patches = std::collections::HashSet::new();
    for ln in content.lines() {
        let mut replaced = false;
        if let Some((k, prefix_end, trailing_start)) = parse_line(ln) {
            for (pk, pv) in patches {
                if *pk == k {
                    out.push_str(&ln[..prefix_end]);
                    out.push('"');
                    out.push_str(pv);
                    out.push('"');
                    out.push_str(&ln[trailing_start..]);
                    out.push('\n');
                    replaced = true;
                    matched_patches.insert(*pk);
                    break;
                }
            }
        }
        if !replaced {
            out.push_str(ln);
            out.push('\n');
        }
    }

    let missing: Vec<_> = patches.iter().filter(|(pk, _)| !matched_patches.contains(pk)).collect();
    if !missing.is_empty() {
        if let Some(last_brace_idx) = out.rfind('}') {
            let mut final_out = String::with_capacity(out.len() + missing.len() * 40);
            final_out.push_str(&out[..last_brace_idx]);
            for (k, v) in missing {
                final_out.push_str(&format!("\t\"{}\"\t\t\"{}\"\n", k, v));
            }
            final_out.push_str(&out[last_brace_idx..]);
            return final_out;
        } else {
            for (k, v) in missing {
                out.push_str(&format!("\t\"{}\"\t\t\"{}\"\n", k, v));
            }
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const TPL: &str = "\"Version\" \"13\"\n\"VendorID\" \"0\"\n\"DeviceID\" \"0\"\n\"setting.defaultres\" \"1920\"\n\"setting.defaultresheight\" \"1080\"\n\"setting.refreshrate_numerator\" \"240\"\n\"setting.mat_queue_mode\" \"2\"\n";

    #[test]
    fn merge_overrides_identity_keeps_rest() {
        let user = "\"Version\" \"11\"\n\"junk\" \"x\"\n\"setting.defaultres\" \"2560\"\n\"setting.defaultresheight\" \"1440\"\n\"setting.refreshrate_numerator\" \"165\"\n";
        let merged = merge_video(user, TPL);
        assert!(merged.contains("\"Version\" \"11\""));
        assert!(merged.contains("\"setting.defaultres\" \"2560\""));
        assert!(merged.contains("\"setting.defaultresheight\" \"1440\""));
        assert!(merged.contains("\"setting.refreshrate_numerator\" \"165\""));
        assert!(merged.contains("\"setting.mat_queue_mode\" \"2\"\n"));
        assert!(merged.contains("\"VendorID\" \"0\"\n")); // template default kept
        assert!(!merged.contains("junk")); // template is source of shape
    }

    #[test]
    fn merge_missing_user_values_keep_template() {
        assert_eq!(merge_video("", TPL), TPL);
    }

    #[test]
    fn merge_first_occurrence_wins() {
        let user = "\"Version\" \"1\"\n\"Version\" \"2\"\n";
        assert!(merge_video(user, TPL).contains("\"Version\" \"1\""));
    }

    #[test]
    fn merge_preserves_trailing_comment() {
        let tpl = "\"setting.defaultres\" \"1920\" // width\n";
        let out = merge_video("\"setting.defaultres\" \"2560\"", tpl);
        assert_eq!(out, "\"setting.defaultres\" \"2560\" // width\n");
    }

    #[test]
    fn set_fov_swaps_value_six_tabs() {
        let gi = "\t\t\"r_aspectratio\"\t\t\t\t\t\t\"2.15\"\nother\n";
        let out = set_fov(gi, "3.09");
        assert!(out.contains("\t\t\"r_aspectratio\"\t\t\t\t\t\t\"3.09\"\n"));
        assert!(out.contains("other\n"));
        assert!(!out.contains("2.15"));
    }

    #[test]
    fn set_fov_bom_stripped() {
        let gi = "\u{FEFF}\"r_aspectratio\" \"2.15\"\n";
        let out = set_fov(gi, "1.60");
        assert!(!out.starts_with('\u{FEFF}'));
        assert!(out.contains("\"1.60\""));
    }

    #[test]
    fn set_fov_no_match_untouched() {
        let gi = "nothing here\n";
        assert_eq!(set_fov(gi, "2.15"), gi);
    }

    #[test]
    fn autoexec_upsert_empty() {
        let out = upsert_autoexec("", true);
        assert!(!out.contains("// DLP BEGIN"));
    }

    #[test]
    fn autoexec_replace_no_duplicate() {
        let existing = "fps_max 0\n// DLP BEGIN\n\tcon_enable \"1\"\n// DLP END\n";
        let out = upsert_autoexec_custom(existing, true, "fps_max 144");
        assert_eq!(out.matches("// DLP BEGIN").count(), 1);
        assert!(out.starts_with("fps_max 0\n"));
    }

    #[test]
    fn autoexec_disable_removes_block_only() {
        let existing = "my_cvar 1\n// DLP BEGIN\n\tcon_enable \"1\"\n// DLP END\nafter_cvar 2\n";
        let out = upsert_autoexec(existing, false);
        assert!(!out.contains("DLP"));
        assert!(out.contains("my_cvar 1\n"));
        assert!(out.contains("after_cvar 2"));
    }

    #[test]
    fn autoexec_user_content_untouched() {
        let existing = "// my own tweaks\nr_thing \"3\"\n";
        let out = upsert_autoexec_custom(existing, true, "fps_max 144");
        assert!(out.starts_with("// my own tweaks\nr_thing \"3\"\n"));
        assert!(out.contains("// DLP BEGIN"));
        assert_eq!(upsert_autoexec(existing, false), existing);
    }

    #[test]
    fn autoexec_custom_commands_appended() {
        let existing = "// base\n";
        let out = upsert_autoexec_custom(existing, true, "fps_max 165\nsensitivity 1.2");
        assert!(out.contains("\tfps_max 165\n"));
        assert!(out.contains("\tsensitivity 1.2\n"));
    }

    #[test]
    fn autoexec_tier_commands_and_custom() {
        let existing = "// base\n";
        let out = upsert_autoexec_full(existing, "r_drawviewmodel 0\nmat_viewportscale 0.8", "fps_max 165");
        assert!(out.contains("\tr_drawviewmodel 0\n"));
        assert!(out.contains("\tmat_viewportscale 0.8\n"));
        assert!(out.contains("\tfps_max 165\n"));
    }

    #[test]
    fn gameinfo_patch_options_test() {
        let gi = "\t\t\"cloth_sim_on_tick\"\t\t\"1\"\n\t\t\"cl_ragdoll_limit\"\t\t\"-1\"\n\t\t\"r_aspectratio\"\t\t\"2.15\"\n";
        let patched = patch_gameinfo_options(gi, Some("2.40"), true, true);
        assert!(patched.contains("\"cloth_sim_on_tick\"\t\t\t\t\t\t\"0\""));
        assert!(patched.contains("\"cl_ragdoll_limit\"\t\t\t\t\t\t\"0\""));
        assert!(patched.contains("\"r_aspectratio\"\t\t\t\t\t\t\"2.40\""));

        let patched_off = patch_gameinfo_options(gi, None, false, false);
        assert!(patched_off.contains("\"cloth_sim_on_tick\"\t\t\t\t\t\t\"1\""));
        assert!(patched_off.contains("\"cl_ragdoll_limit\"\t\t\t\t\t\t\"-1\""));
        assert!(patched_off.contains("// \"r_aspectratio\"\t\t\t\t\t\t\"disabled\""));
    }

    #[test]
    fn patch_video_kv_replaces_keys() {
        let video = "\"setting.r_low_latency\" \"0\"\n\"setting.fps_max\" \"0\"\n\"setting.mat_vsync\" \"0\"\n";
        let patched = patch_video_kv(video, &[("setting.r_low_latency", "1"), ("setting.fps_max", "144")]);
        assert!(patched.contains("\"setting.r_low_latency\" \"1\""));
        assert!(patched.contains("\"setting.fps_max\" \"144\""));
        assert!(patched.contains("\"setting.mat_vsync\" \"0\""));
    }

    #[test]
    fn patch_video_kv_inserts_missing_keys_before_brace() {
        let video = "\"video.cfg\"\n{\n\t\"setting.fps_max\" \"0\"\n}\n";
        let patched = patch_video_kv(video, &[("setting.fov", "90")]);
        assert!(patched.contains("\"setting.fov\"\t\t\"90\""));
        assert!(patched.ends_with("}\n"));
    }

    #[test]
    fn set_aspect_ratio_real_number_and_disable() {
        let gi = "\t\t\"r_aspectratio\"\t\t\t\t\t\t\"2.15\"\n";
        let custom = set_aspect_ratio(gi, Some("2.40"));
        assert!(custom.contains("\"r_aspectratio\"\t\t\t\t\t\t\"2.40\""));

        let disabled = set_aspect_ratio(gi, None);
        assert!(disabled.contains("// \"r_aspectratio\"\t\t\t\t\t\t\"disabled\""));

        let reenabled = set_aspect_ratio(&disabled, Some("1.78"));
        assert!(reenabled.contains("\"r_aspectratio\"\t\t\t\t\t\t\"1.78\""));
        assert!(!reenabled.contains("// \"r_aspectratio\""));
    }
}
