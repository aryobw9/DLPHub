import re

def update_style_css():
    path = 'ui/style.css'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update CSS cursor variables
    old_cur = """      --cur-default: url('assets/cursors/default.png') 19 16, default;
      --cur-pointer: url('assets/cursors/pointer.png') 16 19, pointer;
      --cur-click: url('assets/cursors/click.png') 24 21, pointer;
      --cur-click-right: url('assets/cursors/click_right.png') 18 21, pointer;
      --cur-grab: url('assets/cursors/grab.png') 32 35, grab;
      --cur-text: url('assets/cursors/text.png') 34 35, text;
      --cur-link: url('assets/cursors/link.png') 14 24, pointer;
      --cur-help: url('assets/cursors/help.png') 18 8, help;
      --cur-busy: url('assets/cursors/busy.png') 34 30, wait;
      --cur-nwse: url('assets/cursors/nwse-resize.png') 20 17, nwse-resize;
      --cur-nesw: url('assets/cursors/nesw-resize.png') 14 17, nesw-resize;
      --cur-ns: url('assets/cursors/ns-resize.png') 24 21, ns-resize;
      --cur-ew: url('assets/cursors/ew-resize.png') 32 24, ew-resize;
      --cur-move: url('assets/cursors/move.png') 28 33, move;"""

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

    if old_cur in content:
        content = content.replace(old_cur, new_cur)
        print("Updated CSS cursor variables (20% smaller).")
    else:
        print("WARNING: old_cur not found directly, trying regex or normalized whitespace...")
        # Normalize CRLF
        content_norm = content.replace('\r\n', '\n')
        old_cur_norm = old_cur.replace('\r\n', '\n')
        if old_cur_norm in content_norm:
            content_norm = content_norm.replace(old_cur_norm, new_cur.replace('\r\n', '\n'))
            content = content_norm
            print("Updated CSS cursor variables via normalized newline.")

    # 2. Update #dlp-custom-cursor size from 64px to 51px
    content = re.sub(
        r'(#dlp-custom-cursor\s*\{[^}]*?width:\s*)64px;([^}]*?height:\s*)64px;',
        r'\g<1>51px;\g<2>51px;',
        content
    )
    print("Updated #dlp-custom-cursor size to 51px.")

    # 3. Update #dlp-cursor-target-dot from 6px to 5px
    content = re.sub(
        r'(#dlp-cursor-target-dot\s*\{[^}]*?width:\s*)6px;([^}]*?height:\s*)6px;',
        r'\g<1>5px;\g<2>5px;',
        content
    )
    print("Updated #dlp-cursor-target-dot to 5px.")

    # 4. Replace bloated staggered tab switching animation with unified lightweight overall blur transition
    old_anim_pattern = re.compile(
        r'\.content-header\.panel-revealing,\s*\.panel\.panel-revealing\s+\.tier-card,\s*.*?#panel-advanced\.panel-revealing\.to-en\s+\.adv-col:nth-child\(2\)\s+\.adv-card:nth-child\(2\)\s*\{\s*animation-delay:\s*320ms;\s*\}',
        re.DOTALL
    )

    new_anim_block = """/* Unified Lightweight Overall Panel Blur Transition */
@keyframes panel-overall-blur-in {
  0% {
    opacity: 0.15;
    filter: blur(5px);
    transform: translateY(4px);
  }
  100% {
    opacity: 1;
    filter: blur(0px);
    transform: translateY(0);
  }
}

.panel.panel-revealing {
  animation: panel-overall-blur-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) backwards !important;
  will-change: opacity, filter, transform;
}

.content-header.panel-revealing {
  animation: panel-overall-blur-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) backwards !important;
  will-change: opacity, filter, transform;
}

body.reduced-motion .panel.panel-revealing,
body.reduced-motion .content-header.panel-revealing {
  animation: none !important;
}"""

    if old_anim_pattern.search(content):
        content = old_anim_pattern.sub(new_anim_block, content)
        print("Replaced bloated staggered tab switching rules with unified panel blur transition.")
    else:
        print("WARNING: old_anim_pattern not found directly, checking normalized...")
        content_norm = content.replace('\r\n', '\n')
        if old_anim_pattern.search(content_norm):
            content = old_anim_pattern.sub(new_anim_block, content_norm)
            print("Replaced staggered tab rules via normalized newline.")

    # 5. Fix ConVar layout shift: ensure .convar-top-line flex-wrap is nowrap !important
    content = content.replace(
        '.convar-top-line {\n  display: flex !important;\n  align-items: center !important;\n  flex-wrap: wrap !important;',
        '.convar-top-line {\n  display: flex !important;\n  align-items: center !important;\n  flex-wrap: nowrap !important;'
    )
    content = content.replace(
        '.convar-top-line {\r\n  display: flex !important;\r\n  align-items: center !important;\r\n  flex-wrap: wrap !important;',
        '.convar-top-line {\r\n  display: flex !important;\r\n  align-items: center !important;\r\n  flex-wrap: nowrap !important;'
    )
    print("Updated .convar-top-line to flex-wrap: nowrap !important.")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("style.css successfully updated.")


def update_app_js():
    path = 'ui/app.js'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update CURSOR_HOTSPOTS
    old_hotspots = """const CURSOR_HOTSPOTS = {
  default: { file: 'assets/cursors/default.png', x: 19, y: 16, w: 64, h: 64 },
  pointer: { file: 'assets/cursors/pointer.png', x: 16, y: 19, w: 64, h: 64 },
  click: { file: 'assets/cursors/click.png', x: 24, y: 21, w: 64, h: 64 },
  click_right: { file: 'assets/cursors/click_right.png', x: 18, y: 21, w: 64, h: 64 },
  grab: { file: 'assets/cursors/grab.png', x: 32, y: 35, w: 64, h: 64 },
  text: { file: 'assets/cursors/text.png', x: 34, y: 35, w: 64, h: 64 },
  link: { file: 'assets/cursors/link.png', x: 14, y: 24, w: 64, h: 64 },
  help: { file: 'assets/cursors/help.png', x: 18, y: 8, w: 64, h: 64 },
  busy: { file: 'assets/cursors/busy_full.png', x: 44, y: 44, w: 88, h: 88 },
  'nwse-resize': { file: 'assets/cursors/nwse-resize.png', x: 20, y: 17, w: 64, h: 64 },
  'nesw-resize': { file: 'assets/cursors/nesw-resize.png', x: 14, y: 17, w: 64, h: 64 },
  'ns-resize': { file: 'assets/cursors/ns-resize.png', x: 24, y: 21, w: 64, h: 64 },
  'ew-resize': { file: 'assets/cursors/ew-resize.png', x: 32, y: 24, w: 64, h: 64 },
  move: { file: 'assets/cursors/move.png', x: 28, y: 33, w: 64, h: 64 }
};"""

    new_hotspots = """const CURSOR_HOTSPOTS = {
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

    content_norm = content.replace('\r\n', '\n')
    old_hotspots_norm = old_hotspots.replace('\r\n', '\n')
    if old_hotspots_norm in content_norm:
        content_norm = content_norm.replace(old_hotspots_norm, new_hotspots.replace('\r\n', '\n'))
        print("Updated CURSOR_HOTSPOTS in app.js (20% smaller).")
    else:
        print("WARNING: CURSOR_HOTSPOTS not found in app.js!")

    # Update setCursorType defaults
    content_norm = content_norm.replace("cursorEl.style.width = (meta.w || 64) + 'px';", "cursorEl.style.width = (meta.w || 51) + 'px';")
    content_norm = content_norm.replace("cursorEl.style.height = (meta.h || 64) + 'px';", "cursorEl.style.height = (meta.h || 51) + 'px';")

    # 2. Update selectCardByKey timeout from 750ms to 250ms for snappy blur transition
    old_select_timeout = """    setTimeout(() => {
      active.classList.remove('panel-revealing', 'to-fa', 'to-en');
    }, 750);
  }
  const header = document.querySelector('.content-header');
  if (header) {
    header.classList.remove('panel-revealing', 'to-fa', 'to-en');
    void header.offsetWidth;
    header.classList.add('panel-revealing', dirClass);
    setTimeout(() => {
      header.classList.remove('panel-revealing', 'to-fa', 'to-en');
    }, 750);
  }"""

    new_select_timeout = """    setTimeout(() => {
      active.classList.remove('panel-revealing', 'to-fa', 'to-en');
    }, 250);
  }
  const header = document.querySelector('.content-header');
  if (header) {
    header.classList.remove('panel-revealing', 'to-fa', 'to-en');
    void header.offsetWidth;
    header.classList.add('panel-revealing', dirClass);
    setTimeout(() => {
      header.classList.remove('panel-revealing', 'to-fa', 'to-en');
    }, 250);
  }"""

    if old_select_timeout.replace('\r\n', '\n') in content_norm:
        content_norm = content_norm.replace(old_select_timeout.replace('\r\n', '\n'), new_select_timeout.replace('\r\n', '\n'))
        print("Updated selectCardByKey timeout to 250ms.")

    # 3. Add updateConvarCounters and in-place toggleConvarBool and onConvarNumericChange
    old_cvar_handlers = """function toggleConvarBool(cvarKey) {
  const p = getActivePreset();
  if (!p) return;
  const entries = p.entries || [];
  const entry = entries.find(e => e.path && e.path.length >= 2 && e.path[1].toLowerCase() === cvarKey.toLowerCase());
  const entryVal = entry ? String(entry.value || 'false') : 'false';
  
  const currentVal = perfState.userOverrides[cvarKey] !== undefined ? String(perfState.userOverrides[cvarKey]) : entryVal;
  const isCurrentlyTrue = currentVal.toLowerCase() === 'true';
  const nextVal = isCurrentlyTrue ? 'false' : 'true';
  
  perfState.userOverrides[cvarKey] = nextVal;
  renderConvarEditor(getActivePreset());
}

function onConvarNumericChange(cvarKey, newVal, isFloat, minVal, maxVal) {
  let num = isFloat ? parseFloat(newVal) : parseInt(newVal, 10);
  if (isNaN(num)) return;
  
  let min = minVal !== '' ? Number(minVal) : -Infinity;
  let max = maxVal !== '' ? Number(maxVal) : Infinity;
  if (cvarKey === 'r_aspectratio') {
    if (min === -Infinity) min = 0;
    max = 3.20;
  }
  
  if (num < min) num = min;
  if (num > max) num = max;
  
  const formatted = isFloat ? num.toFixed(2) : String(Math.round(num));
  perfState.userOverrides[cvarKey] = formatted;
  renderConvarEditor(getActivePreset());
}"""

    new_cvar_handlers = """function updateConvarCounters() {
  const p = getActivePreset();
  if (!p) return;
  const entries = p.entries || [];
  const convarMap = perfState.convarMap || {};
  let differsCount = 0;
  for (const e of entries) {
    if (!e.path || e.path.length < 2) continue;
    const cvarKey = e.path[1].toLowerCase();
    const meta = convarMap[cvarKey] || {};
    const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
    const isOverridden = perfState.userOverrides[cvarKey] !== undefined;
    const currentVal = isOverridden ? String(perfState.userOverrides[cvarKey]) : String(e.value || '');
    if (currentVal !== '' && defaultVal !== 'default' && currentVal.toLowerCase() !== defaultVal.toLowerCase()) {
      differsCount++;
    }
  }
  const countDiffersEl = document.getElementById('count-differs');
  const countOverriddenEl = document.getElementById('count-overridden');
  const countAllEl = document.getElementById('count-all');
  if (countAllEl) countAllEl.textContent = entries.length;
  if (countDiffersEl) countDiffersEl.textContent = differsCount;
  if (countOverriddenEl) countOverriddenEl.textContent = Object.keys(perfState.userOverrides).length;
}

function toggleConvarBool(cvarKey) {
  const p = getActivePreset();
  if (!p) return;
  const entries = p.entries || [];
  const entry = entries.find(e => e.path && e.path.length >= 2 && e.path[1].toLowerCase() === cvarKey.toLowerCase());
  const entryVal = entry ? String(entry.value || 'false') : 'false';
  
  const currentVal = perfState.userOverrides[cvarKey] !== undefined ? String(perfState.userOverrides[cvarKey]) : entryVal;
  const isCurrentlyTrue = currentVal.toLowerCase() === 'true';
  const nextVal = isCurrentlyTrue ? 'false' : 'true';
  
  perfState.userOverrides[cvarKey] = nextVal;

  // In-place DOM update prevents vertical layout shift and scroll jumping
  const row = document.querySelector(`.convar-row-item[data-cvar-row="${cvarKey}"]`);
  if (row) {
    const btn = row.querySelector('.cvar-bool-btn');
    if (btn) {
      btn.textContent = nextVal;
      btn.classList.toggle('is-true', nextVal === 'true');
      btn.classList.toggle('is-false', nextVal === 'false');
      btn.title = `Click or scroll to toggle (currently ${nextVal})`;
    }
    const meta = (perfState.convarMap || {})[cvarKey] || {};
    const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
    const isDiff = nextVal !== '' && defaultVal !== 'default' && nextVal.toLowerCase() !== defaultVal.toLowerCase();
    const diffDot = row.querySelector('.convar-diff-dot');
    if (diffDot) {
      diffDot.style.visibility = isDiff ? 'visible' : 'hidden';
    }
  } else {
    renderConvarEditor(getActivePreset());
  }

  updateConvarCounters();
}

function onConvarNumericChange(cvarKey, newVal, isFloat, minVal, maxVal) {
  let num = isFloat ? parseFloat(newVal) : parseInt(newVal, 10);
  if (isNaN(num)) return;
  
  let min = minVal !== '' ? Number(minVal) : -Infinity;
  let max = maxVal !== '' ? Number(maxVal) : Infinity;
  if (cvarKey === 'r_aspectratio') {
    if (min === -Infinity) min = 0;
    max = 3.20;
  }
  
  if (num < min) num = min;
  if (num > max) num = max;
  
  const formatted = isFloat ? num.toFixed(2) : String(Math.round(num));
  perfState.userOverrides[cvarKey] = formatted;

  // In-place DOM update prevents vertical layout shift and scroll jumping
  const row = document.querySelector(`.convar-row-item[data-cvar-row="${cvarKey}"]`);
  if (row) {
    const input = row.querySelector('input.convar-item-val-input');
    if (input && input.value !== formatted) {
      input.value = formatted;
    }
    const meta = (perfState.convarMap || {})[cvarKey] || {};
    const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
    const isDiff = formatted !== '' && defaultVal !== 'default' && formatted.toLowerCase() !== defaultVal.toLowerCase();
    const diffDot = row.querySelector('.convar-diff-dot');
    if (diffDot) {
      diffDot.style.visibility = isDiff ? 'visible' : 'hidden';
    }
  } else {
    renderConvarEditor(getActivePreset());
  }

  updateConvarCounters();
}"""

    if old_cvar_handlers.replace('\r\n', '\n') in content_norm:
        content_norm = content_norm.replace(old_cvar_handlers.replace('\r\n', '\n'), new_cvar_handlers.replace('\r\n', '\n'))
        print("Replaced ConVar handlers with in-place zero-jump updates.")
    else:
        print("WARNING: old_cvar_handlers not found in app.js!")

    # 4. In renderConvarEditor: add data-cvar-row and invariant .convar-diff-dot with visibility style
    old_row_create = """    const row = document.createElement('div');
    row.className = 'convar-row-item';"""

    new_row_create = """    const row = document.createElement('div');
    row.className = 'convar-row-item';
    row.dataset.cvarRow = cvarKey;"""

    if old_row_create.replace('\r\n', '\n') in content_norm:
        content_norm = content_norm.replace(old_row_create.replace('\r\n', '\n'), new_row_create.replace('\r\n', '\n'))
        print("Added data-cvar-row to convar-row-item.")

    old_row_markup = """        <div class="convar-top-line">
          <span class="convar-item-name" title="${cvarKey}">${cvarKey}</span>
          <span class="convar-item-def-badge">def: ${defaultVal}</span>
          ${isDiff ? '<span class="convar-diff-dot" title="Differs from default"></span>' : ''}
        </div>"""

    new_row_markup = """        <div class="convar-top-line">
          <span class="convar-item-name" title="${cvarKey}">${cvarKey}</span>
          <span class="convar-item-def-badge">def: ${defaultVal}</span>
          <span class="convar-diff-dot" style="visibility: ${isDiff ? 'visible' : 'hidden'};" title="Differs from default"></span>
        </div>"""

    if old_row_markup.replace('\r\n', '\n') in content_norm:
        content_norm = content_norm.replace(old_row_markup.replace('\r\n', '\n'), new_row_markup.replace('\r\n', '\n'))
        print("Updated convar-top-line markup to invariant diff-dot with visibility.")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_norm)
    print("app.js successfully updated.")

if __name__ == '__main__':
    update_style_css()
    update_app_js()
