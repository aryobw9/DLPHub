import json
import re

def revert_cursor():
    # 1. Update app.js
    app_js_path = 'ui/app.js'
    with open(app_js_path, 'r', encoding='utf-8') as f:
        app_js = f.read()

    old_hotspots = """const CURSOR_HOTSPOTS = {
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

    restored_hotspots = """const CURSOR_HOTSPOTS = {
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

    app_js_norm = app_js.replace('\r\n', '\n')
    if old_hotspots.replace('\r\n', '\n') in app_js_norm:
        app_js_norm = app_js_norm.replace(old_hotspots.replace('\r\n', '\n'), restored_hotspots.replace('\r\n', '\n'))
        print("Restored CURSOR_HOTSPOTS in app.js as requested.")
    else:
        print("WARNING: old_hotspots not found in app.js")

    # 2. Update updateScale in app.js
    old_update_scale = """function updateScale() {
  const wrapper = document.getElementById('ui-scale-wrapper');
  if (!wrapper) return;
  const availW = window.innerWidth;
  const availH = window.innerHeight - 40;
  const baseW = 920;
  const baseH = 790;
  if (availW >= baseW && availH >= baseH) {
    wrapper.style.transform = 'none';
    return;
  }
  const scale = Math.min(1, Math.min(availW / baseW, availH / baseH));
  wrapper.style.transform = `scale(${scale.toFixed(4)})`;
}"""

    new_update_scale = """function updateScale() {
  const wrapper = document.getElementById('ui-scale-wrapper');
  if (!wrapper) return;
  const isDrawerOpen = !!(window.perfState && window.perfState.isDrawerOpen);
  const availW = window.innerWidth;
  const availH = window.innerHeight - 40;
  
  // When drawer is open, base layout is 900px main + 14px gap + 410px side drawer = 1324px
  const baseW = isDrawerOpen ? 1344 : 920;
  const baseH = 790;
  
  const scale = Math.min(1, Math.min(availW / baseW, availH / baseH));
  const shiftX = isDrawerOpen ? -212 : 0;
  
  if (!isDrawerOpen && availW >= 920 && availH >= 790) {
    wrapper.style.transform = 'none';
  } else if (!isDrawerOpen) {
    wrapper.style.transform = `scale(${scale.toFixed(4)})`;
  } else {
    // When drawer is open, shift wrapper left by 212px in local coords so combined (main + drawer) is symmetrically centered
    wrapper.style.transform = `scale(${scale.toFixed(4)}) translateX(${shiftX}px)`;
  }
}"""

    if old_update_scale.replace('\r\n', '\n') in app_js_norm:
        app_js_norm = app_js_norm.replace(old_update_scale.replace('\r\n', '\n'), new_update_scale.replace('\r\n', '\n'))
        print("Updated updateScale() for responsive side-by-side scaling.")
    else:
        print("WARNING: old_update_scale not found in app.js")

    # 3. Call updateScale() in openPerfDrawer and closePerfDrawer
    old_open_drawer = """function openPerfDrawer() {
  const drawer = document.getElementById('perf-side-drawer');
  const wrapper = document.getElementById('ui-scale-wrapper');
  if (!drawer) return;

  perfState.isDrawerOpen = true;
  drawer.classList.add('open');

  if (wrapper) {
    wrapper.classList.add('side-panel-open');
  }

  renderDrawer();
}"""

    new_open_drawer = """function openPerfDrawer() {
  const drawer = document.getElementById('perf-side-drawer');
  const wrapper = document.getElementById('ui-scale-wrapper');
  if (!drawer) return;

  perfState.isDrawerOpen = true;
  drawer.classList.add('open');

  if (wrapper) {
    wrapper.classList.add('side-panel-open');
  }

  updateScale();
  renderDrawer();
}"""

    old_close_drawer = """function closePerfDrawer() {
  const drawer = document.getElementById('perf-side-drawer');
  const wrapper = document.getElementById('ui-scale-wrapper');
  perfState.isDrawerOpen = false;

  if (drawer) drawer.classList.remove('open');
  if (wrapper) {
    wrapper.classList.remove('side-panel-open');
  }
}"""

    new_close_drawer = """function closePerfDrawer() {
  const drawer = document.getElementById('perf-side-drawer');
  const wrapper = document.getElementById('ui-scale-wrapper');
  perfState.isDrawerOpen = false;

  if (drawer) drawer.classList.remove('open');
  if (wrapper) {
    wrapper.classList.remove('side-panel-open');
  }

  updateScale();
}"""

    if old_open_drawer.replace('\r\n', '\n') in app_js_norm:
        app_js_norm = app_js_norm.replace(old_open_drawer.replace('\r\n', '\n'), new_open_drawer.replace('\r\n', '\n'))
        print("Added updateScale() to openPerfDrawer().")
    if old_close_drawer.replace('\r\n', '\n') in app_js_norm:
        app_js_norm = app_js_norm.replace(old_close_drawer.replace('\r\n', '\n'), new_close_drawer.replace('\r\n', '\n'))
        print("Added updateScale() to closePerfDrawer().")

    with open(app_js_path, 'w', encoding='utf-8') as f:
        f.write(app_js_norm)
    print("app.js successfully updated.")


def update_style_css():
    path = 'ui/style.css'
    with open(path, 'r', encoding='utf-8') as f:
        css = f.read()

    css_norm = css.replace('\r\n', '\n')

    # 1. Restore cursor CSS variables
    old_cur = """      --cur-default: url('assets/cursors/default.png') 12 9, default;
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

    new_cur = """      --cur-default: url('assets/cursors/default.png') 15 13, default;
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

    if old_cur in css_norm:
        css_norm = css_norm.replace(old_cur, new_cur)
        print("Restored CSS cursor variables.")

    # 2. Add transition to #ui-scale-wrapper for butter-smooth sliding
    css_norm = re.sub(
        r'(#ui-scale-wrapper\s*\{[^}]*?)(\n\s*flex-shrink:)',
        r'\1\n      transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);\2',
        css_norm
    )

    # 3. Ensure #main-ui has position: relative !important
    css_norm = re.sub(
        r'(#main-ui\s*\{[^}]*?)(\n\s*width:\s*100%;)',
        r'\1\n      position: relative !important;\2',
        css_norm
    )

    # 4. Replace drawer styling with pixel-perfect Y alignment and 410px width
    old_drawer_block_pattern = re.compile(
        r'\.perf-side-panel,\s*\.perf-side-drawer\s*\{.*?\.\.\.\s*\}|\.perf-side-panel,\s*\.perf-side-drawer\s*\{[^}]*position:\s*fixed;[^}]*top:\s*50%;[^}]*\}',
        re.DOTALL
    )

    new_drawer_block = """.perf-side-panel,
.perf-side-drawer {
  position: absolute !important;
  top: 82px !important;
  left: calc(100% + 14px) !important;
  right: auto !important;
  width: 410px !important;
  height: 440px !important;
  max-height: 440px !important;
  background: rgba(14, 23, 38, 0.96) !important;
  backdrop-filter: blur(24px) saturate(180%) !important;
  border: 1px solid rgba(249, 115, 22, 0.38) !important;
  border-radius: 10px !important;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(249, 115, 22, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  box-sizing: border-box !important;
  z-index: 99 !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
  transform: translateX(20px) !important;
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, visibility 0.25s !important;
}

.perf-side-panel.open,
.perf-side-drawer.open {
  transform: translateX(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  visibility: visible !important;
}"""

    if old_drawer_block_pattern.search(css_norm):
        css_norm = old_drawer_block_pattern.sub(new_drawer_block, css_norm)
        print("Updated main perf-side-drawer CSS block to position: absolute top: 82px height: 440px width: 410px.")
    else:
        print("WARNING: old_drawer_block_pattern not matched directly, checking lines around 10386...")

    # Also clean up the bottom override in style.css (lines ~11352)
    old_bottom_override = """/* Ensure drawer never truncates title or convar details */
.perf-side-panel,
.perf-side-drawer {
  width: 520px !important;
  max-width: 95vw !important;
  height: 620px !important;
  max-height: 88vh !important;
}"""

    new_bottom_override = """/* Perfectly aligned side tab: 410px wide, identical 440px height to main tab */
.perf-side-panel,
.perf-side-drawer {
  position: absolute !important;
  top: 82px !important;
  left: calc(100% + 14px) !important;
  right: auto !important;
  width: 410px !important;
  height: 440px !important;
  max-height: 440px !important;
}"""

    if old_bottom_override in css_norm:
        css_norm = css_norm.replace(old_bottom_override, new_bottom_override)
        print("Replaced bottom drawer override with 410px width and 440px height.")

    # Remove the old buggy max-width: 1440px media query that shifted wrapper only on small screens
    old_media_query = """@media (max-width: 1440px) {
  #ui-scale-wrapper.side-panel-open {
    transform: scale(var(--ui-scale, 0.8)) translateX(-120px) !important;
    transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
  }
}"""
    if old_media_query in css_norm:
        css_norm = css_norm.replace(old_media_query, "/* Dynamic scaling and centering handled via updateScale() */")
        print("Removed conflicting @media (max-width: 1440px) rule.")

    # Compact drawer header and footer styles to fit 410px / 440px
    drawer_refinement = """
.perf-drawer-header {
  padding: 8px 12px 6px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.perf-drawer-header-row1 {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
}

.drawer-header-left {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  min-width: 0 !important;
  flex: 1 1 auto !important;
}

.drawer-tier-pill {
  font-size: 0.62rem !important;
  padding: 1px 6px !important;
  font-weight: 700 !important;
  flex-shrink: 0 !important;
}

.perf-drawer-title {
  margin: 0 !important;
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  color: #f8fafc !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.2 !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.drawer-header-right {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex-shrink: 0 !important;
}

.drawer-stats-pill {
  font-size: 0.62rem !important;
  padding: 2px 6px !important;
  color: var(--text-muted) !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  border-radius: 4px !important;
  white-space: nowrap !important;
}

.perf-drawer-tabs {
  display: flex !important;
  gap: 4px !important;
  margin-top: 6px !important;
}

.perf-drawer-tab {
  flex: 1 1 0% !important;
  font-size: 0.70rem !important;
  padding: 4px 4px !important;
  white-space: nowrap !important;
}

.perf-drawer-footer {
  padding: 6px 12px !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  display: flex !important;
  gap: 8px !important;
}

.btn-drawer-apply {
  flex: 1 !important;
  height: 32px !important;
  font-size: 0.76rem !important;
}

.btn-drawer-reset {
  height: 32px !important;
  font-size: 0.72rem !important;
  padding: 0 10px !important;
}

#ui-scale-wrapper.side-panel-open .bg-trooper-right {
  opacity: 0.15 !important;
}
"""
    css_norm += drawer_refinement

    with open(path, 'w', encoding='utf-8') as f:
        f.write(css_norm)
    print("style.css successfully updated.")


def update_cursors_json():
    path = 'ui/assets/cursors/cursors.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    data['default']['x'] = 19
    data['default']['y'] = 16
    data['pointer']['x'] = 16
    data['pointer']['y'] = 19
    data['click']['x'] = 24
    data['click']['y'] = 21
    data['click_right']['x'] = 18
    data['click_right']['y'] = 21
    data['link']['x'] = 14
    data['link']['y'] = 24

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print("Restored cursors.json.")

if __name__ == '__main__':
    revert_cursor()
    update_style_css()
    update_cursors_json()
