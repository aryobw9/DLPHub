# -*- coding: utf-8 -*-
"""
Deadlock Map Logo Mod Compiler & Deployer
Composites the Deadlock Persian logo onto target in-game map signs and billboards:
1. Bodega / Grocery sign (York Docks & Greenwich Central Park: "Drink Red Cross Cola")
2. Broadway Signage Atlas (Times Square & Broadway Uptown: "Hex Jazz Records", "Cassandra Totem", "Dimensional Chess")
Compiles to native Source 2 .vtex_c via Valve Resource Compiler, and deploys both loose and VPK.
"""

import os
import shutil
import subprocess
from PIL import Image, ImageDraw

SCRATCH_DIR = r"C:\Users\Aryo\.gemini\antigravity\brain\91366e31-f57a-4146-9ff0-db5a727cc1ed\scratch"
PREV_SCRATCH = r"C:\Users\Aryo\.gemini\antigravity\brain\636457bd-d532-4469-9d10-100154b20bb4\scratch"
LOGO_PATH = os.path.join(PREV_SCRATCH, "user_logo.png")

RC_EXE = r"D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe"
GAME_DIR = r"D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\citadel"
CONTENT_DIR = r"D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\content\citadel"
CSDK_GAME_MATERIALS = r"D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\citadel\materials"

CUSTOM_MOD_DIR = r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom"
CUSTOM_VPK = os.path.join(CUSTOM_MOD_DIR, "pak82_dir.vpk")
VPKEDIT_CLI = r"d:\Claude\Modding\Deadlock\tools\vpkedit\vpkeditcli.exe"

def create_vtex_definition(rel_img_path, format_str="BC7"):
    return f"""<!-- dmx encoding keyvalues2_noids 1 format vtex 1 -->
"CDmeVtex"
{{
    "m_inputTextureArray" "element_array" 
    [
        "CDmeInputTexture"
        {{
            "m_name" "string" "InputTexture0"
            "m_fileName" "string" "{rel_img_path}"
            "m_colorSpace" "string" "srgb"
            "m_typeString" "string" "2D"
        }}
    ]
    "m_outputTypeString" "string" "2D"
    "m_outputFormat" "string" "{format_str}"
    "m_textureOutputChannelArray" "element_array"
    [
        "CDmeTextureOutputChannel"
        {{
            "m_inputTextureArray" "string_array" [ "InputTexture0" ]
            "m_srcChannels" "string" "rgba"
            "m_dstChannels" "string" "rgba"
            "m_mipAlgorithm" "CDmeImageProcessor"
            {{
                "m_algorithm" "string" "Box"
            }}
            "m_outputColorSpace" "string" "srgb"
        }}
    ]
}}
"""

def process_bodega_sign(src_png, out_png, logo_im):
    """Processes signs_bodega01a (2048x2048): pastes logo on the Red Cross Cola sign."""
    im = Image.open(src_png).convert("RGBA")
    
    # The sign region in signs_bodega01a_color:
    # x: 1530 to 1860 (width ~330)
    # y: 560 to 2040
    # Center dark box: x: 1545 to 1845, y: 880 to 1740
    # Clean dark background:
    bg_color = (48, 44, 42, 255)
    draw = ImageDraw.Draw(im)
    draw.rectangle([1545, 880, 1845, 1740], fill=bg_color)
    
    # Logo sizing & 90 deg CCW rotation (so it appears right-side-up in-game):
    # Width in sign is 280, height is 280
    logo_res = logo_im.resize((280, 280), Image.Resampling.LANCZOS)
    logo_rot = logo_res.rotate(90, expand=True)
    
    # Center inside the dark box:
    px = 1545 + (300 - logo_rot.width) // 2
    py = 880 + (860 - logo_rot.height) // 2
    im.paste(logo_rot, (px, py), logo_rot)
    
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    im.save(out_png)
    print(f"Saved modified Bodega texture to {out_png}")
    return out_png

def process_broadway_signs(src_png, out_png, logo_im):
    """Processes signs_broadway_01 (4096x4096): pastes logo on Hex Jazz, Cassandra, and Dim Chess."""
    im = Image.open(src_png).convert("RGBA")
    
    # 1. Hex Orange (Screenshot 3 main):
    # Banner x: 90 to 610, y: 60 to 2030 (center x = 350)
    logo_hex_o = logo_im.resize((440, 440), Image.Resampling.LANCZOS)
    im.paste(logo_hex_o, (350 - 220, 850), logo_hex_o)
    
    # 2. Hex Blue (Screenshot 3 corner):
    # Banner x: 1990 to 2510, y: 60 to 2030 (center x = 2250)
    logo_hex_b = logo_im.resize((440, 440), Image.Resampling.LANCZOS)
    im.paste(logo_hex_b, (2250 - 220, 850), logo_hex_b)
    
    # 3. Cassandra Totem (Screenshot 4 top):
    # Poster x: 2860 to 3450, y: 2110 to 3210 (center x = 3155, center y = 2660)
    logo_cas = logo_im.resize((460, 460), Image.Resampling.LANCZOS)
    im.paste(logo_cas, (3155 - 230, 2580), logo_cas)
    
    # 4. Dimensional Chess (Screenshot 4 bottom):
    # Yellow circle profile is around x = 1600, y = 2750
    logo_chess = logo_im.resize((460, 460), Image.Resampling.LANCZOS)
    im.paste(logo_chess, (1600 - 230, 2750 - 230), logo_chess)
    
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    im.save(out_png)
    print(f"Saved modified Broadway texture to {out_png}")
    return out_png

def compile_vtex(content_rel_path, format_str="BC7"):
    """Writes .vtex definition and compiles via resourcecompiler.exe."""
    base_no_ext = os.path.splitext(content_rel_path)[0]
    png_full = os.path.join(CONTENT_DIR, content_rel_path)
    vtex_full = os.path.join(CONTENT_DIR, base_no_ext + ".vtex")
    
    vtex_code = create_vtex_definition(content_rel_path.replace("\\", "/"), format_str)
    with open(vtex_full, "w", encoding="utf-8") as f:
        f.write(vtex_code)
    
    print(f"Compiling {content_rel_path} to .vtex_c...")
    cmd = [RC_EXE, "-game", GAME_DIR, "-f", "-i", vtex_full]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Compilation error for {content_rel_path}:\n{res.stdout}\n{res.stderr}")
        return None
    
    compiled_vtex_c = os.path.join(CSDK_GAME_MATERIALS, os.path.relpath(base_no_ext, "materials") + ".vtex_c")
    if os.path.exists(compiled_vtex_c):
        print(f"SUCCESS: Compiled {compiled_vtex_c} ({os.path.getsize(compiled_vtex_c)} bytes)")
        return compiled_vtex_c
    else:
        print(f"ERROR: Expected compiled file not found: {compiled_vtex_c}")
        return None

def main():
    print("=== DEADLOCK MAP LOGOS MOD BUILDER ===")
    logo = Image.open(LOGO_PATH).convert("RGBA")
    
    # Source images
    bodega_src = os.path.join(SCRATCH_DIR, r"test_bodega\materials\overlays\signs_bodega01a_color_png_93bba988.png")
    broadway_src = os.path.join(SCRATCH_DIR, "signs_broadway_01_psd_e9c4ad49.png")
    
    # Target content destinations
    bodega_content_rel_1 = r"materials\overlays\signs_bodega01a_color_png_93bba988.png"
    bodega_content_rel_2 = r"materials\overlays\signs_bodega01a_color_png_d5c7e675.png"
    broadway_content_rel = r"materials\signage\signs_broadway_01_psd_e9c4ad49.png"
    
    # 1. Modify Bodega
    bodega_out_1 = os.path.join(CONTENT_DIR, bodega_content_rel_1)
    process_bodega_sign(bodega_src, bodega_out_1, logo)
    
    bodega_out_2 = os.path.join(CONTENT_DIR, bodega_content_rel_2)
    shutil.copy2(bodega_out_1, bodega_out_2)
    
    # 2. Modify Broadway
    broadway_out = os.path.join(CONTENT_DIR, broadway_content_rel)
    process_broadway_signs(broadway_src, broadway_out, logo)
    
    # 3. Compile all to .vtex_c
    comp_bodega_1 = compile_vtex(bodega_content_rel_1)
    comp_bodega_2 = compile_vtex(bodega_content_rel_2)
    comp_broadway = compile_vtex(broadway_content_rel)
    
    if not (comp_bodega_1 and comp_broadway):
        print("Build failed during compilation!")
        return
    
    # 4. Deploy loose files to Deadlock custom directory
    print("\nDeploying loose files to custom/ directory...")
    deployments = [
        (comp_bodega_1, r"materials\overlays\signs_bodega01a_color_png_93bba988.vtex_c"),
        (comp_bodega_2, r"materials\overlays\signs_bodega01a_color_png_d5c7e675.vtex_c"),
        (comp_broadway, r"materials\signage\signs_broadway_01_psd_e9c4ad49.vtex_c"),
    ]
    
    for src_file, rel_dest in deployments:
        dest_file = os.path.join(CUSTOM_MOD_DIR, rel_dest)
        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
        shutil.copy2(src_file, dest_file)
        print(f"Deployed: {dest_file} ({os.path.getsize(dest_file)} bytes)")
        
        # Also copy into the VPK staging directory
        vpk_stage_file = os.path.join(PREV_SCRATCH, r"pak82_extracted\pak82_dir (1)", rel_dest)
        os.makedirs(os.path.dirname(vpk_stage_file), exist_ok=True)
        shutil.copy2(src_file, vpk_stage_file)
    
    # 5. Pack into pak82_dir.vpk
    print("\nRepacking custom pak82_dir.vpk...")
    vpk_stage_dir = os.path.join(PREV_SCRATCH, r"pak82_extracted\pak82_dir (1)")
    temp_vpk = os.path.join(SCRATCH_DIR, "repacked_pak82_dir.vpk")
    pack_cmd = [
        VPKEDIT_CLI,
        "-v", "2",
        "-s",
        "-o", temp_vpk,
        vpk_stage_dir
    ]
    res_pack = subprocess.run(pack_cmd, capture_output=True, text=True)
    if res_pack.returncode == 0:
        print(f"Successfully packed: {temp_vpk} ({os.path.getsize(temp_vpk)} bytes)")
        try:
            shutil.copy2(temp_vpk, CUSTOM_VPK)
            print(f"Successfully updated custom VPK: {CUSTOM_VPK}")
        except PermissionError:
            print(f"Notice: {CUSTOM_VPK} is currently locked by running game. Loose files will be loaded automatically by Citadel!")
    else:
        print("Error repacking VPK:", res_pack.stderr.strip())

    print("\n=== MOD BUILD AND DEPLOYMENT COMPLETE! ===")

if __name__ == "__main__":
    main()
