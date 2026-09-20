#!/usr/bin/env python3
"""
Slice the animated flame cursor master sheet into individual transparent PNGs.

Master sheet: C:/Users/Aryo/.gemini/antigravity/brain/a9687934-a97b-4a75-8b38-a32f3f67743c/.user_uploaded/media_1789820481442.jpg
Output:       ui/assets/cursors/<name>_<frame>.png  (64x64, transparent RGBA)
              ui/assets/cursors/<name>.png          (frame 0 fallback)
              src-tauri/cursors/<name>.cur          (Windows native .cur)
"""
import json
import struct
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_SHEET = Path(r"C:\Users\Aryo\.gemini\antigravity\brain\a9687934-a97b-4a75-8b38-a32f3f67743c\.user_uploaded\media_1789820481442.jpg")
OUT_DIR = ROOT / "ui" / "assets" / "cursors"
CUR_DIR = ROOT / "src-tauri" / "cursors"

SIZE = 64
HAND_MAX_CHANNEL = 140

# Centers along X for 8-column rows
LEFT_X = [51, 111, 172, 229, 289, 348, 404, 465]
RIGHT_X = [568, 628, 687, 746, 806, 863, 922, 980]

# Centers for 16-column resize row (4 per direction)
RESIZE_X = [564, 588, 613, 637, 691, 715, 740, 764, 815, 839, 863, 887, 928, 950, 973, 995]

def unmatte(rgb_crop):
    rgba = Image.new("RGBA", rgb_crop.size)
    px_in = rgb_crop.load()
    px_out = rgba.load()
    for y in range(rgb_crop.height):
        for x in range(rgb_crop.width):
            r, g, b = px_in[x, y]
            m = max(r, g, b)
            if m <= 8:
                px_out[x, y] = (0, 0, 0, 0)
            elif m < 35:
                a = int((m - 8) / (35 - 8) * 255)
                scale = 255 / max(1, a)
                px_out[x, y] = (min(255, int(r * scale)), min(255, int(g * scale)), min(255, int(b * scale)), a)
            else:
                px_out[x, y] = (r, g, b, 255)
    return rgba

def measure_hotspot(sprite, mode):
    w, h = sprite.size
    dark_xs, dark_ys = [], []
    all_xs, all_ys = [], []
    px = sprite.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 80:
                continue
            all_xs.append(x)
            all_ys.append(y)
            if max(p[0], p[1], p[2]) < HAND_MAX_CHANNEL:
                dark_xs.append(x)
                dark_ys.append(y)

    if mode == "tip":
        if dark_ys:
            top = min(dark_ys)
            band = [x for x, y in zip(dark_xs, dark_ys) if y <= top + 2]
            band.sort()
            return band[len(band) // 2], top
        elif all_ys:
            top = min(all_ys)
            band = [x for x, y in zip(all_xs, all_ys) if y <= top + 2]
            band.sort()
            return band[len(band) // 2], top
        return w // 2, h // 2

    if mode == "grip":
        if dark_xs:
            dark_xs.sort()
            dark_ys.sort()
            return dark_xs[len(dark_xs) // 2], dark_ys[len(dark_ys) // 2]
        all_xs.sort()
        all_ys.sort()
        return all_xs[len(all_xs) // 2], all_ys[len(all_ys) // 2]

    # centroid
    if all_xs:
        all_xs.sort()
        all_ys.sort()
        return all_xs[len(all_xs) // 2], all_ys[len(all_ys) // 2]
    return w // 2, h // 2

def process_variant(sheet, name, y0, y1, x_centers, mode, target_hotspot=None):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    frames = []
    
    # 1. Extract and unmatte all frames
    for cx in x_centers:
        crop_box = (max(0, cx - 35), y0, min(sheet.width, cx + 35), y1)
        raw_crop = sheet.crop(crop_box)
        unmatted = unmatte(raw_crop)
        bbox = unmatted.getbbox()
        if bbox:
            glyph = unmatted.crop(bbox)
        else:
            glyph = unmatted
        frames.append(glyph)

    # 2. Scale frames uniformly so the largest fits 56x56
    max_w = max(f.width for f in frames)
    max_h = max(f.height for f in frames)
    max_dim = max(max_w, max_h)
    scale = 1.0
    if max_dim > 56:
        scale = 56.0 / max_dim
        frames = [f.resize((max(1, int(f.width * scale)), max(1, int(f.height * scale))), Image.LANCZOS) for f in frames]

    # 3. Determine anchor hotspot based on frame 0
    f0 = frames[0]
    sx, sy = measure_hotspot(f0, mode)
    if target_hotspot:
        anchor_x, anchor_y = target_hotspot
    else:
        # Default positioning: place hotspot at ~38% canvas or clamped
        anchor_x = min(max(20, sx + 4), 44)
        anchor_y = min(max(18, sy + 4), 44)

    # 4. Composite each frame onto 64x64 canvas anchored at (anchor_x, anchor_y)
    canvas_frames = []
    for f in frames:
        fsx, fsy = measure_hotspot(f, mode)
        # Shift relative to frame 0 hotspot to minimize jitter
        dx = anchor_x - fsx
        dy = anchor_y - fsy
        # Clamp placement so image stays within 64x64
        ox = min(max(0, dx), 64 - f.width)
        oy = min(max(0, dy), 64 - f.height)
        c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        c.alpha_composite(f, (ox, oy))
        canvas_frames.append(c)

    # Save frames
    for i, c in enumerate(canvas_frames):
        c.save(OUT_DIR / f"{name}_{i}.png", optimize=True)
    canvas_frames[0].save(OUT_DIR / f"{name}.png", optimize=True)

    print(f"  {name:<14} ({len(canvas_frames)} frames) hotspot ({anchor_x},{anchor_y})")
    return {"file": f"{name}.png", "x": anchor_x, "y": anchor_y, "frames": len(canvas_frames)}

def main():
    if not SRC_SHEET.exists():
        print(f"Error: {SRC_SHEET} not found", file=sys.stderr)
        return 1

    sheet = Image.open(SRC_SHEET).convert("RGB")
    print(f"Opened master sheet: {sheet.size}")

    meta = {}
    meta["default"]     = process_variant(sheet, "default",     55, 150, LEFT_X,  "tip", (19, 16))
    meta["pointer"]     = process_variant(sheet, "pointer",     55, 150, RIGHT_X, "tip", (16, 19))
    meta["click"]       = process_variant(sheet, "click",       250, 340, LEFT_X,  "tip", (24, 21))
    meta["click_right"] = process_variant(sheet, "click_right", 250, 340, RIGHT_X, "tip", (18, 21))
    meta["grab"]        = process_variant(sheet, "grab",        435, 535, LEFT_X,  "grip", (32, 35))
    meta["move"]        = process_variant(sheet, "move",        435, 535, LEFT_X,  "centroid", (28, 33))
    meta["text"]        = process_variant(sheet, "text",        435, 535, RIGHT_X, "centroid", (34, 35))
    meta["link"]        = process_variant(sheet, "link",        630, 725, LEFT_X,  "tip", (14, 24))
    meta["help"]        = process_variant(sheet, "help",        630, 725, RIGHT_X, "tip", (18, 8))
    meta["busy"]        = process_variant(sheet, "busy",        830, 925, LEFT_X,  "centroid", (32, 32))

    # Resizes (4 frames each from bottom right)
    meta["nwse-resize"] = process_variant(sheet, "nwse-resize", 830, 915, RESIZE_X[0:4],   "tip", (20, 17))
    meta["nesw-resize"] = process_variant(sheet, "nesw-resize", 830, 915, RESIZE_X[4:8],   "tip", (14, 17))
    meta["ns-resize"]   = process_variant(sheet, "ns-resize",   830, 915, RESIZE_X[8:12],  "tip", (24, 21))
    meta["ew-resize"]   = process_variant(sheet, "ew-resize",   830, 915, RESIZE_X[12:16], "tip", (32, 24))

    (OUT_DIR / "cursors.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Saved metadata to {OUT_DIR / 'cursors.json'}")

    # Write Windows native .cur files
    CUR_DIR.mkdir(parents=True, exist_ok=True)
    for name in ["default", "pointer", "grab", "move", "ns-resize", "ew-resize", "nwse-resize", "nesw-resize"]:
        png = Image.open(OUT_DIR / f"{name}.png").convert("RGBA")
        w, h = png.size
        px = png.load()
        and_row = ((w + 31) // 32) * 4
        xor = bytearray()
        mask = bytearray(and_row * h)
        for y in range(h - 1, -1, -1):
            row_mask = (h - 1 - y) * and_row
            for x in range(w):
                r, g, b, a = px[x, y]
                xor += bytes((b, g, r, a))
                if a < 128:
                    mask[row_mask + x // 8] |= 0x80 >> (x % 8)
        bmp_header = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(xor) + len(mask), 0, 0, 0, 0)
        img = bmp_header + bytes(xor) + bytes(mask)
        hx, hy = meta[name]["x"], meta[name]["y"]
        out = CUR_DIR / f"{name}.cur"
        out.write_bytes(
            struct.pack("<HHH", 0, 2, 1)
            + struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, hx, hy, len(img), 22)
            + img
        )
        print(f"  wrote {out.relative_to(ROOT)} (hotspot {hx},{hy})")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
