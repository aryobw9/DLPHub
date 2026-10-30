import re

# ==============================================================================
# 1. UPDATE UI/INDEX.HTML
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update aspect ratio slider & bounds in index.html (max 3.20 instead of 3.50)
old_ar_slider_block = re.search(
    r'<div class="fov-slider-bar fov-sub-slider-bar">\s*<span class="fov-bound">1\.33</span>\s*<input type="range" id="ar-slider"[^>]+>\s*<span class="fov-bound">3\.50</span>\s*</div>',
    html
)
new_ar_slider_block = '''<div class="fov-slider-bar fov-sub-slider-bar">
                      <span class="fov-bound tabular-num">1.33</span>
                      <input type="range" id="ar-slider" min="1.33" max="3.20" step="0.01" value="2.15" class="fov-range-input" oninput="setAspectRatio(this.value)" />
                      <span class="fov-bound tabular-num">3.20 <span class="fov-max-tag">(MAX)</span></span>
                    </div>'''

if old_ar_slider_block:
    html = html.replace(old_ar_slider_block.group(0), new_ar_slider_block)
    print("Updated aspect ratio slider & bounds in index.html")
else:
    # Try alternate regex without strict bounds
    html = re.sub(
        r'<span class="fov-bound[^"]*">3\.50</span>',
        '<span class="fov-bound tabular-num">3.20 <span class="fov-max-tag">(MAX)</span></span>',
        html
    )
    html = re.sub(
        r'id="ar-slider"\s+min="1\.33"\s+max="3\.50"',
        'id="ar-slider" min="1.33" max="3.20"',
        html
    )
    print("Applied regex fallback for ar-slider in index.html")

# Update ar-input placeholder & tooltip
html = html.replace(
    'data-tooltip="Real aspect ratio number (e.g. 1.78, 2.15, 2.40)"',
    'data-tooltip="Aspect Ratio (1.33 - 3.20) · Scroll wheel or type numbers"'
)

# Update drawer stats badge to be compact so title never truncates
html = re.sub(
    r'<span class="drawer-stats-pill" id="drawer-stats-pill"[^>]*>.*?</span>',
    '<span class="drawer-stats-pill" id="drawer-stats-pill" title="426 applied · 37 unused"><strong class="tabular-num" id="drawer-stat-applied">426</strong> applied</span>',
    html
)

with open('d:/Claude/DLPBooster/ui/index.html', 'w', encoding='utf-8') as f:
    f.write(html)


# ==============================================================================
# 2. UPDATE UI/STYLE.CSS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/style.css', 'r', encoding='utf-8') as f:
    style = f.read()

# Update .ar-real-input styling
new_ar_input_css = '''.ar-real-input {
  width: 52px !important;
  min-width: 52px !important;
  max-width: 52px !important;
  height: 24px !important;
  min-height: 24px !important;
  max-height: 24px !important;
  padding: 0 4px !important;
  text-align: center;
  font-family: 'Rajdhani', monospace, sans-serif !important;
  font-size: 0.82rem !important;
  font-weight: 700;
  color: var(--deadlock-orange) !important;
  background: rgba(10, 15, 25, 0.9) !important;
  border: 1px solid rgba(249, 115, 22, 0.45) !important;
  border-radius: 4px;
  outline: none;
  font-variant-numeric: tabular-nums !important;
  cursor: ew-resize;
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.15);
  transition: all 0.15s ease;
}

.ar-real-input:focus,
.ar-real-input:hover {
  border-color: var(--deadlock-orange) !important;
  box-shadow: 0 0 12px rgba(249, 115, 22, 0.35);
  color: #ffffff !important;
}'''

style = re.sub(r'\.ar-real-input\s*\{[^}]+\}', new_ar_input_css, style, count=1)

# Ensure drawer width is 480px for unclipped title
style = re.sub(
    r'\.perf-side-panel,\s*\.perf-side-drawer\s*\{[^}]*width:\s*450px[^}]*\}',
    lambda m: m.group(0).replace('450px', '480px'),
    style
)

# ConVar Editor Boolean Toggle & Number Input Enhancements CSS
additional_cvar_css = '''
/* Boolean ConVar Interactive Toggle Button */
.cvar-bool-toggle {
  width: 72px;
  height: 26px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 7px 2px 6px;
  cursor: pointer;
  user-select: none;
  font-family: 'Rajdhani', monospace, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-sizing: border-box;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.cvar-bool-toggle.is-true {
  background: rgba(56, 189, 248, 0.15) !important;
  border: 1px solid rgba(56, 189, 248, 0.55) !important;
  color: #38bdf8 !important;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.25) !important;
}

.cvar-bool-toggle.is-true:hover {
  background: rgba(56, 189, 248, 0.25) !important;
  border-color: #38bdf8 !important;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.45) !important;
  color: #ffffff !important;
}

.cvar-bool-toggle.is-false {
  background: rgba(15, 23, 42, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #94a3b8 !important;
}

.cvar-bool-toggle.is-false:hover {
  background: rgba(30, 41, 59, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  color: #e2e8f0 !important;
}

.cvar-bool-switch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.cvar-bool-toggle.is-true .cvar-bool-switch {
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
}

.cvar-bool-toggle.is-false .cvar-bool-switch {
  background: #475569;
}

.cvar-bool-text {
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.convar-row-item {
  background: rgba(15, 23, 38, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 10px !important;
  min-height: 42px !important;
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
  gap: 2px !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.convar-top-line {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  min-width: 0 !important;
}

.convar-item-name {
  font-family: var(--font-mono, monospace) !important;
  font-weight: 700 !important;
  color: var(--deadlock-cyan) !important;
  font-size: 0.74rem !important;
  line-height: 1.2 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 230px !important;
  flex-shrink: 1 !important;
}

.convar-item-def-badge {
  font-size: 0.63rem !important;
  color: #64748b !important;
  font-family: var(--font-mono, monospace) !important;
  background: rgba(255, 255, 255, 0.04) !important;
  padding: 1px 4px !important;
  border-radius: 3px !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  flex-shrink: 0 !important;
}

.convar-diff-dot {
  width: 5px !important;
  height: 5px !important;
  border-radius: 50% !important;
  background: var(--deadlock-orange) !important;
  box-shadow: 0 0 6px var(--deadlock-orange) !important;
  display: inline-block !important;
  flex-shrink: 0 !important;
}

.convar-item-desc {
  font-size: 0.68rem !important;
  color: #94a3b8 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 320px !important;
  line-height: 1.1 !important;
}

.convar-item-right {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  width: 74px !important;
  flex-shrink: 0 !important;
}

.convar-item-val-input {
  width: 60px !important;
  height: 25px !important;
  background: #06090e !important;
  border: 1px solid rgba(249, 115, 22, 0.4) !important;
  border-radius: 4px !important;
  color: #ffedd5 !important;
  font-family: 'Rajdhani', var(--font-mono, monospace) !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  text-align: center !important;
  padding: 1px 4px !important;
  box-sizing: border-box !important;
  outline: none !important;
  cursor: ew-resize !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
}

.convar-item-val-input:focus {
  border-color: var(--deadlock-orange) !important;
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.45) !important;
  color: #ffffff !important;
}
'''

style += '\n' + additional_cvar_css
with open('d:/Claude/DLPBooster/ui/style.css', 'w', encoding='utf-8') as f:
    f.write(style)
print("Updated style.css with boolean toggles and high-density convar styles")


# ==============================================================================
# 3. UPDATE UI/APP.JS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update setAspectRatio clamp to [1.33, 3.20]
old_set_ar_pattern = re.compile(
    r'function setAspectRatio\(val,\s*persistSetting\s*=\s*true\)\s*\{.*?if\s*\(isNaN\(num\)[^}]*\}\s*else\s*\{[^}]*\}\s*state\.aspectRatio\s*=\s*str;',
    re.DOTALL
)

new_set_ar_code = '''function setAspectRatio(val, persistSetting = true) {
  let str = String(val !== undefined && val !== null ? val : '2.15').trim();
  let num = parseFloat(str);
  if (isNaN(num)) {
    num = 2.15;
  } else if (num < 1.33) {
    num = 1.33;
  } else if (num > 3.20) {
    num = 3.20;
  }
  str = num.toFixed(2);
  state.aspectRatio = str;'''

if old_set_ar_pattern.search(app):
    app = old_set_ar_pattern.sub(new_set_ar_code, app)
    print("Updated setAspectRatio clamp in app.js")

# Add AR Input interaction initializer (wheel & typing restriction)
ar_interaction_code = '''
function initArInputInteractions() {
  const input = document.getElementById('ar-input');
  if (!input || input._arWheelInit) return;
  input._arWheelInit = true;

  input.addEventListener('keydown', (e) => {
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
        (e.ctrlKey || e.metaKey)) {
      return;
    }
    if (e.key === '.' && !input.value.includes('.')) {
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  });

  input.addEventListener('input', () => {
    let val = input.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    input.value = val;
  });

  input.addEventListener('wheel', (e) => {
    e.preventDefault();
    let current = parseFloat(input.value);
    if (isNaN(current)) current = 2.15;
    const direction = e.deltaY < 0 ? 1 : -1;
    const step = e.shiftKey ? 0.05 : 0.01;
    let next = current + (direction * step);
    if (next < 1.33) next = 1.33;
    if (next > 3.20) next = 3.20;
    input.value = next.toFixed(2);
    setAspectRatio(input.value);
  }, { passive: false });
}
'''

# Update syncSettingsToUi to call initArInputInteractions
app = app.replace('updateFpsGlider();\n}', 'updateFpsGlider();\n  initArInputInteractions();\n}')

# Update renderConvarEditor with Boolean Toggles and Numeric Scroll/Validation
old_render_editor_pattern = re.compile(
    r'function renderConvarEditor\(preset\)\s*\{.*?function resetDrawerOverrides\(\)\s*\{',
    re.DOTALL
)

new_render_editor_code = '''function toggleConvarBool(cvarKey) {
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
}

function handleConvarInputKeydown(e, isFloat, minVal) {
  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      (e.ctrlKey || e.metaKey)) {
    return;
  }
  const minNum = minVal !== '' ? Number(minVal) : -Infinity;
  if (e.key === '-' && minNum < 0 && !e.target.value.includes('-') && e.target.selectionStart === 0) {
    return;
  }
  if (e.key === '.' && isFloat && !e.target.value.includes('.')) {
    return;
  }
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

function sanitizeConvarNumericInput(input, isFloat, minVal) {
  let val = input.value;
  const minNum = minVal !== '' ? Number(minVal) : -Infinity;
  if (isFloat) {
    val = val.replace(/[^0-9.-]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
  } else {
    val = val.replace(/[^0-9-]/g, '');
  }
  if (minNum >= 0) val = val.replace(/-/g, '');
  input.value = val;
}

function handleConvarInputWheel(e, input, cvarKey, isFloat, minVal, maxVal) {
  e.preventDefault();
  let current = isFloat ? parseFloat(input.value) : parseInt(input.value, 10);
  if (isNaN(current)) current = 0;
  
  const direction = e.deltaY < 0 ? 1 : -1;
  const step = isFloat ? (e.shiftKey ? 0.05 : 0.01) : (e.shiftKey ? 10 : 1);
  let next = current + (direction * step);
  
  let min = minVal !== '' ? Number(minVal) : -Infinity;
  let max = maxVal !== '' ? Number(maxVal) : Infinity;
  if (cvarKey === 'r_aspectratio') {
    if (min === -Infinity) min = 0;
    max = 3.20;
  }
  
  if (next < min) next = min;
  if (next > max) next = max;
  
  const formatted = isFloat ? next.toFixed(2) : String(Math.round(next));
  input.value = formatted;
  onConvarNumericChange(cvarKey, formatted, isFloat, minVal, maxVal);
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
    const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
    const isOverridden = perfState.userOverrides[cvarKey] !== undefined;
    const currentVal = isOverridden ? String(perfState.userOverrides[cvarKey]) : String(e.value || '');
    const desc = meta.help || meta.description || meta.label || 'Performance tuning parameter';

    // Determine type
    const isBool = meta.kind === 'bool' ||
                   currentVal.toLowerCase() === 'true' || currentVal.toLowerCase() === 'false' ||
                   defaultVal.toLowerCase() === 'true' || defaultVal.toLowerCase() === 'false';

    const isFloat = meta.kind === 'float' ||
                    currentVal.includes('.') || defaultVal.includes('.') ||
                    cvarKey === 'r_aspectratio' || cvarKey.includes('scale') || cvarKey.includes('duration');

    let minVal = meta.min !== undefined ? meta.min : '';
    let maxVal = meta.max !== undefined ? meta.max : '';
    if (cvarKey === 'r_aspectratio') {
      if (minVal === '') minVal = 0;
      maxVal = 3.20;
    }

    const isDiff = currentVal !== '' && defaultVal !== 'default' && currentVal.toLowerCase() !== defaultVal.toLowerCase();
    if (isDiff) differsCount++;

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

    let controlHtml = '';
    if (isBool) {
      const isTrue = currentVal.toLowerCase() === 'true';
      controlHtml = `
        <button type="button" 
          class="cvar-bool-toggle ${isTrue ? 'is-true' : 'is-false'}" 
          onclick="toggleConvarBool('${cvarKey}')" 
          title="Click to toggle (currently ${isTrue ? 'TRUE' : 'FALSE'})">
          <span class="cvar-bool-switch"></span>
          <span class="cvar-bool-text">${isTrue ? 'TRUE' : 'FALSE'}</span>
        </button>
      `;
    } else {
      controlHtml = `
        <input type="text" 
          class="convar-item-val-input tabular-num" 
          value="${currentVal}" 
          data-cvar="${cvarKey}"
          data-kind="${isFloat ? 'float' : 'int'}"
          data-min="${minVal}"
          data-max="${maxVal}"
          onchange="onConvarNumericChange('${cvarKey}', this.value, ${isFloat}, '${minVal}', '${maxVal}')"
          onwheel="handleConvarInputWheel(event, this, '${cvarKey}', ${isFloat}, '${minVal}', '${maxVal}')"
          onkeydown="handleConvarInputKeydown(event, ${isFloat}, '${minVal}')"
          oninput="sanitizeConvarNumericInput(this, ${isFloat}, '${minVal}')"
          title="Scroll up/down or type number (${minVal !== '' ? 'min ' + minVal : ''} ${maxVal !== '' ? 'max ' + maxVal : ''})"
        >
      `;
    }

    row.innerHTML = `
      <div class="convar-item-left">
        <div class="convar-top-line">
          <span class="convar-item-name" title="${cvarKey}">${cvarKey}</span>
          <span class="convar-item-def-badge">def: ${defaultVal}</span>
          ${isDiff ? '<span class="convar-diff-dot" title="Differs from default"></span>' : ''}
        </div>
        <div class="convar-item-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>
      </div>
      <div class="convar-item-right">
        ${controlHtml}
      </div>
    `;
    container.appendChild(row);
  }

  if (countDiffersEl) countDiffersEl.textContent = differsCount;
}

function resetDrawerOverrides() {'''

if old_render_editor_pattern.search(app):
    app = old_render_editor_pattern.sub(new_render_editor_code, app)
    print("Replaced renderConvarEditor with boolean toggles & scrollable inputs in app.js")

# Add window global exports
window_exports = '''
window.toggleConvarBool = toggleConvarBool;
window.onConvarNumericChange = onConvarNumericChange;
window.handleConvarInputKeydown = handleConvarInputKeydown;
window.sanitizeConvarNumericInput = sanitizeConvarNumericInput;
window.handleConvarInputWheel = handleConvarInputWheel;
window.initArInputInteractions = initArInputInteractions;
'''
app += '\n' + ar_interaction_code + '\n' + window_exports

with open('d:/Claude/DLPBooster/ui/app.js', 'w', encoding='utf-8') as f:
    f.write(app)
print("Updated app.js successfully")
