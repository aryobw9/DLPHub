// DLPHub app.js — IPC wiring, i18n, FOV control, install flow.
/* global I18N_FA, I18N_EN */
// window.__TAURI__ is injected asynchronously; NEVER destructure it at
// top level — one throw here kills every panel. Lazy access instead.
function getInvoke() {
  if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
    return window.__TAURI__.core.invoke;
  }
  if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
    return window.__TAURI_INTERNALS__.invoke;
  }
  if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
    return window.__TAURI__.invoke;
  }
  return null;
}

function call(cmd, args) {
  const inv = getInvoke();
  if (!inv) {
    console.warn('[IPC WARNING] invoke not available, command:', cmd);
    return Promise.reject(new Error('tauri ipc not ready'));
  }
  return inv(cmd, args).catch((err) => {
    console.error(`[IPC ERROR] ${cmd}:`, err);
    return Promise.reject(err);
  });
}

// ---------- state ----------
const state = {
  lang: 'fa',
  unlocked: false,
  lastPath: null,
  gamePath: null,
  fov: 90,
  selectedMode: null,
  detectedTier: null,
  running: false,
  unitStatusNew: false,
  fpsMax: 0,
  renderer: 'default',
  customAutoexec: '',
  lastValvePings: null,
  activeTab: 'graphic',
  busyTab: null,
};



const SECTION_TITLES = {
  graphic: 'presetsTitle',
  latency: 'cardLatency',
  advanced: 'cardAdvanced',
};
const PANELS = ['graphic', 'latency', 'advanced'];

const HERO_BY_TAB = {
  graphic: { en: 'GRAPHICS CONFIG', fa: 'پیکربندی گرافیک', sub_en: 'Custom FPS boost configuration for deadlock', sub_fa: 'تنظیمات اختصاصی افزایش فریم برای ددلاک' },
  latency: { en: 'NETWORK', fa: 'شبکه', sub_en: 'Server latency & connection diagnostics', sub_fa: 'تشخیص تأخیر و کیفیت اتصال' },
  advanced: { en: 'ADVANCED', fa: 'پیشرفته', sub_en: 'Advanced settings & Data restoration', sub_fa: 'تنظیمات پیشرفته و بازگردانی اطلاعات' },
};

// ---------- i18n ----------
function t(key) {
  return (state.lang === 'en' ? window.I18N_EN : window.I18N_FA)[key] || key;
}

function applyLang() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = 'ltr'; // layout stays LTR — only text content flips RTL
  
  
  document.body.classList.toggle('lang-fa', state.lang === 'fa');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
    el.classList.toggle('i18n-rtl', state.lang === 'fa');
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-tooltip]').forEach((el) => {
    el.setAttribute('data-tooltip', t(el.dataset.i18nTooltip));
  });

  
  const currentTab = state.activeTab || 'graphic';
  const hero = HERO_BY_TAB[currentTab];
  if (hero) {
    const accent = document.querySelector('.header-subtitle-accent');
    const sub = document.querySelector('.header-title-fa');
    if (accent) accent.textContent = hero[state.lang === 'fa' ? 'fa' : 'en'];
    if (sub) sub.textContent = state.lang === 'fa' ? hero.sub_fa : hero.sub_en;
  }
  const secTitle = document.getElementById('section-title');
  if (secTitle) {
    secTitle.textContent = t(SECTION_TITLES[currentTab] || 'presetsTitle');
  }

  
  refreshRunning();
  const u = document.getElementById('unlock-input');
  const p = document.getElementById('path-input');
  const lbl = document.getElementById('lang-label');
  if (lbl) lbl.textContent = t('langToggle');
  if (u) u.placeholder = t('unlockPlaceholder');
  if (p) p.placeholder = t('pathPlaceholder');
  renderBackups();
  renderActiveBadge();
  if (pingingActive) {
    const lbl = document.querySelector('.latency-loading-content .dlp-load-label');
    if (lbl) lbl.textContent = t('pingTesting').replace(/\.{2,}$/, '');
  } else if (state.lastValvePings) {
    renderValvePings(state.lastValvePings);
  }
  if (!isLangSwitching) {
    setTimeout(() => {
      updateRendererGlider();
      updateFpsGlider();
    }, 20);
  }
}

let isLangSwitching = false;

function setLang(targetLang) {
  if (isLangSwitching || targetLang === state.lang) return;
  const transitionClass = targetLang === 'fa' ? 'to-fa' : 'to-en';

  isLangSwitching = true;
  const btnToggle = document.getElementById('btn-lang-toggle');
  if (btnToggle) btnToggle.style.pointerEvents = 'none';

  document.body.classList.remove('to-fa', 'to-en', 'lang-transitioning', 'lang-revealing');
  document.body.classList.add('lang-transitioning', transitionClass);

  setTimeout(() => {
    state.lang = targetLang;
    call('set_settings', { patch: { lang: targetLang } }).catch(() => {});
    applyLang();
  }, 1800);

  setTimeout(() => {
    document.body.classList.remove('lang-transitioning');
    document.body.classList.add('lang-revealing', transitionClass);

    setTimeout(() => {
      updateRendererGlider();
      updateFpsGlider();
    }, 500);

    setTimeout(() => {
      document.body.classList.remove('lang-revealing', 'to-fa', 'to-en');
      updateRendererGlider();
      updateFpsGlider();
      if (btnToggle) btnToggle.style.pointerEvents = '';
      isLangSwitching = false;
    }, 2000);
  }, 2000);
}

function toggleLang() {
  setLang(state.lang === 'fa' ? 'en' : 'fa');
}

window.addEventListener('resize', () => {
  updateRendererGlider();
  updateFpsGlider();
});

// ---------- fatal-error surface (never silent) ----------
function fatal(err) {
  console.error('[DLPHub fatal]', err);
  let d = document.getElementById('dlp-fatal-banner');
  if (!d && document.body) {
    d = document.createElement('pre');
    d.id = 'dlp-fatal-banner';
    d.style.cssText = 'color:#f87171;background:#180608;border:1px solid #dc2626;padding:12px;margin:10px;border-radius:8px;direction:ltr;text-align:left;white-space:pre-wrap;font-size:12px;position:fixed;bottom:10px;left:10px;right:10px;z-index:99999;box-shadow:0 0 20px rgba(220,38,38,0.5)';
    document.body.appendChild(d);
  }
  if (d) d.textContent = 'app.js error: ' + ((err && err.stack) || err);
}

// ---------- boot ----------
async function boot() {
  for (let i = 0; i < 50 && !getInvoke(); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const inv = getInvoke();
  console.log('[boot] IPC connection:', inv ? 'READY' : 'UNAVAILABLE');

  let s = {};
  try { s = await call('get_settings'); } catch (e) { console.warn('[boot] get_settings failed:', e); }
  state.lang = s.lang || 'fa';
  state.unlocked = !!s.unlocked;
  state.lastPath = s.last_path || null;
  state.unitStatusNew = !!s.unit_status_new;
  state.fpsMax = s.fps_max;
  state.customAutoexec = s.custom_autoexec || '';
  state.renderer = s.renderer || 'default';

  applyLang();
  syncSettingsToUi();
  setFov(typeof s.fov === 'number' && s.fov >= 70 && s.fov <= 120 ? s.fov : 90);
  selectCardByKey('graphic');

  if (state.unlocked) showTesterModes();

  try {
    if (await call('running_from_pkg')) {
      showModal(t('guardTitle'), t('tempPkgTitle'), [{ label: t('ok') }]);
    }
  } catch (e) { /* non-fatal */ }

  await refreshGame();

  setTimeout(async () => {
    try {
      const up = await call('check_for_updates');
      if (up && up.should_update) {
        const go = await showModal(t('updateTitle'), `${t('updateAvailable')}: ${up.version}`, [
          { label: t('ok'), value: true, kind: 'apply' },
          { label: t('guardCancel'), value: false },
        ]);
        if (go) {
          if (window.__OPEN_URL__) {
            window.__OPEN_URL__('https://github.com/aryobw9/DLPHub/releases/latest');
          } else {
            window.open('https://github.com/aryobw9/DLPHub/releases/latest', '_blank');
          }
        }
      }
    } catch (_) {}
  }, 4000);
}

function syncSettingsToUi() {
  const swUnit = document.getElementById('sw-unit-status');
  if (swUnit) swUnit.checked = !!state.unitStatusNew;

  const fps = state.fpsMax;
  document.querySelectorAll('#fps-radio-group .renderer-pill').forEach((btn) => {
    if (fps === null || fps === undefined || fps === 'DEFAULT') {
      btn.classList.toggle('active', btn.dataset.fps === 'DEFAULT');
    } else {
      btn.classList.toggle('active', btn.dataset.fps === String(fps));
    }
  });

  const renderer = state.renderer || 'default';
  document.querySelectorAll('#renderer-radio-group .renderer-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.renderer === renderer);
  });
  updateRendererGlider();
  updateFpsGlider();
}

function updateRendererGlider() {
  const group = document.getElementById('renderer-radio-group');
  const glider = document.getElementById('renderer-glider');
  if (!group || !glider) return;
  const activeBtn = group.querySelector('.renderer-pill.active');
  if (!activeBtn) {
    glider.style.opacity = '0';
    return;
  }
  glider.style.opacity = '1';
  glider.style.width = `${activeBtn.offsetWidth}px`;
  glider.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

function updateFpsGlider() {
  const group = document.getElementById('fps-radio-group');
  const glider = document.getElementById('fps-glider');
  if (!group || !glider) return;
  const activeBtn = group.querySelector('.renderer-pill.active');
  if (!activeBtn) {
    glider.style.opacity = '0';
    return;
  }
  glider.style.opacity = '1';
  glider.style.width = `${activeBtn.offsetWidth}px`;
  glider.style.height = `${activeBtn.offsetHeight}px`;
  glider.style.transform = `translate(${activeBtn.offsetLeft}px, ${activeBtn.offsetTop}px)`;
}

function selectFps(val) {
  if (val === 'DEFAULT' || val === null || val === undefined || val === '') {
    state.fpsMax = null;
    document.querySelectorAll('#fps-radio-group .renderer-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fps === 'DEFAULT');
    });
    updateFpsGlider();
    call('set_settings', { patch: { fps_max: -1 } }).catch(() => {});
  } else {
    const num = Number(val) || 0;
    state.fpsMax = num;
    document.querySelectorAll('#fps-radio-group .renderer-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fps === String(num));
    });
    updateFpsGlider();
    call('set_settings', { patch: { fps_max: num } }).catch(() => {});
  }
}

function selectRenderer(mode) {
  state.renderer = mode;
  document.querySelectorAll('#renderer-radio-group .renderer-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.renderer === mode);
  });
  updateRendererGlider();
  call('set_settings', { patch: { renderer: mode } }).catch(() => {});
}

async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

async function copyLaunchOpt(text, btn) {
  try {
    await copyToClipboard(text);
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = `<code><i class="fa-solid fa-check"></i> ${text}</code>`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = origHtml;
      }, 1200);
    }
  } catch (err) {
    console.error('Failed to copy launch option:', err);
  }
}


async function refreshGame() {
  try {
    const forcePick = window.location.hash === '#pickgame'
      || (typeof localStorage !== 'undefined' && localStorage.getItem('DLPB_DEBUG_FORCE_PICK') === '1');
    const found = forcePick ? null : await call('find_game');
    if (found) {
      state.gamePath = found.deadlock;
      document.getElementById('nogame-panel').style.display = 'none';
      document.getElementById('main-ui').style.display = 'block';
      call('set_settings', { patch: { last_path: found.deadlock } }).catch(() => {});
    } else if (state.lastPath && await call('pick_game', { path: state.lastPath })) {
      state.gamePath = state.lastPath;
      document.getElementById('nogame-panel').style.display = 'none';
      document.getElementById('main-ui').style.display = 'block';
    } else {
      state.gamePath = null;
      document.getElementById('nogame-panel').style.display = 'block';
      if (state.lastPath) document.getElementById('path-input').value = state.lastPath;
    }
  } catch (e) {
    document.getElementById('nogame-panel').style.display = 'block';
  }
  updateDetectBadge();
  refreshRunning();
}

async function refreshRunning() {
  try {
    const running = (await call('check_running')).length > 0;
    state.running = running;
    const btn = document.getElementById('btn-launch');
    if (btn) {
      btn.classList.toggle('running', running);
      btn.dataset.running = running ? '1' : '';
      const label = btn.querySelector('[data-i18n="launch"]');
      if (label) label.textContent = running ? t('launchRunning') : t('launch');
    }
  } catch (e) { /* non-fatal */ }
}

// ---------- locate game ----------
async function pickFolder() {
  try {
    let dir = null;
    const dlg = window.__TAURI__ && window.__TAURI__.dialog;
    if (dlg && dlg.open) {
      dir = await dlg.open({ directory: true, title: t('locate') });
    } else {
      dir = await call('plugin:dialog|open', { options: { directory: true, title: t('locate') } });
    }
    if (dir) {
      document.getElementById('path-input').value = Array.isArray(dir) ? dir[0] : dir;
    }
  } catch (e) {
    console.warn('[pickFolder failed]', e);
  }
}

async function confirmPath() {
  const p = document.getElementById('path-input').value.trim();
  if (!p) return;
  const ok = await call('pick_game', { path: p });
  if (ok) {
    state.gamePath = ok.deadlock;
    call('set_settings', { patch: { last_path: ok.deadlock } }).catch(() => {});
    document.getElementById('nogame-panel').style.display = 'none';
    document.getElementById('main-ui').style.display = 'block';
    updateDetectBadge();
    refreshRunning();
  } else {
    showModal(t('locate'), t('locateDesc'), [{ label: t('ok') }]);
  }
}

// ---------- detect badge ----------
function renderActiveBadge() {
  const apDot = document.getElementById('active-dot');
  const apLabel = document.getElementById('active-profile-label');
  const res = state.detectedTier;
  if (!apLabel) return;
  if (res === 'T1' || res === 'T2' || res === 'T3' || res === 'POTATO' || res === 'T1MODS' || res === 'T2MODS') {
    if (apDot) { apDot.style.background = 'var(--deadlock-orange)'; apDot.style.color = 'var(--deadlock-orange)'; }
    apLabel.textContent = t('activeProfile') + ' · ' + res;
  } else if (res === 'MISSING') {
    if (apDot) { apDot.style.background = 'var(--text-muted)'; apDot.style.color = 'var(--text-muted)'; }
    apLabel.textContent = t('currentMissing');
  } else if (res) {
    if (apDot) { apDot.style.background = 'var(--deadlock-cyan)'; apDot.style.color = 'var(--deadlock-cyan)'; }
    apLabel.textContent = t('currentUnknown');
  } else {
    if (apDot) { apDot.style.background = 'var(--text-muted)'; apDot.style.color = 'var(--text-muted)'; }
    apLabel.textContent = t('activeProfile') + ' · —';
  }
}

async function updateDetectBadge() {
  if (!state.gamePath) return;
  const cit = state.gamePath.replace(/[\\/]+$/, '') + '\\game\\citadel';
  let res;
  try { res = await call('detect_tier_cmd', { citadel: cit }); } catch (e) { return; }
  state.detectedTier = res;
  renderActiveBadge();
}

// ---------- install flow ----------
function stepLine(text, cls) {
  const log = document.getElementById('step-log');
  const div = document.createElement('div');
  div.textContent = text;
  if (cls) div.className = cls;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------- cursor states & virtual cursor follower ----------
// Chromium enforces a security restriction that forces any CSS cursor: url()
// to revert to the system cursor whenever the cursor image intersects the window
// boundary (edges/corners). The DOM follower below completely bypasses this
// limitation by rendering right up to the 0th pixel of the viewport without ever
// reverting to standard Windows cursors.
const CURSOR_HOTSPOTS = {
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
};

let updateCursorFollower = () => {};

(function setupCursorStates() {
  const root = document.documentElement;

  Object.values(CURSOR_HOTSPOTS).forEach((c) => {
    const img = new Image();
    img.src = c.file;
  });

  let cursorEl = document.getElementById('dlp-custom-cursor');
  let cursorInner = document.getElementById('dlp-custom-cursor-inner');
  if (!cursorEl) {
    cursorEl = document.createElement('div');
    cursorEl.id = 'dlp-custom-cursor';
    cursorInner = document.createElement('div');
    cursorInner.id = 'dlp-custom-cursor-inner';
    cursorEl.appendChild(cursorInner);
    const mount = () => {
      if (!document.getElementById('dlp-custom-cursor') && document.body) {
        document.body.appendChild(cursorEl);
      }
    };
    if (document.body) mount();
    else window.addEventListener('DOMContentLoaded', mount);
  } else if (!cursorInner) {
    cursorInner = document.createElement('div');
    cursorInner.id = 'dlp-custom-cursor-inner';
    cursorEl.appendChild(cursorInner);
  }

  let currentType = '';
  let isMouseIn = false;
  let lastX = -100, lastY = -100;
  let rightTimer = null;

  function setCursorType(type) {
    if (!CURSOR_HOTSPOTS[type]) type = 'default';
    if (currentType === type) return;
    currentType = type;
    const meta = CURSOR_HOTSPOTS[type];
    cursorEl.style.width = (meta.w || 64) + 'px';
    cursorEl.style.height = (meta.h || 64) + 'px';
    cursorInner.style.backgroundImage = `url("${meta.file}")`;
    if (type === 'busy') {
      cursorEl.classList.add('is-spinning');
    } else {
      cursorEl.classList.remove('is-spinning');
    }
  }

  function render(x, y) {
    const meta = CURSOR_HOTSPOTS[currentType] || CURSOR_HOTSPOTS.default;
    cursorEl.style.transform = `translate3d(${x - meta.x}px, ${y - meta.y}px, 0)`;
  }

  function isUsableInteractive(t) {
    if (!(t instanceof Element)) return false;
    const btn = t.closest('button, [role="button"], a, [data-url], .win-ctl, .lang-pill-btn, .pro-card, .sci-card, select, .hud-switch-card, .neon-checkbox, .option-item, .tier-card, .social-card, [onclick]');
    if (!btn) return false;
    if (btn.matches('button:disabled, [disabled], [aria-disabled="true"], .disabled')) return false;
    return true;
  }

  function determineCursor(t) {
    if (root.classList.contains('right-click')) return 'click_right';

    const isBusyNow = state.busyTab && (state.busyTab === 'global' || state.busyTab === state.activeTab);
    if (isBusyNow) {
      if (isUsableInteractive(t)) {
        return root.classList.contains('is-pressed') ? 'click' : 'pointer';
      }
      return 'busy';
    }

    if (t instanceof Element && t.closest('.action-footer, #action-footer, .active-profile, .step-log')) {
      if (t.closest('button, [role="button"], .btn-apply, .btn-reset')) {
        return root.classList.contains('is-pressed') ? 'click' : 'pointer';
      }
      return 'default';
    }

    if (t instanceof Element) {
      if (t.closest('input[type="range"]')) {
        return root.classList.contains('is-pressed') ? 'grab' : 'pointer';
      }
      if (t.closest('input[type="text"], input[type="password"], textarea, .path-input, .step-log')) {
        return 'text';
      }
      if (t.closest('.social-card, a, [data-url]')) {
        return 'link';
      }
      if (t.closest('button, [role="button"], select, .option-item, .tier-card, .pro-card, .win-ctl, .btn-play, .lang-pill-btn, .neon-checkbox, .hud-switch-wrap, .btn-apply, .btn-reset, .btn-refresh-ping-top, .border-beam, [onclick]')) {
        return root.classList.contains('is-pressed') ? 'click' : 'pointer';
      }
      if (t.closest('.app-titlebar, .titlebar-drag-spacer, .brand-meta, [data-tauri-drag-region]')) {
        return 'move';
      }
      if (t.closest('.hint-trigger, .hint-tooltip, [title]:not(button):not(a):not(input):not(.social-card):not(.win-ctl)')) {
        return 'help';
      }
    }

    if (root.classList.contains('is-pressed')) return 'click';

    const edge = root.getAttribute('data-edge');
    if (edge) {
      if (edge === 'nw' || edge === 'se') return 'nwse-resize';
      if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
      if (edge === 'n' || edge === 's') return 'ns-resize';
      if (edge === 'w' || edge === 'e') return 'ew-resize';
    }

    return 'default';
  }

  updateCursorFollower = (target, x, y) => {
    if (typeof x === 'number') { lastX = x; lastY = y; }
    const type = determineCursor(target || (document.elementFromPoint ? document.elementFromPoint(lastX, lastY) : null));
    setCursorType(type);
    render(lastX, lastY);
  };

  window.addEventListener('mousemove', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (!isMouseIn) {
      isMouseIn = true;
      cursorEl.style.display = 'block';
    }
    const type = determineCursor(e.target);
    setCursorType(type);
    render(lastX, lastY);
  }, { passive: true });

  window.addEventListener('mousedown', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.button === 2) {
      root.classList.add('right-click');
      clearTimeout(rightTimer);
      rightTimer = setTimeout(() => {
        root.classList.remove('right-click');
        updateCursorFollower(null, lastX, lastY);
      }, 400);
    } else if (e.button === 0) {
      root.classList.add('is-pressed');
    }
    updateCursorFollower(e.target, lastX, lastY);
  });

  const release = (e) => {
    root.classList.remove('is-pressed');
    root.classList.remove('right-click');
    if (e && typeof e.clientX === 'number') {
      updateCursorFollower(e.target, e.clientX, e.clientY);
    } else {
      updateCursorFollower(null, lastX, lastY);
    }
  };

  window.addEventListener('mouseup', release);
  window.addEventListener('blur', () => {
    release();
    isMouseIn = false;
    cursorEl.style.display = 'none';
  });
  document.addEventListener('mouseleave', () => {
    release();
    isMouseIn = false;
    cursorEl.style.display = 'none';
  });
  document.addEventListener('mouseenter', () => {
    isMouseIn = true;
    cursorEl.style.display = 'block';
  });
  window.addEventListener('contextmenu', () => {
    root.classList.remove('right-click');
    updateCursorFollower(null, lastX, lastY);
  });

  setCursorType('default');
})();

function setBusyCursor(on, tabKey) {
  state.busyTab = on ? (tabKey || state.activeTab || 'global') : null;
  document.documentElement.classList.toggle('is-busy', !!on);
  updateCursorFollower();
}

async function doInstall() {
  if (!state.gamePath) { showModal(t('locate'), t('noGame'), [{ label: t('ok') }]); return; }
  if (!state.selectedMode) {
    state.selectedMode = 'T1';
    const card = document.querySelector('.option-item.preset[data-mode="T1"]');
    if (card) card.classList.add('selected');
  }

  try {
    const running = await call('check_running');
    if (running.length > 0) {
      showModal(t('guardTitle'), t('guardBody'), [{ label: t('ok') }]);
      return;
    }
  } catch (e) { /* guard check failed — backend re-checks anyway */ }

  const btn = document.getElementById('btn-install');
  btn.disabled = true;
  setBusyCursor(true, 'graphic');
  document.getElementById('step-log').innerHTML = '';
  stepLine(t('working'));

  const reassuranceMsgs = [
    t('reassurance1') || 'Applying optimization packages...',
    t('reassurance2') || 'Still working — configuring graphics and game configs...',
    t('reassurance3') || 'Almost done — syncing settings with Deadlock...',
    t('reassurance4') || 'Finalizing files — process is active and running...',
  ];
  let reassuranceIdx = 0;
  const startTime = Date.now();
  const reassuranceTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed >= 10 && (elapsed - 10) % 5 === 0) {
      const msg = reassuranceMsgs[reassuranceIdx % reassuranceMsgs.length];
      reassuranceIdx++;
      stepLine(`⏳ ${msg} (${elapsed}s)`);
    }
  }, 1000);

  try {
    const log = await call('install_mode', {
      mode: state.selectedMode,
      fov: state.fov,
      path: state.gamePath,
    });
    clearInterval(reassuranceTimer);
    document.getElementById('step-log').innerHTML = '';
    for (const l of log) stepLine(`[${l.step}] ${l.detail} ${l.skipped ? '— ' + t('stepSkip') : '— ' + t('stepDone')}`, l.skipped ? 'skip' : 'ok');
    showModal(t('doneTitle'), t('doneBody'), [{ label: 'OK', kind: 'apply' }]);
  } catch (e) {
    clearInterval(reassuranceTimer);
    document.getElementById('step-log').innerHTML = '';
    stepLine(String(e), 'skip');
    const msg = String(e).includes('NeedsAdmin') ? t('needsAdmin') : String(e);
    showModal(t('guardTitle'), msg, [{ label: t('ok') }]);
  } finally {
    clearInterval(reassuranceTimer);
    setBusyCursor(false, 'graphic');
    btn.disabled = false;
    updateDetectBadge();
  }
}

// ---------- backup ----------
async function doBackupNow() {
  setBusyCursor(true, 'advanced');
  try {
    const name = await call('do_backup_cmd', { path: state.gamePath || '' });
    stepLine(`[backup] ${name}`, 'ok');
    renderBackups();
  } catch (e) {
    showModal('BACKUP & RESTORE', String(e), [{ label: 'OK' }]);
  } finally {
    setBusyCursor(false, 'advanced');
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function renderBackups() {
  const list = document.getElementById('backup-list');
  if (!list) return;
  let items = [];
  try { items = await call('list_backups'); } catch (e) { return; }
  list.innerHTML = '';
  if (!items || items.length === 0) {
    const d = document.createElement('div');
    d.className = 'option-detail';
    d.textContent = t('noBackups');
    list.appendChild(d);
    return;
  }
  for (const b of items) {
    const n = b.name;
    const row = document.createElement('div');
    row.className = 'backup-row';

    const info = document.createElement('div');
    info.className = 'backup-meta';
    info.style.display = 'flex';
    info.style.alignItems = 'center';
    info.style.gap = '8px';

    const name = document.createElement('span');
    name.className = 'backup-name';
    name.textContent = n;
    info.appendChild(name);

    const isMain = !!b.is_main || (items.length > 0 && b === items[items.length - 1] && !items.some((x) => x.is_main));

    if (b.size_bytes !== undefined && b.size_bytes > 0) {
      const size = document.createElement('span');
      size.className = 'backup-size';
      size.textContent = formatBytes(b.size_bytes);
      info.appendChild(size);
    }

    if (isMain) {
      const badge = document.createElement('span');
      badge.className = 'backup-badge-main';
      badge.textContent = t('mainBackupBadge') || 'Main Backup';
      info.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'backup-actions';

    const btnRestore = document.createElement('button');
    btnRestore.className = 'btn-apply btn-restore';
    btnRestore.textContent = t('restore');
    btnRestore.onclick = async () => {
      try {
        const running = await call('check_running');
        if (running.length > 0) {
          showModal(t('guardTitle') || 'Game Running', t('guardBody') || 'Deadlock is currently running.', [{ label: t('ok') || 'OK' }]);
          return;
        }
      } catch (e) { /* non-fatal */ }
      const go = await showModal(t('restoreTitle') || 'RESTORE BACKUP', t('confirmRestore'), [
        { label: t('restore'), value: true, kind: 'apply' },
        { label: t('guardCancel') || 'Cancel', value: false },
      ]);
      if (!go) return;
      setBusyCursor(true, 'advanced');
      try {
        const rep = await call('do_restore', { name: n, path: state.gamePath || '' });
        stepLine(`[restore] ${n} — ${rep.removed_addons.length} addons removed`, 'ok');
        updateDetectBadge();
      } catch (e) {
        showModal(t('restoreTitle') || 'RESTORE BACKUP', String(e), [{ label: t('ok') || 'OK' }]);
      } finally {
        setBusyCursor(false, 'advanced');
      }
    };

    actions.appendChild(btnRestore);

    if (!isMain) {
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-delete-backup';
      btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
      btnDel.dataset.tooltip = t('deleteBackup');
      btnDel.onclick = async () => {
        const go = await showModal(t('deleteBackup'), t('confirmDeleteBackup'), [
          { label: t('deleteBackup'), value: true, kind: 'danger' },
          { label: t('guardCancel') || 'Cancel', value: false },
        ]);
        if (!go) return;
        setBusyCursor(true, 'advanced');
        try {
          await call('delete_backup_cmd', { name: n });
          stepLine(`[delete] ${n}`, 'ok');
          renderBackups();
        } catch (e) {
          showModal(t('deleteBackup'), String(e), [{ label: t('ok') || 'OK' }]);
        } finally {
          setBusyCursor(false, 'advanced');
        }
      };
      actions.appendChild(btnDel);
    }

    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

async function checkForUpdates() {
  const btn = document.getElementById('btn-check-updates');
  const icon = btn ? btn.querySelector('i') : null;
  if (btn) {
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
  }
  if (icon) icon.classList.add('fa-spin');
  document.body.style.cursor = 'wait';

  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), 7000);
    });

    const checkPromise = (async () => {
      try {
        return await call('check_for_updates');
      } catch (e) {
        if (window.__TAURI__ && window.__TAURI__.updater && typeof window.__TAURI__.updater.check === 'function') {
          return await window.__TAURI__.updater.check();
        }
        return null;
      }
    })();

    const update = await Promise.race([checkPromise, timeoutPromise]);

    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise((r) => setTimeout(r, 800 - elapsed));
    }

    if (update && (update.should_update || update.available)) {
      const ver = update.version || '';
      const go = await showModal(t('updateTitle'), `${t('updateAvailable')}: ${ver}`, [
        { label: t('ok'), value: true, kind: 'apply' },
        { label: t('guardCancel'), value: false },
      ]);
      if (go) {
        if (window.__OPEN_URL__) {
          window.__OPEN_URL__('https://github.com/aryobw9/DLPHub/releases/latest');
        } else {
          window.open('https://github.com/aryobw9/DLPHub/releases/latest', '_blank');
        }
      }
    } else {
      showModal(t('updateTitle'), t('updateLatest'), [{ label: t('ok') }]);
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise((r) => setTimeout(r, 800 - elapsed));
    }
    showModal(t('updateTitle'), t('updateFailed'), [{ label: t('ok') }]);
  } finally {
    if (icon) icon.classList.remove('fa-spin');
    if (btn) {
      btn.disabled = false;
      btn.style.pointerEvents = '';
    }
    document.body.style.cursor = '';
  }
}

async function doResetSettings() {
  const confirm = await showModal(t('btnResetSettings'), t('confirmResetSettings'), [
    { label: t('btnResetSettings'), value: true, kind: 'danger' },
    { label: t('guardCancel'), value: false },
  ]);
  if (!confirm) return;

  setBusyCursor(true, 'advanced');
  try {
    const s = await call('reset_settings_cmd');
    state.lang = s.lang;
    state.unlocked = s.unlocked;
    state.fov = s.fov;
    state.fpsMax = s.fps_max;
    state.unitStatusNew = s.unit_status_new;
    state.customAutoexec = s.custom_autoexec;
    state.renderer = s.renderer || 'default';

    const fovSlider = document.getElementById('fov-slider');
    if (fovSlider) fovSlider.value = s.fov;
    const fovCurrent = document.getElementById('fov-current');
    if (fovCurrent) fovCurrent.textContent = s.fov + '°';

    syncSettingsToUi();

    showModal(t('btnResetSettings'), t('settingsResetDone'), [{ label: t('ok'), kind: 'apply' }]);
  } catch (e) {
    showModal(t('btnResetSettings'), String(e), [{ label: t('ok') }]);
  } finally {
    setBusyCursor(false, 'advanced');
  }
}

async function doCopyDiagnostics() {
  try {
    const diag = await call('get_diagnostics');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(diag);
    } else {
      const ta = document.createElement('textarea');
      ta.value = diag;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showModal(t('btnCopyDiag'), t('diagCopied'), [{ label: t('ok'), kind: 'apply' }]);
  } catch (e) {
    showModal(t('btnCopyDiag'), String(e), [{ label: t('ok') }]);
  }
}

// ---------- revert vanilla ----------
async function doRevertVanilla() {
  if (!state.gamePath) {
    showModal(t('revertVanilla'), t('noGame'), [{ label: t('ok') }]);
    return;
  }
  try {
    const running = await call('check_running');
    if (running.length > 0) {
      showModal(t('guardTitle'), t('guardBody'), [{ label: t('ok') }]);
      return;
    }
  } catch (e) { /* non-fatal */ }
  const confirm = await showModal(t('revertVanilla'), t('confirmRevertVanilla'), [
    { label: t('btnRevertVanilla'), value: true, kind: 'apply' },
    { label: t('guardCancel'), value: false },
  ]);
  if (!confirm) return;

  const btn = document.getElementById('btn-revert-vanilla');
  if (btn) btn.disabled = true;
  setBusyCursor(true, 'advanced');
  document.getElementById('step-log').innerHTML = '';
  stepLine(t('working'));
  try {
    const rep = await call('revert_original_cmd', { path: state.gamePath });
    let details = [];
    if (rep.restored_gi) details.push('gameinfo.gi');
    if (rep.restored_video) details.push('cfg\\video.txt');
    if (rep.removed_addons && rep.removed_addons.length > 0) {
      details.push(`${rep.removed_addons.length} ${t('addonsRemoved')}`);
    }
    stepLine(`[${t('revertLog')}] ${details.join(', ') || t('restored')}`, 'ok');
    updateDetectBadge();
    showModal(t('revertVanilla'), t('revertComplete'), [{ label: 'OK', kind: 'apply' }]);
  } catch (e) {
    stepLine(String(e), 'skip');
    showModal(t('revertVanilla'), String(e), [{ label: t('ok') }]);
  }
  setBusyCursor(false, 'advanced');
  if (btn) btn.disabled = false;
}

// ---------- tester unlock ----------
function showTesterModes() {
  const l = document.getElementById('tester-locked');
  const m = document.getElementById('tester-modes');
  if (l) l.style.display = 'none';
  if (m) m.style.display = 'flex';
}

async function doUnlock() {
  const code = document.getElementById('unlock-input').value;
  try {
    await call('set_settings', { patch: { unlock_code: code } });
    state.unlocked = true;
    showTesterModes();
  } catch (e) {
    showModal(t('testerTitle'), t('unlockBad'), [{ label: t('ok') }]);
  }
}

// ---------- launch ----------
async function launchGame() {
  if (state.running) return;
  try { await call('launch_game'); } catch (e) { /* steam not found etc. */ }
  setTimeout(refreshRunning, 2000);
}

// ---------- social links: open in system browser ----------
async function openExternal(url) {
  try {
    const t = window.__TAURI__;
    const op = t && (t.opener || (t.plugins && t.plugins.opener));
    if (op) {
      if (typeof op.openUrl === 'function') { await op.openUrl(url); return; }
      if (typeof op.open === 'function') { await op.open(url); return; }
    }
  } catch (e) { /* fall through */ }
  try { await call('plugin:opener|open_url', { url }); return; } catch (e) { /* fall through */ }
  try { window.open(url, '_blank'); } catch (e) {}
}

// ---------- modal ----------
function showModal(title, body, actions) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;
    const act = document.getElementById('modal-actions');
    act.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = a.kind === 'apply' ? 'btn-apply' : 'btn-reset';
      b.textContent = a.label;
      b.onclick = () => { overlay.style.display = 'none'; resolve(a.value); };
      act.appendChild(b);
    }
    overlay.style.display = 'flex';
  });
}

// ---------- FOV ----------
function setFov(v) {
  const persist = (snapped) => { if (window.__TAURI__) call('set_settings', { patch: { fov: snapped } }).catch(() => {}); };
  const slider = document.getElementById('fov-slider');
  const number = document.getElementById('fov-number');
  const current = document.getElementById('fov-current');
  const snapped = Math.min(120, Math.max(70, Math.round((v - 70) / 5) * 5 + 70));
  state.fov = snapped;
  persist(snapped);
  if (slider) slider.value = snapped;
  if (number) number.value = snapped;
  if (current) current.textContent = snapped + '°';
}

// ---------- valve game servers ping ----------
let pingingActive = false;
let lastTestAt = null;

const PING_HISTORY = {};
const HISTORY_WINDOW_MS = 30000;

function pushHistory(s) {
  const now = Date.now();
  const arr = (PING_HISTORY[s.id] = PING_HISTORY[s.id] || []);
  const v = s.avg_ms !== null && s.avg_ms !== undefined ? s.avg_ms : s.ping_ms;
  if (v !== null && v !== undefined) arr.push({ ms: v, t: now });
  while (arr.length && now - arr[0].t > HISTORY_WINDOW_MS) arr.shift();
  return arr;
}

function routeScore(s) {
  if (s.ping_ms === null || s.ping_ms === undefined) return -1;
  const ms = s.ping_ms;
  const jitter = s.jitter_ms || 0;
  const loss = s.loss_pct || 0;
  const latScore = Math.max(0, 100 - (ms / 3));
  const jitScore = Math.max(0, 100 - jitter * 4);
  const lossScore = Math.max(0, 100 - loss * 12);
  return Math.round(latScore * 0.45 + jitScore * 0.35 + lossScore * 0.2);
}

function qualityState(s) {
  if (s.ping_ms === null || s.ping_ms === undefined) return 'offline';
  const ms = s.ping_ms;
  const jitter = s.jitter_ms || 0;
  const loss = s.loss_pct || 0;
  if (loss > 10) return 'unstable';
  if (ms < 90 && jitter <= 8 && loss < 1) return 'excellent';
  if (ms < 160 && jitter <= 20) return 'stable';
  return 'unstable';
}

function scoreLabel(score) {
  if (score >= 90) return { label: 'routeExcellent', cls: 'st-excellent' };
  if (score >= 75) return { label: 'routeStable', cls: 'st-stable' };
  if (score >= 55) return { label: 'routeUnstable', cls: 'st-unstable' };
  return { label: 'routePoor', cls: 'st-poor' };
}

function routeLabel(state) {
  return { excellent: 'routeExcellent', stable: 'routeStable', unstable: 'routeUnstable', poor: 'routePoor', offline: 'offline' }[state] || 'routeStable';
}

function stateDot(state) {
  return { excellent: '●', stable: '●', unstable: '◐', offline: '○', poor: '●' }[state] || '●';
}

function sparkline(history, state, wide) {
  if (!history || history.length < 2) return '<div class="spark-flat"></div>';
  const w = wide ? 460 : 200, h = wide ? 34 : 22;
  const max = Math.max(...history, 10) * 1.1;
  const step = w / (history.length - 1);
  const pts = history.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h * 0.9 - 2).toFixed(1)}`).join(' ');
  const cls = state === 'offline' ? 'spark offline' : state === 'unstable' ? 'spark bad' : state === 'stable' ? 'spark mid' : 'spark good';
  return `<svg class="spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline class="${cls}" points="${pts}" fill="none" stroke-width="1.5"/></svg>`;
}

function relayCardHtml(s, featured) {
  const st = qualityState(s);
  const offline = st === 'offline';
  const name = state.lang === 'fa' ? s.name_fa : (s.name || s.id.toUpperCase());
  const region = (state.lang === 'fa' ? s.region_fa : s.region || '').toUpperCase();
  const code = (s.id || '').toUpperCase();
  const jitter = s.jitter_ms !== null && s.jitter_ms !== undefined ? `±${s.jitter_ms} ms` : '—';
  const loss = s.loss_pct !== null && s.loss_pct !== undefined ? `${s.loss_pct.toFixed(1)}%` : '—';
  const dot = stateDot(st);
  const hist = (PING_HISTORY[s.id] || []).map((h) => h.ms);
  const score = routeScore(s);
  const sl = scoreLabel(score);
  const agoSec = lastTestAt ? Math.max(0, Math.round((Date.now() - lastTestAt) / 1000)) : null;
  const liveTxt = agoSec === null ? '●' : `● ${agoSec}s`;
  const hs = hist;
  const avgV = hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : null;
  const minV = hs.length ? Math.min(...hs) : null;
  const maxV = hs.length ? Math.max(...hs) : null;

  if (featured) {
    return `
      <div class="featured-card">
        <div class="fc-tag">✦ ${t('recommended')} — ${t('bestRoute')}</div>
        <div class="fc-main">
          <div class="fc-left">
            <div class="fc-name">${name} <span class="fc-code">${code}</span></div>
            <div class="fc-region">${region}</div>
            <div class="fc-spark">${offline ? '<div class="spark-flat"></div>' : sparkline(hist, st, true)}</div>
            <div class="fc-stats">
              ${offline
                ? `<span class="fc-dot st-text-offline">${dot} ${t('offline')}</span>`
                : `<span class="fc-dot st-text-${st}">${dot} ${t(routeLabel(st))}</span>
                   <span class="fc-stat mono">${t('jitter')} ${jitter}</span>
                   <span class="fc-stat mono">${t('loss')} ${loss}</span>`}
              <span class="fc-live">${offline ? t('offline') : `${liveTxt} ●`}</span>
            </div>
            <div class="fc-ip mono" data-tooltip="${s.ip}">${s.ip}</div>
          </div>
          <div class="fc-ping-wrap">
            <div class="fc-ping">${offline ? '—' : s.ping_ms}</div>
            <div class="fc-ms">${offline ? '' : 'ms'}</div>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="ping-card st-${st}">
      <div class="pc-head">
        <span class="pc-dot st-text-${st}">${dot}</span>
        <div class="pc-names">
          <div class="pc-name">${name}</div>
          <div class="pc-region">${code} · ${offline ? t('offline') : region}</div>
        </div>
      </div>
      <div class="pc-ping mono ${offline ? 'is-offline' : 'st-text-' + st}">${offline ? '—' : s.ping_ms}<small>${offline ? '' : ' ms'}</small></div>
      <div class="pc-stats mono">${offline ? `<span>${t('offline')}</span>` : `<span class="st-text-${st}">${dot} ${t(routeLabel(st))}</span>`}</div>
    </div>`;
}

function renderValvePings(servers) {
  const grid = document.getElementById('ping-grid');
  const slot = document.getElementById('best-route-slot');
  if (!grid || !Array.isArray(servers)) return;

  grid.classList.remove('is-loading');
  for (const s of servers) pushHistory(s);
  const online = servers.filter((s) => s.ping_ms !== null && s.ping_ms !== undefined);
  const best = online.length
    ? online.reduce((a, b) => (routeScore(b) > routeScore(a) ? b : a))
    : null;

  if (slot) slot.innerHTML = best ? relayCardHtml(best, true) : '';

  grid.innerHTML = '';
  for (const s of servers) {
    pushHistory(s);
    if (best && s.id === best.id) continue;
    const tpl = document.createElement('template');
    tpl.innerHTML = relayCardHtml(s, false).trim();
    const el = tpl.content.firstElementChild;
    grid.appendChild(el);
  }
  if (window.Motion && !isLangSwitching) {
    const anim = Motion.animate(grid.querySelectorAll('.ping-card'),
      { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] },
      { delay: Motion.stagger(0.05), duration: 0.3, easing: 'ease-out' });
    if (anim && anim.finished) {
      anim.finished.then(() => {
        grid.querySelectorAll('.ping-card').forEach((c) => {
          c.style.transform = '';
        });
      });
    }
  }

  const footer = document.getElementById('net-footer');
  lastTestAt = Date.now();
  const time = new Date(lastTestAt).toLocaleTimeString(state.lang === 'fa' ? 'fa-IR' : 'en-GB');
  startAgoTicker();
  if (footer) {
    footer.style.display = 'flex';
    footer.innerHTML = `<span>${t('lastTest')} · ${time}</span><span>${online.length}/${servers.length} ${t('relaysOnline')}</span>`;
  }
}

let agoTimer = null;
function startAgoTicker() {
  if (agoTimer) clearInterval(agoTimer);
  agoTimer = setInterval(() => {
    const footer = document.getElementById('net-footer');
    if (!footer || !lastTestAt) return;
    const ago = Math.max(0, Math.round((Date.now() - lastTestAt) / 1000));
    const time = new Date(lastTestAt).toLocaleTimeString(state.lang === 'fa' ? 'fa-IR' : 'en-GB');
    footer.innerHTML = `<span>${t('lastTest')} · ${time} (${ago}s)</span>`;
    const fc = document.querySelector('.fc-live');
    if (fc && !fc.textContent.includes(t('offline'))) fc.textContent = `● ${ago}s`;
  }, 1000);
}

function renderMeteorsHtml(count = 16) {
  let html = '';
  for (let i = 0; i < count; i++) {
    const left = ((i * 53) % 100) + '%';
    const delay = (((i * 37) % 60) / 10).toFixed(1) + 's';
    const duration = (2.5 + ((i * 17) % 40) / 10).toFixed(1) + 's';
    html += `<span class="vf-meteor" style="left:${left};animation-duration:${duration};animation-delay:${delay};"><span class="vf-meteor-head"></span></span>`;
  }
  return html;
}

async function refreshValvePings(forceLoading = false) {
  if (pingingActive) return;
  pingingActive = true;
  const btn = document.getElementById('btn-refresh-ping');
  const grid = document.getElementById('ping-grid');
  const slot = document.getElementById('best-route-slot');
  const footer = document.getElementById('net-footer');
  const spinIcon = btn ? btn.querySelector('.refresh-icon') : null;
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-pinging');
  }
  if (spinIcon) spinIcon.classList.add('spin');
  setBusyCursor(true, 'latency');

  const shouldShowLoading = forceLoading || !state.lastValvePings || state.lastValvePings.length === 0;

  if (shouldShowLoading) {
    if (slot) slot.innerHTML = '';
    if (footer) footer.style.display = 'none';
    if (grid) {
      grid.classList.add('is-loading');
      grid.innerHTML = `
        <div class="latency-loading-wrap">
          <div class="vf-meteors-container" aria-hidden="true">
            ${renderMeteorsHtml(16)}
          </div>
          <div class="latency-loading-content">
            <div class="dlp-loader">
              <div class="l1"><div class="l2"><div class="l3"></div></div></div>
            </div>
            <div class="vf-loading-dots-wrap" role="status">
              <span class="dlp-load-label">${t('pingTesting').replace(/\.{2,}$/, '')}</span>
              <span class="vf-loading-dots" aria-hidden="true">
                <span class="vf-dot"></span>
                <span class="vf-dot"></span>
                <span class="vf-dot"></span>
              </span>
            </div>
          </div>
        </div>`;
    }
  }

  try {
    const servers = await call('ping_valve_servers');
    state.lastValvePings = servers;
    renderValvePings(servers);
  } catch (err) {
    console.error('[ping_valve_servers error]', err);
    if (grid) {
      grid.classList.remove('is-loading');
      grid.innerHTML = `<div class="ping-loading-msg text-danger">${String(err)}</div>`;
    }
  } finally {
    setBusyCursor(false, 'latency');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-pinging');
    }
    if (spinIcon) spinIcon.classList.remove('spin');
    pingingActive = false;
  }
}

function selectCardByKey(tabKey) {
  state.activeTab = tabKey;
  const el = document.getElementById(`card-${tabKey}`);
  if (!el) return;
  const hero = HERO_BY_TAB[tabKey];
  if (hero) {
    const accent = document.querySelector('.header-subtitle-accent');
    const sub = document.querySelector('.header-title-fa');
    if (accent) accent.textContent = hero[state.lang === 'fa' ? 'fa' : 'en'];
    if (sub) sub.textContent = state.lang === 'fa' ? hero.sub_fa : hero.sub_en;
  }
  document.querySelectorAll('.pro-card, .sci-card').forEach((card) => card.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('section-title').textContent = t(SECTION_TITLES[tabKey] || 'presetsTitle');
  const ICONS = { graphic: 'fa-desktop', latency: 'fa-bolt', advanced: 'fa-sliders' };
  const iconEl = document.getElementById('section-icon');
  if (iconEl && ICONS[tabKey]) {
    iconEl.className = 'fa-solid ' + ICONS[tabKey];
    iconEl.style.fontSize = '13px';
    iconEl.style.color = 'var(--deadlock-orange)';
  }
  for (const p of PANELS) {
    const pan = document.getElementById(`panel-${p}`);
    if (pan) {
      pan.style.display = p === tabKey ? 'block' : 'none';
      pan.classList.remove('panel-revealing', 'to-fa', 'to-en');
    }
  }
  const footer = document.getElementById('action-footer');
  if (footer) footer.style.display = tabKey === 'graphic' ? 'flex' : 'none';

  const dirClass = state.lang === 'fa' ? 'to-fa' : 'to-en';
  const active = document.getElementById(`panel-${tabKey}`);
  if (active) {
    active.classList.remove('panel-revealing', 'to-fa', 'to-en');
    void active.offsetWidth;
    active.classList.add('panel-revealing', dirClass);
    setTimeout(() => {
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
  }
  const pingBtn = document.getElementById('btn-refresh-ping');
  if (pingBtn) pingBtn.style.display = tabKey === 'latency' ? '' : 'none';
  const isBusyNow = state.busyTab && (state.busyTab === 'global' || state.busyTab === tabKey);
  document.documentElement.classList.toggle('is-busy', !!isBusyNow);
  updateCursorFollower();
  if (tabKey === 'latency') {
    if (!state.lastValvePings || state.lastValvePings.length === 0) {
      refreshValvePings();
    }
  }
  if (tabKey === 'advanced') renderBackups();
  if (tabKey === 'graphic') {
    setTimeout(() => {
      updateRendererGlider();
      updateFpsGlider();
    }, 380);
  }
}

function getWin() {
  try {
    if (window.__TAURI__) {
      if (window.__TAURI__.webviewWindow && typeof window.__TAURI__.webviewWindow.getCurrentWebviewWindow === 'function') {
        return window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
      }
      if (window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === 'function') {
        return window.__TAURI__.window.getCurrentWindow();
      }
    }
  } catch (e) {}
  return null;
}

async function handleWinMin() {
  const w = getWin();
  if (w && typeof w.minimize === 'function') {
    try { await w.minimize(); return; } catch (e) {}
  }
  call('plugin:window|minimize', { label: 'main' }).catch(() => {});
}

async function handleWinMax() {
  const w = getWin();
  if (w && typeof w.isMaximized === 'function') {
    try {
      const maxed = await w.isMaximized();
      if (maxed) await w.unmaximize();
      else await w.maximize();
      await updateMaximizedState();
      setTimeout(updateScale, 50);
      setTimeout(updateScale, 200);
      return;
    } catch (e) {}
  }
  call('plugin:window|toggle_maximize', { label: 'main' }).catch(() => {});
  setTimeout(updateMaximizedState, 100);
  setTimeout(updateScale, 50);
  setTimeout(updateScale, 200);
}

async function handleWinClose() {
  const w = getWin();
  if (w && typeof w.close === 'function') {
    try { await w.close(); return; } catch (e) {}
  }
  call('plugin:window|close', { label: 'main' }).catch(() => {});
}

// ---------- window edge zones (flame resize cursors) ----------
// No overlay elements: a global mousemove classifies the pointer into a
// non-overlapping edge zone by coordinates and sets html[data-edge], which the
// CSS maps to the flame resize cursors. Zones cover the webview-accessible
// band just inside the OS-owned native resize border. mousedown in a zone
// delegates the drag to Tauri's startResizeDragging.
const EDGE_ZONE = 20;          // px band along each side/bottom edge
const EDGE_TOP = 12;           // px band along the top — the 40px titlebar lives
                               // there, so the top grab strip stays thin (9px of
                               // it is ours; the rest of the bar still drags)
const EDGE_CORNER = 64;        // px square grab zone at each corner
// The top 4px of the client area belong to tauri-runtime-wry's
// `TAURI_DRAG_RESIZE_BORDERS` child, whose window region is exactly the top
// strip (SetWindowRgn cut-out, 4px at 96dpi). It always answers HTTOP, so
// Windows paints that strip and swallows the click — our zone starts below it.
// Left/right/bottom insets are *outside* the client area entirely, so the
// webview owns those edges and the flame cursors come from CSS; the 8px OS
// band beyond them is covered by the WM_SETCURSOR subclass in
// src-tauri/src/native_cursor.rs.
const EDGE_TOP_NATIVE = 4;

const RESIZE_DIR_NAMES = {
  n: 'North', s: 'South', e: 'East', w: 'West',
  nw: 'NorthWest', ne: 'NorthEast', sw: 'SouthWest', se: 'SouthEast',
};

function edgeZoneFor(x, y, w, h) {
  // corners first (they win over plain edges). Corners need both axes inside
  // the client area: x/y 0..3 on the top edge belongs to tao's native border.
  if (x >= EDGE_TOP_NATIVE && x <= EDGE_CORNER && y >= EDGE_TOP_NATIVE && y <= EDGE_CORNER) return 'nw';
  if (x >= w - EDGE_CORNER && y >= EDGE_TOP_NATIVE && y <= EDGE_CORNER) return 'ne';
  if (x <= EDGE_CORNER && y >= h - EDGE_CORNER) return 'sw';
  if (x >= w - EDGE_CORNER && y >= h - EDGE_CORNER) return 'se';
  // edges, offset inward past the OS-owned native band
  const nearN = y >= EDGE_TOP_NATIVE && y <= EDGE_TOP;
  const nearS = y >= h - EDGE_ZONE;
  const nearW = x <= EDGE_ZONE;
  const nearE = x >= w - EDGE_ZONE;
  if (nearN) return 'n';
  if (nearS) return 's';
  if (nearW) return 'w';
  if (nearE) return 'e';
  return null;
}

// The Tauri IPC (for delegating the actual resize drag) — absent in a plain
// browser, where the zones still style the cursor but can't resize.
const IN_TAURI = !!(window.__TAURI__ && (window.__TAURI__.webviewWindow || window.__TAURI__.window));

function isEdgeZonesActive() {
  // Zones are visual in every host; only actual resizing is Tauri-only.
  // Never while maximized (nothing to resize then).
  return !document.documentElement.classList.contains('is-maximized');
}

function updateEdgeZone(x, y, target) {
  if (!isEdgeZonesActive()) return;
  const root = document.documentElement;

  // Buttons, titlebar controls, action footer, and titlebar drag region win over resize zones:
  if (target && target.closest && target.closest('button, [role="button"], a, [data-url], input, select, textarea, .social-card, .win-ctl, .btn-play, .lang-pill-btn, .app-titlebar, [data-tauri-drag-region], [onclick], .action-footer, #action-footer, .active-profile, #active-profile, .step-log, #step-log, .app-version-badge, #app-version-badge, .social-cluster, #social-cluster')) {
    if (root.hasAttribute('data-edge')) {
      root.removeAttribute('data-edge');
      updateCursorFollower(target, x, y);
    }
    return;
  }

  const dir = edgeZoneFor(x, y, window.innerWidth, window.innerHeight);
  const oldDir = root.getAttribute('data-edge');
  if (dir) {
    if (oldDir !== dir) {
      root.setAttribute('data-edge', dir);
      updateCursorFollower(target, x, y);
    }
  } else if (oldDir) {
    root.removeAttribute('data-edge');
    updateCursorFollower(target, x, y);
  }
}

async function updateMaximizedState() {
  const w = getWin();
  if (!w || typeof w.isMaximized !== 'function') return;
  try {
    const maxed = await w.isMaximized();
    document.documentElement.classList.toggle('is-maximized', !!maxed);
    if (maxed) document.documentElement.removeAttribute('data-edge');
    const btnMax = document.getElementById('btn-max');
    if (btnMax) {
      btnMax.title = maxed ? 'Restore' : 'Maximize';
      btnMax.setAttribute('aria-label', maxed ? 'Restore' : 'Maximize');
      btnMax.innerHTML = maxed
        ? '<i class="fa-regular fa-clone" style="font-size:10px"></i>'
        : '<i class="fa-regular fa-square" style="font-size:10px"></i>';
    }
  } catch (e) { /* ignore */ }
}

// Edge-zone debug view: hold Alt+Shift+E to outline the live zones and show
// the current classification. z-order is below the resize strips.
function setupEdgeZoneDebug() {
  const box = document.createElement('div');
  box.id = 'edge-zone-debug';
  box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99998;display:none;';
  const label = document.createElement('div');
  label.style.cssText = 'position:absolute;bottom:44px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#7ef29a;font:600 12px monospace;padding:6px 12px;border-radius:6px;border:1px solid #2f6f4a;white-space:nowrap;';
  box.appendChild(label);
  const zones = document.createElement('div');
  zones.style.cssText = 'position:absolute;inset:0;';
  const mk = (css) => { const d = document.createElement('div'); d.style.cssText = css + ';position:absolute;background:rgba(126,242,154,.16);border:1px solid rgba(126,242,154,.5);'; return d; };
  const C = EDGE_CORNER, Z = EDGE_ZONE, T = EDGE_TOP, W = () => window.innerWidth, H = () => window.innerHeight;
  const defs = [
    [`top:0;left:0;width:${C}px;height:${C}px`, 'nw'], [`top:0;right:0;width:${C}px;height:${C}px`, 'ne'],
    [`bottom:0;left:0;width:${C}px;height:${C}px`, 'sw'], [`bottom:0;right:0;width:${C}px;height:${C}px`, 'se'],
    [`top:${EDGE_TOP_NATIVE}px;left:${C}px;right:${C}px;height:${T - EDGE_TOP_NATIVE}px`, 'n'],
    [`bottom:0;left:${C}px;right:${C}px;height:${Z}px`, 's'],
    [`left:0;top:${C}px;bottom:${C}px;width:${Z}px`, 'w'], [`right:0;top:${C}px;bottom:${C}px;width:${Z}px`, 'e'],
  ];
  for (const [css, dir] of defs) { const d = mk(css); d.dataset.dir = dir; zones.appendChild(d); }
  box.appendChild(zones);
  document.body.appendChild(box);
  let on = false;
  window.addEventListener('keydown', (e) => { if (e.altKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) { on = !on; box.style.display = on ? '' : 'none'; } });
  window.addEventListener('mousemove', (e) => {
    if (!on) return;
    const dir = document.documentElement.getAttribute('data-edge') || '—';
    label.textContent = `edge=${dir}  x=${e.clientX} y=${e.clientY}  ${window.innerWidth}x${window.innerHeight}`;
    zones.querySelectorAll('[data-dir]').forEach((d) => { d.style.background = d.dataset.dir === dir ? 'rgba(126,242,154,.45)' : 'rgba(126,242,154,.16)'; });
  }, { passive: true });
}

function setupResizeEdges() {
  window.addEventListener('mousemove', (e) => updateEdgeZone(e.clientX, e.clientY, e.target), { passive: true });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !IN_TAURI) return;
    const dir = edgeZoneFor(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
    if (!dir || !isEdgeZonesActive()) return;
    // Buttons, inputs, and footer controls win over edge zones:
    if (e.target.closest('button, input, select, textarea, a, [onclick], .action-footer, #action-footer, .active-profile, #active-profile, .step-log, #step-log, .app-version-badge, #app-version-badge, .social-cluster, #social-cluster')) return;
    // Titlebar drag region wins over edge zones (drag window instead of resize):
    if (e.target.closest('.app-titlebar, [data-tauri-drag-region]')) return;
    e.preventDefault();
    // Claim the event: Tauri's own drag.js (and setupTitlebarDrag) also listen
    // for mousedown, and the top band overlaps the titlebar — without this the
    // window would get start_dragging *and* start_resize_dragging at once.
    e.stopImmediatePropagation();
    const win = getWin();
    if (win && typeof win.startResizeDragging === 'function') {
      win.startResizeDragging(RESIZE_DIR_NAMES[dir]).catch(() => {});
    } else {
      call('plugin:window|start_resize_dragging', { label: 'main', direction: RESIZE_DIR_NAMES[dir] }).catch(() => {});
    }
  }, true);
  window.addEventListener('blur', () => document.documentElement.removeAttribute('data-edge'));
  document.addEventListener('mouseleave', () => document.documentElement.removeAttribute('data-edge'));
  window.addEventListener('mouseup', updateMaximizedState);
  window.addEventListener('resize', () => { clearTimeout(updateMaximizedState._t); updateMaximizedState._t = setTimeout(updateMaximizedState, 120); });
  updateMaximizedState();
  setupEdgeZoneDebug();
}

function setupTitlebarDrag() {
  const titlebar = document.querySelector('.app-titlebar');
  if (!titlebar) return;
  titlebar.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select, textarea, [data-tauri-drag-region="false"]')) return;
    // Double click on titlebar toggles maximize:
    if (e.detail === 2) {
      handleWinMax();
      return;
    }
    const w = getWin();
    if (w && typeof w.startDragging === 'function') {
      w.startDragging().catch(() => {});
    } else {
      call('plugin:window|start_dragging', { label: 'main' }).catch(() => {});
    }
  });
  titlebar.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, input, select, textarea, [data-tauri-drag-region="false"]')) return;
    handleWinMax();
  });
}

function updateScale() {
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
}

function selectPreset(mode) {
  state.selectedMode = mode;
  document.querySelectorAll('.tier-card, .tier-card-sm, .option-item.preset').forEach((p) => {
    const was = p.classList.contains('selected');
    p.classList.toggle('selected', p.dataset.mode === mode);
    if (!was && p.dataset.mode === mode && window.__animateStyle) {
      p.classList.add('animate__animated', 'animate__zoomIn');
      p.addEventListener('animationend', () => p.classList.remove('animate__animated', 'animate__zoomIn'), { once: true });
    }
  });
}

window.updateScale = updateScale;
window.selectPreset = selectPreset;
window.handleWinMin = handleWinMin;
window.handleWinMax = handleWinMax;
window.handleWinClose = handleWinClose;
window.toggleLang = toggleLang;
window.setLang = setLang;
window.selectCardByKey = selectCardByKey;
window.refreshValvePings = refreshValvePings;
window.launchGame = launchGame;
window.pickFolder = pickFolder;
window.confirmPath = confirmPath;
window.doInstall = doInstall;
window.doBackupNow = doBackupNow;
window.doRevertVanilla = doRevertVanilla;
window.doUnlock = doUnlock;
window.doResetSettings = doResetSettings;
window.doCopyDiagnostics = doCopyDiagnostics;
window.selectRenderer = selectRenderer;
window.setFov = setFov;
window.copyLaunchOpt = copyLaunchOpt;
// ---------- Custom Info Tooltip & Launch Options Hover Preview ----------
function positionTooltip(el, tooltip) {
  const rect = el.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  let top = rect.top - tipRect.height - 8;
  let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

  if (top < 8) {
    top = rect.bottom + 8;
  }
  if (left < 10) left = 10;
  if (left + tipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tipRect.width - 10;
  }

  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.style.left = `${Math.round(left)}px`;
}

function setupCustomTooltips() {
  const tooltip = document.getElementById('app-custom-tooltip');

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target && tooltip) {
      const text = target.getAttribute('data-tooltip');
      if (text) {
        tooltip.textContent = text;
        tooltip.style.display = 'block';
        void tooltip.offsetWidth;
        positionTooltip(target, tooltip);
        tooltip.classList.add('visible');
      }
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target && tooltip && !e.relatedTarget?.closest('[data-tooltip]')) {
      tooltip.classList.remove('visible');
      setTimeout(() => {
        if (!tooltip.classList.contains('visible')) tooltip.style.display = 'none';
      }, 150);
    }
  });
}

// ---------- wire everything ----------
function init() {
  try {
    updateScale();
    window.addEventListener('resize', updateScale);
    setupCustomTooltips();
    window.__animateStyle = !!document.querySelector('link[href*="animate.min.css"]');
    if (window.__animateStyle) {
      document.querySelectorAll('.cards-deck .pro-card').forEach((card, i) => {
        card.style.setProperty('--animate-delay', `${i * 0.07}s`);
        card.classList.add('animate__animated', 'animate__fadeInUp');
        card.addEventListener('animationend', () => card.classList.remove('animate__animated', 'animate__fadeInUp'), { once: true });
      });
    }
    const btnMin = document.getElementById('btn-min');
    if (btnMin) btnMin.onclick = handleWinMin;
    const btnMax = document.getElementById('btn-max');
    if (btnMax) btnMax.onclick = handleWinMax;
    const btnClose = document.getElementById('btn-close');
    if (btnClose) btnClose.onclick = handleWinClose;
    setupTitlebarDrag();
    setupResizeEdges();

    const btnLang = document.getElementById('btn-lang-toggle');
    if (btnLang) btnLang.onclick = window.toggleLang;

    document.getElementById('btn-pick-folder').onclick = pickFolder;
    document.getElementById('btn-confirm-path').onclick = confirmPath;
    document.getElementById('btn-launch').onclick = launchGame;
    document.querySelectorAll('.social-card[data-url]').forEach((b) => {
      b.onclick = () => openExternal(b.dataset.url);
    });
    document.getElementById('btn-install').onclick = doInstall;
    document.getElementById('btn-backup').onclick = doBackupNow;
    document.getElementById('btn-revert-vanilla').onclick = doRevertVanilla;
    document.getElementById('btn-unlock').onclick = doUnlock;
    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) btnResetSettings.onclick = doResetSettings;
    const btnCopyDiag = document.getElementById('btn-copy-diag');
    if (btnCopyDiag) btnCopyDiag.onclick = doCopyDiagnostics;

    const swUnit = document.getElementById('sw-unit-status');
    if (swUnit) {
      swUnit.onchange = (e) => {
        state.unitStatusNew = e.target.checked;
        call('set_settings', { patch: { unit_status_new: e.target.checked } }).catch(() => {});
      };
    }

    const slider = document.getElementById('fov-slider');
    const number = document.getElementById('fov-number');
    if (slider) slider.oninput = () => setFov(Number(slider.value));
    if (number) number.onchange = () => setFov(Number(number.value) || 90);
    const fovBox = document.querySelector('.setting-box.fov-box');
    if (fovBox) {
      fovBox.addEventListener('wheel', (e) => {
        e.preventDefault();
        setFov(Number(slider ? slider.value : 90) + (e.deltaY < 0 ? 5 : -5));
      }, { passive: false });
    }
    const fovDefaultTick = document.getElementById('fov-default-tick');
    if (fovDefaultTick) {
      fovDefaultTick.onclick = () => setFov(90);
    }

    document.querySelectorAll('.tier-card, .tier-card-sm, .option-item.preset').forEach((el) => {
      el.addEventListener('click', () => {
        selectPreset(el.dataset.mode);
      });
    });
    state.selectedMode = 'T1';
    selectPreset('T1');

    document.querySelectorAll('.pro-card[id^="card-"], .sci-card[id^="card-"]').forEach((card) => {
      const key = card.id.replace('card-', '');
      card.addEventListener('click', () => selectCardByKey(key));
    });

    boot();
  } catch (err) {
    fatal(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('error', (e) => fatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));
