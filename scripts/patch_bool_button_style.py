import re

# ==============================================================================
# 1. UPDATE UI/STYLE.CSS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/style.css', 'r', encoding='utf-8') as f:
    style = f.read()

# Replace .cvar-bool-toggle styles with unified .convar-item-val-input.cvar-bool-btn styles
old_bool_css = re.compile(
    r'/\* Boolean ConVar Interactive Toggle Button \*/.*?\.cvar-bool-text\s*\{[^}]+\}',
    re.DOTALL
)

new_bool_css = '''/* Boolean ConVar Interactive Button - Exactly Same Style As Number Boxes */
.convar-item-val-input.cvar-bool-btn,
.cvar-bool-btn,
.cvar-bool-toggle {
  width: 60px !important;
  min-width: 60px !important;
  max-width: 60px !important;
  height: 25px !important;
  min-height: 25px !important;
  max-height: 25px !important;
  background: #06090e !important;
  border: 1px solid rgba(249, 115, 22, 0.4) !important;
  border-radius: 4px !important;
  font-family: 'Rajdhani', var(--font-mono, monospace) !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  text-align: center !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 1px 4px !important;
  box-sizing: border-box !important;
  outline: none !important;
  cursor: pointer !important;
  user-select: none !important;
  line-height: 1 !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease !important;
}

.convar-item-val-input.cvar-bool-btn:hover,
.cvar-bool-btn:hover,
.cvar-bool-toggle:hover {
  border-color: var(--deadlock-orange) !important;
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.45) !important;
}

.convar-item-val-input.cvar-bool-btn.is-true,
.cvar-bool-btn.is-true,
.cvar-bool-toggle.is-true {
  color: #ffedd5 !important;
  border-color: rgba(249, 115, 22, 0.4) !important;
}

.convar-item-val-input.cvar-bool-btn.is-true:hover,
.cvar-bool-btn.is-true:hover,
.cvar-bool-toggle.is-true:hover {
  color: #ffffff !important;
  border-color: var(--deadlock-orange) !important;
}

.convar-item-val-input.cvar-bool-btn.is-false,
.cvar-bool-btn.is-false,
.cvar-bool-toggle.is-false {
  color: #94a3b8 !important;
  border-color: rgba(249, 115, 22, 0.4) !important;
}

.convar-item-val-input.cvar-bool-btn.is-false:hover,
.cvar-bool-btn.is-false:hover,
.cvar-bool-toggle.is-false:hover {
  color: #e2e8f0 !important;
  border-color: var(--deadlock-orange) !important;
}'''

if old_bool_css.search(style):
    style = old_bool_css.sub(new_bool_css, style)
    print("Replaced old boolean toggle CSS in style.css")
else:
    style += '\n' + new_bool_css
    print("Appended new boolean toggle CSS in style.css")

with open('d:/Claude/DLPBooster/ui/style.css', 'w', encoding='utf-8') as f:
    f.write(style)


# ==============================================================================
# 2. UPDATE UI/APP.JS
# ==============================================================================
with open('d:/Claude/DLPBooster/ui/app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update controlHtml in renderConvarEditor
old_control_html_pattern = re.compile(
    r'<button type="button"\s*class="cvar-bool-toggle[^"]*"[^>]*>.*?<span class="cvar-bool-switch"></span>.*?<span class="cvar-bool-text">.*?</span>\s*</button>',
    re.DOTALL
)

new_control_html = '''<button type="button" 
          class="convar-item-val-input cvar-bool-btn ${isTrue ? 'is-true' : 'is-false'}" 
          onclick="toggleConvarBool('${cvarKey}')" 
          onwheel="handleBoolWheel(event, '${cvarKey}')"
          title="Click or scroll to toggle (currently ${isTrue ? 'true' : 'false'})">
          ${isTrue ? 'true' : 'false'}
        </button>'''

if old_control_html_pattern.search(app):
    app = old_control_html_pattern.sub(new_control_html, app)
    print("Updated boolean button HTML in app.js")

# Add handleBoolWheel
if 'function handleBoolWheel' not in app:
    app = app.replace(
        'function toggleConvarBool(cvarKey) {',
        '''function handleBoolWheel(e, cvarKey) {
  e.preventDefault();
  toggleConvarBool(cvarKey);
}

function toggleConvarBool(cvarKey) {'''
    )
    app += '\nwindow.handleBoolWheel = handleBoolWheel;\n'
    print("Added handleBoolWheel to app.js")

with open('d:/Claude/DLPBooster/ui/app.js', 'w', encoding='utf-8') as f:
    f.write(app)
