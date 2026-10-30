import json

def update_app_js():
    path = 'ui/app.js'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_hotspots = """const CURSOR_HOTSPOTS = {
  default: { file: 'assets/cursors/default.png', x: 15, y: 13, w: 51, h: 51 },
  pointer: { file: 'assets/cursors/pointer.png', x: 13, y: 15, w: 51, h: 51 },
  click: { file: 'assets/cursors/click.png', x: 19, y: 17, w: 51, h: 51 },
  click_right: { file: 'assets/cursors/click_right.png', x: 14, y: 17, w: 51, h: 51 },
  grab: { file: 'assets/cursors/grab.png', x: 26, y: 28, w: 51, h: 51 },
  text: { file: 'assets/cursors/text.png', x: 27, y: 28, w: 51, h: 51 },
  link: { file: 'assets/cursors/link.png', x: 11, y: 19, w: 51, h: 51 },
  help: { file: 'assets/cursors/help.png', x: 14, y: 6, w: 51, h: 51 },
  busy: { file: 'assets/cursors/busy_full.png', x: 35, y: 35, w: 70, h: 70 },
  'nwse-resize': { file: 'assets/cursors/nwse-resize.png', x: 16, y: 14, w: 51, h: 51 },
  'nesw-resize': { file: 'assets/cursors/nesw-resize.png', x: 11, y: 14, w: 51, h: 51 },
  'ns-resize': { file: 'assets/cursors/ns-resize.png', x: 19, y: 17, w: 51, h: 51 },
  'ew-resize': { file: 'assets/cursors/ew-resize.png', x: 26, y: 19, w: 51, h: 51 },
  move: { file: 'assets/cursors/move.png', x: 22, y: 26, w: 51, h: 51 }
};"""

    new_hotspots = """const CURSOR_HOTSPOTS = {
  default: { file: 'assets/cursors/default.png', x: 12, y: 9, w: 51, h: 51 },
  pointer: { file: 'assets/cursors/pointer.png', x: 6, y: 11, w: 51, h: 51 },
  click: { file: 'assets/cursors/click.png', x: 6, y: 11, w: 51, h: 51 },
  click_right: { file: 'assets/cursors/click_right.png', x: 7, y: 11, w: 51, h: 51 },
  grab: { file: 'assets/cursors/grab.png', x: 23, y: 28, w: 51, h: 51 },
  text: { file: 'assets/cursors/text.png', x: 8, y: 12, w: 51, h: 51 },
  link: { file: 'assets/cursors/link.png', x: 6, y: 14, w: 51, h: 51 },
  help: { file: 'assets/cursors/help.png', x: 7, y: 9, w: 51, h: 51 },
  busy: { file: 'assets/cursors/busy_full.png', x: 35, y: 35, w: 70, h: 70 },
  'nwse-resize': { file: 'assets/cursors/nwse-resize.png', x: 25, y: 25, w: 51, h: 51 },
  'nesw-resize': { file: 'assets/cursors/nesw-resize.png', x: 24, y: 27, w: 51, h: 51 },
  'ns-resize': { file: 'assets/cursors/ns-resize.png', x: 22, y: 28, w: 51, h: 51 },
  'ew-resize': { file: 'assets/cursors/ew-resize.png', x: 28, y: 26, w: 51, h: 51 },
  move: { file: 'assets/cursors/move.png', x: 22, y: 26, w: 51, h: 51 }
};"""

    content_norm = content.replace('\r\n', '\n')
    if old_hotspots.replace('\r\n', '\n') in content_norm:
        content_norm = content_norm.replace(old_hotspots.replace('\r\n', '\n'), new_hotspots.replace('\r\n', '\n'))
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content_norm)
        print("Updated CURSOR_HOTSPOTS in app.js with exact fingertip hotspots.")
    else:
        print("ERROR: old_hotspots not found in app.js!")


def update_style_css():
    path = 'ui/style.css'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_cur = """      --cur-default: url('assets/cursors/default.png') 15 13, default;
      --cur-pointer: url('assets/cursors/pointer.png') 13 15, pointer;
      --cur-click: url('assets/cursors/click.png') 19 17, pointer;
      --cur-click-right: url('assets/cursors/click_right.png') 14 17, pointer;
      --cur-grab: url('assets/cursors/grab.png') 26 28, grab;
      --cur-text: url('assets/cursors/text.png') 27 28, text;
      --cur-link: url('assets/cursors/link.png') 11 19, pointer;
      --cur-help: url('assets/cursors/help.png') 14 6, help;
      --cur-busy: url('assets/cursors/busy.png') 27 24, wait;
      --cur-nwse: url('assets/cursors/nwse-resize.png') 16 14, nwse-resize;
      --cur-nesw: url('assets/cursors/nesw-resize.png') 11 14, nesw-resize;
      --cur-ns: url('assets/cursors/ns-resize.png') 19 17, ns-resize;
      --cur-ew: url('assets/cursors/ew-resize.png') 26 19, ew-resize;
      --cur-move: url('assets/cursors/move.png') 22 26, move;"""

    new_cur = """      --cur-default: url('assets/cursors/default.png') 12 9, default;
      --cur-pointer: url('assets/cursors/pointer.png') 6 11, pointer;
      --cur-click: url('assets/cursors/click.png') 6 11, pointer;
      --cur-click-right: url('assets/cursors/click_right.png') 7 11, pointer;
      --cur-grab: url('assets/cursors/grab.png') 23 28, grab;
      --cur-text: url('assets/cursors/text.png') 8 12, text;
      --cur-link: url('assets/cursors/link.png') 6 14, pointer;
      --cur-help: url('assets/cursors/help.png') 7 9, help;
      --cur-busy: url('assets/cursors/busy.png') 27 24, wait;
      --cur-nwse: url('assets/cursors/nwse-resize.png') 25 25, nwse-resize;
      --cur-nesw: url('assets/cursors/nesw-resize.png') 24 27, nesw-resize;
      --cur-ns: url('assets/cursors/ns-resize.png') 22 28, ns-resize;
      --cur-ew: url('assets/cursors/ew-resize.png') 28 26, ew-resize;
      --cur-move: url('assets/cursors/move.png') 22 26, move;"""

    content_norm = content.replace('\r\n', '\n')
    if old_cur.replace('\r\n', '\n') in content_norm:
        content_norm = content_norm.replace(old_cur.replace('\r\n', '\n'), new_cur.replace('\r\n', '\n'))
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content_norm)
        print("Updated CSS cursor variables with exact fingertip hotspots.")
    else:
        print("ERROR: old_cur not found in style.css!")


def update_cursors_json():
    path = 'ui/assets/cursors/cursors.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # In 64x64 scale:
    # pointer: x=8, y=14
    # click: x=8, y=14
    # click_right: x=9, y=14
    # link: x=8, y=18
    # default: x=15, y=11
    # text: x=10, y=15
    # help: x=9, y=11
    data['pointer']['x'] = 8
    data['pointer']['y'] = 14
    data['click']['x'] = 8
    data['click']['y'] = 14
    data['click_right']['x'] = 9
    data['click_right']['y'] = 14
    data['link']['x'] = 8
    data['link']['y'] = 18

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print("Updated cursors.json with calibrated fingertip values.")


def update_agents_md():
    path = 'AGENTS.md'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    replacement = """## 3. Custom Pointer & Cursor Scaling Standard
- Custom flame pointer cursors are scaled to **51px × 51px** (`busy` mode is **70px × 70px**).
- Target dot is **5px × 5px**.
- **Fingertip Click Alignment**: For hand pointer cursors (`pointer`, `click`, `click_right`, `link`), the hotspot `(meta.x, meta.y)` and target dot MUST sit precisely at the index fingertip (`x: 6, y: 11` on 51px scale), NEVER in the middle of the palm/knuckle."""

    if '## 3. Custom Pointer & Cursor Scaling Standard' in content:
        lines = content.split('## 3. Custom Pointer & Cursor Scaling Standard')[0]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(lines + replacement + '\n')
        print("Updated AGENTS.md with fingertip standard.")

if __name__ == '__main__':
    update_app_js()
    update_style_css()
    update_cursors_json()
    update_agents_md()
