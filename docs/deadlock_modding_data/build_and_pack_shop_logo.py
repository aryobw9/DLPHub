# -*- coding: utf-8 -*-
"""
Deadlock Shop Logo Packer
Converts edited PNG background textures back into native Source 2 .vtex_c files
and repacks them into the custom mod VPK.
"""

import os
import shutil
import subprocess
from PIL import Image

WORKSPACE_DIR = r"d:\Claude\Modding\Deadlock"
EDITING_DIR = os.path.join(WORKSPACE_DIR, "shop_assets_for_editing")
SCRATCH_DIR = r"C:\Users\Aryo\.gemini\antigravity\brain\636457bd-d532-4469-9d10-100154b20bb4\scratch"
MOD_ROOT = os.path.join(SCRATCH_DIR, r"pak82_extracted\pak82_dir (1)")
DOWNLOADS_VPK = r"C:\Users\Aryo\Downloads\pak82_dir (1).vpk"
CUSTOM_VPK = r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\pak82_dir.vpk"
VPKEDIT_CLI = os.path.join(WORKSPACE_DIR, r"tools\vpkedit\vpkeditcli.exe")
TEMPLATE_TEX_DIR = os.path.join(SCRATCH_DIR, "all_shop_bgs")

# Catalog texture files mapping: (filename, relative_vtex_path)
CATALOG_TEXTURES = [
    ("catalog_shop_bg_weapon_psd.png", r"panorama\images\shop\catalog\catalog_shop_bg_weapon_psd.vtex_c"),
    ("catalog_shop_bg_vitality_psd.png", r"panorama\images\shop\catalog\catalog_shop_bg_vitality_psd.vtex_c"),
    ("catalog_shop_bg_spirit_psd.png", r"panorama\images\shop\catalog\catalog_shop_bg_spirit_psd.vtex_c"),
    ("catalog_shop_filter_bg_psd.png", r"panorama\images\shop\catalog\catalog_shop_filter_bg_psd.vtex_c"),
    ("catalog_shop_popular_bg_psd.png", r"panorama\images\shop\catalog\catalog_shop_popular_bg_psd.vtex_c"),
    ("catalog_shop_generic_bg2_psd.png", r"panorama\images\shop\catalog\catalog_shop_generic_bg2_psd.vtex_c"),
]

def encode_vtex_c(template_vtex_path, png_image_path, output_vtex_path):
    """Encodes a modified PNG image back into a valid Source 2 .vtex_c binary."""
    with open(template_vtex_path, "rb") as f:
        template_bytes = f.read()

    im = Image.open(png_image_path).convert("RGBA")
    w, h = im.size
    raw_len = w * h * 4
    header = template_bytes[:len(template_bytes) - raw_len]

    # Convert RGBA to BGRA
    r, g, b, a = im.split()
    bgra = Image.merge("RGBA", (b, g, r, a))
    new_vtex_bytes = header + bgra.tobytes()

    os.makedirs(os.path.dirname(output_vtex_path), exist_ok=True)
    with open(output_vtex_path, "wb") as f:
        f.write(new_vtex_bytes)
    return len(new_vtex_bytes)

TEXTURE_CONFIGS = {
    "catalog_shop_bg_weapon_psd.png": {"size": (190, 190), "margin": (50, 60)},
    "catalog_shop_bg_vitality_psd.png": {"size": (190, 190), "margin": (50, 60)},
    "catalog_shop_bg_spirit_psd.png": {"size": (190, 190), "margin": (50, 60)},
    "catalog_shop_popular_bg_psd.png": {"size": (180, 180), "margin": (50, 210)},
    "catalog_shop_generic_bg2_psd.png": {"size": (180, 180), "margin": (50, 210)},
    "catalog_shop_filter_bg_psd.png": {"size": (180, 180), "margin": (50, 210)},
}

def apply_auto_logo_if_needed(png_path, logo_path, out_png_path, size=(190, 190), margin=(50, 60)):
    """Stamps the logo on the bottom-right corner of the texture."""
    bg = Image.open(png_path).convert("RGBA")
    logo = Image.open(logo_path).convert("RGBA")
    logo_resized = logo.resize(size, Image.Resampling.LANCZOS)

    pos_x = bg.width - logo_resized.width - margin[0]
    pos_y = bg.height - logo_resized.height - margin[1]

    bg.paste(logo_resized, (pos_x, pos_y), logo_resized)
    bg.save(out_png_path)
    return out_png_path

def main(auto_stamp=False):
    print("=== Deadlock Shop Logo Compiler & Packer ===")
    logo_file = os.path.join(EDITING_DIR, "my_logo.png")

    for png_name, rel_vtex in CATALOG_TEXTURES:
        src_png = os.path.join(EDITING_DIR, png_name)
        template_vtex = os.path.join(TEMPLATE_TEX_DIR, rel_vtex)
        dest_vtex = os.path.join(MOD_ROOT, rel_vtex)

        if not os.path.exists(src_png):
            print(f"Skipping {png_name} (not found in editing folder)")
            continue

        active_png = src_png
        if auto_stamp and os.path.exists(logo_file):
            cfg = TEXTURE_CONFIGS.get(png_name, {"size": (190, 190), "margin": (50, 60)})
            temp_stamped = os.path.join(SCRATCH_DIR, "temp_" + png_name)
            active_png = apply_auto_logo_if_needed(src_png, logo_file, temp_stamped, size=cfg["size"], margin=cfg["margin"])

        byte_count = encode_vtex_c(template_vtex, active_png, dest_vtex)
        print(f"Compiled: {png_name} -> {rel_vtex} ({byte_count} bytes)")

        # Also copy loose file to Deadlock custom directory
        custom_loose_vtex = os.path.join(r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom", rel_vtex)
        try:
            os.makedirs(os.path.dirname(custom_loose_vtex), exist_ok=True)
            shutil.copy2(dest_vtex, custom_loose_vtex)
        except Exception as e:
            print(f"Notice loose copy: {e}")

    # Repack VPK
    print("\nRepacking VPK...")
    pack_cmd = [
        VPKEDIT_CLI,
        "-v", "2",
        "-s",
        "-o", DOWNLOADS_VPK,
        MOD_ROOT
    ]
    res = subprocess.run(pack_cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Successfully repacked: {DOWNLOADS_VPK}")
    else:
        print("Error repacking VPK:", res.stderr.strip())

    try:
        shutil.copy2(DOWNLOADS_VPK, CUSTOM_VPK)
        print(f"Updated custom VPK: {CUSTOM_VPK}")
    except PermissionError:
        print(f"Notice: {CUSTOM_VPK} is locked by running game. Loose textures deployed to custom/ are loaded directly!")
    except Exception as e:
        print(f"Notice custom VPK copy: {e}")

    print("\nDone! All shop textures updated.")

if __name__ == "__main__":
    import sys
    auto = "--auto" in sys.argv
    main(auto_stamp=auto)
