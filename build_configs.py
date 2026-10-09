import os
import shutil
import re

DEADLOCK_CONFIGS = r"D:\Claude\DeadlockConfigs"
NEW_MODS = r"D:\Claude\new mods"
GAMEINFO_4 = r"C:\Users\Aryo\Downloads\gameinfo (4).gi"
NEW_VIDEO = os.path.join(NEW_MODS, "video.txt")

def generate_video_txt(tier):
    # Read base new video.txt
    with open(NEW_VIDEO, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    out = []
    for line in lines:
        stripped = line.strip()
        # Parse key
        m = re.match(r'\"([^\"]+)\"\s+\"([^\"]*)\"', stripped)
        if m:
            k, v = m.group(1), m.group(2)
            # Universal rules
            if k == "setting.r_shadows":
                v = "1"
            elif k == "setting.csm_max_num_cascades_override":
                v = "0"
            elif k == "setting.csm_max_shadow_dist_override":
                v = "0"
            elif k == "setting.r_fullscreen_gamma":
                v = "2.2"
            elif k == "setting.r_light_sensitivity_mode":
                v = "true"
            elif k in ("setting.volume_fog_width", "setting.volume_fog_height", "setting.volume_fog_depth"):
                if tier == "t1":
                    v = "2"
                else:
                    v = "0"
            elif k == "setting.r_dashboard_render_quality":
                if tier in ("t1", "t2"):
                    v = "1"
                else:
                    v = "0"
            elif k == "setting.shaderquality":
                if tier in ("t1", "t2"):
                    v = "1"
                else:
                    v = "0"
            elif k == "setting.r_texture_stream_mip_bias":
                if tier == "t1":
                    v = "3"
                elif tier in ("t2", "t3"):
                    v = "4"
                else: # potato, russian_potato
                    v = "5"
            elif k == "setting.r_citadel_shadow_quality":
                if tier == "t1":
                    v = "1"
                else:
                    v = "0"
            out.append(f'\t"{k}"\t\t"{v}"\n')
        else:
            out.append(line)
    return "".join(out)

def modify_gameinfo(tier):
    with open(GAMEINFO_4, "r", encoding="utf-8") as f:
        content = f.read()

    # Tier-specific variable dicts
    props_break = "1" if tier == "t1" else "0"
    part_detail = "1" if tier == "t1" else "0"
    
    if tier == "t1":
        shadows = "1"
        lb_shadows = "true"
        part_shadows = "1"
        df_farfield = "1"
        dyn_lights = "true"
        size_cull = "0.9"
        tex_bias = "3"
        lod_scale = "0.55"
        farz = "7000"
    elif tier == "t2":
        shadows = "0"
        lb_shadows = "false"
        part_shadows = "0"
        df_farfield = "0"
        dyn_lights = "false"
        size_cull = "1.0"
        tex_bias = "4"
        lod_scale = "0.35"
        farz = "6000"
    elif tier == "t3":
        shadows = "0"
        lb_shadows = "false"
        part_shadows = "0"
        df_farfield = "0"
        dyn_lights = "false"
        size_cull = "1.2"
        tex_bias = "4"
        lod_scale = "0.25"
        farz = "5000"
    else: # potato
        shadows = "0"
        lb_shadows = "false"
        part_shadows = "0"
        df_farfield = "0"
        dyn_lights = "false"
        size_cull = "1.6"
        tex_bias = "5"
        lod_scale = "0.20"
        farz = "4000"

    # Replacements in ConVars
    overrides = {
        "citadel_camera_use_vmdl_flatten_vertical": "true",
        "props_break_max_pieces_perframe": props_break,
        "r_enable_volume_fog": "false",
        "r_enable_cubemap_fog": "false",
        "r_enable_gradient_fog": "false",
        "r_shadows": shadows,
        "lb_enable_shadow_casting": lb_shadows,
        "r_particle_shadows": part_shadows,
        "r_particle_cables_cast_shadows": "0",
        "r_citadel_distancefield_farfield_enable": df_farfield,
        "lb_enable_dynamic_lights": dyn_lights,
        "r_RainParticleDensity": "0",
        "r_particle_max_detail_level": part_detail,
        "r_particle_depth_feathering": "false",
        "r_citadel_half_res_noisy_effects": "true",
        "panorama_render_target_cache_max_size": "134217728",
        "r_postprocess_enable": "true",
        "citadel_player_glow_disabled": "0",
        "enable_boneflex": "0",
        "ik_final_fixup_enable": "0",
        "cl_particle_fallback_multiplier": "10",
        "cl_particle_fallback_base": "5",
        "r_size_cull_threshold": size_cull,
        "r_texture_stream_mip_bias": tex_bias,
        "sc_screen_size_lod_scale_override": lod_scale,
        "r_farz": farz,
        "r_mapextents": farz,
        "citadel_unit_status_stamina_low_pips": "7",
        "r_aspectratio": "2.15",
        "cloth_sim_on_tick": "0",
        "cl_ragdoll_limit": "0",
        "cl_disable_ragdolls": "0",
    }

    # Split into lines
    lines = content.splitlines(keepends=True)
    out_lines = []
    seen_keys = set()
    in_convars = False
    convars_depth = 0

    for line in lines:
        stripped = line.strip()
        code_part = stripped.split('//')[0].strip()

        if not in_convars and (code_part == 'ConVars' or code_part == '"ConVars"'):
            in_convars = True
            convars_depth = 0
            out_lines.append(line)
            continue

        if in_convars:
            delta = code_part.count('{') - code_part.count('}')
            if convars_depth == 1 and '}' in code_part:
                # Insert any keys that weren't present before closing brace
                for k, v in overrides.items():
                    if k not in seen_keys:
                        out_lines.append(f'\t\t"{k}"\t\t\t\t\t\t"{v}"\n')
                in_convars = False
                convars_depth = 0
                out_lines.append(line)
                continue

            convars_depth += delta

            # Remove r_drawdecals
            if re.match(r'^\s*\"?r_drawdecals\"?\s+', stripped):
                continue

            # Check if this line defines an override key
            m = re.match(r'^\s*\"?([a-zA-Z0-9_\.]+)\"?\s+\"?([^\"]*)\"?(.*)$', line)
            if m:
                k = m.group(1)
                trailing = m.group(3)
                if k in overrides:
                    seen_keys.add(k)
                    new_val = overrides[k]
                    prefix = line[:line.find(k)]
                    out_lines.append(f'{prefix}"{k}"\t\t\t\t\t\t"{new_val}"\n')
                    continue

        out_lines.append(line)

    return "".join(out_lines)

print("Building configs...")
for tier in ["t1", "t2", "t3", "potato"]:
    tdir = os.path.join(DEADLOCK_CONFIGS, tier)
    os.makedirs(tdir, exist_ok=True)
    
    # video.txt
    vtxt = generate_video_txt(tier)
    with open(os.path.join(tdir, "video.txt"), "w", encoding="utf-8") as f:
        f.write(vtxt)
        
    # gameinfo.gi
    gitxt = modify_gameinfo(tier)
    with open(os.path.join(tdir, "gameinfo.gi"), "w", encoding="utf-8") as f:
        f.write(gitxt)
    print(f"Generated {tier}/video.txt and {tier}/gameinfo.gi")

# Russian Potato setup
rp_dir = os.path.join(DEADLOCK_CONFIGS, "russian_potato")
os.makedirs(rp_dir, exist_ok=True)

# Copy authentic russian potato autoexec and gameinfo
rp_src = os.path.join(NEW_MODS, "russian potato")
shutil.copy(os.path.join(rp_src, "autoexec.cfg"), os.path.join(rp_dir, "autoexec.cfg"))

# For russian potato gameinfo: ensure it has stamina convar, no r_drawdecals, and proper animation hooks
with open(os.path.join(rp_src, "gameinfo.gi"), "r", encoding="utf-8") as f:
    rp_gi = f.read()

# Remove r_drawdecals
rp_gi = re.sub(r'^\s*\"?r_drawdecals\"?\s+.*$\n', '', rp_gi, flags=re.MULTILINE)

# Add citadel_unit_status_stamina_low_pips if missing
if "citadel_unit_status_stamina_low_pips" not in rp_gi:
    rp_gi = re.sub(r'(ConVars\s*\{)', r'\1\n\t\t"citadel_unit_status_stamina_low_pips" "7"', rp_gi)

# Apply panorama and particle fixes
rp_gi = re.sub(r'("?panorama_max_fps"?\s+)"?\d+"?', r'\g<1>"120"', rp_gi)
rp_gi = re.sub(r'("?r_particle_skip_postsim"?\s+)"?\d+"?', r'\g<1>"0"', rp_gi)
rp_gi = re.sub(r'("?particle_cluster_nodraw"?\s+)"?\d+"?', r'\g<1>"0"', rp_gi)
rp_gi = re.sub(r'("?r_particle_max_size_cull"?\s+)"?\d+"?', r'\g<1>"0"', rp_gi)
rp_gi = re.sub(r'("?r_directlighting"?\s+)"?\d+"?', r'\g<1>"1"', rp_gi)

with open(os.path.join(rp_dir, "gameinfo.gi"), "w", encoding="utf-8") as f:
    f.write(rp_gi)

# Russian potato video.txt based on new mods rules
rp_vtxt = generate_video_txt("potato")
with open(os.path.join(rp_dir, "video.txt"), "w", encoding="utf-8") as f:
    f.write(rp_vtxt)

print("Generated russian_potato configs.")
