import re

# ==============================================================================
# 1. PATCH UI/INDEX.HTML
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

# Replace the old 3-line header with strict 2-line header
old_header_pattern = re.compile(
    r'<div class="perf-drawer-header">.*?<div class="perf-drawer-badge-row">.*?</div>\s*<div class="perf-drawer-title-row">.*?</div>\s*<!-- Drawer Navigation Tabs -->\s*<div class="perf-drawer-tabs">.*?</div>\s*</div>',
    re.DOTALL
)

new_header_html = '''<div class="perf-drawer-header">
        <!-- Line 1: Badge + Preset Name (Never Truncates) + Stats Pill + Close Button -->
        <div class="perf-drawer-header-row1">
          <div class="drawer-header-left">
            <span class="drawer-tier-pill" id="drawer-tier-pill">SWEATY</span>
            <h3 class="perf-drawer-title" id="drawer-preset-title" title="OptiLock FPS (Recommended)">OptiLock FPS (Recommended)</h3>
          </div>
          <div class="drawer-header-right">
            <span class="drawer-stats-pill" id="drawer-stats-pill" title="348 applied · 37 unused">
              <strong class="tabular-num" id="drawer-stat-applied">348</strong> applied · <strong class="tabular-num" id="drawer-stat-unused">37</strong> unused
            </span>
            <button type="button" class="perf-drawer-close" onclick="closePerfDrawer()" aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Line 2: Slim Segmented Navigation Tabs -->
        <div class="perf-drawer-tabs">
          <button type="button" class="perf-drawer-tab active" data-tab="overview" onclick="switchDrawerTab('overview')">
            <i class="fa-solid fa-chart-pie"></i> <span data-i18n="drawerTabOverview">تغییرات</span>
          </button>
          <button type="button" class="perf-drawer-tab" data-tab="camera" onclick="switchDrawerTab('camera')">
            <i class="fa-solid fa-eye"></i> <span data-i18n="drawerTabCamera">دوربین و دید</span>
          </button>
          <button type="button" class="perf-drawer-tab" data-tab="editor" onclick="switchDrawerTab('editor')">
            <i class="fa-solid fa-sliders"></i> <span data-i18n="drawerTabEditor">ویرایشگر کانوارهای بازی</span>
          </button>
        </div>
      </div>'''

if old_header_pattern.search(index_html):
    index_html = old_header_pattern.sub(new_header_html, index_html)
    print("Successfully patched header in index.html")
else:
    print("Warning: old header pattern not matched in index.html")

# Update Tab 3 filter chips in index.html
old_chips_pattern = re.compile(
    r'<div class="editor-filter-chips">.*?</div>',
    re.DOTALL
)

new_chips_html = '''<div class="editor-filter-chips">
            <button type="button" class="editor-chip active" id="chip-filter-all" data-filter="all" onclick="setDrawerEditorFilter('all')">
              <span>همه</span> (<span class="tabular-num" id="count-all">348</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-differs" data-filter="differs" onclick="setDrawerEditorFilter('differs')">
              <span>متفاوت با بازی</span> (<span class="tabular-num" id="count-differs">46</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-overridden" data-filter="overridden" onclick="setDrawerEditorFilter('overridden')">
              <span>تغییر یافته توسط شما</span> (<span class="tabular-num" id="count-overridden">0</span>)
            </button>
          </div>'''

# Search only inside drawer-tab-pane #pane-drawer-editor
if '<div class="drawer-tab-pane" id="pane-drawer-editor"' in index_html:
    part1, part2 = index_html.split('<div class="drawer-tab-pane" id="pane-drawer-editor"', 1)
    if old_chips_pattern.search(part2):
        part2 = old_chips_pattern.sub(new_chips_html, part2, count=1)
        index_html = part1 + '<div class="drawer-tab-pane" id="pane-drawer-editor"' + part2
        print("Successfully patched editor chips in index.html")

with open('d:/Claude/DLPBooster/ui/index.html', 'w', encoding='utf-8') as f:
    f.write(index_html)


# ==============================================================================
# 2. PATCH UI/STYLE.CSS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/style.css', 'r', encoding='utf-8') as f:
    style_css = f.read()

# Replace drawer header styles
old_drawer_css_pattern = re.compile(
    r'\.perf-drawer-header\s*\{.*?\.perf-drawer-tabs\s*\{.*?\.perf-drawer-tab\.active\s*\{.*?\}',
    re.DOTALL
)

new_drawer_css = '''.perf-drawer-header {
  padding: 10px 14px 8px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 7px !important;
  background: rgba(10, 15, 25, 0.7) !important;
  border-radius: 12px 12px 0 0 !important;
  flex-shrink: 0 !important;
}

.perf-drawer-header-row1 {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  min-height: 28px !important;
}

.drawer-header-left {
  display: flex !important;
  align-items: center !important;
  gap: 7px !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.drawer-tier-pill {
  font-family: 'Rajdhani', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.68rem !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  background: rgba(249, 115, 22, 0.2) !important;
  color: var(--deadlock-orange) !important;
  border: 1px solid rgba(249, 115, 22, 0.45) !important;
  flex-shrink: 0 !important;
  letter-spacing: 0.5px !important;
  line-height: 1.2 !important;
}

.perf-drawer-title {
  margin: 0 !important;
  font-size: 0.92rem !important;
  font-weight: 700 !important;
  color: #f8fafc !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.2 !important;
  flex: 1 1 auto !important;
}

.drawer-header-right {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex-shrink: 0 !important;
}

.drawer-stats-pill {
  font-size: 0.68rem !important;
  font-family: 'Rajdhani', 'Vazirmatn', sans-serif !important;
  color: #94a3b8 !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  white-space: nowrap !important;
}

.perf-drawer-close {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: #94a3b8 !important;
  width: 24px !important;
  height: 24px !important;
  border-radius: 5px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  font-size: 11px !important;
}

.perf-drawer-close:hover {
  background: rgba(239, 68, 68, 0.25) !important;
  border-color: #ef4444 !important;
  color: #ffffff !important;
}

.perf-drawer-tabs {
  display: flex !important;
  gap: 3px !important;
  background: rgba(6, 10, 18, 0.75) !important;
  padding: 2px !important;
  border-radius: 6px !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  height: 30px !important;
  box-sizing: border-box !important;
}

.perf-drawer-tab {
  flex: 1 !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  border-radius: 4px !important;
  color: #94a3b8 !important;
  font-size: 0.73rem !important;
  font-weight: 600 !important;
  padding: 3px 5px !important;
  cursor: pointer !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
  transition: all 0.15s ease !important;
  white-space: nowrap !important;
}

.perf-drawer-tab:hover {
  color: #f1f5f9 !important;
  background: rgba(255, 255, 255, 0.04) !important;
}

.perf-drawer-tab.active {
  background: rgba(249, 115, 22, 0.2) !important;
  color: #ffedd5 !important;
  font-weight: 700 !important;
  border-color: rgba(249, 115, 22, 0.45) !important;
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.2) !important;
}'''

if old_drawer_css_pattern.search(style_css):
    style_css = old_drawer_css_pattern.sub(new_drawer_css, style_css)
    print("Successfully patched drawer header CSS in style.css")
else:
    print("Warning: old drawer header CSS not matched in style.css")

# Replace camera & convar CSS in style.css
old_camera_css_pattern = re.compile(
    r'/\* Camera & Visibility Switches \*/.*?\.camera-switch-def\s*\{.*?\}',
    re.DOTALL
)

new_camera_css = '''/* Camera & Visibility Switches (High-Density Sleek Rows) */
.camera-switches-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 5px !important;
}

.camera-switch-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  background: rgba(15, 23, 38, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  min-height: 42px !important;
  box-sizing: border-box !important;
  transition: border-color 0.15s ease, background-color 0.15s ease !important;
}

.camera-switch-row:hover {
  background: rgba(249, 115, 22, 0.06) !important;
  border-color: rgba(249, 115, 22, 0.3) !important;
}

.camera-switch-meta {
  display: flex !important;
  flex-direction: column !important;
  gap: 1px !important;
  flex: 1 !important;
  min-width: 0 !important;
}

.camera-switch-top-line {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.camera-switch-title {
  font-weight: 700 !important;
  font-size: 0.8rem !important;
  color: #f1f5f9 !important;
  line-height: 1.2 !important;
}

.camera-switch-def {
  font-size: 0.65rem !important;
  color: #64748b !important;
  font-family: var(--font-mono, monospace) !important;
}

.camera-switch-cvar {
  font-family: var(--font-mono, monospace) !important;
  font-size: 0.67rem !important;
  color: var(--deadlock-cyan) !important;
  line-height: 1.1 !important;
}

.camera-switch-row .neon-checkbox {
  transform: scale(0.85);
  transform-origin: right center;
  margin: 0 !important;
}'''

if old_camera_css_pattern.search(style_css):
    style_css = old_camera_css_pattern.sub(new_camera_css, style_css)
    print("Successfully patched camera switches CSS in style.css")
else:
    print("Warning: old camera switches CSS not matched in style.css")

# Replace convar editor CSS in style.css
old_editor_css_pattern = re.compile(
    r'/\* ConVar Editor \*/.*?\.convar-item-val-input\s*\{.*?\}',
    re.DOTALL
)

new_editor_css = '''/* ConVar Editor (High-Density Pro Inspector) */
.editor-search-bar {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: rgba(0, 0, 0, 0.45) !important;
  border: 1px solid rgba(249, 115, 22, 0.35) !important;
  border-radius: 6px !important;
  padding: 5px 10px !important;
  margin-bottom: 7px !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
}

.editor-search-bar:focus-within {
  border-color: var(--deadlock-orange) !important;
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.25) !important;
}

.editor-search-bar i {
  color: var(--deadlock-orange) !important;
  font-size: 11px !important;
}

.editor-search-bar input {
  flex: 1 !important;
  background: transparent !important;
  border: none !important;
  color: #f1f5f9 !important;
  font-size: 0.78rem !important;
  outline: none !important;
}

.editor-filter-chips {
  display: flex !important;
  gap: 5px !important;
  margin-bottom: 8px !important;
  overflow-x: auto !important;
}

.editor-chip {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 4px !important;
  color: #94a3b8 !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  padding: 2px 7px !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  transition: all 0.12s ease !important;
}

.editor-chip:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #f8fafc !important;
}

.editor-chip.active {
  background: rgba(249, 115, 22, 0.2) !important;
  border-color: rgba(249, 115, 22, 0.5) !important;
  color: #ffedd5 !important;
  font-weight: 700 !important;
}

.editor-convar-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.convar-row-item {
  background: rgba(15, 23, 38, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 6px !important;
  padding: 5px 9px !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 8px !important;
  min-height: 40px !important;
  box-sizing: border-box !important;
  transition: border-color 0.15s ease, background-color 0.15s ease !important;
}

.convar-row-item:hover {
  background: rgba(249, 115, 22, 0.06) !important;
  border-color: rgba(249, 115, 22, 0.3) !important;
}

.convar-item-left {
  display: flex !important;
  flex-direction: column !important;
  gap: 1px !important;
  flex: 1 !important;
  min-width: 0 !important;
}

.convar-top-line {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.convar-item-name {
  font-family: var(--font-mono, monospace) !important;
  font-weight: 700 !important;
  color: var(--deadlock-cyan) !important;
  font-size: 0.74rem !important;
  line-height: 1.2 !important;
}

.convar-item-def-badge {
  font-size: 0.64rem !important;
  color: #64748b !important;
  font-family: var(--font-mono, monospace) !important;
}

.convar-diff-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--deadlock-orange);
  box-shadow: 0 0 6px var(--deadlock-orange);
  display: inline-block;
}

.convar-item-desc {
  font-size: 0.68rem !important;
  color: #94a3b8 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.1 !important;
}

.convar-item-val-input {
  width: 48px !important;
  height: 24px !important;
  background: #06090e !important;
  border: 1px solid rgba(249, 115, 22, 0.4) !important;
  border-radius: 4px !important;
  color: #ffedd5 !important;
  font-family: var(--font-mono, monospace) !important;
  font-size: 0.76rem !important;
  font-weight: 700 !important;
  text-align: center !important;
  padding: 1px 4px !important;
  box-sizing: border-box !important;
  outline: none !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
}

.convar-item-val-input:focus {
  border-color: var(--deadlock-orange) !important;
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.4) !important;
}'''

if old_editor_css_pattern.search(style_css):
    style_css = old_editor_css_pattern.sub(new_editor_css, style_css)
    print("Successfully patched editor CSS in style.css")
else:
    print("Warning: old editor CSS not matched in style.css")

with open('d:/Claude/DLPBooster/ui/style.css', 'w', encoding='utf-8') as f:
    f.write(style_css)


# ==============================================================================
# 3. PATCH UI/APP.JS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Replace renderDrawer through resetDrawerOverrides
old_app_drawer_pattern = re.compile(
    r'function renderDrawer\(\)\s*\{.*?function resetDrawerOverrides\(\)\s*\{.*?renderDrawer\(\);\s*\}',
    re.DOTALL
)

new_app_drawer_code = '''function renderDrawer() {
  const p = getActivePreset();
  if (!p) return;

  const titleEl = document.getElementById('drawer-preset-title');
  const tierPill = document.getElementById('drawer-tier-pill');
  if (titleEl) {
    titleEl.textContent = p.name;
    titleEl.title = `${p.name} (by ${p.author || 'Community'} · ${p.license || 'GPL-3.0'})`;
  }
  if (tierPill) {
    tierPill.textContent = (p.tier || 'BALANCED').toUpperCase();
    tierPill.className = `drawer-tier-pill tier-${p.tier || 'balanced'}`;
  }

  // Ensure convarMap lookup table is populated
  if (perfState.catalog && Array.isArray(perfState.catalog.convars) && !perfState.convarMap) {
    perfState.convarMap = {};
    for (const c of perfState.catalog.convars) {
      if (c && c.name) perfState.convarMap[c.name.toLowerCase()] = c;
    }
  }

  renderCategoryBars(p);
  renderCameraSwitches(p);
  renderConvarEditor(p);
}

function renderCategoryBars(preset) {
  const container = document.getElementById('drawer-category-bars');
  if (!container || !perfState.catalog) return;
  container.innerHTML = '';

  const convarMap = perfState.convarMap || {};
  const catCounts = {};
  const entries = preset.entries || [];

  for (const e of entries) {
    if (e.path && e.path.length >= 2) {
      const cvarKey = e.path[1].toLowerCase();
      const meta = convarMap[cvarKey];
      const cat = (meta && meta.category) ? meta.category : 'other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }

  const isFa = document.documentElement.lang === 'fa';
  const categoryLabels = {
    shadows: isFa ? 'سایه‌ها و انسداد محیطی' : 'Shadows & Occlusion',
    particles: isFa ? 'افکت‌ها و ذرات فایت' : 'Particles & Combat FX',
    world: isFa ? 'مدل‌ها و جزییات جهان (LOD)' : 'World & Mesh LOD',
    physics: isFa ? 'فیزیک و اجساد هیروها' : 'Physics & Ragdolls',
    cpu: isFa ? 'پردازنده و زمان‌بندی رشته‌ها' : 'CPU & Threading',
    lighting: isFa ? 'نورپردازی و مه محیطی' : 'Lighting & Volumetrics',
    textures: isFa ? 'بافت‌ها و حافظه ویدیویی' : 'Textures & VRAM',
    postprocessing: isFa ? 'پردازش نهایی و رنگ' : 'Post-processing',
    audio: isFa ? 'سیستم صوتی' : 'Audio',
    interface: isFa ? 'رابط کاربری' : 'Interface',
    camera: isFa ? 'دوربین و فیلترهای بصری' : 'Camera & Filters',
    network: isFa ? 'شبکه و نت‌کد' : 'Network',
    other: isFa ? 'سایر تنظیمات انجین' : 'Other Engine',
  };

  const categoryIcons = {
    shadows: 'fa-moon',
    particles: 'fa-fire',
    world: 'fa-mountain',
    physics: 'fa-person-falling',
    cpu: 'fa-bolt',
    lighting: 'fa-lightbulb',
    textures: 'fa-layer-group',
    postprocessing: 'fa-wand-magic-sparkles',
    audio: 'fa-volume-high',
    interface: 'fa-desktop',
    camera: 'fa-eye',
    network: 'fa-wifi',
    other: 'fa-microchip',
  };

  const sortedCats = Object.keys(categoryLabels).sort((a, b) => (catCounts[b] || 0) - (catCounts[a] || 0));
  const maxVal = Math.max(...Object.values(catCounts), 1);

  for (const cat of sortedCats) {
    const count = catCounts[cat] || 0;
    if (count === 0) continue;
    const pct = Math.round((count / maxVal) * 100);

    const row = document.createElement('div');
    row.className = 'category-bar-row';
    row.innerHTML = `
      <div class="category-bar-left">
        <i class="fa-solid ${categoryIcons[cat] || 'fa-sliders'} category-bar-icon"></i>
        <span class="category-bar-label">${categoryLabels[cat] || cat}</span>
      </div>
      <div class="category-bar-track">
        <div class="category-bar-fill" style="width: ${pct}%"></div>
      </div>
      <span class="category-bar-count tabular-num">${count}</span>
    `;
    container.appendChild(row);
  }
}

function renderCameraSwitches(preset) {
  const container = document.getElementById('drawer-camera-switches');
  if (!container) return;
  container.innerHTML = '';

  const camSettings = [
    { key: 'citadel_trooper_glow_disabled', label: 'Hide Trooper Glow', desc: 'Disables outline glow on troopers', def: '0', val: '1' },
    { key: 'citadel_boss_glow_disabled', label: 'Hide Boss Glow', desc: 'Disables outline glow on Boss and Walkers', def: '0', val: '1' },
    { key: 'citadel_melee_shake_duration', label: 'Disable Melee Shake', desc: 'Removes camera screen shake during melee', def: '0.1', val: '0' },
    { key: 'citadel_camera_wobble_disable', label: 'Disable Camera Wobble', desc: 'Stabilizes camera motion during sprints', def: 'false', val: 'true' },
    { key: 'r_citadel_glow_health_bars', label: 'Health Bar Glow', desc: 'Glow effect on enemy health bars', def: '1', val: '0' },
    { key: 'citadel_unit_status_delta_decay_delay', label: 'Fast Damage Highlight', desc: 'Reduces delay before damage decay on health bar', def: '0.3', val: '0' },
    { key: 'cl_camera_fov_scale', label: 'FOV Scale On Abilities', desc: 'Prevents FOV distortion during hero dashes', def: '1', val: '0' },
    { key: 'mat_motion_blur_enabled', label: 'Disable Motion Blur', desc: 'Eliminates blur on high speed camera pans', def: '1', val: '0' },
  ];

  for (const item of camSettings) {
    const isOverridden = perfState.userOverrides[item.key] !== undefined;
    const currentVal = isOverridden ? perfState.userOverrides[item.key] : item.val;
    const isChecked = currentVal === '1' || currentVal === 'true';

    const row = document.createElement('div');
    row.className = 'camera-switch-row';
    row.innerHTML = `
      <div class="camera-switch-meta">
        <div class="camera-switch-top-line">
          <span class="camera-switch-title">${item.label}</span>
          <span class="camera-switch-def">Default: ${item.def}</span>
        </div>
        <span class="camera-switch-cvar">${item.key}</span>
      </div>
      <div class="neon-checkbox">
        <input type="checkbox" id="cam-${item.key}" ${isChecked ? 'checked' : ''} onchange="toggleCameraOverride('${item.key}', this.checked ? '${item.val}' : '${item.def}')">
        <div class="neon-checkbox__frame">
          <div class="neon-checkbox__box">
            <div class="neon-checkbox__check-container">
              <svg viewBox="0 0 24 24" class="neon-checkbox__check"><path d="M3,12.5l7,7L21,5"></path></svg>
            </div>
            <div class="neon-checkbox__glow"></div>
            <div class="neon-checkbox__borders"><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(row);
  }
}

function toggleCameraOverride(key, val) {
  perfState.userOverrides[key] = val;
  const countOverriddenEl = document.getElementById('count-overridden');
  if (countOverriddenEl) countOverriddenEl.textContent = Object.keys(perfState.userOverrides).length;
}

function toggleEngineSections(checked) {
  perfState.includeEngineSections = !!checked;
}

function onDrawerConvarSearch(query) {
  perfState.editorSearch = query.trim().toLowerCase();
  renderConvarEditor(getActivePreset());
}

function setDrawerEditorFilter(filter) {
  perfState.editorFilter = filter;
  document.querySelectorAll('.editor-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
  renderConvarEditor(getActivePreset());
}

function renderConvarEditor(preset) {
  const container = document.getElementById('drawer-convar-list');
  if (!container || !perfState.catalog) return;
  container.innerHTML = '';

  const convarMap = perfState.convarMap || {};
  const entries = preset.entries || [];
  let renderedCount = 0;
  let differsCount = 0;
  let overriddenCount = Object.keys(perfState.userOverrides).length;

  const countDiffersEl = document.getElementById('count-differs');
  const countOverriddenEl = document.getElementById('count-overridden');
  const countAllEl = document.getElementById('count-all');
  if (countAllEl) countAllEl.textContent = entries.length;
  if (countOverriddenEl) countOverriddenEl.textContent = overriddenCount;

  for (const e of entries) {
    if (!e.path || e.path.length < 2) continue;
    const cvarKey = e.path[1].toLowerCase();
    const meta = convarMap[cvarKey] || {};
    const defaultVal = meta.default !== undefined ? meta.default : 'default';
    const isDiff = e.value !== undefined && defaultVal !== 'default' && String(e.value) !== String(defaultVal);
    if (isDiff) differsCount++;

    const isOverridden = perfState.userOverrides[cvarKey] !== undefined;
    const currentVal = isOverridden ? perfState.userOverrides[cvarKey] : (e.value || '');
    const desc = meta.help || meta.description || meta.label || 'Performance tuning parameter';

    if (perfState.editorFilter === 'differs' && !isDiff) continue;
    if (perfState.editorFilter === 'overridden' && !isOverridden) continue;

    if (perfState.editorSearch) {
      if (!cvarKey.includes(perfState.editorSearch) && !desc.toLowerCase().includes(perfState.editorSearch)) {
        continue;
      }
    }

    renderedCount++;
    if (renderedCount > 100) continue;

    const row = document.createElement('div');
    row.className = 'convar-row-item';
    row.innerHTML = `
      <div class="convar-item-left">
        <div class="convar-top-line">
          <span class="convar-item-name">${cvarKey}</span>
          <span class="convar-item-def-badge">def: ${defaultVal}</span>
          ${isDiff ? '<span class="convar-diff-dot" title="Differs from default"></span>' : ''}
        </div>
        <div class="convar-item-desc">${desc}</div>
      </div>
      <div class="convar-item-right">
        <input type="text" class="convar-item-val-input tabular-num" value="${currentVal}" onchange="perfState.userOverrides['${cvarKey}'] = this.value; renderConvarEditor(getActivePreset());">
      </div>
    `;
    container.appendChild(row);
  }

  if (countDiffersEl) countDiffersEl.textContent = differsCount;
}

function resetDrawerOverrides() {
  perfState.userOverrides = {};
  renderDrawer();
}'''

if old_app_drawer_pattern.search(app_js):
    app_js = old_app_drawer_pattern.sub(new_app_drawer_code, app_js)
    print("Successfully patched render functions in app.js")
else:
    print("Warning: old render functions pattern not matched in app.js")

with open('d:/Claude/DLPBooster/ui/app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)

print("Codebase patching complete!")
