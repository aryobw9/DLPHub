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
  aspectRatio: '2.15',
  aspectRatioEnabled: true,
  reducedMotion: false,
  selectedMode: null,
  detectedTier: null,
  running: false,
  unitStatusNew: false,
  stopClothAnim: false,
  ragdollFade: false,
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
  if (state.lastMatchId) {
    const textEl = document.getElementById('btn-sync-match-text');
    if (textEl) textEl.textContent = `${t('btnCopyMatch')} (#${state.lastMatchId})`;
    const badge = document.getElementById('match-sync-badge');
    if (badge) {
      badge.className = 'match-sync-badge badge-success';
      badge.textContent = `#${state.lastMatchId}`;
    }
  } else {
    const badge = document.getElementById('match-sync-badge');
    if (badge && !badge.classList.contains('badge-syncing')) {
      badge.textContent = t('matchSyncBadgeReady');
    }
  }
  if (typeof updateLatencyHeroPills === 'function') {
    updateLatencyHeroPills();
  }
  if (typeof pingingActive !== 'undefined' && pingingActive) {
    const lbl = document.querySelector('.latency-loading-content .dlp-load-label');
    if (lbl) lbl.textContent = t('pingTesting').replace(/\.{2,}$/, '');
  } else {
    if (typeof renderServerGrid === 'function' && Array.isArray(state.valveClusters)) {
      renderServerGrid();
    }
    if (typeof renderDnsGrid === 'function' && Array.isArray(state.dnsProfiles)) {
      renderDnsGrid();
    }
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
  state.betterBreakables = !!s.better_breakables;
  state.higherBrightness = !!s.higher_brightness;
  state.reduceClutter = !!s.reduce_clutter;
  state.stopClothAnim = !!s.stop_cloth_anim;
  state.ragdollFade = !!s.ragdoll_fade;
  state.fpsMax = s.fps_max;
  state.customAutoexec = s.custom_autoexec || '';
  state.renderer = s.renderer || 'default';
  state.reducedMotion = !!s.reduced_motion;
  state.aspectRatio = s.aspect_ratio || '2.15';
  state.aspectRatioEnabled = s.aspect_ratio_enabled !== false;

  applyLang();
  syncSettingsToUi();
  applyReducedMotion(state.reducedMotion);
  setVideoFov(typeof s.fov === 'number' && s.fov >= 70 && s.fov <= 90 ? s.fov : 90, false);
  setAspectRatio(state.aspectRatio, false);
  toggleAspectRatio(state.aspectRatioEnabled, false);
  selectCardByKey('graphic');
  checkAdminStatus().catch(() => {});

  if (state.unlocked) showTesterModes();

  try {
    if (await call('running_from_pkg')) {
      showModal(t('guardTitle'), t('tempPkgTitle'), [{ label: t('ok') }]);
    }
  } catch (_) {}
  try {
    const ver = await call('get_app_version');
    if (ver) {
      state.appVersion = ver;
      const el = document.getElementById('app-ver-tag');
      if (el) {
        el.innerHTML = `v${ver} <span class="ver-beta">BETA</span>`;
      }
    }
  } catch (_) {}

  await refreshGame();

  setTimeout(async () => {
    try {
      const up = await call('check_for_updates');
      if (up && up.should_update) {
        const go = await showModal(t('updateTitle'), `${t('updateAvailable')}: ${up.version}`, [
          { label: t('btnUpdateNow') || t('ok'), value: true, kind: 'apply' },
          { label: t('guardCancel'), value: false },
        ]);
        if (go) {
          const targetUrl = up.download_url || up.html_url || 'https://github.com/aryobw9/DLPHub/releases/latest';
          try {
            await call('open_download_url', { url: targetUrl });
          } catch (_) {
            if (window.__OPEN_URL__) {
              window.__OPEN_URL__(targetUrl);
            } else {
              window.open(targetUrl, '_blank');
            }
          }
        }
      }
    } catch (_) {}
  }, 4000);
}

function syncSettingsToUi() {
  const swBreakables = document.getElementById('sw-better-breakables');
  if (swBreakables) swBreakables.checked = !!state.betterBreakables;

  const swBrightness = document.getElementById('sw-higher-brightness');
  if (swBrightness) swBrightness.checked = !!state.higherBrightness;

  const swClutter = document.getElementById('sw-reduce-clutter');
  if (swClutter) swClutter.checked = !!state.reduceClutter;

  const swCloth = document.getElementById('sw-cloth-anim');
  if (swCloth) swCloth.checked = !!state.stopClothAnim;

  const swFade = document.getElementById('sw-ragdoll-fade');
  if (swFade) swFade.checked = !!state.ragdollFade;

  const swRedMotion = document.getElementById('sw-reduced-motion');
  if (swRedMotion) swRedMotion.checked = !!state.reducedMotion;

  const swAr = document.getElementById('sw-ar-enable');
  if (swAr) swAr.checked = state.aspectRatioEnabled !== false;

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
  if (res === 'T1' || res === 'T2' || res === 'T3' || res === 'POTATO' || res === 'RUSSIAN_POTATO' || res === 'T1MODS' || res === 'T2MODS') {
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

// ---------- custom flame cursor follower (100% viewport & corners coverage) ----------
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

function isInteractiveTarget(t) {
  if (!(t instanceof Element)) return false;
  const el = t.closest('button, [role="button"], a, select, .win-ctl, .lang-pill-btn, .pro-card, .sci-card, .tier-card, .social-card, .option-item, .neon-checkbox, .hud-switch-card, .launch-opt-btn, .renderer-pill, .ar-pill, .chip-btn, .fov-default-tick, [onclick]');
  if (!el) return false;
  if (el.matches('button:disabled, [disabled], [aria-disabled="true"], .disabled')) return false;
  return true;
}

function getCornerOrEdge(x, y) {
  if (document.documentElement.classList.contains('is-maximized')) return null;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const CORNER = 24;
  const EDGE = 8;

  // Corners must take precedence over plain edges:
  if (x <= CORNER && y <= CORNER) return 'nw';
  if (x >= w - CORNER && y <= CORNER) return 'ne';
  if (x <= CORNER && y >= h - CORNER) return 'sw';
  if (x >= w - CORNER && y >= h - CORNER) return 'se';

  // Edges:
  if (y <= EDGE) return 'n';
  if (y >= h - EDGE) return 's';
  if (x <= EDGE) return 'w';
  if (x >= w - EDGE) return 'e';

  return null;
}

(function setupCursorStates() {
  Object.values(CURSOR_HOTSPOTS).forEach((c) => {
    const img = new Image();
    img.src = c.file;
  });

  let cursorEl = document.getElementById('dlp-custom-cursor');
  let cursorInner = document.getElementById('dlp-custom-cursor-inner');
  let cursorDot = document.getElementById('dlp-cursor-target-dot');
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
  }
  if (!cursorDot && cursorEl) {
    cursorDot = document.createElement('div');
    cursorDot.id = 'dlp-cursor-target-dot';
    cursorEl.appendChild(cursorDot);
  }

  let currentType = '';
  let isPressed = false;
  let isRightClick = false;
  let rightTimer = null;
  let lastX = Math.round(window.innerWidth / 2) || 400;
  let lastY = Math.round(window.innerHeight / 2) || 300;
  let rafPending = false;
  let pendingTarget = null;

  function isReducedMotionActive() {
    return !!state.reducedMotion || (document.body && document.body.classList.contains('reduced-motion'));
  }

  function setCursorType(type) {
    if (!CURSOR_HOTSPOTS[type]) type = 'default';
    if (currentType === type) return;
    currentType = type;
    const meta = CURSOR_HOTSPOTS[type];
    cursorEl.style.width = (meta.w || 64) + 'px';
    cursorEl.style.height = (meta.h || 64) + 'px';
    if (!cursorInner) cursorInner = document.getElementById('dlp-custom-cursor-inner');
    if (cursorInner) cursorInner.style.backgroundImage = `url("${meta.file}")`;
    if (!cursorDot) cursorDot = document.getElementById('dlp-cursor-target-dot');
    if (cursorDot) {
      cursorDot.style.left = meta.x + 'px';
      cursorDot.style.top = meta.y + 'px';
    }
    if (type === 'busy') {
      cursorEl.classList.add('is-spinning');
    } else {
      cursorEl.classList.remove('is-spinning');
    }
  }

  function render(x, y) {
    if (isReducedMotionActive()) return;
    const meta = CURSOR_HOTSPOTS[currentType] || CURSOR_HOTSPOTS.default;
    cursorEl.style.transform = `translate3d(${x - meta.x}px, ${y - meta.y}px, 0)`;
  }

  function determineCursor(t, x, y) {
    if (isRightClick) return 'click_right';

    // 1. Window corners and edges take highest priority at the outer borders
    const edge = getCornerOrEdge(x, y);
    if (edge) {
      if (edge === 'nw' || edge === 'se') return 'nwse-resize';
      if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
      if (edge === 'n' || edge === 's') return 'ns-resize';
      if (edge === 'w' || edge === 'e') return 'ew-resize';
    }

    // 2. Busy state across panels
    const isBusyNow = state.busyTab && (state.busyTab === 'global' || state.busyTab === state.activeTab);
    if (isBusyNow) {
      return 'busy';
    }

    // 3. Interactive buttons, cards, pills, options
    if (isInteractiveTarget(t)) {
      return isPressed ? 'click' : 'pointer';
    }

    // 4. Text inputs & logs
    if (t instanceof Element && t.closest('input[type="text"], input[type="password"], textarea, .path-input, .step-log')) {
      return 'text';
    }

    // 5. Sliders
    if (t instanceof Element && t.closest('input[type="range"]')) {
      return isPressed ? 'grab' : 'pointer';
    }

    // 6. Help tooltips
    if (t instanceof Element && t.closest('.hint-trigger, .hint-tooltip')) {
      return 'help';
    }

    // 7. Titlebar drag region (away from the top corners)
    if (t instanceof Element && t.closest('.app-titlebar, .titlebar-drag-spacer, [data-tauri-drag-region]')) {
      return 'move';
    }

    return isPressed ? 'click' : 'default';
  }

  updateCursorFollower = (target, x, y) => {
    if (isReducedMotionActive()) return;
    if (typeof x === 'number') { lastX = x; lastY = y; }
    const t = target || (document.elementFromPoint ? document.elementFromPoint(lastX, lastY) : null);
    const type = determineCursor(t, lastX, lastY);
    setCursorType(type);
    render(lastX, lastY);
  };

  const onPointerMove = (e) => {
    if (e.pointerType === 'touch' || isReducedMotionActive()) return;
    lastX = e.clientX;
    lastY = e.clientY;
    pendingTarget = e.target;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (isReducedMotionActive()) return;
        cursorEl.style.opacity = '1';
        const type = determineCursor(pendingTarget, lastX, lastY);
        setCursorType(type);
        render(lastX, lastY);
      });
    }
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  window.addEventListener('mousedown', (e) => {
    if (e.pointerType === 'touch') return;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!isReducedMotionActive()) {
      cursorEl.style.opacity = '1';
      cursorEl.classList.add('is-clicking');
    }
    if (e.button === 2) {
      isRightClick = true;
      clearTimeout(rightTimer);
      rightTimer = setTimeout(() => {
        isRightClick = false;
        updateCursorFollower(null, lastX, lastY);
      }, 400);
    } else if (e.button === 0) {
      isPressed = true;
    }
    updateCursorFollower(e.target, lastX, lastY);

    if (e.button === 0) {
      const edge = getCornerOrEdge(e.clientX, e.clientY);
      if (edge) {
        const RESIZE_DIR_NAMES = {
          n: 'North', s: 'South', e: 'East', w: 'West',
          nw: 'NorthWest', ne: 'NorthEast', sw: 'SouthWest', se: 'SouthEast',
        };
        const win = getWin();
        if (win && typeof win.startResizeDragging === 'function') {
          win.startResizeDragging(RESIZE_DIR_NAMES[edge]).catch(() => {});
        } else {
          call('plugin:window|start_resize_dragging', { label: 'main', direction: RESIZE_DIR_NAMES[edge] }).catch(() => {});
        }
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    isPressed = false;
    isRightClick = false;
    cursorEl.classList.remove('is-clicking');
    updateCursorFollower(e.target, e.clientX, e.clientY);
  });

  window.addEventListener('contextmenu', () => {
    isRightClick = false;
    cursorEl.classList.remove('is-clicking');
    updateCursorFollower(null, lastX, lastY);
  });

  document.addEventListener('mouseleave', (e) => {
    isPressed = false;
    isRightClick = false;
    cursorEl.classList.remove('is-clicking');
    if (e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      cursorEl.style.opacity = '0';
    }
  });

  document.addEventListener('mouseenter', () => {
    if (!isReducedMotionActive()) cursorEl.style.opacity = '1';
  });

  window.addEventListener('blur', () => {
    isPressed = false;
    isRightClick = false;
    cursorEl.classList.remove('is-clicking');
  });

  window.addEventListener('focus', () => {
    if (!isReducedMotionActive()) cursorEl.style.opacity = '1';
  });

  window.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });

  setCursorType('default');
  if (!isReducedMotionActive()) {
    cursorEl.style.opacity = '1';
    render(lastX, lastY);
  }
})();

function applyReducedMotion(enabled) {
  const isEn = !!enabled;
  state.reducedMotion = isEn;
  if (document.body) {
    document.body.classList.toggle('reduced-motion', isEn);
  }
  const sw = document.getElementById('sw-reduced-motion');
  if (sw) sw.checked = isEn;
  const cursor = document.getElementById('dlp-custom-cursor');
  if (cursor) {
    cursor.style.display = isEn ? 'none' : '';
  }
}

function toggleReducedMotion(enabled) {
  applyReducedMotion(enabled);
  if (window.__TAURI__) {
    call('set_settings', { patch: { reduced_motion: !!enabled } }).catch(() => {});
  }
}

function setBusyCursor(on, tabKey) {
  state.busyTab = on ? (tabKey || state.activeTab || 'global') : null;
  try {
    if (on) {
      document.body.style.cursor = 'wait';
      document.documentElement.style.cursor = 'wait';
    } else {
      document.body.style.cursor = '';
      document.documentElement.style.cursor = '';
    }
  } catch (_) {}
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
      aspect_ratio: state.aspectRatio || '2.15',
      aspect_ratio_enabled: state.aspectRatioEnabled !== false,
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
        { label: t('btnUpdateNow') || t('ok'), value: true, kind: 'apply' },
        { label: t('guardCancel'), value: false },
      ]);
      if (go) {
        const targetUrl = update.download_url || update.html_url || 'https://github.com/aryobw9/DLPHub/releases/latest';
        try {
          await call('open_download_url', { url: targetUrl });
        } catch (_) {
          if (window.__OPEN_URL__) {
            window.__OPEN_URL__(targetUrl);
          } else {
            window.open(targetUrl, '_blank');
          }
        }
      }
    } else {
      showModal(t('updateTitle'), t('updateUpToDate') || t('updateLatest'), [{ label: t('ok') }]);
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise((r) => setTimeout(r, 800 - elapsed));
    }
    const errText = (err && err.message) ? err.message : String(err);
    showModal(t('updateTitle'), `${t('updateFailed')}\n(${errText})`, [{ label: t('ok') }]);
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
    state.fov = s.fov || 90;
    state.aspectRatio = s.aspect_ratio || '2.15';
    state.aspectRatioEnabled = s.aspect_ratio_enabled !== false;
    state.reducedMotion = !!s.reduced_motion;
    state.betterBreakables = !!s.better_breakables;
    state.higherBrightness = !!s.higher_brightness;
    state.reduceClutter = !!s.reduce_clutter;
    state.stopClothAnim = !!s.stop_cloth_anim;
    state.ragdollFade = !!s.ragdoll_fade;
    state.customAutoexec = s.custom_autoexec;
    state.renderer = s.renderer || 'default';

    applyReducedMotion(state.reducedMotion);
    setVideoFov(state.fov, false);
    setAspectRatio(state.aspectRatio, false);
    toggleAspectRatio(state.aspectRatioEnabled, false);

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

// ---------- custom match sync ----------
async function doSyncMatch() {
  const btn = document.getElementById('btn-sync-match');
  const icon = document.getElementById('icon-sync-match');
  const badge = document.getElementById('match-sync-badge');
  const textEl = document.getElementById('btn-sync-match-text');

  // If match was already detected, clicking again copies the match ID
  if (state.lastMatchId) {
    await doCopyMatchId();
    return;
  }

  if (btn) btn.disabled = true;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  if (badge) {
    badge.className = 'match-sync-badge badge-syncing';
    badge.textContent = t('matchSyncBadgeSyncing') || 'SYNCING...';
  }

  try {
    const res = await call('sync_last_match', { customEndpoint: null, customToken: null });
    if (res && res.success) {
      state.lastMatchId = res.match_id;
      if (badge) {
        badge.className = 'match-sync-badge badge-success';
        badge.textContent = `#${res.match_id}`;
      }
      if (textEl) {
        textEl.textContent = `${t('btnCopyMatch')} (#${res.match_id})`;
      }
      showModal(t('matchSyncTitle') || 'CUSTOM MATCH SYNC', res.message, [
        { label: t('btnCopyMatch') || 'Copy Match ID', value: true, kind: 'apply' },
        { label: t('ok') || 'OK', value: false },
      ]).then((copy) => {
        if (copy) doCopyMatchId();
      });
    } else {
      if (badge) {
        badge.className = 'match-sync-badge badge-error';
        badge.textContent = t('matchSyncBadgeFailed') || 'ERROR';
      }
      showModal(t('matchSyncTitle') || 'CUSTOM MATCH SYNC', (res && res.message) ? res.message : 'Match sync failed.', [{ label: t('ok') || 'OK' }]);
    }
  } catch (err) {
    if (badge) {
      badge.className = 'match-sync-badge badge-error';
      badge.textContent = t('matchSyncBadgeFailed') || 'FAILED';
    }
    showModal(t('matchSyncTitle') || 'CUSTOM MATCH SYNC', String(err), [{ label: t('ok') || 'OK' }]);
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.className = 'fa-solid fa-trophy';
  }
}

async function doCopyMatchId() {
  if (!state.lastMatchId) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(state.lastMatchId);
    } else {
      const ta = document.createElement('textarea');
      ta.value = state.lastMatchId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const badge = document.getElementById('match-sync-badge');
    if (badge) {
      const orig = badge.textContent;
      badge.textContent = t('matchSyncBadgeCopied') || 'COPIED!';
      setTimeout(() => { badge.textContent = `#${state.lastMatchId}` || orig; }, 1800);
    }
  } catch (err) {
    console.error('Failed to copy match ID:', err);
  }
}

function showMatchHelp() {
  showModal(t('matchHelpTitle') || 'DEADLOCK MATCH ID GUIDE', t('matchHelpBody') || 'Guide', [
    { label: t('ok') || 'OK', kind: 'apply' },
  ]);
}

window.doSyncMatch = doSyncMatch;
window.doCopyMatchId = doCopyMatchId;
window.showMatchHelp = showMatchHelp;

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

// ---------- toast notification system ----------
function showToast(message, type = 'info') {
  if (!message) return;
  try {
    let container = document.getElementById('dlp-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dlp-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `dlp-toast toast-${type}`;

    const iconMap = {
      success: 'fa-circle-check',
      error: 'fa-triangle-exclamation',
      warning: 'fa-circle-exclamation',
      info: 'fa-circle-info'
    };
    const iconClass = iconMap[type] || 'fa-circle-info';

    const icon = document.createElement('i');
    icon.className = `fa-solid ${iconClass} toast-icon`;

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = String(message);

    toast.appendChild(icon);
    toast.appendChild(text);

    toast.onclick = () => {
      toast.classList.add('toast-hide');
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 250);
    };

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 300);
      }
    }, 4000);
  } catch (err) {
    console.warn('[showToast error]', err);
  }
}
window.showToast = showToast;

// ---------- Doorman Ult Diagnostic Modal ----------
const DOORMAN_TEST_CVARS = [
  {
    key: 'cl_ragdoll_limit',
    labelEn: 'Ragdoll Limit (Doorman Fix)',
    labelFa: 'محدودیت رگ‌دال (فیکس محو شدن آلتیمیت)',
    descEn: 'Setting to 0/1 causes Doorman ult indicator to slowly fade away! Set to -1 to fix.',
    descFa: 'تنظیم روی 0 یا 1 باعث می‌شود نشانگر آلتیمیت دورمن آرام‌آرام محو شود! روی 1- بگذارید.',
    safeVal: '-1',
    buggyVal: '0'
  },
  {
    key: 'g_ragdoll_maxcount',
    labelEn: 'Max Ragdoll Count',
    labelFa: 'حداکثر تعداد رگ‌دال در بازی',
    descEn: 'Controls total simultaneous ragdolls in the world (T1 sets to 0)',
    descFa: 'حداکثر تعداد رگ‌دال‌های همزمان در صحنه (T1 روی 0 می‌گذارد)',
    safeVal: '-1',
    buggyVal: '0'
  },
  {
    key: 'g_ragdoll_important_maxcount',
    labelEn: 'Important Ragdoll Count',
    labelFa: 'تعداد رگ‌دال‌های مهم (هیروها)',
    descEn: 'Limits important entity ragdolls like hero corpses and ult clones',
    descFa: 'تعداد رگ‌دال‌های مهم مثل جنازه هیرو و کلون نشانگر توانایی',
    safeVal: '-1',
    buggyVal: '0'
  },
  {
    key: 'cl_disable_ragdolls',
    labelEn: 'Disable Ragdolls',
    labelFa: 'غیرفعال‌سازی کامل رگ‌دال‌ها',
    descEn: 'If enabled (1), completely kills hero ragdolls and Doorman clone',
    descFa: 'اگر فعال (1) باشد، رگ‌دال‌ها و کلون نشانگر دورمن را کلاً حذف می‌کند',
    safeVal: '0',
    buggyVal: '1'
  },
  {
    key: 'r_particle_model_new8',
    labelEn: '3D Particle Models',
    labelFa: 'مدل‌های سه‌بعدی ذرات (Particle Models)',
    descEn: 'Disables newer 3D models instanced inside particle systems',
    descFa: 'مدل‌های سه‌بعدی ساخته‌شده درون سیستم پارتیکل را غیرفعال می‌کند',
    safeVal: '1',
    buggyVal: '0'
  },
  {
    key: 'r_size_cull_threshold',
    labelEn: 'Screen Size Culling',
    labelFa: 'حذف آبجکت‌ها بر اساس اندازه تصویر (Size Cull)',
    descEn: 'Aggressively culls/hides objects & meshes taking <1.2% of screen',
    descFa: 'آبجکت‌ها و افکت‌های کوچکتر از ۱.۲ درصد صفحه را کلاً مخفی می‌کند',
    safeVal: '0',
    buggyVal: '1.2'
  },
  {
    key: 'r_physics_particle_op_spawn_scale',
    labelEn: 'Physics Particles Spawn',
    labelFa: 'اسپاون ذرات مبتنی بر فیزیک',
    descEn: 'Prevents physics-based particle operator from spawning',
    descFa: 'از ساخت و تولید پارتیکل‌های دارای محاسبات فیزیک جلوگیری می‌کند',
    safeVal: '1',
    buggyVal: '0'
  },
  {
    key: 'r_citadel_npr_outlines_max_dist',
    labelEn: 'Outlines Max Distance',
    labelFa: 'حداکثر برد خطوط دور هیروها (Outlines)',
    descEn: 'Limits hero/marker outlines rendering distance to 600 units (~15m)',
    descFa: 'رندر خطوط و هایلایت دور هیرو را به فاصله ۶۰۰ یونیت محدود می‌کند',
    safeVal: '0',
    buggyVal: '600'
  },
  {
    key: 'r_drawmodeldecals',
    labelEn: 'Model Decals',
    labelFa: 'دکال‌های روی مدل‌ها (Model Decals)',
    descEn: 'Disables decals projected on models/ground surfaces',
    descFa: 'رندر دکال‌ها و نشانه‌های افکت روی مدل‌ها را غیرفعال می‌کند',
    safeVal: '1',
    buggyVal: '0'
  },
  {
    key: 'cl_simulate_dormant_entities',
    labelEn: 'Dormant Entities Simulation',
    labelFa: 'شبیه‌سازی انتیتی‌های دور (Dormant)',
    descEn: 'Stops simulating/updating entities when out of direct sight',
    descFa: 'شبیه‌سازی و آپدیت کاراکترهایی که دور هستند یا تلپورت شدند را قطع می‌کند',
    safeVal: '1',
    buggyVal: '0'
  }
];

let doormanTestState = {};

window.openDoormanModal = async function() {
  const overlay = document.getElementById('modal-doorman-test');
  if (!overlay) return;
  const statusEl = document.getElementById('doorman-modal-status');
  if (statusEl) statusEl.style.display = 'none';

  overlay.style.display = 'flex';

  try {
    const states = await call('get_cvar_test_states');
    if (states && typeof states === 'object') {
      doormanTestState = { ...states };
    }
  } catch (e) {
    console.warn('[doorman-test] failed to load live states:', e);
  }

  for (const item of DOORMAN_TEST_CVARS) {
    if (doormanTestState[item.key] === undefined || doormanTestState[item.key] === 'default') {
      doormanTestState[item.key] = item.buggyVal;
    }
  }

  renderDoormanToggles();
};

window.closeDoormanModal = function() {
  const overlay = document.getElementById('modal-doorman-test');
  if (overlay) overlay.style.display = 'none';
};

window.renderDoormanToggles = function() {
  const list = document.getElementById('doorman-toggles-list');
  if (!list) return;
  const isFa = document.body.classList.contains('lang-fa');
  const t = window.I18N && window.I18N[isFa ? 'fa' : 'en'] ? window.I18N[isFa ? 'fa' : 'en'] : {};

  list.innerHTML = '';
  for (const item of DOORMAN_TEST_CVARS) {
    const currentVal = doormanTestState[item.key] !== undefined ? String(doormanTestState[item.key]) : item.buggyVal;
    const isSafe = currentVal === item.safeVal;

    const card = document.createElement('div');
    card.className = 'doorman-toggle-card' + (isSafe ? ' is-active' : '');

    const info = document.createElement('div');
    info.className = 'doorman-card-info';

    const top = document.createElement('div');
    top.className = 'doorman-card-top';

    const key = document.createElement('span');
    key.className = 'doorman-card-key';
    key.textContent = item.key;

    const lbl = document.createElement('span');
    lbl.className = 'doorman-card-label';
    lbl.textContent = isFa ? item.labelFa : item.labelEn;

    top.appendChild(key);
    top.appendChild(lbl);

    const desc = document.createElement('div');
    desc.className = 'doorman-card-detail';
    desc.textContent = isFa ? item.descFa : item.descEn;

    info.appendChild(top);
    info.appendChild(desc);

    const ctrl = document.createElement('div');
    ctrl.className = 'doorman-card-control';

    const valTag = document.createElement('span');
    valTag.className = 'doorman-state-val ' + (isSafe ? 'is-fixed' : 'is-buggy');
    valTag.textContent = `${currentVal} (${isSafe ? (t.cvarSafeFixed || 'Fixed') : (t.cvarBuggyT1 || 'T1')})`;

    const swWrap = document.createElement('label');
    swWrap.className = 'switch-toggle';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = isSafe;
    chk.onchange = (e) => {
      doormanTestState[item.key] = e.target.checked ? item.safeVal : item.buggyVal;
      renderDoormanToggles();
    };
    const slider = document.createElement('span');
    slider.className = 'slider-toggle';

    swWrap.appendChild(chk);
    swWrap.appendChild(slider);

    ctrl.appendChild(valTag);
    ctrl.appendChild(swWrap);

    card.appendChild(info);
    card.appendChild(ctrl);
    list.appendChild(card);
  }
};

window.setAllDoormanToggles = function(preset) {
  for (const item of DOORMAN_TEST_CVARS) {
    doormanTestState[item.key] = preset === 'safe' ? item.safeVal : item.buggyVal;
  }
  renderDoormanToggles();
};

window.applyDoormanTestStates = async function() {
  const btn = document.getElementById('btn-apply-doorman-test');
  const statusEl = document.getElementById('doorman-modal-status');
  const isFa = document.body.classList.contains('lang-fa');
  const t = window.I18N && window.I18N[isFa ? 'fa' : 'en'] ? window.I18N[isFa ? 'fa' : 'en'] : {};

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.style.display = 'none';
  }

  try {
    const res = await call('apply_cvar_test_states', { states: doormanTestState });
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.className = 'doorman-modal-status';
      statusEl.textContent = t.doormanAppliedMsg || res;
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.className = 'doorman-modal-status is-error';
      statusEl.textContent = (t.doormanErrorMsg || 'Error: ') + err;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ---------- FOV & ASPECT RATIO ----------
function setVideoFov(v, persistSetting = true) {
  const num = typeof v === 'number' ? v : Number(v) || 90;
  const snapped = Math.min(90, Math.max(70, Math.round((num - 70) / 5) * 5 + 70));
  state.fov = snapped;
  const slider = document.getElementById('fov-slider');
  const number = document.getElementById('fov-number');
  const chip = document.getElementById('fov-video-val');
  if (slider) slider.value = snapped;
  if (number) number.value = snapped;
  if (chip) chip.textContent = snapped + '°';
  if (persistSetting && window.__TAURI__) {
    call('set_settings', { patch: { fov: snapped } }).catch(() => {});
  }
}

function setFov(v, persistSetting = true) {
  setVideoFov(v, persistSetting);
}

function setAspectRatio(val, persistSetting = true) {
  let str = String(val !== undefined && val !== null ? val : '2.15').trim();
  let num = parseFloat(str);
  if (isNaN(num) || num < 1.0 || num > 4.0) {
    num = 2.15;
    str = '2.15';
  } else {
    str = num.toFixed(2);
  }
  state.aspectRatio = str;
  const input = document.getElementById('ar-input');
  const slider = document.getElementById('ar-slider');
  if (input && document.activeElement !== input) input.value = str;
  if (slider) slider.value = num;

  document.querySelectorAll('.ar-presets-row .ar-pill').forEach((pill) => {
    const pillText = pill.textContent.trim();
    pill.classList.toggle('active', pillText.startsWith(str));
  });

  if (persistSetting && window.__TAURI__) {
    call('set_settings', { patch: { aspect_ratio: str } }).catch(() => {});
  }
}

function toggleAspectRatio(enabled, persistSetting = true) {
  const isEn = !!enabled;
  state.aspectRatioEnabled = isEn;
  const sw = document.getElementById('sw-ar-enable');
  if (sw) sw.checked = isEn;
  const controlsBody = document.getElementById('ar-controls-body');
  const disabledMsg = document.getElementById('ar-disabled-msg');
  const input = document.getElementById('ar-input');
  if (controlsBody) controlsBody.style.display = isEn ? '' : 'none';
  if (disabledMsg) disabledMsg.style.display = isEn ? 'none' : '';
  if (input) input.disabled = !isEn;
  if (persistSetting && window.__TAURI__) {
    call('set_settings', { patch: { aspect_ratio_enabled: isEn } }).catch(() => {});
  }
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
  const ms = s.avg_ms !== null && s.avg_ms !== undefined ? s.avg_ms : s.ping_ms;
  const jitter = s.jitter_ms || 0;
  const loss = s.loss_pct || 0;

  // Severe penalty for packet loss (unplayable if loss > 15%)
  const lossPenalty = loss * 12;

  // Jitter is only a subtle tie-breaker (0.25 pt per ms, capped at 15)
  const jitterPenalty = Math.min(15, jitter * 0.25);

  // Ping dominates 85%+: 1000 base score minus ping * 3.5
  // Frankfurt (87ms, 20ms jitter) = ~690
  // Madrid (127ms, 8ms jitter) = ~553
  // Lower ping ALWAYS wins decisively over jitter differences!
  const score = 1000 - (ms * 3.5) - jitterPenalty - lossPenalty;
  return Math.max(0, Math.round(score));
}

function qualityState(s) {
  if (s.ping_ms === null || s.ping_ms === undefined) return 'offline';
  const ms = s.avg_ms !== null && s.avg_ms !== undefined ? s.avg_ms : s.ping_ms;
  const loss = s.loss_pct || 0;
  if (loss > 15) return 'unstable';
  if (ms <= 95 && loss <= 2) return 'excellent';
  if (ms <= 135 && loss <= 5) return 'stable';
  if (ms <= 175 && loss <= 10) return 'stable';
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
  const name = state.lang === 'fa' ? (s.name_fa || s.name) : (s.name || s.id.toUpperCase());
  const region = (state.lang === 'fa' ? (s.region_name_fa || s.region_fa || s.region) : (s.region_name || s.region || '')).toUpperCase();
  const code = (s.id || '').toUpperCase();
  const jitter = s.jitter_ms !== null && s.jitter_ms !== undefined ? `±${s.jitter_ms} ms` : '—';
  const loss = s.loss_pct !== null && s.loss_pct !== undefined ? `${s.loss_pct.toFixed(0)}%` : '0%';
  const dot = stateDot(st);
  const hist = (PING_HISTORY[s.id] || []).map((h) => h.ms);
  const isBlocked = !!s.is_blocked;
  const isTop5 = !!s.is_top5;

  const toggleBtnText = isBlocked ? t('unblockServer') : t('blockServer');
  const toggleBtnIcon = isBlocked ? 'fa-lock-open' : 'fa-ban';
  const statusBadge = isBlocked
    ? `<span class="pc-status-badge badge-blocked"><i class="fa-solid fa-ban"></i> ${t('serverBlocked')}</span>`
    : `<span class="pc-status-badge badge-active"><i class="fa-solid fa-circle-check"></i> ${t('serverActive')}</span>`;
  const optimalLabel = state.lang === 'fa' ? 'بهینه' : 'OPTIMAL';
  const top5Badge = isTop5 ? `<span class="pc-badge-top5"><i class="fa-solid fa-star"></i> ${optimalLabel}</span>` : '';

  if (featured) {
    return `
      <div class="featured-card ${isBlocked ? 'is-blocked' : ''}">
        <div class="fc-glow-accent"></div>
        <div class="fc-top-ribbon">
          <div class="fc-recommend-tag">
            <i class="fa-solid fa-crown"></i>
            <span>${t('recommended')} — ${t('bestRoute')}</span>
          </div>
          <div class="fc-badges-wrap">
            ${top5Badge}
            <span class="fc-region-badge">${region}</span>
          </div>
        </div>

        <div class="fc-body-row">
          <div class="fc-info-col">
            <div class="fc-name-title">
              <img src="assets/flags/${s.id}.png" class="featured-server-flag" alt="" onerror="this.style.display='none'">
              <span class="fc-city-name">${name}</span>
              <span class="fc-cluster-code">${code}</span>
            </div>
            <div class="fc-telemetry-chips">
              <span class="fc-chip"><span class="pc-dot st-text-${st}">${dot}</span> ${t(routeLabel(st))}</span>
              <span class="fc-chip"><i class="fa-solid fa-wave-square"></i> ${t('jitter')} <span class="ltr-val">${jitter}</span></span>
              <span class="fc-chip"><i class="fa-solid fa-shield-halved"></i> ${t('loss')} <span class="ltr-val">${loss}</span></span>
              <span class="fc-chip fc-ip-chip" data-tooltip="Relay IP"><span class="ltr-val">${s.primary_ip || s.ip}</span></span>
            </div>
            <div class="fc-sparkline-wrap">
              ${offline ? '<div class="spark-flat"></div>' : sparkline(hist, st, true)}
            </div>
          </div>

          <div class="fc-action-col">
            <div class="fc-ping-display mono ${offline ? 'is-offline' : 'st-text-' + st}">
              <span class="fc-ping-number">${offline ? '—' : (s.ping_ms || '—')}</span>
              <span class="fc-ping-unit">${offline ? '' : 'ms'}</span>
            </div>
            <div class="fc-btn-wrap">
              ${statusBadge}
              <button class="fc-btn-toggle ${isBlocked ? 'is-blocked-action' : 'is-allow-action'}" onclick="toggleCluster('${s.id}', ${!isBlocked})">
                <i class="fa-solid ${toggleBtnIcon}"></i> <span>${toggleBtnText}</span>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="ping-card st-${st} ${isBlocked ? 'is-blocked' : ''} ${isTop5 ? 'is-top5' : ''}">
      <div class="pc-header-row">
        <div class="pc-title-col">
          <div class="pc-name-line">
            <img src="assets/flags/${s.id}.png" class="server-flag" alt="" onerror="this.style.display='none'">
            <span class="pc-name">${name}</span>
            <span class="pc-cluster-code">${code}</span>
            ${top5Badge}
          </div>
          <div class="pc-region-line">${region}</div>
        </div>
        <div class="pc-ping-badge mono ${offline ? 'is-offline' : 'st-text-' + st}">
          <span class="pc-ping-num">${offline ? '—' : (s.ping_ms || '—')}</span>
          <span class="pc-ping-unit">${offline ? '' : 'ms'}</span>
        </div>
      </div>

      <div class="pc-metrics-row">
        <div class="pc-metric"><span class="pc-dot st-text-${st}">${dot}</span> ${t(routeLabel(st))}</div>
        <div class="pc-metric"><i class="fa-solid fa-wave-square"></i> <span class="ltr-val">${jitter}</span></div>
        <div class="pc-metric"><i class="fa-solid fa-shield-halved"></i> <span class="ltr-val">${loss}</span></div>
      </div>

      <div class="pc-action-row">
        ${statusBadge}
        <button class="pc-btn-toggle ${isBlocked ? 'is-blocked-action' : 'is-allow-action'}" onclick="toggleCluster('${s.id}', ${!isBlocked})">
          <i class="fa-solid ${toggleBtnIcon}"></i> <span>${toggleBtnText}</span>
        </button>
      </div>
    </div>`;
}

function dnsCardHtml(p) {
  const name = state.lang === 'fa' ? (p.name_fa || p.name) : p.name;
  const desc = state.lang === 'fa' ? (p.desc_fa || p.desc) : p.desc;
  const tag = state.lang === 'fa' ? (p.tag_fa || p.tag) : p.tag;
  const isIr = p.id.includes('radar') || p.id.includes('electro') || p.id.includes('shecan') || p.id.includes('403') || p.id.includes('begzar') || p.id.includes('shelter') || p.id.includes('beshkan') || p.id.includes('pishgaman') || p.id.includes('irancell') || p.id.includes('mci');
  const isActive = !!p.is_active;
  const pingVal = p.ping_ms !== null && p.ping_ms !== undefined ? `${p.ping_ms} ms` : '—';

  return `
    <div class="dns-card ${isActive ? 'is-active' : ''}" id="dns-card-${p.id}">
      <div class="dns-top-row">
        <div class="dns-name">${name}</div>
        <span class="dns-tag ${isIr ? 'tag-ir' : ''}">${tag}</span>
      </div>
      <div class="dns-desc">${desc}</div>
      <div class="dns-ips-box mono">
        <span>${p.primary}</span> · <span>${p.secondary}</span>
      </div>
      <div class="dns-footer-row">
        <div class="dns-latency-val mono"><i class="fa-solid fa-bolt"></i> ${pingVal}</div>
        <button class="btn-apply-dns-card ${isActive ? 'is-active' : ''}" onclick="applyDnsProfile('${p.id}')">
          ${isActive ? `<i class="fa-solid fa-circle-check"></i> ${t('activeDnsBadge')}` : `<i class="fa-solid fa-check"></i> ${t('applyDnsBtn')}`}
        </button>
      </div>
    </div>`;
}

function renderServerGrid() {
  const grid = document.getElementById('ping-grid');
  const slot = document.getElementById('best-route-slot');
  if (!grid || !Array.isArray(state.valveClusters)) return;

  const reg = state.selectedServerRegion || 'all';
  const filtered = state.valveClusters.filter((c) => {
    if (reg === 'all') return true;
    if (reg === 'south_america') return c.region === 'south_america' || c.region === 'africa' || c.region === 'oceania';
    return c.region === reg;
  });

  filtered.sort((a, b) => {
    const pA = a.avg_ms ?? a.ping_ms ?? 9999;
    const pB = b.avg_ms ?? b.ping_ms ?? 9999;
    if (pA !== pB) return pA - pB;
    return routeScore(b) - routeScore(a);
  });

  const online = state.valveClusters.filter((s) => s.ping_ms !== null && s.ping_ms !== undefined);
  const best = online.length
    ? online.reduce((a, b) => (routeScore(b) > routeScore(a) ? b : a))
    : null;

  if (slot) {
    if (reg === 'all' && best) {
      slot.innerHTML = relayCardHtml(best, true);
    } else {
      slot.innerHTML = '';
    }
  }

  grid.innerHTML = '';
  for (const s of filtered) {
    if (reg === 'all' && best && s.id === best.id) continue;
    const tpl = document.createElement('template');
    tpl.innerHTML = relayCardHtml(s, false).trim();
    const el = tpl.content.firstElementChild;
    grid.appendChild(el);
  }

  updateLatencyHeroPills();
  updateServerFilterCounts();
  updatePresetSelect();
}

function updateServerFilterCounts() {
  if (!Array.isArray(state.valveClusters) || state.valveClusters.length === 0) return;
  const total = state.valveClusters.length;
  const eu = state.valveClusters.filter((c) => c.region === 'europe').length;
  const me = state.valveClusters.filter((c) => c.region === 'middle_east').length;
  const asia = state.valveClusters.filter((c) => c.region === 'asia').length;
  const na = state.valveClusters.filter((c) => c.region === 'north_america').length;
  const other = state.valveClusters.filter((c) => c.region === 'south_america' || c.region === 'africa' || c.region === 'oceania').length;

  const badgeCount = document.getElementById('badge-servers-count');
  if (badgeCount) badgeCount.textContent = total;

  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach((p) => {
    const r = p.dataset.region;
    let label = '';
    let count = total;
    if (r === 'all') { label = t('filterAll'); count = total; }
    else if (r === 'europe') { label = t('filterEurope'); count = eu; }
    else if (r === 'middle_east') { label = t('filterMiddleEast'); count = me; }
    else if (r === 'asia') { label = t('filterAsia'); count = asia; }
    else if (r === 'north_america') { label = t('filterNAmerica'); count = na; }
    else if (r === 'south_america') { label = t('filterOther'); count = other; }
    if (label) {
      p.textContent = `${label} (${count})`;
    }
  });
}

function renderDnsGrid() {
  const grid = document.getElementById('dns-grid');
  if (!grid || !Array.isArray(state.dnsProfiles)) return;
  grid.innerHTML = state.dnsProfiles.map((p) => dnsCardHtml(p)).join('');
  const badge = document.getElementById('badge-dns-count');
  if (badge) {
    badge.textContent = state.dnsProfiles.length;
  }
  updateLatencyHeroPills();
}

function updateLatencyHeroPills() {
  const dnsValEl = document.getElementById('pill-dns-val');
  const srvValEl = document.getElementById('pill-servers-val');
  const shieldValEl = document.getElementById('pill-shield-val');

  if (dnsValEl) {
    const active = Array.isArray(state.dnsProfiles) ? state.dnsProfiles.find((p) => p.is_active) : null;
    if (active) {
      dnsValEl.textContent = state.lang === 'fa' ? (active.name_fa || active.name) : active.name;
    } else {
      dnsValEl.textContent = state.lang === 'fa' ? 'پیش‌فرض (DHCP)' : 'DHCP (Default)';
    }
  }

  if (srvValEl) {
    if (Array.isArray(state.valveClusters) && state.valveClusters.length > 0) {
      const total = state.valveClusters.length;
      const blocked = state.valveClusters.filter((c) => c.is_blocked).length;
      const allowed = total - blocked;
      srvValEl.textContent = state.lang === 'fa' ? `${allowed} سرور باز` : `${allowed} Open / ${blocked} Blocked`;
    } else {
      srvValEl.textContent = state.lang === 'fa' ? '۳۶ سرور' : '36 Servers';
    }
  }

  if (shieldValEl) {
    const isShieldOn = document.getElementById('tweak-check-shield')?.checked;
    shieldValEl.textContent = isShieldOn ? (state.lang === 'fa' ? 'فعال (ایزوله)' : 'Active') : (state.lang === 'fa' ? 'غیرفعال' : 'Off');
  }
}

function switchLatencySubtab(subtab) {
  state.latencySubtab = subtab;
  const tabs = ['servers', 'dns', 'tweaks'];
  tabs.forEach((tName) => {
    const btn = document.getElementById(`subtab-btn-${tName}`);
    const view = document.getElementById(`subview-${tName}`);
    if (btn) btn.classList.toggle('active', tName === subtab);
    if (view) view.style.display = tName === subtab ? '' : 'none';
  });
}

function filterServersByRegion(region) {
  state.selectedServerRegion = region;
  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.region === region);
  });
  renderServerGrid();
}

async function checkAdminStatus() {
  try {
    const isAdmin = await call('check_admin_status');
    state.isAdmin = !!isAdmin;
    const gate = document.getElementById('latency-admin-gate');
    const content = document.getElementById('latency-content-wrapper');
    const topPingBtn = document.getElementById('btn-refresh-ping');

    if (gate && content) {
      if (state.isAdmin) {
        gate.style.display = 'none';
        content.style.display = 'flex';
        if (topPingBtn && state.activeTab === 'latency') topPingBtn.style.display = '';
        checkFirewallStatus().catch(() => {});
      } else {
        gate.style.display = 'flex';
        content.style.display = 'none';
        if (topPingBtn) topPingBtn.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('[checkAdminStatus error]', err);
  }
}

async function restartAsAdmin() {
  const gateBtn = document.getElementById('btn-admin-gate-restart');
  if (gateBtn) {
    gateBtn.classList.add('is-loading');
    gateBtn.disabled = true;
  }
  setBusyCursor(true, 'latency');
  try {
    await call('restart_as_admin');
  } catch (err) {
    if (gateBtn) {
      gateBtn.classList.remove('is-loading');
      gateBtn.disabled = false;
    }
    setBusyCursor(false, 'latency');
      showModalAlert(
        state.lang === 'fa' ? 'خطا در اجرای برنامه با دسترسی Admin' : 'Failed to Restart as Administrator',
        String(err)
      );
    }
  }

  async function checkFirewallStatus() {
    try {
      const isEnabled = await call('check_firewall_status');
      state.firewallEnabled = !!isEnabled;
      const warn = document.getElementById('latency-firewall-warning');
      if (warn) {
        warn.style.display = isEnabled ? 'none' : 'flex';
      }
    } catch (err) {
      console.warn('[checkFirewallStatus error]', err);
    }
  }

  async function enableWindowsFirewall() {
    const btn = document.getElementById('btn-enable-firewall');
    if (btn) {
      btn.classList.add('is-loading');
      btn.disabled = true;
    }
    setBusyCursor(true, 'latency');
    try {
      await call('enable_firewall_cmd');
      state.firewallEnabled = true;
      const warn = document.getElementById('latency-firewall-warning');
      if (warn) warn.style.display = 'none';
      showToast(t('firewallEnabledToast') || 'Windows Firewall enabled!', 'success');
    } catch (err) {
      showModalAlert(
        state.lang === 'fa' ? 'خطا در فعال‌سازی فایروال' : 'Firewall Activation Error',
        String(err)
      );
    } finally {
      if (btn) {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
      setBusyCursor(false, 'latency');
    }
  }

let latencyBenchmarkActive = false;

async function refreshLatencySuite(forceLoading = false) {
  if (latencyBenchmarkActive) return;
  latencyBenchmarkActive = true;

  const btn = document.getElementById('btn-benchmark-all');
  const topBtn = document.getElementById('btn-refresh-ping');
  const progWrap = document.getElementById('latency-progress-wrap');
  const progBar = document.getElementById('latency-progress-bar');
  const progPct = document.getElementById('latency-progress-pct');

  if (btn) btn.disabled = true;
  if (topBtn) topBtn.disabled = true;
  setBusyCursor(true, 'latency');

  if (progWrap && progBar && progPct) {
    progWrap.style.display = 'flex';
    progBar.style.width = '15%';
    progPct.textContent = '15%';
  }

  try {
    // 1. Initial parallel cluster & DNS ping in Rust (runs in ~2.5s)
    if (progBar && progPct) {
      setTimeout(() => {
        progBar.style.width = '45%';
        progPct.textContent = '45%';
      }, 400);
      setTimeout(() => {
        progBar.style.width = '75%';
        progPct.textContent = '75%';
      }, 1000);
    }

    const [clusters, dnsProfiles] = await Promise.all([
      call('ping_valve_clusters'),
      call('ping_dns_profiles'),
    ]);

    state.valveClusters = clusters;
    state.dnsProfiles = dnsProfiles;
    state.lastValvePings = clusters;

    for (const c of clusters) pushHistory(c);

    renderServerGrid();
    renderDnsGrid();

    if (progBar && progPct) {
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      setTimeout(() => {
        if (progWrap) progWrap.style.display = 'none';
      }, 600);
    }

    lastTestAt = Date.now();
    startAgoTicker();
    const footer = document.getElementById('net-footer');
    if (footer) {
      footer.style.display = 'flex';
      const time = new Date(lastTestAt).toLocaleTimeString(state.lang === 'fa' ? 'fa-IR' : 'en-GB');
      const onlineCount = clusters.filter((c) => c.ping_ms !== null).length;
      footer.innerHTML = `<span>${t('lastTest')} · ${time}</span><span>${onlineCount}/${clusters.length} ${t('relaysOnline')}</span>`;
    }
  } catch (err) {
    console.error('[refreshLatencySuite error]', err);
    showToast(String(err), 'error');
  } finally {
    setBusyCursor(false, 'latency');
    if (btn) btn.disabled = false;
    if (topBtn) topBtn.disabled = false;
    latencyBenchmarkActive = false;
  }
}

async function doDeepBenchmark() {
  if (latencyBenchmarkActive) return;
  latencyBenchmarkActive = true;

  const deepBtn = document.getElementById('btn-deep-benchmark');
  const btn = document.getElementById('btn-benchmark-all');
  const topBtn = document.getElementById('btn-refresh-ping');
  const progWrap = document.getElementById('latency-progress-wrap');
  const progBar = document.getElementById('latency-progress-bar');
  const progPct = document.getElementById('latency-progress-pct');
  const progTitle = document.getElementById('latency-progress-title');

  if (deepBtn) deepBtn.disabled = true;
  if (btn) btn.disabled = true;
  if (topBtn) topBtn.disabled = true;
  setBusyCursor(true, 'latency');

  if (progWrap && progBar && progPct) {
    progWrap.style.display = 'flex';
    progBar.style.width = '3%';
    progPct.textContent = '3%';
    if (progTitle) progTitle.textContent = t('deepBenchmarkingTitle');
  }

  // Smooth live progress ticker over 30 seconds
  const startTime = Date.now();
  const totalDuration = 30500;
  const progressTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const pct = Math.min(96, Math.floor((elapsed / totalDuration) * 96));
    if (progBar && progPct) {
      progBar.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;
    }
  }, 400);

  try {
    const [clusters, dnsProfiles] = await Promise.all([
      call('deep_benchmark_clusters_cmd', { durationSecs: 30 }),
      call('deep_benchmark_dns_cmd', { durationSecs: 30 }),
    ]);

    clearInterval(progressTimer);

    state.valveClusters = clusters;
    state.dnsProfiles = dnsProfiles;
    state.lastValvePings = clusters;

    for (const c of clusters) pushHistory(c);

    renderServerGrid();
    renderDnsGrid();

    if (progBar && progPct) {
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      setTimeout(() => {
        if (progWrap) progWrap.style.display = 'none';
        if (progTitle) progTitle.textContent = t('benchmarkingTitle');
      }, 700);
    }

    lastTestAt = Date.now();
    startAgoTicker();
    const footer = document.getElementById('net-footer');
    if (footer) {
      footer.style.display = 'flex';
      const time = new Date(lastTestAt).toLocaleTimeString(state.lang === 'fa' ? 'fa-IR' : 'en-GB');
      const onlineCount = clusters.filter((c) => c.ping_ms !== null).length;
      footer.innerHTML = `<span>${t('lastTest')} · ${time} (Deep 30s)</span><span>${onlineCount}/${clusters.length} ${t('relaysOnline')}</span>`;
    }

    showToast(t('deepBenchmarkDoneToast'), 'success');
  } catch (err) {
    clearInterval(progressTimer);
    console.error('[doDeepBenchmark error]', err);
    showToast(String(err), 'error');
  } finally {
    clearInterval(progressTimer);
    setBusyCursor(false, 'latency');
    if (deepBtn) deepBtn.disabled = false;
    if (btn) btn.disabled = false;
    if (topBtn) topBtn.disabled = false;
    latencyBenchmarkActive = false;
  }
}

// ---------- Regional Metro Hub Grouping ----------
const METRO_GROUPS = [
  ['sto', 'sto2', 'dsto'],      // Stockholm, Sweden (Kista, Bromma, Datapacket)
  ['fra', 'dfra', 'fsn'],       // Germany (Frankfurt, Frankfurt 2, Falkenstein)
  ['vie', 'dvie'],              // Vienna, Austria
  ['lhr', 'dlhr'],              // London, UK
  ['bom2', 'maa2'],             // India (Mumbai & Chennai)
];

function getMetroSiblings(id) {
  for (const group of METRO_GROUPS) {
    if (group.includes(id)) return group;
  }
  return [id];
}

function getOptimalServerIds(clusters) {
  const online = (clusters || []).filter(c => c.ping_ms != null && c.ping_ms > 0);
  if (!online.length) return [];

  // Sort ascending by effective ping
  online.sort((a, b) => {
    const pA = a.avg_ms ?? a.ping_ms ?? 9999;
    const pB = b.avg_ms ?? b.ping_ms ?? 9999;
    return pA - pB;
  });

  const best = online[0];
  const minPing = best.avg_ms ?? best.ping_ms;
  // Threshold: servers within 15ms of lowest ping (or 15% delta)
  const maxAllowed = Math.max(minPing + 15, Math.round(minPing * 1.15));

  const optimalSet = new Set();
  for (const c of online) {
    const p = c.avg_ms ?? c.ping_ms;
    if (p <= maxAllowed && (c.loss_pct == null || c.loss_pct <= 3)) {
      // Include this cluster AND all siblings in its metro group!
      for (const sib of getMetroSiblings(c.id)) {
        optimalSet.add(sib);
      }
    }
  }

  // Fallback: ensure at least the best server's entire metro group is included
  if (optimalSet.size === 0 && online.length > 0) {
    for (const sib of getMetroSiblings(best.id)) {
      optimalSet.add(sib);
    }
  }

  return Array.from(optimalSet);
}

async function toggleCluster(id, blocked) {
  if (state.firewallEnabled === false) {
    showToast(t('firewallDisabledAlert'), 'warning');
  }
  const siblings = getMetroSiblings(id);
  try {
    for (const sibId of siblings) {
      await call('toggle_cluster_block', { id: sibId, blocked });
      if (Array.isArray(state.valveClusters)) {
        const c = state.valveClusters.find((item) => item.id === sibId);
        if (c) c.is_blocked = blocked;
      }
    }
    renderServerGrid();
    const sibNames = siblings.map(s => s.toUpperCase()).join(' & ');
    const msg = blocked
      ? (state.lang === 'fa' ? `سرورهای منطقه (${sibNames}) مسدود شدند` : `Region servers (${sibNames}) blocked`)
      : (state.lang === 'fa' ? `سرورهای منطقه (${sibNames}) مجاز شدند` : `Region servers (${sibNames}) unblocked`);
    showToast(msg, 'success');
  } catch (err) {
    showToast(String(err), 'error');
    showModalAlert(state.lang === 'fa' ? 'خطا در فایروال' : 'Firewall Error', String(err.message || err));
  }
}

async function lockToTop5() {
  if (!Array.isArray(state.valveClusters)) return;
  const online = state.valveClusters.filter((c) => c.ping_ms !== null);
  if (online.length === 0) {
    showToast(state.lang === 'fa' ? 'هنوز سروری تست نشده است. ابتدا پایش سرورها انجام می‌شود...' : 'No servers tested yet. Running benchmark first...', 'info');
    await refreshLatencySuite(true);
  }

  const btn = document.querySelector('.btn-tool-top5');
  const progWrap = document.getElementById('latency-progress-wrap');
  const progBar = document.getElementById('latency-progress-bar');
  const progPct = document.getElementById('latency-progress-pct');
  const progTitle = document.getElementById('latency-progress-title');

  let origHtml = '';
  if (btn) {
    origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${state.lang === 'fa' ? 'در حال اعمال...' : 'Applying...'}</span>`;
  }
  setBusyCursor(true, 'latency');

  if (progWrap && progBar && progPct && progTitle) {
    progWrap.style.display = 'flex';
    progBar.style.width = '35%';
    progPct.textContent = '35%';
    progTitle.textContent = state.lang === 'fa' ? 'در حال محاسبه و اعمال سرورهای بهینه...' : 'Calculating & applying optimal servers...';
  }

  try {
    const optimalIds = getOptimalServerIds(state.valveClusters);
    if (progBar && progPct) {
      progBar.style.width = '75%';
      progPct.textContent = '75%';
    }

    await call('apply_top5_clusters', { top5Ids: optimalIds });
    for (const c of state.valveClusters) {
      c.is_blocked = !optimalIds.includes(c.id);
      c.is_top5 = optimalIds.includes(c.id);
    }
    renderServerGrid();

    if (progBar && progPct && progTitle) {
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      progTitle.textContent = state.lang === 'fa' ? 'سرورهای بهینه با موفقیت اعمال شدند!' : 'Optimal servers applied successfully!';
    }

    const srvNames = optimalIds.map((id) => id.toUpperCase()).join(', ');
    showToast(state.lang === 'fa' ? `سرورهای بهینه فعال شدند: ${srvNames}` : `Optimal servers activated: ${srvNames}`, 'success');
  } catch (err) {
    if (progBar) progBar.style.background = '#ef4444';
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در اعمال سرورها' : 'Server Apply Error', String(err.message || err), [{ label: t('ok') }]);
  } finally {
    setTimeout(() => {
      if (progWrap) {
        progWrap.style.display = 'none';
        if (progBar) progBar.style.background = '';
      }
    }, 700);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (origHtml) btn.innerHTML = origHtml;
    }
    setBusyCursor(false, 'latency');
  }
}

async function allowEuropeOnly() {
  if (!Array.isArray(state.valveClusters)) return;
  const euClusters = state.valveClusters.filter((c) => c.region === 'europe');
  const euIds = euClusters.map((c) => c.id);

  try {
    await call('apply_top5_clusters', { top5Ids: euIds });
    for (const c of state.valveClusters) {
      c.is_blocked = !euIds.includes(c.id);
    }
    renderServerGrid();
    showToast(t('btnAllowEu'), 'success');
  } catch (err) {
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در فایروال' : 'Firewall Error', String(err.message || err), [{ label: t('ok') }]);
  }
}

async function unblockAllRelays() {
  const btn = document.querySelector('.btn-tool-unblock');
  const icon = btn ? btn.querySelector('i') : null;
  const origIconClass = icon ? icon.className : '';
  if (btn) btn.disabled = true;
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  setBusyCursor(true, 'latency');

  try {
    await call('unblock_all_clusters');
    if (Array.isArray(state.valveClusters)) {
      for (const c of state.valveClusters) {
        c.is_blocked = false;
      }
    }
    state.activePresetId = 'all_open';
    renderServerGrid();
    updatePresetSelect();
    updatePresetStatusText();
    updateLatencyHeroPills();
    showToast(t('unblockedAllToast'), 'success');
  } catch (err) {
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در فایروال' : 'Firewall Error', String(err.message || err), [{ label: t('ok') }]);
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.className = origIconClass;
    setBusyCursor(false, 'latency');
  }
}

// ---------- Server Presets Engine ----------
const DEFAULT_SERVER_PRESETS = [
  {
    id: 'all_open',
    nameKey: 'presetAllOpen',
    getBlockedIds: () => []
  },
  {
    id: 'bypass_germany',
    nameKey: 'presetBypassGermany',
    // Blocks all Germany (fra, dfra, fsn) + Austria & Poland transit bridges (vie, dvie, waw) + non-EU
    // Leaves only: Stockholm, Helsinki, London, Amsterdam, Paris, Madrid
    getBlockedIds: (clusters) => {
      const safeEu = new Set(['sto', 'sto2', 'dsto', 'hel', 'lhr', 'dlhr', 'ams', 'par', 'mad']);
      return clusters.filter(c => !safeEu.has(c.id)).map(c => c.id);
    }
  },
  {
    id: 'eu_only',
    nameKey: 'presetEuOnly',
    getBlockedIds: (clusters) => clusters.filter(c => c.region !== 'europe').map(c => c.id)
  },
  {
    id: 'eu_west_north',
    nameKey: 'presetEuWestNorth',
    getBlockedIds: (clusters) => {
      const euWestNorth = new Set(['fra', 'dfra', 'fsn', 'ams', 'lhr', 'dlhr', 'par', 'mad', 'sto', 'sto2', 'dsto', 'hel']);
      return clusters.filter(c => !euWestNorth.has(c.id)).map(c => c.id);
    }
  },
  {
    id: 'dubai_only',
    nameKey: 'presetDubai',
    getBlockedIds: (clusters) => clusters.filter(c => c.id !== 'dxb').map(c => c.id)
  },
  {
    id: 'nordic_only',
    nameKey: 'presetNordic',
    getBlockedIds: (clusters) => {
      const nordic = new Set(['sto', 'sto2', 'dsto', 'hel']);
      return clusters.filter(c => !nordic.has(c.id)).map(c => c.id);
    }
  },
  {
    id: 'top5',
    nameKey: 'presetTop5',
    getBlockedIds: (clusters) => {
      const optimalIds = getOptimalServerIds(clusters);
      const optimalSet = new Set(optimalIds);
      return clusters.filter(c => !optimalSet.has(c.id)).map(c => c.id);
    }
  }
];

function loadCustomPresets() {
  try {
    const raw = localStorage.getItem('dlphub_custom_server_presets');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomPresets(list) {
  try {
    localStorage.setItem('dlphub_custom_server_presets', JSON.stringify(list));
  } catch (e) {}
}

function updatePresetSelect() {
  const sel = document.getElementById('preset-select');
  const delBtn = document.getElementById('btn-del-preset');
  if (!sel) return;

  const currentPresetId = state.activePresetId || 'all_open';
  const customPresets = loadCustomPresets();

  sel.innerHTML = '';
  // Built-in presets
  DEFAULT_SERVER_PRESETS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = t(p.nameKey);
    if (p.id === currentPresetId) opt.selected = true;
    sel.appendChild(opt);
  });

  // Custom presets
  if (customPresets.length > 0) {
    const optGroup = document.createElement('optgroup');
    optGroup.label = state.lang === 'fa' ? 'پروفایل‌های شخصی شما' : 'Your Custom Presets';
    customPresets.forEach((cp) => {
      const opt = document.createElement('option');
      opt.value = cp.id;
      opt.textContent = `★ ${cp.name}`;
      if (cp.id === currentPresetId) opt.selected = true;
      optGroup.appendChild(opt);
    });
    sel.appendChild(optGroup);
  }

  // Show delete button only if currently selected preset is a custom one
  const isCustom = customPresets.some(cp => cp.id === currentPresetId);
  if (delBtn) {
    delBtn.style.display = isCustom ? 'inline-flex' : 'none';
  }

  updatePresetStatusText();
}

function updatePresetStatusText() {
  const statusEl = document.getElementById('spb-status-text');
  if (!statusEl || !Array.isArray(state.valveClusters)) return;
  const total = state.valveClusters.length;
  const blocked = state.valveClusters.filter(c => c.is_blocked).length;
  const allowed = total - blocked;
  if (state.lang === 'fa') {
    statusEl.textContent = `${allowed} سرور فعال / ${blocked} مسدود`;
  } else {
    statusEl.textContent = `${allowed} active / ${blocked} blocked`;
  }
}

async function onPresetSelected(presetId) {
  if (!Array.isArray(state.valveClusters) || state.valveClusters.length === 0) return;
  state.activePresetId = presetId;

  let blockedIds = [];
  let presetName = '';

  const defaultPreset = DEFAULT_SERVER_PRESETS.find(p => p.id === presetId);
  if (defaultPreset) {
    presetName = t(defaultPreset.nameKey);
    blockedIds = defaultPreset.getBlockedIds(state.valveClusters);
  } else {
    const customPresets = loadCustomPresets();
    const custom = customPresets.find(cp => cp.id === presetId);
    if (custom) {
      presetName = custom.name;
      blockedIds = custom.blocked_ids || [];
    }
  }

  try {
    await call('apply_cluster_preset_cmd', { blockedIds });
    for (const c of state.valveClusters) {
      c.is_blocked = blockedIds.includes(c.id);
    }
    renderServerGrid();
    updatePresetSelect();
    updatePresetStatusText();
    updateLatencyHeroPills();
    showToast(t('presetAppliedToast').replace('{name}', presetName), 'success');
  } catch (err) {
    showToast(String(err), 'error');
  }
}

function openSavePresetModal() {
  const modal = document.getElementById('modal-save-preset');
  const input = document.getElementById('input-preset-name');
  if (modal) modal.style.display = 'flex';
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

function closeSavePresetModal() {
  const modal = document.getElementById('modal-save-preset');
  if (modal) modal.style.display = 'none';
}

function confirmSavePreset() {
  const input = document.getElementById('input-preset-name');
  const name = (input ? input.value : '').trim();
  if (!name) {
    showToast(state.lang === 'fa' ? 'لطفاً یک نام وارد کنید' : 'Please enter a name', 'warning');
    return;
  }

  if (!Array.isArray(state.valveClusters)) return;
  const blockedIds = state.valveClusters.filter(c => c.is_blocked).map(c => c.id);
  const customPresets = loadCustomPresets();

  const newId = 'custom_' + Date.now();
  customPresets.push({
    id: newId,
    name,
    blocked_ids: blockedIds
  });

  saveCustomPresets(customPresets);
  closeSavePresetModal();
  state.activePresetId = newId;
  updatePresetSelect();
  showToast(t('presetSavedToast').replace('{name}', name), 'success');
}

function deleteCurrentCustomPreset() {
  const currentPresetId = state.activePresetId;
  const customPresets = loadCustomPresets();
  const target = customPresets.find(cp => cp.id === currentPresetId);
  if (!target) return;

  const msg = t('confirmDeletePreset').replace('{name}', target.name);
  if (!confirm(msg)) return;

  const filtered = customPresets.filter(cp => cp.id !== currentPresetId);
  saveCustomPresets(filtered);

  showToast(t('presetDeletedToast'), 'info');
  // Revert selection to all_open
  onPresetSelected('all_open');
}

async function applyDnsProfile(id) {
  try {
    await call('apply_dns_profile', { id });
    if (Array.isArray(state.dnsProfiles)) {
      for (const p of state.dnsProfiles) {
        p.is_active = p.id === id;
      }
    }
    renderDnsGrid();
    const prof = state.dnsProfiles.find((p) => p.id === id);
    const pName = prof ? (state.lang === 'fa' ? prof.name_fa : prof.name) : id;
    showToast(t('appliedDnsToast').replace('{name}', pName), 'success');
  } catch (err) {
    showToast(String(err), 'error');
  }
}

async function resetDnsToDhcp() {
  try {
    await call('reset_dns_dhcp');
    if (Array.isArray(state.dnsProfiles)) {
      for (const p of state.dnsProfiles) {
        p.is_active = false;
      }
    }
    renderDnsGrid();
    showToast(t('resetDhcpToast'), 'success');
  } catch (err) {
    showToast(String(err), 'error');
  }
}

async function doFlushDns() {
  try {
    await call('flush_dns_cmd');
    showToast(t('btnFlushDns'), 'success');
  } catch (err) {
    showToast(String(err), 'error');
  }
}

async function doSmartOptimize() {
  if (state.firewallEnabled === false) {
    showToast(t('firewallDisabledAlert'), 'warning');
  }
  const btn = document.getElementById('btn-smart-optimize');
  const revertBtn = document.getElementById('btn-revert-network');
  const benchBtn = document.getElementById('btn-benchmark-all');
  const deepBtn = document.getElementById('btn-deep-benchmark');

  const progWrap = document.getElementById('latency-progress-wrap');
  const progBar = document.getElementById('latency-progress-bar');
  const progPct = document.getElementById('latency-progress-pct');
  const progTitle = document.getElementById('latency-progress-title');

  let origBtnHtml = '';
  if (btn) {
    origBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${state.lang === 'fa' ? 'در حال بهینه‌سازی...' : 'Optimizing...'}</span>`;
  }
  if (revertBtn) revertBtn.disabled = true;
  if (benchBtn) benchBtn.disabled = true;
  if (deepBtn) deepBtn.disabled = true;

  setBusyCursor(true, 'latency');

  if (progWrap && progBar && progPct && progTitle) {
    progWrap.style.display = 'flex';
    progBar.style.width = '15%';
    progPct.textContent = '15%';
    progTitle.textContent = state.lang === 'fa' ? 'در حال پایش و سنجش پینگ سرورها...' : 'Measuring cluster latencies...';
  }

  try {
    if (!state.valveClusters || state.valveClusters.length === 0 || !state.dnsProfiles) {
      if (progBar && progPct) {
        progBar.style.width = '30%';
        progPct.textContent = '30%';
      }
      await refreshLatencySuite(true);
    }

    if (progBar && progPct && progTitle) {
      progBar.style.width = '50%';
      progPct.textContent = '50%';
      progTitle.textContent = state.lang === 'fa' ? 'در حال فعال‌سازی بهترین دی‌ان‌اس ضد تحریم...' : 'Activating optimal anti-sanction DNS...';
    }

    // 1. Find Best DNS (lowest ping)
    const onlineDns = [...(state.dnsProfiles || [])].sort((a, b) => (a.ping_ms || 9999) - (b.ping_ms || 9999));
    const bestDns = onlineDns.length ? onlineDns[0] : null;

    if (bestDns) {
      await call('apply_dns_profile', { id: bestDns.id });
      for (const p of state.dnsProfiles) {
        p.is_active = p.id === bestDns.id;
      }
    }

    if (progBar && progPct && progTitle) {
      progBar.style.width = '75%';
      progPct.textContent = '75%';
      progTitle.textContent = state.lang === 'fa' ? 'در حال کانفیگ فایروال برای سرورهای کم‌پینگ و هم‌منطقه...' : 'Configuring firewall for optimal regional clusters...';
    }

    // 2. Find Optimal Servers (within 15ms of lowest ping + metro cohesion)
    const optimalIds = getOptimalServerIds(state.valveClusters);
    await call('apply_top5_clusters', { top5Ids: optimalIds });

    for (const c of state.valveClusters) {
      c.is_blocked = !optimalIds.includes(c.id);
      c.is_top5 = optimalIds.includes(c.id);
    }

    renderServerGrid();
    renderDnsGrid();

    if (progBar && progPct && progTitle) {
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      progTitle.textContent = state.lang === 'fa' ? 'بهینه‌سازی هوشمند شبکه با موفقیت اعمال شد!' : 'Smart network optimization completed successfully!';
    }

    const dnsName = bestDns ? (state.lang === 'fa' ? bestDns.name_fa : bestDns.name) : 'DNS';
    const srvNames = optimalIds.map((id) => id.toUpperCase()).join(', ');
    showToast(t('smartOptimizeToast').replace('{servers}', srvNames).replace('{dns}', dnsName), 'success');
  } catch (err) {
    if (progBar) progBar.style.background = '#ef4444';
    if (progTitle) progTitle.textContent = state.lang === 'fa' ? 'خطا در بهینه‌سازی شبکه' : 'Smart Optimization Error';
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در بهینه‌سازی شبکه' : 'Optimization Failed', String(err.message || err), [{ label: t('ok') }]);
  } finally {
    setTimeout(() => {
      if (progWrap) {
        progWrap.style.display = 'none';
        if (progBar) progBar.style.background = '';
      }
    }, 700);

    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (origBtnHtml) btn.innerHTML = origBtnHtml;
    }
    if (revertBtn) revertBtn.disabled = false;
    if (benchBtn) benchBtn.disabled = false;
    if (deepBtn) deepBtn.disabled = false;

    setBusyCursor(false, 'latency');
  }
}

async function doRevertNetwork() {
  const btn = document.getElementById('btn-revert-network');
  const optBtn = document.getElementById('btn-smart-optimize');
  const benchBtn = document.getElementById('btn-benchmark-all');
  const deepBtn = document.getElementById('btn-deep-benchmark');

  const progWrap = document.getElementById('latency-progress-wrap');
  const progBar = document.getElementById('latency-progress-bar');
  const progPct = document.getElementById('latency-progress-pct');
  const progTitle = document.getElementById('latency-progress-title');

  let origBtnHtml = '';
  if (btn) {
    origBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${state.lang === 'fa' ? 'در حال بازگردانی...' : 'Reverting...'}</span>`;
  }
  if (optBtn) optBtn.disabled = true;
  if (benchBtn) benchBtn.disabled = true;
  if (deepBtn) deepBtn.disabled = true;

  setBusyCursor(true, 'latency');

  if (progWrap && progBar && progPct && progTitle) {
    progWrap.style.display = 'flex';
    progBar.style.width = '25%';
    progPct.textContent = '25%';
    progTitle.textContent = state.lang === 'fa' ? 'در حال حذف رول‌های فایروال سرورها...' : 'Removing server firewall rules...';
  }

  try {
    await call('unblock_all_clusters');

    if (progBar && progPct && progTitle) {
      progBar.style.width = '60%';
      progPct.textContent = '60%';
      progTitle.textContent = state.lang === 'fa' ? 'در حال بازگردانی دی‌ان‌اس به حالت خودکار (DHCP)...' : 'Resetting DNS adapter to DHCP...';
    }

    await call('reset_dns_dhcp');

    if (progBar && progPct && progTitle) {
      progBar.style.width = '85%';
      progPct.textContent = '85%';
      progTitle.textContent = state.lang === 'fa' ? 'در حال پاکسازی کش شبکه و DNS...' : 'Flushing DNS cache...';
    }

    await call('flush_dns_cmd').catch(() => {});

    if (Array.isArray(state.valveClusters)) {
      for (const c of state.valveClusters) {
        c.is_blocked = false;
      }
    }
    if (Array.isArray(state.dnsProfiles)) {
      for (const p of state.dnsProfiles) {
        p.is_active = false;
      }
    }
    renderServerGrid();
    renderDnsGrid();

    if (progBar && progPct && progTitle) {
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      progTitle.textContent = state.lang === 'fa' ? 'تمام تنظیمات شبکه با موفقیت بازگردانده شدند!' : 'All network settings reverted to defaults!';
    }

    showToast(t('unblockedAllToast'), 'success');
  } catch (err) {
    if (progBar) progBar.style.background = '#ef4444';
    if (progTitle) progTitle.textContent = state.lang === 'fa' ? 'خطا در بازگردانی شبکه' : 'Network Reset Error';
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در بازگردانی شبکه' : 'Revert Failed', String(err.message || err), [{ label: t('ok') }]);
  } finally {
    setTimeout(() => {
      if (progWrap) {
        progWrap.style.display = 'none';
        if (progBar) progBar.style.background = '';
      }
    }, 700);

    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (origBtnHtml) btn.innerHTML = origBtnHtml;
    }
    if (optBtn) optBtn.disabled = false;
    if (benchBtn) benchBtn.disabled = false;
    if (deepBtn) deepBtn.disabled = false;

    setBusyCursor(false, 'latency');
  }
}

async function saveLatencyTweaks() {
  const btn = document.querySelector('.btn-save-tweaks');
  let origHtml = '';
  if (btn) {
    origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${state.lang === 'fa' ? 'در حال اعمال...' : 'Applying...'}</span>`;
  }
  setBusyCursor(true, 'latency');

  const tweaks = {
    bandwidth_shield: !!document.getElementById('tweak-check-shield')?.checked,
    qos_enabled: !!document.getElementById('tweak-check-qos')?.checked,
    throttling_disabled: !!document.getElementById('tweak-check-throttling')?.checked,
    nic_opt_enabled: !!document.getElementById('tweak-check-nic')?.checked,
    netcode_opt_enabled: !!document.getElementById('tweak-check-netcode')?.checked,
  };

  try {
    const res = await call('apply_latency_tweaks_cmd', { tweaks });
    updateLatencyHeroPills();
    showToast(t('tweaksAppliedToast'), 'success');
  } catch (err) {
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در اعمال توئیک‌ها' : 'Tweaks Error', String(err.message || err), [{ label: t('ok') }]);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (origHtml) btn.innerHTML = origHtml;
    }
    setBusyCursor(false, 'latency');
  }
}

async function revertLatencyTweaks() {
  const btn = document.querySelector('#subview-tweaks .btn-cyber-ghost');
  let origHtml = '';
  if (btn) {
    origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${state.lang === 'fa' ? 'در حال بازگردانی...' : 'Reverting...'}</span>`;
  }
  setBusyCursor(true, 'latency');

  try {
    await call('revert_latency_tweaks_cmd');
    const shieldChk = document.getElementById('tweak-check-shield');
    if (shieldChk) shieldChk.checked = false;
    updateLatencyHeroPills();
    showToast(t('tweaksRevertedToast'), 'success');
  } catch (err) {
    showToast(String(err), 'error');
    showModal(state.lang === 'fa' ? 'خطا در بازگردانی توئیک‌ها' : 'Tweaks Revert Error', String(err.message || err), [{ label: t('ok') }]);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (origHtml) btn.innerHTML = origHtml;
    }
    setBusyCursor(false, 'latency');
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

// Backward-compatibility alias
function renderValvePings(pings) {
  if (typeof renderServerGrid === 'function') {
    renderServerGrid();
  }
}
window.renderValvePings = renderValvePings;

async function refreshValvePings(forceLoading = false) {
  return refreshLatencySuite(forceLoading);
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
  if (pingBtn) pingBtn.style.display = tabKey === 'latency' && state.isAdmin ? '' : 'none';
  const isBusyNow = state.busyTab && (state.busyTab === 'global' || state.busyTab === tabKey);
  updateCursorFollower();
  if (tabKey === 'latency') {
    checkAdminStatus().then(() => {
      if (state.isAdmin) {
        if (!state.valveClusters || state.valveClusters.length === 0) {
          call('get_valve_clusters').then((cl) => {
            state.valveClusters = cl;
            renderServerGrid();
          }).catch(() => {});
          call('get_dns_profiles').then((dp) => {
            state.dnsProfiles = dp;
            renderDnsGrid();
          }).catch(() => {});
          refreshLatencySuite(false);
        } else {
          renderServerGrid();
          renderDnsGrid();
        }
      }
    });
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

async function updateMaximizedState() {
  const w = getWin();
  if (!w || typeof w.isMaximized !== 'function') return;
  try {
    const maxed = await w.isMaximized();
    document.documentElement.classList.toggle('is-maximized', !!maxed);
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
  if (mode === 'SOON') return;
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
window.setVideoFov = setVideoFov;
window.setAspectRatio = setAspectRatio;
window.toggleAspectRatio = toggleAspectRatio;
window.applyReducedMotion = applyReducedMotion;
window.toggleReducedMotion = toggleReducedMotion;
window.copyLaunchOpt = copyLaunchOpt;
window.restartAsAdmin = restartAsAdmin;
window.refreshLatencySuite = refreshLatencySuite;
window.switchLatencySubtab = switchLatencySubtab;
window.filterServersByRegion = filterServersByRegion;
window.toggleCluster = toggleCluster;
window.lockToTop5 = lockToTop5;
window.allowEuropeOnly = allowEuropeOnly;
window.unblockAllRelays = unblockAllRelays;
window.applyDnsProfile = applyDnsProfile;
window.resetDnsToDhcp = resetDnsToDhcp;
window.doFlushDns = doFlushDns;
window.doSmartOptimize = doSmartOptimize;
window.doRevertNetwork = doRevertNetwork;
window.saveLatencyTweaks = saveLatencyTweaks;
window.revertLatencyTweaks = revertLatencyTweaks;
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
    window.addEventListener('resize', () => {
      updateScale();
      clearTimeout(updateMaximizedState._t);
      updateMaximizedState._t = setTimeout(updateMaximizedState, 120);
    });
    updateMaximizedState();
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

    const btnLang = document.getElementById('btn-lang-toggle');
    if (btnLang) btnLang.onclick = window.toggleLang;

    const btnPick = document.getElementById('btn-pick-folder');
    if (btnPick) btnPick.onclick = pickFolder;
    const btnConfirm = document.getElementById('btn-confirm-path');
    if (btnConfirm) btnConfirm.onclick = confirmPath;
    const btnLaunch = document.getElementById('btn-launch');
    if (btnLaunch) btnLaunch.onclick = launchGame;
    document.querySelectorAll('.social-card[data-url]').forEach((b) => {
      b.onclick = () => openExternal(b.dataset.url);
    });
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) btnInstall.onclick = doInstall;
    const btnBackup = document.getElementById('btn-backup');
    if (btnBackup) btnBackup.onclick = doBackupNow;
    const btnRevert = document.getElementById('btn-revert-vanilla');
    if (btnRevert) btnRevert.onclick = doRevertVanilla;
    const btnUnlock = document.getElementById('btn-unlock');
    if (btnUnlock) btnUnlock.onclick = doUnlock;
    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) btnResetSettings.onclick = doResetSettings;
    const btnCopyDiag = document.getElementById('btn-copy-diag');
    if (btnCopyDiag) btnCopyDiag.onclick = doCopyDiagnostics;

    const swBreakables = document.getElementById('sw-better-breakables');
    if (swBreakables) {
      swBreakables.onchange = (e) => {
        state.betterBreakables = e.target.checked;
        call('set_settings', { patch: { better_breakables: e.target.checked } }).catch(() => {});
      };
    }

    const swBrightness = document.getElementById('sw-higher-brightness');
    if (swBrightness) {
      swBrightness.onchange = (e) => {
        state.higherBrightness = e.target.checked;
        call('set_settings', { patch: { higher_brightness: e.target.checked } }).catch(() => {});
      };
    }

    const swClutter = document.getElementById('sw-reduce-clutter');
    if (swClutter) {
      swClutter.onchange = (e) => {
        state.reduceClutter = e.target.checked;
        call('set_settings', { patch: { reduce_clutter: e.target.checked } }).catch(() => {});
      };
    }

    const swCloth = document.getElementById('sw-cloth-anim');
    if (swCloth) {
      swCloth.onchange = (e) => {
        state.stopClothAnim = e.target.checked;
        call('set_settings', { patch: { stop_cloth_anim: e.target.checked } }).catch(() => {});
      };
    }

    const swFade = document.getElementById('sw-ragdoll-fade');
    if (swFade) {
      swFade.onchange = (e) => {
        state.ragdollFade = e.target.checked;
        call('set_settings', { patch: { ragdoll_fade: e.target.checked } }).catch(() => {});
      };
    }

    const slider = document.getElementById('fov-slider');
    const number = document.getElementById('fov-number');
    if (slider) slider.oninput = () => setVideoFov(Number(slider.value));
    if (number) number.onchange = () => setVideoFov(Number(number.value) || 90);
    const fovBox = document.querySelector('.setting-box.fov-box');
    if (fovBox) {
      fovBox.addEventListener('wheel', (e) => {
        if (e.target && e.target.closest && e.target.closest('.fov-part-video')) {
          e.preventDefault();
          setVideoFov(Number(slider ? slider.value : 90) + (e.deltaY < 0 ? 5 : -5));
        }
      }, { passive: false });
    }
    const fovDefaultTick = document.getElementById('fov-default-tick');
    if (fovDefaultTick) {
      fovDefaultTick.onclick = () => setVideoFov(90);
    }

    const swRedMotion = document.getElementById('sw-reduced-motion');
    if (swRedMotion) {
      swRedMotion.onchange = (e) => toggleReducedMotion(e.target.checked);
    }

    const swAr = document.getElementById('sw-ar-enable');
    if (swAr) {
      swAr.onchange = (e) => toggleAspectRatio(e.target.checked);
    }

    const arInput = document.getElementById('ar-input');
    if (arInput) {
      arInput.onchange = (e) => setAspectRatio(e.target.value);
    }

    const arSlider = document.getElementById('ar-slider');
    if (arSlider) {
      arSlider.oninput = (e) => setAspectRatio(e.target.value);
    }

    document.querySelectorAll('.tier-card, .tier-card-sm, .option-item.preset').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.dataset.mode === 'SOON') return;
        selectPreset(el.dataset.mode);
      });
    });
    state.selectedMode = 'T1';
    selectPreset('T1');

    document.querySelectorAll('.pro-card[id^="card-"], .sci-card[id^="card-"]').forEach((card) => {
      const key = card.id.replace('card-', '');
      card.addEventListener('click', () => selectCardByKey(key));
    });

    const doormanModal = document.getElementById('modal-doorman-test');
    if (doormanModal) {
      doormanModal.addEventListener('click', (e) => {
        if (e.target === doormanModal) closeDoormanModal();
      });
    }
    const presetModal = document.getElementById('modal-save-preset');
    if (presetModal) {
      presetModal.addEventListener('click', (e) => {
        if (e.target === presetModal) closeSavePresetModal();
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDoormanModal();
        closeSavePresetModal();
      }
    });

    window.onPresetSelected = onPresetSelected;
    window.openSavePresetModal = openSavePresetModal;
    window.closeSavePresetModal = closeSavePresetModal;
    window.confirmSavePreset = confirmSavePreset;
    window.deleteCurrentCustomPreset = deleteCurrentCustomPreset;
    window.enableWindowsFirewall = enableWindowsFirewall;

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
