#!/usr/bin/env python3
"""
Slice the flame-hand cursor sprite sheet into individual transparent PNGs.

Input:  tools/cursor-sheet.png (1536x1024 master sheet)
Output: ui/assets/cursors/<name>.png  (64x64, transparent)

Variants mapped to CSS cursor keywords:

    default        NORMAL
    pointer        HOVER
    click          CLICK (LEFT)   (driven from app.js on mousedown)
    click_right    CLICK (RIGHT)  (driven from app.js on mousedown)
    grab           DRAG
    text           TEXT
    link           LINK
    help           HELP
    busy           BUSY
    nwse-resize    RESIZE (NW-SE)
    nesw-resize    RESIZE (NE-SW)
    ns-resize      RESIZE (N-S)
    ew-resize      RESIZE (E-W)
    move           MOVE

Hotspots are derived from the art itself, not hand-tuned guesses:
  - "tip"      hotspots use the topmost dark (hand) pixel -> the fingertip,
               which is where every one of these glyphs functionally points.
  - "grip"     uses the centroid of the dark hand pixels (closed fist).
  - "centroid" uses the centroid of all opaque pixels (vortex / star / I-beam).

The hotspot lands at 38% of the 64px canvas so the flame trail has room to the
down-right, matching the direction the art already leans.
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "tools" / "cursor-sheet.png"
OUT_DIR = ROOT / "ui" / "assets" / "cursors"

SIZE = 64          # final cursor canvas (square)
HAND_MAX_CHANNEL = 140   # hand is dark olive; flame is bright green
ANCHOR_FRAC = 0.38       # where the hotspot sits on the canvas

# (name, col, row, mode)
VARIANTS = [
    # --- row 1 -------------------------------------------------------------
    ("default",     0, 0, "tip"),
    ("pointer",     1, 0, "tip"),
    ("click",       2, 0, "tip"),
    ("click_right", 3, 0, "tip"),
    # --- row 2 -------------------------------------------------------------
    ("grab",        0, 1, "grip"),
    ("text",        1, 1, "centroid"),
    ("link",        2, 1, "tip"),
    ("help",        3, 1, "tip"),
    ("busy",        4, 1, "centroid"),
    # --- row 3 -------------------------------------------------------------
    ("nwse-resize", 0, 2, "tip"),
    ("nesw-resize", 1, 2, "tip"),
    ("ns-resize",   2, 2, "tip"),
    ("ew-resize",   3, 2, "tip"),
    ("move",        4, 2, "centroid"),
]

GRID_COLS = 5
GRID_ROWS = 3
EXPECTED_PER_BAND = [4, 5, 5]  # row1: 4 variants; row2/3: 5 each
MIN_BAND_GAP = 15              # px of fully-transparent rows between bands
MIN_COL_GAP = 20               # px of fully-transparent cols between glyphs


def split_bands(mask_rows, min_gap):
    """Group consecutive non-empty rows into bands, separated by >= min_gap empty rows."""
    bands: list[tuple[int, int]] = []
    start = None
    gap = 0
    for i, filled in enumerate(mask_rows):
        if filled:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                bands.append((start, i - gap))
                start = None
                gap = 0
    if start is not None:
        bands.append((start, len(mask_rows) - 1 - gap))
    return bands


def segment_glyphs(sheet: Image.Image) -> list[Image.Image]:
    """Locate each glyph automatically: split the sheet into horizontal bands
    (sprite rows), then into column groups, then drop caption/ember noise.

    Only "sprite" pixels count: green flame or the dark olive hand. Gray
    caption text and the transparent background are ignored. Short bands
    (stray ember rows) and column groups beyond the expected count (the
    size-preview strip at bottom-right) are dropped.
    """
    w, h = sheet.size
    px = sheet.load()

    def is_sprite(x: int, y: int) -> bool:
        p = px[x, y]
        if p[3] <= 8:
            return False
        r, g, b = p[0], p[1], p[2]
        return (g > r + 18 and g > 60) or max(r, g, b) < HAND_MAX_CHANNEL

    row_filled = [any(is_sprite(x, y) for x in range(0, w, 2)) for y in range(h)]
    bands = split_bands(row_filled, MIN_BAND_GAP)
    bands = [(y0, y1) for y0, y1 in bands if y1 - y0 > 40]  # drop ember/caption slivers
    if len(bands) != len(EXPECTED_PER_BAND):
        raise SystemExit(f"expected {EXPECTED_PER_BAND} sprite bands, found {len(bands)}: {bands}")

    glyphs: list[Image.Image] = []
    for (y0, y1), expected in zip(bands, EXPECTED_PER_BAND):
        col_filled = [any(is_sprite(x, y) for y in range(y0, y1 + 1, 2)) for x in range(w)]
        groups = split_bands(col_filled, MIN_COL_GAP)
        if len(groups) < expected:
            raise SystemExit(f"band y{y0}-{y1}: expected {expected} glyphs, found {len(groups)} at {groups}")
        for x0, x1 in groups[:expected]:
            group = sheet.crop((x0, y0, x1 + 1, y1 + 1))
            gdata = group.getchannel("A").load()
            sub_rows = [any(gdata[x, y] > 8 for x in range(group.width)) for y in range(group.height)]
            subs = split_bands(sub_rows, MIN_BAND_GAP)
            if not subs:
                raise SystemExit("empty glyph group")
            gy0, gy1 = max(subs, key=lambda s: s[1] - s[0])  # tallest = the glyph itself
            sub = group.crop((0, gy0, group.width, gy1 + 1))
            bbox = sub.getbbox()
            glyphs.append(sub.crop(bbox))
    return glyphs


def _snap_dark(sprite: Image.Image, hx: int, hy: int, radius: int = 8) -> tuple[int, int]:
    """Snap (hx, hy) to the nearest dark (hand) pixel so the hotspot never sits
    on a flame glow edge."""
    px = sprite.load()
    if max(px[hx, hy][0], px[hx, hy][1], px[hx, hy][2]) < HAND_MAX_CHANNEL:
        return hx, hy
    best: tuple[int, int, int] | None = None  # (dist, x, y)
    for y in range(max(0, hy - radius), min(sprite.height, hy + radius + 1)):
        for x in range(max(0, hx - radius), min(sprite.width, hx + radius + 1)):
            p = px[x, y]
            if p[3] >= 200 and max(p[0], p[1], p[2]) < HAND_MAX_CHANNEL:
                d = (x - hx) ** 2 + (y - hy) ** 2
                if best is None or d < best[0]:
                    best = (d, x, y)
    return (best[1], best[2]) if best else (hx, hy)


def measure(sprite: Image.Image, mode: str) -> tuple[int, int]:
    """Hotspot within the sprite, per mode."""
    w, h = sprite.size
    dark_xs: list[int] = []
    dark_ys: list[int] = []
    all_xs: list[int] = []
    all_ys: list[int] = []
    px = sprite.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 200:
                continue
            all_xs.append(x)
            all_ys.append(y)
            if max(p[0], p[1], p[2]) < HAND_MAX_CHANNEL:
                dark_xs.append(x)
                dark_ys.append(y)

    if mode in ("tip", "grip") and len(dark_xs) < 10:
        raise SystemExit(f"no hand pixels found for mode {mode!r}")
    if mode == "tip":
        # Topmost dark pixel = the fingertip. Median x among the top 3 rows
        # guards against a single stray speck.
        top = min(dark_ys)
        band = [x for x, y in zip(dark_xs, dark_ys) if y <= top + 2]
        band.sort()
        return _snap_dark(sprite, band[len(band) // 2], top)
    if mode == "grip":
        dark_xs.sort()
        dark_ys.sort()
        return _snap_dark(sprite, dark_xs[len(dark_xs) // 2], dark_ys[len(dark_ys) // 2])
    # centroid of all opaque pixels
    all_xs.sort()
    all_ys.sort()
    return all_xs[len(all_xs) // 2], all_ys[len(all_ys) // 2]


def fit_and_crop(variant: str, sprite_in: Image.Image, mode: str) -> tuple[Image.Image, tuple[int, int]]:
    """Place the sprite on a SIZE x SIZE transparent canvas, hotspot anchored."""
    sprite = sprite_in.copy()

    # Scale down first if the sprite can't fit the canvas at all, so the
    # hotspot is measured on the final-resolution art.
    max_dim = max(sprite.size)
    if max_dim > SIZE:
        scale = SIZE / max_dim
        sprite = sprite.resize((max(1, round(sprite.width * scale)),
                                max(1, round(sprite.height * scale))), Image.LANCZOS)

    sx, sy = measure(sprite, mode)
    anchor_x = min(max(int(SIZE * ANCHOR_FRAC), sx), SIZE - max(1, sprite.width - sx))
    anchor_y = min(max(int(SIZE * ANCHOR_FRAC), sy), SIZE - max(1, sprite.height - sy))
    if anchor_x < sx or anchor_y < sy:
        raise SystemExit(f"variant {variant!r}: sprite {sprite.size} too large for {SIZE}px canvas")

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(sprite, (anchor_x - sx, anchor_y - sy))
    return canvas, (anchor_x, anchor_y)


def main() -> int:
    if not SHEET.exists():
        print(f"error: sprite sheet not found: {SHEET}", file=sys.stderr)
        return 1

    sheet = Image.open(SHEET).convert("RGBA")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    meta: dict[str, dict] = {}
    glyphs = segment_glyphs(sheet)
    if len(glyphs) != len(VARIANTS):
        raise SystemExit(f"segmented {len(glyphs)} glyphs, expected {len(VARIANTS)}")
    for (name, _col, _row, mode), sprite in zip(VARIANTS, glyphs):
        png, (px, py) = fit_and_crop(name, sprite, mode)
        alpha = png.getpixel((px, py))[3]
        png.save(OUT_DIR / f"{name}.png", optimize=True)
        meta[name] = {"file": f"{name}.png", "x": px, "y": py}
        flag = "" if alpha > 40 else "  << TRANSPARENT HOTSPOT"
        print(f"  {name:<12} {mode:<9} hotspot ({px:>2},{py:>2}) alpha={alpha}{flag}")

    (OUT_DIR / "cursors.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(meta)} cursors + cursors.json -> {OUT_DIR.relative_to(ROOT)}")
    write_windows_cur(meta)
    return 0


# --- Windows .cur files for the native WM_SETCURSOR border (see
#     src-tauri/src/native_cursor.rs). The OS paints the outer resize band, so
#     those four variants must be real .cur files, not CSS url()s. ---
CUR_VARIANTS = ("default", "pointer", "grab", "move", "ns-resize", "ew-resize", "nwse-resize", "nesw-resize")


def write_windows_cur(meta: dict) -> None:
    cur_dir = ROOT / "src-tauri" / "cursors"
    cur_dir.mkdir(parents=True, exist_ok=True)
    for name in CUR_VARIANTS:
        png = Image.open(OUT_DIR / meta[name]["file"]).convert("RGBA")
        w, h = png.size
        px = png.load()
        and_row = ((w + 31) // 32) * 4  # 1bpp rows padded to 4 bytes
        xor = bytearray()
        mask = bytearray(and_row * h)
        for y in range(h - 1, -1, -1):  # bitmap data is bottom-up
            row_mask = (h - 1 - y) * and_row
            for x in range(w):
                r, g, b, a = px[x, y]
                xor += bytes((b, g, r, a))  # BGRA
                if a < 128:  # AND mask bit set = transparent
                    mask[row_mask + x // 8] |= 0x80 >> (x % 8)
        # BITMAPINFOHEADER: biHeight = 2*h (XOR plus AND planes)
        bmp_header = struct.pack("<IiiHHIIiiII",
                                 40, w, h * 2, 1, 32, 0,
                                 len(xor) + len(mask), 0, 0, 0, 0)
        img = bmp_header + bytes(xor) + bytes(mask)
        hx, hy = meta[name]["x"], meta[name]["y"]
        # CURSORDIR(6) + CURSORDIRENTRY(16); hotspot rides in the entry's
        # planes/bitCount fields, as the .cur format specifies
        out = cur_dir / f"{name}.cur"
        out.write_bytes(
            struct.pack("<HHH", 0, 2, 1)
            + struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, hx, hy, len(img), 22)
            + img)
        print(f"  wrote {out.relative_to(ROOT)} (hotspot {hx},{hy})")


if __name__ == "__main__":
    raise SystemExit(main())
