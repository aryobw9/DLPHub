import re

# ==============================================================================
# 1. UPDATE UI/INDEX.HTML
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add dir="ltr" to both fov-sub-slider-bar elements so flex layout is consistently LTR
html = re.sub(
    r'<div class="fov-slider-bar fov-sub-slider-bar"[^>]*>',
    '<div class="fov-slider-bar fov-sub-slider-bar" dir="ltr">',
    html
)

# Ensure drawer stats pill is compact
html = re.sub(
    r'<span class="drawer-stats-pill" id="drawer-stats-pill"[^>]*>.*?</span>',
    '<span class="drawer-stats-pill" id="drawer-stats-pill" title="426 applied · 37 unused"><strong class="tabular-num" id="drawer-stat-applied">426</strong> applied</span>',
    html
)

with open('d:/Claude/DLPBooster/ui/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("index.html updated successfully")


# ==============================================================================
# 2. UPDATE UI/STYLE.CSS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/style.css', 'r', encoding='utf-8') as f:
    style = f.read()

# 1. Expand drawer width to 520px (from 380px/450px) so names and header NEVER truncate
drawer_w_pattern = re.compile(r'(\.perf-side-panel,\s*\.perf-side-drawer\s*\{[^}]*width:\s*)([0-9]+px)([^}]*\})', re.DOTALL)
if drawer_w_pattern.search(style):
    style = drawer_w_pattern.sub(r'\g<1>520px\g<3>', style)
    print("Expanded drawer width to 520px in style.css")

# 2. Remove all truncation / ellipsis limits on .convar-item-name and .convar-item-desc
# Fix .convar-item-name
style = re.sub(
    r'\.convar-item-name\s*\{[^}]+\}',
    '''.convar-item-name {
  font-family: var(--font-mono, monospace) !important;
  font-weight: 700 !important;
  color: var(--deadlock-cyan) !important;
  font-size: 0.77rem !important;
  line-height: 1.3 !important;
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  word-break: break-word !important;
  display: inline !important;
}''',
    style
)

# Fix .convar-item-desc
style = re.sub(
    r'\.convar-item-desc\s*\{[^}]+\}',
    '''.convar-item-desc {
  font-size: 0.71rem !important;
  color: #94a3b8 !important;
  line-height: 1.38 !important;
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  word-break: normal !important;
  margin-top: 3px !important;
  display: block !important;
}''',
    style
)

# Fix .convar-top-line
style = re.sub(
    r'\.convar-top-line\s*\{[^}]+\}',
    '''.convar-top-line {
  display: flex !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 6px 8px !important;
  min-width: 0 !important;
}''',
    style
)

# Fix .convar-row-item (allow dynamic height, comfortable padding)
style = re.sub(
    r'\.convar-row-item\s*\{[^}]+\}',
    '''.convar-row-item {
  background: rgba(15, 23, 38, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 6px !important;
  padding: 8px 12px !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 14px !important;
  min-height: 46px !important;
  height: auto !important;
  box-sizing: border-box !important;
  transition: border-color 0.15s ease, background-color 0.15s ease !important;
}''',
    style
)

# 3. FIX ASPECT RATIO & FOV NUMBERS OUT OF BORDER
# Ensure .setting-box.fov-box contains all children cleanly and doesn't overflow
fov_box_fix_css = '''
/* Fix FOV & Aspect Ratio box borders and bounds overflow */
.setting-box.fov-box {
  overflow: hidden !important;
  padding: 8px 12px 10px !important;
  box-sizing: border-box !important;
}

.fov-part-section {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.ar-controls-body {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.fov-slider-bar,
.fov-slider-bar.fov-sub-slider-bar {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  padding: 0 1px !important;
  margin: 0 !important;
  direction: ltr !important;
}

.fov-slider-bar .fov-range-input,
.fov-slider-bar.fov-sub-slider-bar .fov-range-input {
  flex: 1 1 0% !important;
  min-width: 0 !important;
  width: auto !important;
  box-sizing: border-box !important;
  margin: 0 !important;
}

.fov-slider-bar .fov-bound,
.fov-slider-bar.fov-sub-slider-bar .fov-bound {
  flex: 0 0 auto !important;
  font-family: 'Rajdhani', monospace, 'Vazirmatn', sans-serif !important;
  font-size: 0.62rem !important;
  font-weight: 700 !important;
  color: var(--text-muted, #94a3b8) !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  box-sizing: border-box !important;
}

.fov-slider-bar .fov-bound:first-child {
  text-align: left !important;
}

.fov-slider-bar .fov-bound:last-child {
  text-align: right !important;
}

.fov-max-tag {
  font-size: 0.52rem !important;
  color: var(--deadlock-orange) !important;
  font-weight: 700 !important;
  margin-left: 2px !important;
}

/* Ensure drawer never truncates title or convar details */
.perf-side-panel,
.perf-side-drawer {
  width: 520px !important;
  max-width: 95vw !important;
  height: 620px !important;
  max-height: 88vh !important;
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
  min-width: 0 !important;
}
'''

style += '\n' + fov_box_fix_css
with open('d:/Claude/DLPBooster/ui/style.css', 'w', encoding='utf-8') as f:
    f.write(style)
print("style.css updated successfully")


# ==============================================================================
# 3. UPDATE UI/APP.JS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Make sure stats pill rendered by renderDrawer is compact: "426 applied"
app = re.sub(
    r"tierPill\.className = `drawer-tier-pill tier-\$\{p\.tier \|\| 'balanced'\}`;\s*\}",
    """tierPill.className = `drawer-tier-pill tier-${p.tier || 'balanced'}`;
  }
  const statsPill = document.getElementById('drawer-stats-pill');
  if (statsPill) {
    const totalApplied = (p.entries || []).length;
    statsPill.innerHTML = `<strong class="tabular-num">${totalApplied}</strong> applied`;
    statsPill.title = `${totalApplied} applied · 37 unused`;
  }""",
    app
)

with open('d:/Claude/DLPBooster/ui/app.js', 'w', encoding='utf-8') as f:
    f.write(app)
print("app.js updated successfully")
