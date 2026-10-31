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
  const timeoutMs = 25000;
  return Promise.race([
    inv(cmd, args),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[IPC TIMEOUT] ${cmd} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]).catch((err) => {
    console.error(`[IPC ERROR] ${cmd}:`, err);
    return Promise.reject(err);
  });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  lan: 'cardLan',
  advanced: 'cardAdvanced',
};
const PANELS = ['graphic', 'latency', 'lan', 'advanced'];

const HERO_BY_TAB = {
  graphic: { en: 'GRAPHICS CONFIG', fa: 'پیکربندی گرافیک', sub_en: 'Custom FPS boost configuration for deadlock', sub_fa: 'تنظیمات اختصاصی افزایش فریم برای ددلاک' },
  latency: { en: 'NETWORK', fa: 'شبکه', sub_en: 'Server latency & connection diagnostics', sub_fa: 'تشخیص تأخیر و کیفیت اتصال' },
  lan: { en: 'LAN CONNECTION', fa: 'اتصال لن و چندنفره', sub_en: 'Direct LAN matchmaking & VIP Iran server mesh', sub_fa: 'بازی چندنفره تحت شبکه محلی، وی‌پی‌ان و سرور ایران' },
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
  renderModCacheList();
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
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  if (typeof updatePresetDropdownLang === 'function') {
    updatePresetDropdownLang();
  }
  if (typeof updatePresetStatsDisplay === 'function') {
    updatePresetStatsDisplay();
  }
  if (typeof renderDrawer === 'function') {
    renderDrawer();
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
  initArInputInteractions();
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
  if (typeof updateFpsBadge === 'function') updateFpsBadge(fps);

  const renderer = state.renderer || 'default';
  document.querySelectorAll('#renderer-radio-group .renderer-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.renderer === renderer);
  });
  updateRendererGlider();
  updateFpsGlider();
  initArInputInteractions();
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

function updateFpsBadge(val) {
  const badge = document.getElementById('fps-val-badge');
  if (!badge) return;
  if (!val || val === 'DEFAULT' || val === -1 || val === '-1') {
    badge.textContent = 'DEFAULT';
  } else if (val === 0 || val === '0') {
    badge.textContent = 'UNLIMITED';
  } else {
    badge.textContent = `${val} FPS`;
  }
}

function selectFps(val) {
  if (val === 'DEFAULT' || val === null || val === undefined || val === '') {
    state.fpsMax = null;
    document.querySelectorAll('#fps-radio-group .renderer-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fps === 'DEFAULT');
    });
    updateFpsBadge('DEFAULT');
    updateFpsGlider();
    call('set_settings', { patch: { fps_max: -1 } }).catch(() => {});
  } else {
    const num = Number(val) || 0;
    state.fpsMax = num;
    document.querySelectorAll('#fps-radio-group .renderer-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.fps === String(num));
    });
    updateFpsBadge(num);
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
  const apWrap = document.getElementById('active-profile');
  const res = state.detectedTier;
  if (!apLabel) return;
  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';

  let tierName = res || '—';
  if (res === 'T1') tierName = isFa ? 'سطح ۱ (پردازنده)' : 'Level 1 (CPU)';
  else if (res === 'T2') tierName = isFa ? 'سطح ۲ (پردازنده + گرافیک)' : 'Level 2 (CPU + GPU)';
  else if (res === 'T3' || res === 'POTATO') tierName = isFa ? 'سطح ۳ (حالت ذغالی)' : 'Level 3 (Potato)';
  else if (res === 'T1MODS') tierName = isFa ? 'سطح ۱ + مدها' : 'Level 1 + Mods';
  else if (res === 'T2MODS') tierName = isFa ? 'سطح ۲ + مدها' : 'Level 2 + Mods';

  const prefix = isFa ? 'کانفیگ فعال' : 'ACTIVE CONFIG';

  if (res === 'T1' || res === 'T2' || res === 'T3' || res === 'POTATO' || res === 'T1MODS' || res === 'T2MODS') {
    if (apDot) { apDot.className = 'active-dot is-active'; apDot.style.background = ''; apDot.style.color = ''; }
    if (apWrap) apWrap.className = 'active-profile is-active';
    apLabel.innerHTML = `<span class="active-tag-prefix">${prefix}</span><span class="active-tag-sep">·</span><span class="active-tag-val">${tierName}</span>`;
  } else if (res === 'MISSING') {
    if (apDot) { apDot.className = 'active-dot is-missing'; apDot.style.background = ''; apDot.style.color = ''; }
    if (apWrap) apWrap.className = 'active-profile is-missing';
    const missingText = t('currentMissing') || (isFa ? 'پیش‌فرض استیم' : 'Vanilla Steam');
    apLabel.innerHTML = `<span class="active-tag-prefix">${isFa ? 'کانفیگ بازی' : 'GAME CONFIG'}</span><span class="active-tag-sep">·</span><span class="active-tag-val">${missingText}</span>`;
  } else if (res) {
    if (apDot) { apDot.className = 'active-dot is-custom'; apDot.style.background = ''; apDot.style.color = ''; }
    if (apWrap) apWrap.className = 'active-profile is-custom';
    const unknownText = t('currentUnknown') || (isFa ? 'سفارشی' : 'Custom');
    apLabel.innerHTML = `<span class="active-tag-prefix">${prefix}</span><span class="active-tag-sep">·</span><span class="active-tag-val">${unknownText}</span>`;
  } else {
    if (apDot) { apDot.className = 'active-dot is-idle'; apDot.style.background = ''; apDot.style.color = ''; }
    if (apWrap) apWrap.className = 'active-profile is-idle';
    apLabel.innerHTML = `<span class="active-tag-prefix">${prefix}</span><span class="active-tag-sep">·</span><span class="active-tag-val">—</span>`;
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
  default: { file: 'assets/cursors/default.png', x: 12, y: 9, w: 51, h: 51 },
  pointer: { file: 'assets/cursors/pointer.png', x: 13, y: 15, w: 51, h: 51 },
  click: { file: 'assets/cursors/click.png', x: 6, y: 11, w: 51, h: 51 },
  click_right: { file: 'assets/cursors/click_right.png', x: 7, y: 11, w: 51, h: 51 },
  grab: { file: 'assets/cursors/grab.png', x: 23, y: 28, w: 51, h: 51 },
  text: { file: 'assets/cursors/text.png', x: 8, y: 12, w: 51, h: 51 },
  link: { file: 'assets/cursors/link.png', x: 6, y: 14, w: 51, h: 51 },
  help: { file: 'assets/cursors/help.png', x: 7, y: 9, w: 51, h: 51 },
  busy: { file: 'assets/cursors/busy_full.png', x: 35, y: 35, w: 70, h: 70 },
  'nwse-resize': { file: 'assets/cursors/nwse-resize.png', x: 16, y: 14, w: 51, h: 51 },
  'nesw-resize': { file: 'assets/cursors/nesw-resize.png', x: 11, y: 14, w: 51, h: 51 },
  'ns-resize': { file: 'assets/cursors/ns-resize.png', x: 19, y: 17, w: 51, h: 51 },
  'ew-resize': { file: 'assets/cursors/ew-resize.png', x: 26, y: 19, w: 51, h: 51 },
  move: { file: 'assets/cursors/move.png', x: 22, y: 26, w: 51, h: 51 }
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
    cursorEl.style.width = (meta.w || 51) + 'px';
    cursorEl.style.height = (meta.h || 51) + 'px';
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
    const preset = getActivePreset();
    const resolvedEntries = resolvePresetEntries(preset);

    const log = await call('apply_perf_optimization_cmd', {
      req: {
        level: perfState.activeLevel,
        preset_id: perfState.activePresetId,
        preset_name: preset.name,
        entries: resolvedEntries,
        video_settings: preset.videoSettings || [],
        include_engine_sections: !!perfState.includeEngineSections,
        fov: state.fov,
        aspect_ratio: state.aspectRatio || '2.15',
        aspect_ratio_enabled: state.aspectRatioEnabled !== false,
        fps_limit: state.fpsLimit || 'DEFAULT',
        cloth_sim_stop: false,
        ragdoll_fade: false,
        better_breakables: !!state.betterBreakables,
        higher_brightness: !!state.higherBrightness,
        reduce_clutter: !!state.reduceClutter,
        deadlock_path: state.gamePath,
      }
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

async function renderModCacheList() {
  const list = document.getElementById('mod-cache-list');
  if (!list) return;
  let items = [];
  try { items = await call('get_mod_cache_status_cmd'); } catch (_) { return; }
  list.innerHTML = '';
  if (!items || items.length === 0) {
    const d = document.createElement('div');
    d.className = 'option-detail';
    d.textContent = state.lang === 'fa' ? 'هیچ مادی یافت نشد.' : 'No mods found.';
    list.appendChild(d);
    return;
  }
  const isFa = state.lang === 'fa';
  for (const m of items) {
    const row = document.createElement('div');
    row.className = 'mod-cache-row';

    const info = document.createElement('div');
    info.className = 'mod-cache-meta';

    const statusDot = document.createElement('span');
    statusDot.className = 'mod-cache-dot';
    statusDot.style.background = m.is_cached ? 'var(--deadlock-green)' : 'var(--text-muted)';
    if (m.is_cached) {
      statusDot.style.boxShadow = '0 0 6px rgba(34, 197, 94, 0.45)';
    }
    info.appendChild(statusDot);

    const name = document.createElement('span');
    name.className = 'mod-cache-title';
    name.textContent = isFa ? m.display_name_fa : m.display_name_en;
    info.appendChild(name);

    if (isFa && m.display_name_en) {
      const enTag = document.createElement('span');
      enTag.className = 'mod-cache-en-tag';
      enTag.setAttribute('dir', 'ltr');
      enTag.textContent = m.display_name_en;
      info.appendChild(enTag);
    }

    const size = document.createElement('span');
    size.className = 'mod-cache-size';
    size.textContent = formatBytes(m.size_bytes);
    info.appendChild(size);

    const badge = document.createElement('span');
    badge.className = 'mod-cache-badge';
    if (m.is_cached) {
      badge.style.background = 'rgba(34, 197, 94, 0.15)';
      badge.style.color = 'var(--deadlock-green)';
      badge.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      badge.textContent = isFa ? 'ذخیره شده' : 'Cached';
    } else {
      badge.style.background = 'rgba(255, 255, 255, 0.05)';
      badge.style.color = 'var(--text-muted)';
      badge.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      badge.textContent = isFa ? 'دانلود نشده' : 'Not Cached';
    }

    row.appendChild(info);
    row.appendChild(badge);
    list.appendChild(row);
  }
}

async function clearModCacheAction() {
  const btn = document.getElementById('btn-clear-cache');
  if (btn) btn.disabled = true;
  try {
    const freedBytes = await call('clear_mod_cache_cmd');
    const freedStr = formatBytes(freedBytes);
    showModal(
      t('modCacheTitle') || 'Mod Cache',
      `${t('cacheCleared') || 'Mod cache cleared successfully.'}\n${t('cacheFreed') || 'Space freed: '} ${freedStr}`,
      [{ label: t('ok') || 'OK' }]
    );
    await renderModCacheList();
  } catch (err) {
    showModal(t('modCacheTitle') || 'Mod Cache', `Error: ${err}`, [{ label: t('ok') || 'OK' }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function handleModProgressEvent(p) {
  if (!p) return;
  const log = document.getElementById('step-log');
  if (!log) return;
  const isFa = state.lang === 'fa';
  const name = isFa ? p.display_name_fa : p.display_name_en;
  const curMb = (p.current_bytes / (1024 * 1024)).toFixed(1);
  const totalMb = (p.total_bytes / (1024 * 1024)).toFixed(1);

  if (p.status === 'downloading') {
    log.innerHTML = `<span style="color:var(--deadlock-cyan)"><i class="fa-solid fa-cloud-arrow-down fa-bounce"></i> ${isFa ? 'در حال دریافت ماد' : 'Downloading mod'}: <b>${name}</b> (${curMb}MB / ${totalMb}MB · ${p.percent}% · ${p.speed_kbps} KB/s)</span>`;
  } else if (p.status === 'verifying') {
    log.innerHTML = `<span style="color:var(--deadlock-orange)"><i class="fa-solid fa-shield-halved fa-spin"></i> ${isFa ? 'اعتبارسنجی امنیتی هش SHA-256...' : 'Verifying SHA-256 hash...'}</span>`;
  } else if (p.status === 'completed') {
    log.innerHTML = `<span style="color:var(--deadlock-green)"><i class="fa-solid fa-circle-check"></i> ${isFa ? 'ماد با موفقیت تایید و کش شد' : 'Mod verified and cached'} (${name})</span>`;
    setTimeout(() => {
      renderModCacheList();
    }, 400);
  } else if (p.status === 'error') {
    log.innerHTML = `<span style="color:var(--deadlock-red)"><i class="fa-solid fa-triangle-exclamation"></i> ${isFa ? 'خطا در اعتبارسنجی ماد!' : 'Mod verification failed!'}</span>`;
  }
}

async function setupModProgressListener() {
  try {
    if (window.__TAURI__?.event?.listen) {
      await window.__TAURI__.event.listen('mod-download-progress', (event) => {
        handleModProgressEvent(event.payload);
      });
      await window.__TAURI__.event.listen('server-loader-progress', (event) => {
        const p = event.payload;
        if (p) {
          const badge = document.getElementById('lan-lobby-badge');
          if (badge && p.status === 'downloading') {
            badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> دریافت فایل‌های سرور (${p.percent}%)...`;
          } else if (badge && p.status === 'extracting') {
            badge.innerHTML = `<i class="fa-solid fa-box-open"></i> استخراج فایل‌های سرور...`;
          }
          if (p.status === 'completed') {
            showToast('فایل‌های سرور مودشده با موفقیت دریافت و آماده‌سازی شدند', 'success');
          }
        }
      });
    }
  } catch (e) {
    console.warn('Failed to setup download listeners:', e);
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
  const vipCard = document.getElementById('vip-lan-card');
  if (vipCard) vipCard.style.display = 'flex';
}

async function doUnlock() {
  const inp = document.getElementById('unlock-input');
  if (!inp) return;
  const code = inp.value;
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
  let rawStr = String(message || '').trim();
  let cleanMsg = rawStr;
  if (cleanMsg.includes('\n')) {
    cleanMsg = cleanMsg.split('\n')[0].trim();
  }
  if (cleanMsg.length > 120) {
    cleanMsg = cleanMsg.slice(0, 117) + '...';
  }
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
    text.textContent = cleanMsg;

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

// ---------- Enhanced System Error & Diagnostics Modal ----------
let currentFixCommand = '';
let currentErrorReport = '';

function parseSystemError(err) {
  const raw = String(err?.message || err || '').trim();

  // 1. Windows WMI / CIM Repository Corruption
  if (
    /cimserver|broken\s*cim|cannot connect to cim|corrupted and unreadable|0x80041002|0x80041010|qos_policy_error|cimbrokencimsession/i.test(raw)
  ) {
    return {
      category: 'wmi',
      titleKey: 'errWmiTitle',
      subtitleKey: 'errWmiSubtitle',
      descKey: 'errWmiDesc',
      solutionKey: 'errWmiSolution',
      solutionCmd: 'winmgmt /salvagerepository',
      toastKey: 'errWmiToast',
      iconClass: 'fa-solid fa-triangle-exclamation'
    };
  }

  // 2. PowerShell Script Execution Policy Restricted
  if (
    /cannot be loaded because running scripts is disabled|execution_policies|pssecurityexception|script execution is disabled/i.test(raw)
  ) {
    return {
      category: 'psPolicy',
      titleKey: 'errPsPolicyTitle',
      subtitleKey: 'errPsPolicySubtitle',
      descKey: 'errPsPolicyDesc',
      solutionKey: 'errPsPolicySolution',
      solutionCmd: 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force',
      toastKey: 'errPsPolicyToast',
      iconClass: 'fa-solid fa-code'
    };
  }

  // 3. Administrator / Elevation Required
  if (
    /administrator privileges|needsadmin|access is denied|unauthorizedaccessexception|permissiondenied|0x80070005/i.test(raw)
  ) {
    return {
      category: 'admin',
      titleKey: 'errAdminTitle',
      subtitleKey: 'errAdminSubtitle',
      descKey: 'errAdminDesc',
      solutionKey: 'errAdminSolution',
      solutionCmd: null,
      toastKey: 'errAdminToast',
      iconClass: 'fa-solid fa-user-shield'
    };
  }

  // 4. Windows Firewall Inactive / Disabled
  if (/mpssvc|0x80070424|firewall activation error|firewall service/i.test(raw)) {
    return {
      category: 'firewall',
      titleKey: 'errFwTitle',
      subtitleKey: 'errFwSubtitle',
      descKey: 'errFwDesc',
      solutionKey: 'errFwSolution',
      solutionCmd: 'net start mpssvc',
      toastKey: 'errFwToast',
      iconClass: 'fa-solid fa-shield-halved'
    };
  }

  // 5. Windows DNS Client / DHCP Service Disabled (often by Debloater scripts)
  if (
    /dnscache|could not flush the dns resolver cache|set-dnsclientserveraddress.*service|dhcp.*service|the service cannot be started, either because it is disabled/i.test(raw)
  ) {
    return {
      category: 'dnsService',
      titleKey: 'errDnsServiceTitle',
      subtitleKey: 'errDnsServiceSubtitle',
      descKey: 'errDnsServiceDesc',
      solutionKey: 'errDnsServiceSolution',
      solutionCmd: 'sc config dnscache start= auto && net start dnscache',
      toastKey: 'errDnsServiceToast',
      iconClass: 'fa-solid fa-ethernet'
    };
  }

  // 6. Game File Locked / Deadlock or Steam Running
  if (
    /being used by another process|ebusy|file.*locked|sharingviolation|cannot access the file|deadlock\.exe is running/i.test(raw)
  ) {
    return {
      category: 'fileLock',
      titleKey: 'errFileLockTitle',
      subtitleKey: 'errFileLockSubtitle',
      descKey: 'errFileLockDesc',
      solutionKey: 'errFileLockSolution',
      solutionCmd: 'taskkill /f /im deadlock.exe /im citadel.exe',
      toastKey: 'errFileLockToast',
      iconClass: 'fa-solid fa-lock'
    };
  }

  // 7. Network Timeout / Steam SDR Relay Unreachable / ISP Block
  if (
    /failed to fetch valve cluster|no internet|connection timed out|could not resolve host|socketerror|network is unreachable|timed out|10060|10054|err_internet_disconnected/i.test(raw)
  ) {
    return {
      category: 'networkTimeout',
      titleKey: 'errNetTimeoutTitle',
      subtitleKey: 'errNetTimeoutSubtitle',
      descKey: 'errNetTimeoutDesc',
      solutionKey: 'errNetTimeoutSolution',
      solutionCmd: null,
      toastKey: 'errNetTimeoutToast',
      iconClass: 'fa-solid fa-wifi'
    };
  }

  // 8. Antivirus / SmartScreen / Security Interference
  if (
    /operation was canceled by user|blocked by antivirus|windefender|kaspersky|bitdefender|avast|virus or potentially unwanted software|0x800704ec/i.test(raw)
  ) {
    return {
      category: 'antivirus',
      titleKey: 'errAntivirusTitle',
      subtitleKey: 'errAntivirusSubtitle',
      descKey: 'errAntivirusDesc',
      solutionKey: 'errAntivirusSolution',
      solutionCmd: null,
      toastKey: 'errAntivirusToast',
      iconClass: 'fa-solid fa-shield-virus'
    };
  }

  // 9. Insufficient Disk Space
  if (/not enough space on the disk|enospc|0x80070070|disk full/i.test(raw)) {
    return {
      category: 'diskSpace',
      titleKey: 'errDiskSpaceTitle',
      subtitleKey: 'errDiskSpaceSubtitle',
      descKey: 'errDiskSpaceDesc',
      solutionKey: 'errDiskSpaceSolution',
      solutionCmd: 'cleanmgr',
      toastKey: 'errDiskSpaceToast',
      iconClass: 'fa-solid fa-hard-drive'
    };
  }

  // 10. Mod Verification / Hash Mismatch
  if (
    /sha-256 hash mismatch|corrupted download|failed to verify mod|invalid zip|unexpected end of data|corrupted mod/i.test(raw)
  ) {
    return {
      category: 'modCorrupt',
      titleKey: 'errModCorruptTitle',
      subtitleKey: 'errModCorruptSubtitle',
      descKey: 'errModCorruptDesc',
      solutionKey: 'errModCorruptSolution',
      solutionCmd: null,
      toastKey: 'errModCorruptToast',
      iconClass: 'fa-solid fa-file-circle-exclamation'
    };
  }

  // 11. Missing .NET 10 Runtime
  if (/dotnet|missing .net|failed to locate dotnet|deadworks_loader/i.test(raw)) {
    return {
      category: 'dotnet',
      titleKey: 'errDotnetTitle',
      subtitleKey: 'errDotnetSubtitle',
      descKey: 'errDotnetDesc',
      solutionKey: 'errDotnetSolution',
      solutionCmd: null,
      toastKey: 'errDotnetToast',
      iconClass: 'fa-brands fa-windows'
    };
  }

  // 12. Network Adapter Property Limitation
  if (/nic_optimization_error|get-netadapteradvancedproperty|msft_netadapteradvancedproperty/i.test(raw)) {
    return {
      category: 'nic',
      titleKey: 'errNicTitle',
      subtitleKey: 'errNicSubtitle',
      descKey: 'errNicDesc',
      solutionKey: 'errNicSolution',
      solutionCmd: null,
      toastKey: 'errNicToast',
      iconClass: 'fa-solid fa-network-wired'
    };
  }

  // 13. Generic Fallback
  return {
    category: 'generic',
    titleKey: 'errGenericTitle',
    subtitleKey: 'errGenericSubtitle',
    descKey: 'errGenericDesc',
    solutionKey: 'errGenericSolution',
    solutionCmd: null,
    toastKey: 'errGenericToast',
    iconClass: 'fa-solid fa-circle-exclamation'
  };
}

function showAppErrorModal(err, contextTitle = '') {
  if (!err) return;
  const rawText = String(err?.message || err || '').trim();
  window.__lastAppError = rawText;

  // Log to backend app.log
  try {
    call('log_client_error', {
      level: 'ERROR',
      message: `[${contextTitle || 'UI_Error'}] ${rawText}`
    }).catch(() => {});
  } catch (_) {}

  const parsed = parseSystemError(rawText);
  currentFixCommand = parsed.solutionCmd || '';

  const modal = document.getElementById('modal-error-diag');
  if (!modal) {
    showToast(t(parsed.toastKey) || rawText, 'error');
    return;
  }

  // Set titles and icons
  const titleEl = document.getElementById('error-dialog-title');
  if (titleEl) titleEl.textContent = t(parsed.titleKey);

  const subEl = document.getElementById('error-dialog-subtitle');
  if (subEl) subEl.textContent = t(parsed.subtitleKey);

  const iconEl = document.getElementById('error-dialog-badge-icon');
  if (iconEl) iconEl.innerHTML = `<i class="${parsed.iconClass}"></i>`;

  const descEl = document.getElementById('error-dialog-desc');
  if (descEl) descEl.textContent = t(parsed.descKey);

  const solTitleEl = document.getElementById('error-solution-title');
  if (solTitleEl) solTitleEl.textContent = t('errSolutionTitle');

  const solTextEl = document.getElementById('error-solution-text');
  if (solTextEl) solTextEl.textContent = t(parsed.solutionKey);

  const cmdBox = document.getElementById('error-solution-cmd-box');
  const cmdCode = document.getElementById('error-solution-cmd-code');
  const cmdBtnLabel = document.getElementById('btn-copy-fix-label');

  if (parsed.solutionCmd) {
    if (cmdBox) cmdBox.style.display = 'flex';
    if (cmdCode) cmdCode.textContent = parsed.solutionCmd;
    if (cmdBtnLabel) cmdBtnLabel.textContent = t('errBtnCopyFix');
  } else {
    if (cmdBox) cmdBox.style.display = 'none';
  }

  // Technical details
  const techLabel = document.getElementById('error-tech-toggle-label');
  if (techLabel) techLabel.textContent = t('errTechToggleShow');
  const techContent = document.getElementById('error-tech-content');
  if (techContent) techContent.style.display = 'none';
  const chevron = document.getElementById('error-tech-chevron');
  if (chevron) chevron.classList.remove('is-open');

  const rawEl = document.getElementById('error-dialog-raw');
  if (rawEl) rawEl.textContent = rawText;

  // Action buttons
  const copyBtn = document.getElementById('label-copy-err-report');
  if (copyBtn) copyBtn.textContent = t('errBtnCopyReport');

  const logBtn = document.getElementById('label-open-log-folder');
  if (logBtn) logBtn.textContent = t('errBtnOpenLogs');

  const dismissBtn = document.getElementById('label-dismiss-error');
  if (dismissBtn) dismissBtn.textContent = t('errBtnDismiss');

  currentErrorReport = `=== DLPHub Error Report ===\nTime: ${new Date().toISOString()}\nLang: ${state.lang}\nCategory: ${t(parsed.titleKey)}\nContext: ${contextTitle}\n\nTechnical Details:\n${rawText}`;

  modal.style.display = 'flex';
  showToast(t(parsed.toastKey), 'error');
}

function showModalAlert(title, err) {
  showAppErrorModal(err, title);
}

function closeErrorModal() {
  const modal = document.getElementById('modal-error-diag');
  if (modal) modal.style.display = 'none';
}

function toggleTechDetails() {
  const content = document.getElementById('error-tech-content');
  const chevron = document.getElementById('error-tech-chevron');
  const label = document.getElementById('error-tech-toggle-label');
  if (!content) return;
  const isHidden = content.style.display === 'none';
  content.style.display = isHidden ? 'block' : 'none';
  if (chevron) chevron.classList.toggle('is-open', isHidden);
  if (label) label.textContent = isHidden ? t('errTechToggleHide') : t('errTechToggleShow');
}

async function copyFixCommand() {
  if (!currentFixCommand) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(currentFixCommand);
    }
    const lbl = document.getElementById('btn-copy-fix-label');
    if (lbl) {
      const orig = lbl.textContent;
      lbl.textContent = t('errBtnCopiedFix');
      setTimeout(() => { if (lbl) lbl.textContent = orig; }, 1800);
    }
  } catch (e) {
    console.warn('[copyFixCommand error]', e);
  }
}

async function copyErrorReport() {
  if (!currentErrorReport) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(currentErrorReport);
    }
    const lbl = document.getElementById('label-copy-err-report');
    if (lbl) {
      const orig = lbl.textContent;
      lbl.textContent = t('errBtnCopiedReport');
      setTimeout(() => { if (lbl) lbl.textContent = orig; }, 1800);
    }
    showToast(t('diagCopied') || 'Error report copied to clipboard!', 'info');
  } catch (e) {
    console.warn('[copyErrorReport error]', e);
  }
}

async function openLogsFolder() {
  try {
    await call('open_logs_folder');
  } catch (e) {
    console.warn('[openLogsFolder error]', e);
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
  if (isNaN(num)) {
    num = 2.15;
  } else if (num < 1.33) {
    num = 1.33;
  } else if (num > 3.20) {
    num = 3.20;
  }
  str = num.toFixed(2);
  state.aspectRatio = str;
  const input = document.getElementById('ar-input');
  const slider = document.getElementById('ar-slider');
  if (input && document.activeElement !== input) input.value = str;
  if (slider) slider.value = num;

  document.querySelectorAll('.ar-presets-row .ar-pill').forEach((pill) => {
    const pillText = pill.textContent.trim();
    const pillAr = pill.dataset.ar;
    pill.classList.toggle('active', (pillAr && pillAr === str) || pillText.startsWith(str));
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
              <button class="fc-btn-toggle ${isBlocked ? 'is-blocked-action' : 'is-allow-action'}" data-cluster-id="${escapeHtml(s.id)}" data-blocked="${!isBlocked}" onclick="toggleCluster(this.dataset.clusterId, this.dataset.blocked === 'true')">
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
        <button class="pc-btn-toggle ${isBlocked ? 'is-blocked-action' : 'is-allow-action'}" data-cluster-id="${escapeHtml(s.id)}" data-blocked="${!isBlocked}" onclick="toggleCluster(this.dataset.clusterId, this.dataset.blocked === 'true')">
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
        <button class="btn-apply-dns-card ${isActive ? 'is-active' : ''}" data-dns-id="${escapeHtml(p.id)}" onclick="applyDnsProfile(this.dataset.dnsId)">
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
    showAppErrorModal(err, 'allowEuropeOnly');
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
    showAppErrorModal(err, 'unblockAllRelays');
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
    showAppErrorModal(err, 'SmartOptimize');
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
    showAppErrorModal(err, 'LatencyTweaks');
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
    showAppErrorModal(err, 'RevertLatencyTweaks');
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
  const ICONS = { graphic: 'fa-desktop', latency: 'fa-bolt', lan: 'fa-network-wired', advanced: 'fa-sliders' };
  const iconEl = document.getElementById('section-icon');
  if (iconEl && ICONS[tabKey]) {
    iconEl.className = 'fa-solid ' + ICONS[tabKey];
    iconEl.style.fontSize = '13px';
    iconEl.style.color = 'var(--deadlock-orange)';
  }
  if (tabKey === 'lan' && typeof initLanPanel === 'function') {
    initLanPanel();
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
  if (tabKey === 'advanced') {
    renderBackups();
    renderModCacheList();
  }
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
    initPerfSystem();
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
    setupModProgressListener();
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

    // LAN Connection exports
    window.switchLanRole = switchLanRole;
    window.switchVipRole = switchVipRole;
    window.refreshLocalIps = refreshLocalIps;
    window.onLanIpSelected = onLanIpSelected;
    window.toggleBotCountInput = toggleBotCountInput;
    window.createLanLobbyAction = createLanLobbyAction;
    window.joinLanLobbyAction = joinLanLobbyAction;
    window.startLanServerAction = createLanLobbyAction;
    window.joinLanServerAction = joinLanLobbyAction;
    window.probeLanServerAction = probeLanServerAction;
    window.copyClientConsoleCmd = copyClientConsoleCmd;
    window.createVipRoomAction = createVipRoomAction;
    window.joinVipRoomAction = joinVipRoomAction;
    window.leaveActiveSessionAction = leaveActiveSessionAction;
    window.leaveVipRoomAction = leaveActiveSessionAction;
    window.copyVipCode = copyVipCode;
    window.copyVipConnectCmd = copyVipConnectCmd;
    window.copyVipJoinCmd = copyVipJoinCmd;
window.onVipSkipDeadworksChange = onVipSkipDeadworksChange;
window.copyClientShareCmd = copyClientShareCmd;
    window.copyLobbyCode = copyLobbyCode;
    window.onVipSkipDeadworksChange = onVipSkipDeadworksChange;
    window.copyClientShareCmd = copyClientShareCmd;
    window.initLanPanel = initLanPanel;
    window.redeemVipKeyAction = redeemVipKeyAction;
    window.redeemVipExtendKeyAction = redeemVipExtendKeyAction;
    window.toggleVipExtendInput = toggleVipExtendInput;
    window.copyHwid = copyHwid;
    window.startSessionDedicatedServerAction = startSessionDedicatedServerAction;
    window.stopSessionDedicatedServerAction = stopSessionDedicatedServerAction;
    window.joinSessionSelfAction = joinSessionSelfAction;
    window.autoJoinActiveSessionAction = autoJoinActiveSessionAction;
    window.sendAdminCmd = sendAdminCmd;
    window.selectSessionModMode = selectSessionModMode;

    boot();
  } catch (err) {
    fatal(err);
  }
}

// ============================================================
// LAN CONNECTION & MATCHMAKING MANAGER
// ============================================================
const lanState = {
  currentRole: 'host',
  vipRole: 'host',
  vipMode: 'relay',
  serverRunning: false,
  vipRoomCode: null,
  vipHostIp: null,
  vipPollTimer: null,
  localIps: [],
  isVip: false,
  vipUntil: null,
  vipDaysRemaining: null,
  hwid: null,
};

function initLanPanel() {
  refreshLocalIps();
  checkLanServerStatus();
  initVipLicense();
}

async function initVipLicense() {
  try {
    const hwid = await call('get_machine_hwid_cmd');
    lanState.hwid = hwid;
    const hwidEl = document.getElementById('vip-hwid-display');
    if (hwidEl) {
      hwidEl.textContent = hwid;
    }

    const res = await call('check_vip_status_cmd', { apiUrl: null });
    lanState.isVip = !!res.is_vip;
    lanState.vipUntil = res.vip_until;
    lanState.vipDaysRemaining = res.days_remaining;

    updateVipLicenseUI();
  } catch (err) {
    console.warn('[lan] initVipLicense error:', err);
    updateVipLicenseUI();
  }
}

function updateVipLicenseUI() {
  const actBox = document.getElementById('vip-activation-box');
  const statusBar = document.getElementById('vip-status-bar');
  const meshControls = document.getElementById('vip-mesh-controls');
  const remainingEl = document.getElementById('vip-status-remaining');
  const extendBox = document.getElementById('vip-extend-box');

  if (lanState.isVip) {
    if (actBox) actBox.style.display = 'none';
    if (statusBar) statusBar.style.display = 'flex';
    if (meshControls) meshControls.style.display = 'flex';

    if (remainingEl && lanState.vipDaysRemaining !== null && lanState.vipDaysRemaining !== undefined) {
      const days = lanState.vipDaysRemaining;
      if (days >= 1) {
        remainingEl.textContent = t('vipDaysRemaining').replace('{days}', days.toFixed(1));
      } else {
        const hours = Math.max(1, Math.round(days * 24));
        remainingEl.textContent = t('vipHoursRemaining').replace('{hours}', hours);
      }
    }
  } else {
    if (actBox) actBox.style.display = 'flex';
    if (statusBar) statusBar.style.display = 'none';
    if (meshControls) meshControls.style.display = 'none';
    if (extendBox) extendBox.style.display = 'none';
  }
}

async function redeemVipKeyAction() {
  const input = document.getElementById('vip-key-input');
  const btn = document.getElementById('btn-vip-redeem');
  if (!input || !input.value.trim()) {
    showModal(t('vipActTitle'), state.lang === 'fa' ? 'لطفاً کلید لایسنس VIP را وارد کنید.' : 'Please enter your VIP license key.', [{ label: t('ok') }]);
    return;
  }

  const key = input.value.trim().toUpperCase();
  if (btn) btn.disabled = true;

  try {
    const res = await call('redeem_vip_key_cmd', { apiUrl: null, key, nickname: null });
    if (res.success) {
      input.value = '';
      await initVipLicense();
      showModal(
        t('vipActTitle'),
        state.lang === 'fa'
          ? `اشتراک VIP با موفقیت فعال شد! (${(res.days_remaining || 0).toFixed(1)} روز اعتبار)`
          : `VIP subscription activated successfully! (${(res.days_remaining || 0).toFixed(1)} days validity)`,
        [{ label: t('ok') }]
      );
    }
  } catch (err) {
    showModal(t('vipActTitle'), `${t('vipRedeemError')}${err}`, [{ label: t('ok') }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function redeemVipExtendKeyAction() {
  const input = document.getElementById('vip-extend-key-input');
  const btn = document.getElementById('btn-vip-extend-redeem');
  if (!input || !input.value.trim()) return;

  const key = input.value.trim().toUpperCase();
  if (btn) btn.disabled = true;

  try {
    const res = await call('redeem_vip_key_cmd', { apiUrl: null, key, nickname: null });
    if (res.success) {
      input.value = '';
      const extendBox = document.getElementById('vip-extend-box');
      if (extendBox) extendBox.style.display = 'none';
      await initVipLicense();
      showModal(
        t('vipActTitle'),
        state.lang === 'fa'
          ? `اشتراک شما با موفقیت تمدید شد! (${(res.days_remaining || 0).toFixed(1)} روز اعتبار کل)`
          : `Subscription extended successfully! (${(res.days_remaining || 0).toFixed(1)} total days validity)`,
        [{ label: t('ok') }]
      );
    }
  } catch (err) {
    showModal(t('vipActTitle'), `${t('vipRedeemError')}${err}`, [{ label: t('ok') }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function toggleVipExtendInput() {
  const box = document.getElementById('vip-extend-box');
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  }
}

async function copyHwid() {
  if (!lanState.hwid) return;
  await copyToClipboard(lanState.hwid);
  const el = document.getElementById('vip-hwid-display');
  if (el) {
    const orig = el.textContent;
    el.textContent = state.lang === 'fa' ? 'کپی شد!' : 'Copied!';
    setTimeout(() => { el.textContent = orig; }, 1800);
  }
}

function switchLanRole(role) {
  lanState.currentRole = role;
  const hostBtn = document.getElementById('btn-lan-role-host');
  const clientBtn = document.getElementById('btn-lan-role-client');
  const hostPanel = document.getElementById('lan-panel-host');
  const clientPanel = document.getElementById('lan-panel-client');
  if (role === 'host') {
    if (hostBtn) hostBtn.classList.add('active');
    if (clientBtn) clientBtn.classList.remove('active');
    if (hostPanel) hostPanel.style.display = 'flex';
    if (clientPanel) clientPanel.style.display = 'none';
  } else {
    if (hostBtn) hostBtn.classList.remove('active');
    if (clientBtn) clientBtn.classList.add('active');
    if (hostPanel) hostPanel.style.display = 'none';
    if (clientPanel) clientPanel.style.display = 'flex';
  }
}

function switchVipRole(role) {
  lanState.vipRole = role;
  const hostBtn = document.getElementById('btn-vip-role-host');
  const joinBtn = document.getElementById('btn-vip-role-join');
  const hostPanel = document.getElementById('vip-panel-host');
  const joinPanel = document.getElementById('vip-panel-join');
  if (role === 'host') {
    if (hostBtn) hostBtn.classList.add('active');
    if (joinBtn) joinBtn.classList.remove('active');
    if (hostPanel) hostPanel.style.display = 'flex';
    if (joinPanel) joinPanel.style.display = 'none';
  } else {
    if (hostBtn) hostBtn.classList.remove('active');
    if (joinBtn) joinBtn.classList.add('active');
    if (hostPanel) hostPanel.style.display = 'none';
    if (joinPanel) joinPanel.style.display = 'flex';
    refreshVipLobbiesList();
  }
}

async function refreshLocalIps() {
  const sel = document.getElementById('lan-host-ip-select');
  if (!sel) return;
  try {
    const ips = await call('get_lan_local_ips');
    lanState.localIps = ips || [];
    sel.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '0.0.0.0';
    defOpt.textContent = state.lang === 'fa' ? '0.0.0.0 (تمام کارت‌های شبکه)' : '0.0.0.0 (All Interfaces)';
    sel.appendChild(defOpt);
    for (const item of lanState.localIps) {
      const opt = document.createElement('option');
      opt.value = item.ip;
      opt.textContent = `${item.ip} (${item.interface_name})`;
      sel.appendChild(opt);
    }
  } catch (err) {
    console.warn('[lan] refreshLocalIps failed:', err);
  }
}

function onLanIpSelected(val) {
  const custom = document.getElementById('lan-host-ip-custom');
  if (custom) {
    custom.style.display = val === 'custom' ? 'block' : 'none';
  }
}

function toggleBotCountInput(checked) {
  const el = document.getElementById('lan-bot-count-wrap');
  if (el) el.style.display = checked ? 'flex' : 'none';
}

async function checkLanServerStatus() {
  try {
    const status = await call('get_lan_server_status');
    lanState.serverRunning = !!status.is_running;
    updateServerStatusUI(status);
  } catch (err) {
    console.warn('[lan] checkLanServerStatus failed:', err);
  }
}

let lobbyPollTimer = null;

function updateServerStatusUI(status) {
  const isRunning = status && status.is_running;
  const isCrashed = status && status.crashed;
  const startBtn = document.getElementById('btn-lan-start-server');
  const stopBtn = document.getElementById('btn-lan-stop-server');
  const copyBtn = document.getElementById('btn-lan-copy-connect');
  const joinSelfBtn = document.getElementById('btn-lan-join-self');
  const liveControls = document.getElementById('lan-live-controls');
  const hintEl = document.getElementById('lan-server-hint');
  const statusDot = document.getElementById('lan-status-dot');
  const statusText = document.getElementById('lan-status-text');

  if (isRunning) {
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'flex';
    if (copyBtn) copyBtn.style.display = 'flex';
    if (joinSelfBtn) joinSelfBtn.style.display = 'flex';
    if (liveControls) liveControls.style.display = 'flex';
    if (hintEl) hintEl.style.display = 'flex';
    if (statusDot) { statusDot.className = 'lan-status-dot active'; }
    if (statusText) { statusText.textContent = state.lang === 'fa' ? `آنلاین (شناسه: ${status.pid || 'فعال'})` : `ONLINE (PID: ${status.pid || 'Active'})`; statusText.style.color = '#22c55e'; }
    startLobbyStatusPolling();
  } else if (isCrashed) {
    if (startBtn) {
      startBtn.style.display = 'flex';
      startBtn.disabled = false;
    }
    if (stopBtn) stopBtn.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
    if (joinSelfBtn) joinSelfBtn.style.display = 'none';
    if (liveControls) liveControls.style.display = 'none';
    if (hintEl) hintEl.style.display = 'none';
    if (statusDot) { statusDot.className = 'lan-status-dot crashed'; }
    if (statusText) {
      const exitMsg = (status.exit_code !== undefined && status.exit_code !== null) ? ` (کد خروج: ${status.exit_code})` : '';
      statusText.textContent = state.lang === 'fa' ? `متوقف شد (کرش پردازه${exitMsg})` : `CRASHED (Exit: ${status.exit_code ?? 'Err'})`;
      statusText.style.color = '#ef4444';
    }
    stopLobbyStatusPolling();
  } else {
    if (startBtn) startBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
    if (joinSelfBtn) joinSelfBtn.style.display = 'none';
    if (liveControls) liveControls.style.display = 'none';
    if (hintEl) hintEl.style.display = 'none';
    if (statusDot) { statusDot.className = 'lan-status-dot idle'; }
    if (statusText) { statusText.textContent = t('lanStatusIdle'); statusText.style.color = '#ccc'; }
    stopLobbyStatusPolling();
  }
}

function startLobbyStatusPolling() {
  if (lobbyPollTimer) clearInterval(lobbyPollTimer);
  fetchLobbyStatus();
  lobbyPollTimer = setInterval(async () => {
    await checkLanServerStatus();
    if (lanState.serverRunning) {
      await fetchLobbyStatus();
    }
  }, 2000);
}

function stopLobbyStatusPolling() {
  if (lobbyPollTimer) {
    clearInterval(lobbyPollTimer);
    lobbyPollTimer = null;
  }
}

async function fetchLobbyStatus() {
  if (!lanState.serverRunning) return;
  try {
    const statusJson = await call('get_lan_lobby_status');
    if (!statusJson) return;
    const s = JSON.parse(statusJson);
    const badge = document.getElementById('lan-lobby-badge');
    if (!badge) return;

    if (s.is_paused) {
      badge.innerHTML = `<i class="fa-solid fa-pause"></i> <span style="color:#f59e0b;">${state.lang === 'fa' ? 'سرور متوقف است' : 'Server Paused'}</span>`;
      badge.style.background = 'rgba(245, 158, 11, 0.15)';
      badge.style.border = '1px solid #f59e0b';
    } else if (s.state === 'WaitingForPlayers') {
      badge.innerHTML = `<i class="fa-solid fa-hourglass-start"></i> ${state.lang === 'fa' ? `لابی پیش از بازی (${s.ready_count}/${s.required_count} آماده - ${s.connected_count} متصل)` : `Pre-Game Lobby (${s.ready_count}/${s.required_count} ready - ${s.connected_count} connected)`}`;
      badge.style.background = 'rgba(56, 189, 248, 0.15)';
      badge.style.border = '1px solid #38bdf8';
    } else if (s.state === 'Countdown') {
      badge.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${state.lang === 'fa' ? `شمارش معکوس شروع: ${s.countdown_seconds} ثانیه...` : `Countdown: ${s.countdown_seconds}s...`}`;
      badge.style.background = 'rgba(234, 179, 8, 0.2)';
      badge.style.border = '1px solid #eab308';
    } else if (s.state === 'InGame') {
      badge.innerHTML = `<i class="fa-solid fa-gamepad"></i> ${state.lang === 'fa' ? `بازی در جریان است (${s.connected_count} بازیکن)` : `Match in progress (${s.connected_count} players)`}`;
      badge.style.background = 'rgba(34, 197, 94, 0.15)';
      badge.style.border = '1px solid #22c55e';
    }
  } catch (err) {
    // Ignore transient read errors during server initialization
  }
}

async function sendLanServerCmd(cmd) {
  try {
    await call('send_lan_server_command', { command: cmd });
    const badge = document.getElementById('lan-lobby-badge');
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-paper-plane"></i> دستور ${cmd} ارسال شد...`;
    }
    const labelMap = {
      'start': 'دستور شروع بازی (!start) به سرور ارسال شد',
      'togglepause': 'دستور توقف / ادامه (!pause) به سرور ارسال شد',
      'restart': 'دستور ریست لابی و هیروها (!restart) به سرور ارسال شد',
    };
    showToast(labelMap[cmd] || `دستور ${cmd} به سرور ارسال شد`, 'info');
    setTimeout(fetchLobbyStatus, 600);
  } catch (err) {
    console.error('[lan] send server command failed:', err);
    showToast(`خطا در ارسال دستور به سرور: ${err}`, 'error');
  }
}

// ==========================================================================
// Part 3: Active Match Session Engine (Deadworks Dedicated & Modded Suite)
// ==========================================================================
const sessionState = {
  active: false,
  role: 'host',
  connectionType: 'standard_lan',
  roomCode: null,
  connectTarget: '127.0.0.1:27005',
  modMode: 'vanilla',
  isServerRunning: false,
  rosterTimer: null,
};

function selectSessionModMode(mode) {
  sessionState.modMode = mode;
  document.querySelectorAll('.session-mode-option').forEach(opt => {
    opt.classList.toggle('active', opt.id === `opt-mode-${mode.replace('_', '-')}`);
  });
  const radio = document.querySelector(`input[name="session_mod_mode"][value="${mode}"]`);
  if (radio) radio.checked = true;

  const badge = document.getElementById('session-mod-mode-badge');
  if (badge) {
    if (mode === 'cursed_arena') badge.textContent = state.lang === 'fa' ? 'کرسد آرنا (دوئل)' : 'Cursed Arena (1v1)';
    else if (mode === 'ability_brawl') badge.textContent = state.lang === 'fa' ? 'ماد درفت اسکیل' : 'Ability Brawl';
    else if (mode === 'automatch') badge.textContent = state.lang === 'fa' ? 'مسابقه تیمی ۶ به ۶' : 'AutoMatch 6v6';
    else if (mode === 'none') badge.textContent = state.lang === 'fa' ? 'بدون ماد (ساده)' : 'Vanilla (No Mods)';
    else badge.textContent = state.lang === 'fa' ? 'دد‌ورکس پایه' : 'Deadworks Base';
  }

  const cursedBar = document.getElementById('session-cursed-actions');
  if (cursedBar) cursedBar.style.display = (mode === 'cursed_arena' && sessionState.isServerRunning) ? 'block' : 'none';
  const cursedGuide = document.getElementById('guide-cursed-mode');
  if (cursedGuide) cursedGuide.style.display = mode === 'cursed_arena' ? 'flex' : 'none';

  if (mode === 'cursed_arena') {
    const mapSelect = document.getElementById('session-map-select');
    if (mapSelect) mapSelect.value = 'dl_midtown';
  }
}

async function enterActiveSession(role, opts) {
  sessionState.active = true;
  sessionState.role = role;
  sessionState.connectionType = opts.connectionType || 'standard_lan';
  sessionState.roomCode = opts.roomCode || null;
  sessionState.connectTarget = opts.connectTarget || '127.0.0.1:27005';
  sessionState.clientConnectTarget = opts.clientConnectTarget || opts.connectTarget || '127.0.0.1:27005';
  sessionState.modMode = opts.modMode || 'vanilla';
  sessionState.skipDeadworks = !!opts.skipDeadworks;
  sessionState.hostIp = opts.hostIp || '0.0.0.0';
  sessionState.publicPort = opts.publicPort || 27005;
  sessionState.nickname = opts.nickname || (role === 'host' ? 'Host' : 'Player');

  // Screen transition: Hide lobby browser, show active session
  const browserEl = document.getElementById('lan-lobby-browser');
  const sessionEl = document.getElementById('lan-active-session');
  if (browserEl) browserEl.style.display = 'none';
  if (sessionEl) sessionEl.style.display = 'flex';

  // Top Bar Meta
  const connBadge = document.getElementById('session-conn-mode-badge');
  if (connBadge) {
    if (sessionState.connectionType === 'vip_relay') connBadge.textContent = state.lang === 'fa' ? 'رله پرسرعت' : 'VIP Fast Relay';
    else if (sessionState.connectionType === 'vip_wintun') connBadge.textContent = state.lang === 'fa' ? 'شبکه مش اختصاصی' : 'VIP Wintun Mesh';
    else connBadge.textContent = state.lang === 'fa' ? 'شبکه محلی' : 'Standard LAN';
  }
  selectSessionModMode(sessionState.modMode);

  // 1. Separate Dedicated Lobby Code Pill
  const roomPill = document.getElementById('session-room-code-pill');
  const roomDisplay = document.getElementById('session-room-code-display');
  if (roomPill && roomDisplay) {
    if (sessionState.roomCode) {
      roomDisplay.textContent = sessionState.roomCode;
      roomPill.style.display = 'inline-flex';
    } else {
      roomPill.style.display = 'none';
    }
  }

  // 2. Separate Dedicated Console Command Pill
  const displayEl = document.getElementById('session-connect-display');
  if (displayEl) {
    const target = sessionState.connectTarget || '127.0.0.1:27005';
    const clean = target.startsWith('connect ') ? target : `connect ${target}`;
    displayEl.textContent = clean;
  }

  // Views based on role
  const hostView = document.getElementById('session-view-host');
  const clientView = document.getElementById('session-view-client');
  const hostDeadworksCard = document.getElementById('session-host-deadworks-card');
  const hostDirectCard = document.getElementById('session-host-direct-card');

  if (role === 'host') {
    if (hostView) hostView.style.display = 'block';
    if (clientView) clientView.style.display = 'none';

    if (sessionState.skipDeadworks) {
      if (hostDeadworksCard) hostDeadworksCard.style.display = 'none';
      if (hostDirectCard) hostDirectCard.style.display = 'block';
    } else {
      if (hostDeadworksCard) hostDeadworksCard.style.display = 'block';
      if (hostDirectCard) hostDirectCard.style.display = 'none';
      await checkLanServerStatus();
    }
  } else {
    if (hostView) hostView.style.display = 'none';
    if (clientView) clientView.style.display = 'block';

    const checklistEl = document.querySelector('.session-mod-checklist');
    const clientHeading = document.querySelector('.session-client-heading');
    const clientSub = document.querySelector('.session-client-sub');

    if (sessionState.skipDeadworks) {
      if (checklistEl) checklistEl.style.display = 'none';
      if (clientHeading) clientHeading.textContent = state.lang === 'fa' ? 'لابی آماده اتصال بدون تغییر فایل‌ها' : 'Lobby Ready (No File Changes)';
      if (clientSub) clientSub.textContent = state.lang === 'fa' ? 'اتصال شبکه برقرار است و بدون تغییر فایل‌های بازی می‌توانید مستقیماً وارد شوید.' : 'Connected to network lobby. You can launch and connect without file modifications.';
    } else {
      if (checklistEl) checklistEl.style.display = 'grid';
      if (clientHeading) clientHeading.textContent = t('sessionClientHeading');
      if (clientSub) clientSub.textContent = t('sessionClientSub');
      await checkAndPrepareClientEnvironment(sessionState.modMode);
    }
  }

  startSessionRosterPolling();
}

async function checkAndPrepareClientEnvironment(mode) {
  if (sessionState.skipDeadworks || mode === 'none') return;
  try {
    const env = await call('check_deadworks_env_cmd');
    updateChecklistUI(env);

    const needsPrep = !env.bootstrap_cached || !env.gameinfo_patched
      || (mode === 'ability_brawl' && !env.ability_brawl_cached)
      || (mode === 'cursed_arena' && !env.cursed_arena_cached);

    if (needsPrep) {
      showToast(state.lang === 'fa' ? 'در حال بررسی و آماده‌سازی فایل‌های ماد کلاینت...' : 'Preparing client mod files...', 'info');
      await call('prepare_modded_client_cmd', { mode });
      const updatedEnv = await call('check_deadworks_env_cmd');
      updateChecklistUI(updatedEnv);
    }
  } catch (err) {
    console.warn('[client-prep] error:', err);
  }
}

function updateChecklistUI(env) {
  const setChk = (id, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('pending', !ok);
    const icon = el.querySelector('i');
    if (icon) icon.className = ok ? 'fa-solid fa-check' : 'fa-solid fa-clock';
  };
  setChk('chk-dotnet', env.dotnet10);
  setChk('chk-bootstrap', env.bootstrap_cached);
  let addonOk = true;
  if (sessionState.modMode === 'ability_brawl') addonOk = env.ability_brawl_cached;
  else if (sessionState.modMode === 'cursed_arena') addonOk = env.cursed_arena_cached;
  setChk('chk-addon', addonOk);
  setChk('chk-gameinfo', env.gameinfo_patched);
}

async function leaveActiveSessionAction() {
  stopSessionRosterPolling();

  if (!sessionState.skipDeadworks) {
    try {
      await call('restore_vanilla_client_cmd');
    } catch (_) {}
  }

  if (sessionState.roomCode) {
    try {
      await call('leave_vip_room_cmd', { apiUrl: null, roomCode: sessionState.roomCode });
    } catch (_) {}
  }

  if (lanState.serverRunning || sessionState.isServerRunning) {
    try {
      await call('stop_lan_server');
    } catch (_) {}
  }

  sessionState.active = false;
  sessionState.isServerRunning = false;
  lanState.serverRunning = false;
  lanState.vipRoomCode = null;

  // Screen transition: Hide active session, restore lobby browser
  const sessionEl = document.getElementById('lan-active-session');
  const browserEl = document.getElementById('lan-lobby-browser');
  if (sessionEl) sessionEl.style.display = 'none';
  if (browserEl) browserEl.style.display = 'block';

  showToast(
    state.lang === 'fa'
      ? 'از اتاق خارج شدید و بازی به حالت خالص اولیه بازگردانی شد.'
      : 'Disconnected from session. Game files restored to clean vanilla state.',
    'info'
  );
}

async function autoJoinActiveSessionAction() {
  const target = sessionState.connectTarget || '127.0.0.1:27005';
  const cleanCmd = target.startsWith('connect ') ? target : `connect ${target}`;
  const mode = sessionState.skipDeadworks ? null : (sessionState.modMode || 'vanilla');
  try {
    const isRunning = await call('is_deadlock_running_cmd').catch(() => false);
    
    // Always backup copy command to clipboard for zero friction
    await copyToClipboard(cleanCmd).catch(() => {});

    if (isRunning) {
      showToast(
        state.lang === 'fa'
          ? 'بازی ددلاک در حال اجراست؛ اتصال مستقیم بدون خروج از بازی انجام شد.'
          : 'Deadlock is already running; connecting directly in-game without restart.',
        'success'
      );
    } else {
      showToast(
        state.lang === 'fa'
          ? 'در حال آماده‌سازی و ورود مستقیم به بازی ددلاک...'
          : 'Preparing client and launching Deadlock...',
        'info'
      );
    }

    if (!sessionState.skipDeadworks) {
      await checkAndPrepareClientEnvironment(mode);
    }

    await call('auto_join_deadlock_cmd', { connectTarget: target, mode });
  } catch (err) {
    showModal(t('sessionActiveTitle'), `خطا در اجرای بازی: ${err}`, [{ label: t('ok') }]);
  }
}

async function copyLobbyCode() {
  const code = sessionState.roomCode || lanState.vipRoomCode;
  if (!code) {
    showToast(state.lang === 'fa' ? 'کد لابی یافت نشد.' : 'No lobby code available.', 'warn');
    return;
  }
  await copyToClipboard(code);
  showToast(state.lang === 'fa' ? `کد لابی کپی شد: ${code}` : `Lobby code copied: ${code}`, 'success');
}

async function copySessionTarget() {
  const target = sessionState.connectTarget || '127.0.0.1:27005';
  const clean = target.startsWith('connect ') ? target : `connect ${target}`;
  await copyToClipboard(clean);
  showToast(state.lang === 'fa' ? `دستور اتصال کپی شد: ${clean}` : `Copied console command: ${clean}`, 'info');
}

async function startSessionDedicatedServerAction() {
  const mapSelect = document.getElementById('session-map-select');
  const mapName = mapSelect ? mapSelect.value : 'dl_midtown';
  const maxPlayers = parseInt(document.getElementById('session-max-players')?.value || '12', 10);
  const isOffline = document.getElementById('session-check-offline')?.checked ?? true;
  const isSdr = document.getElementById('session-check-sdr')?.checked ?? false;
  const modMode = sessionState.modMode || 'vanilla';
  const isCursed = modMode === 'cursed_arena';

  const config = {
    host_ip: sessionState.hostIp || '0.0.0.0',
    public_port: sessionState.publicPort || 27005,
    internal_port: 27006,
    map_name: isCursed ? 'dl_midtown' : mapName,
    max_players: isCursed ? 12 : maxPlayers,
    enable_bots: false,
    bot_count: 0,
    street_brawl: false,
    enable_cheats: isCursed,
    duplicate_heroes: false,
    unlock_flex_slots: true,
    hero_draft: false,
    active_lane: 0,
    disable_autokick: true,
    use_modded_server: true,
    mod_match_start: true,
    mod_auto_match: modMode === 'automatch',
    mod_admin_tools: true,
    mod_ability_brawl: modMode === 'ability_brawl',
    mod_cursed_arena: isCursed,
    pregame_lobby: true,
    start_paused: false,
    min_players: 2,
    enable_sdr: isSdr,
    offline_mode: isOffline,
    server_mode: modMode,
  };

  const startBtn = document.getElementById('btn-session-start-server');
  if (startBtn) startBtn.disabled = true;

  try {
    await checkAndPrepareClientEnvironment(modMode);
    const res = await call('start_lan_server', { config });
    sessionState.isServerRunning = true;
    lanState.serverRunning = true;

    // Update Host UI
    if (startBtn) startBtn.style.display = 'none';
    const stopBtn = document.getElementById('btn-session-stop-server');
    const joinBtn = document.getElementById('btn-session-host-join');
    const adminBar = document.getElementById('session-admin-bar');
    const stateBadge = document.getElementById('session-server-state-badge');

    if (stopBtn) stopBtn.style.display = 'inline-flex';
    if (joinBtn) joinBtn.style.display = 'inline-flex';
    if (adminBar) {
      adminBar.style.display = 'flex';
      const cursedBar = document.getElementById('session-cursed-actions');
      if (cursedBar) cursedBar.style.display = isCursed ? 'block' : 'none';
    }
    if (stateBadge) {
      stateBadge.textContent = state.lang === 'fa' ? 'در حال اجرا' : 'RUNNING';
      stateBadge.className = 'session-badge-mini running';
    }

    showToast(
      state.lang === 'fa'
        ? 'سرور ددورکس با موفقیت اجرا شد. پنجره کنسول ویندوز باز است.'
        : 'Deadworks server launched successfully. Console is active.',
      'success'
    );
  } catch (err) {
    showModal(t('sessionActiveTitle'), `خطا در اجرای سرور ددورکس: ${err}`, [{ label: t('ok') }]);
  } finally {
    if (startBtn) startBtn.disabled = false;
  }
}

async function stopSessionDedicatedServerAction() {
  try {
    await call('stop_lan_server');
    await call('restore_vanilla_client_cmd');
  } catch (_) {}

  sessionState.isServerRunning = false;
  lanState.serverRunning = false;

  const startBtn = document.getElementById('btn-session-start-server');
  const stopBtn = document.getElementById('btn-session-stop-server');
  const joinBtn = document.getElementById('btn-session-host-join');
  const adminBar = document.getElementById('session-admin-bar');
  const stateBadge = document.getElementById('session-server-state-badge');
  const cursedBar = document.getElementById('session-cursed-actions');

  if (startBtn) startBtn.style.display = 'inline-flex';
  if (stopBtn) stopBtn.style.display = 'none';
  if (joinBtn) joinBtn.style.display = 'none';
  if (adminBar) adminBar.style.display = 'none';
  if (cursedBar) cursedBar.style.display = 'none';
  if (stateBadge) {
    stateBadge.textContent = state.lang === 'fa' ? 'متوقف شد' : 'STOPPED';
    stateBadge.className = 'session-badge-mini';
    stateBadge.style.background = '';
    stateBadge.style.color = '';
    stateBadge.style.borderColor = '';
  }

  showToast(state.lang === 'fa' ? 'سرور متوقف شد.' : 'Server stopped.', 'info');
}

async function joinSessionSelfAction() {
  const mode = sessionState.modMode || 'cursed_arena';
  try {
    showToast(state.lang === 'fa' ? 'در حال آماده‌سازی و ورود میزبان...' : 'Preparing host client and launching...', 'info');
    await checkAndPrepareClientEnvironment(mode);
    await call('auto_join_deadlock_cmd', { connectTarget: '127.0.0.1:27005', mode });
  } catch (err) {
    showModal(t('sessionActiveTitle'), `خطا در اجرای بازی: ${err}`, [{ label: t('ok') }]);
  }
}

async function sendAdminCmd(cmd) {
  try {
    await call('send_lan_server_command', { command: cmd });
    showToast(state.lang === 'fa' ? `دستور مدیریت '${cmd}' به سرور ارسال شد!` : `Admin Command '${cmd}' sent to Deadworks server!`, 'info');
  } catch (err) {
    showToast(`Command error: ${err}`, 'error');
  }
}

function startSessionRosterPolling() {
  stopSessionRosterPolling();
  updateSessionRoster();
  sessionState.rosterTimer = setInterval(updateSessionRoster, 3000);
}

function stopSessionRosterPolling() {
  if (sessionState.rosterTimer) {
    clearInterval(sessionState.rosterTimer);
    sessionState.rosterTimer = null;
  }
}

async function updateSessionRoster() {
  if (!sessionState.active) return;
  const rosterContainer = document.getElementById('session-roster-list');
  const countBadge = document.getElementById('session-player-count');

  // Watchdog check for host dedicated server
  if (sessionState.role === 'host' && sessionState.isServerRunning) {
    try {
      const sStatus = await call('get_lan_server_status');
      if (sStatus && !sStatus.is_running && sStatus.crashed) {
        sessionState.isServerRunning = false;
        lanState.serverRunning = false;
        const startBtn = document.getElementById('btn-session-start-server');
        const stopBtn = document.getElementById('btn-session-stop-server');
        const joinBtn = document.getElementById('btn-session-host-join');
        const adminBar = document.getElementById('session-admin-bar');
        const stateBadge = document.getElementById('session-server-state-badge');
        const cursedBar = document.getElementById('session-cursed-actions');

        if (startBtn) { startBtn.style.display = 'inline-flex'; startBtn.disabled = false; }
        if (stopBtn) stopBtn.style.display = 'none';
        if (joinBtn) joinBtn.style.display = 'none';
        if (adminBar) adminBar.style.display = 'none';
        if (cursedBar) cursedBar.style.display = 'none';
        if (stateBadge) {
          stateBadge.textContent = state.lang === 'fa' ? 'متوقف شد (کرش پردازه)' : 'CRASHED';
          stateBadge.className = 'session-badge-mini';
          stateBadge.style.background = 'rgba(239, 68, 68, 0.2)';
          stateBadge.style.color = '#ef4444';
          stateBadge.style.borderColor = '#ef4444';
        }
        showToast(
          state.lang === 'fa'
            ? 'سرور بازی به طور ناگهانی متوقف یا بسته شد! می‌توانید آن را دوباره راه‌اندازی کنید.'
            : 'Dedicated server terminated unexpectedly (Crashed)! Click Start to restart.',
          'error'
        );
      }
    } catch (_) {}
  }

  if (sessionState.roomCode) {
    try {
      const status = await call('get_vip_room_status_cmd', { apiUrl: null, roomCode: sessionState.roomCode });
      if (status && status.peers) {
        if (countBadge) countBadge.textContent = `${status.peers.length} بازیکن`;
        if (rosterContainer) {
          rosterContainer.innerHTML = '';
          for (const p of status.peers) {
            const item = document.createElement('div');
            item.className = 'session-roster-item';
            const isMeHost = sessionState.role === 'host';
            const canModerate = isMeHost && !p.is_host;

            const safeName = escapeHtml(p.name || 'Player');
            const safeIp = escapeHtml(p.ip || '');

            item.innerHTML = `
              <div class="roster-player-info">
                <div class="roster-avatar"><i class="fa-solid fa-user"></i></div>
                <div style="display:flex;flex-direction:column;gap:2px;">
                  <span class="roster-player-name">${safeName}</span>
                  <span style="font-size:10px;color:#94a3b8;">${safeIp}</span>
                </div>
                ${p.is_host ? `<span class="roster-host-tag">${state.lang === 'fa' ? 'میزبان' : 'HOST'}</span>` : ''}
              </div>
            `;

            if (canModerate) {
              const actionsDiv = document.createElement('div');
              actionsDiv.className = 'roster-actions';

              const btnKick = document.createElement('button');
              btnKick.type = 'button';
              btnKick.className = 'btn-roster-kick';
              btnKick.textContent = state.lang === 'fa' ? 'اخراج' : 'Kick';
              btnKick.addEventListener('click', () => kickSessionPeer(p.name));

              const btnBan = document.createElement('button');
              btnBan.type = 'button';
              btnBan.className = 'btn-roster-ban';
              btnBan.textContent = state.lang === 'fa' ? 'مسدود' : 'Ban';
              btnBan.addEventListener('click', () => banSessionPeer(p.name));

              actionsDiv.appendChild(btnKick);
              actionsDiv.appendChild(btnBan);
              item.appendChild(actionsDiv);
            }
            rosterContainer.appendChild(item);
          }
        }
      }
    } catch (_) {}
  } else {
    // Standard LAN local session fallback
    if (rosterContainer) {
      rosterContainer.innerHTML = `
        <div class="session-roster-item">
          <div class="roster-player-info">
            <div class="roster-avatar"><i class="fa-solid fa-crown" style="color:gold"></i></div>
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span class="roster-player-name">${sessionState.role === 'host' ? (state.lang === 'fa' ? 'میزبان (شما)' : 'Host (You)') : (state.lang === 'fa' ? 'بازیکن (شما)' : 'Client (You)')}</span>
              <span style="font-size:10px;color:#34d399;">${state.lang === 'fa' ? 'اتصال مستقیم فعال' : 'Direct Socket Active'}</span>
            </div>
          </div>
        </div>
      `;
    }
  }
}

async function kickSessionPeer(peerName) {
  if (!sessionState.roomCode) return;
  try {
    await call('kick_vip_peer_cmd', { apiUrl: null, roomCode: sessionState.roomCode, peerName });
    showToast(state.lang === 'fa' ? `بازیکن ${peerName} اخراج شد.` : `Player ${peerName} kicked.`, 'warning');
    setTimeout(updateSessionRoster, 500);
  } catch (err) {
    showToast(`Kick failed: ${err}`, 'error');
  }
}

async function banSessionPeer(peerName) {
  if (!sessionState.roomCode) return;
  try {
    await call('ban_vip_peer_cmd', { apiUrl: null, roomCode: sessionState.roomCode, peerName });
    showToast(state.lang === 'fa' ? `بازیکن ${peerName} از اتاق مسدود شد.` : `Player ${peerName} banned from room.`, 'error');
    setTimeout(updateSessionRoster, 500);
  } catch (err) {
    showToast(`Ban failed: ${err}`, 'error');
  }
}

async function checkIsGameRunning() {
  try {
    const list = await call('check_running');
    return Array.isArray(list) && list.length > 0;
  } catch (_) {
    return false;
  }
}

async function handleHostPreflightAndSetup(modMode) {
  let isRunning = await checkIsGameRunning();
  if (isRunning) {
    const action = await showModal(
      state.lang === 'fa' ? 'بازی Deadlock در حال اجراست' : 'Deadlock is Currently Running',
      state.lang === 'fa'
        ? 'بازی Deadlock در حال حاضر باز است و فایل‌های آن توسط ویندوز قفل می‌باشند.\nبرای نصب سرور Deadworks، تنظیم مپ‌ها و ساخت لابی، بازی باید بسته شود.\n\nمی‌توانید بازی را به صورت دستی ببندید یا دکمه زیر را بزنید تا برنامه بازی را به طور خودکار ببندد.'
        : 'Deadlock is currently running and its game files are locked by Windows.\nTo deploy the Deadworks server and patch gameinfo.gi mod paths, the game must be closed.\n\nPlease close the game to create your lobby, or click below to close it automatically.',
      [
        {
          label: state.lang === 'fa' ? 'بستن خودکار بازی و ادامه' : 'Close Game & Continue',
          value: 'auto_close',
          kind: 'danger'
        },
        {
          label: state.lang === 'fa' ? 'دستی بستم، ادامه بده' : 'I Closed Game Manually, Continue',
          value: 'manual_closed',
          kind: 'apply'
        },
        {
          label: state.lang === 'fa' ? 'انصراف' : 'Cancel',
          value: 'cancel'
        }
      ]
    );

    if (!action || action === 'cancel') {
      return false;
    }

    if (action === 'auto_close') {
      showToast(state.lang === 'fa' ? 'در حال بستن بازی Deadlock...' : 'Closing Deadlock...', 'info');
      await call('close_deadlock_game_cmd');
      await new Promise(r => setTimeout(r, 800));
    }

    isRunning = await checkIsGameRunning();
    if (isRunning) {
      showModal(
        state.lang === 'fa' ? 'خطا در بستن بازی' : 'Game Still Running',
        state.lang === 'fa'
          ? 'بازی Deadlock همچنان در حال اجراست. لطفاً آن را به صورت دستی ببندید و مجدداً تلاش کنید.'
          : 'Deadlock is still running. Please close it manually and try again.',
        [{ label: t('ok') }]
      );
      return false;
    }
  }

  try {
    showToast(
      state.lang === 'fa'
        ? 'در حال آماده‌سازی فایل‌های سرور Deadworks و پچ مسیرهای ماد...'
        : 'Setting up Deadworks server and patching mod paths...',
      'info'
    );
    await call('setup_host_server_env_cmd', { mode: modMode });
    return true;
  } catch (err) {
    showModal(
      state.lang === 'fa' ? 'خطا در آماده‌سازی سرور' : 'Server Setup Error',
      `${state.lang === 'fa' ? 'آماده‌سازی فایل‌های سرور با خطا مواجه شد:' : 'Failed to setup server environment:'}\n${err}`,
      [{ label: t('ok') }]
    );
    return false;
  }
}

async function createLanLobbyAction() {
  const nickname = document.getElementById('lan-host-nickname')?.value?.trim() || 'Host';
  const modSelect = document.getElementById('lan-host-mod-mode');
  const chosenMod = modSelect ? modSelect.value : 'vanilla';
  const ipSelect = document.getElementById('lan-host-ip-select');
  const ipCustom = document.getElementById('lan-host-ip-custom');
  let chosenIp = '0.0.0.0';
  if (ipCustom && ipCustom.style.display !== 'none' && ipCustom.value.trim()) {
    chosenIp = ipCustom.value.trim();
  } else if (ipSelect && ipSelect.value) {
    chosenIp = ipSelect.value;
  }

  const publicPort = parseInt(document.getElementById('lan-public-port')?.value || '27005', 10);
  const btn = document.getElementById('btn-lan-create-lobby');
  if (btn) btn.disabled = true;

  try {
    const ready = await handleHostPreflightAndSetup(chosenMod);
    if (!ready) return;

    lanState.hostNickname = nickname;
    lanState.hostIp = chosenIp;
    lanState.publicPort = publicPort;
    lanState.isHost = true;

    // Display target: If 0.0.0.0, use the first preferred local adapter IP if available
    let displayIp = chosenIp;
    if (displayIp === '0.0.0.0' && lanState.localIps && lanState.localIps.length > 0) {
      const nonZero = lanState.localIps.find(x => x.ip && x.ip !== '0.0.0.0');
      if (nonZero) displayIp = nonZero.ip;
    }

    const connectTarget = `${displayIp}:${publicPort}`;

    enterActiveSession('host', {
      connectionType: 'standard_lan',
      roomCode: null,
      connectTarget: connectTarget,
      modMode: chosenMod,
      hostIp: chosenIp,
      publicPort: publicPort,
      nickname: nickname,
    });
  } catch (err) {
    showModal(t('stdLanTitle'), `خطا در ایجاد لابی: ${err}`, [{ label: t('ok') }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function joinLanLobbyAction() {
  const nickname = document.getElementById('lan-client-nickname')?.value?.trim() || 'Player';
  const targetInput = document.getElementById('lan-client-target-ip');
  const targetIp = targetInput ? targetInput.value.trim() : '';

  if (!targetIp) {
    showModal(
      t('stdLanTitle'),
      state.lang === 'fa' ? 'لطفاً آدرس IP سرور میزبان را وارد کنید.' : 'Please enter host IP:Port.',
      [{ label: t('ok') }]
    );
    return;
  }

  const cleanTarget = targetIp.replace(/^connect\s+/i, '').trim();
  const btn = document.getElementById('btn-lan-join-lobby');
  if (btn) btn.disabled = true;

  try {
    enterActiveSession('client', {
      connectionType: 'standard_lan',
      roomCode: null,
      connectTarget: cleanTarget,
      modMode: 'vanilla',
      nickname: nickname,
    });
  } catch (err) {
    showModal(t('stdLanTitle'), `خطا در ورود به لابی: ${err}`, [{ label: t('ok') }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function probeLanServerAction() {
  const input = document.getElementById('lan-client-target-ip');
  if (!input || !input.value.trim()) {
    showModal(t('stdLanTitle'), state.lang === 'fa' ? 'لطفاً ابتدا IP و پورت سرور میزبان را وارد کنید.' : 'Please enter host IP:Port first.', [{ label: t('ok') }]);
    return;
  }
  const raw = input.value.trim().replace(/^connect\s+/i, '');
  const parts = raw.split(':');
  const ip = parts[0].trim();
  const port = parts[1] ? parseInt(parts[1].trim(), 10) : 27005;

  const probeBtn = document.getElementById('btn-lan-probe-server');
  if (probeBtn) probeBtn.disabled = true;

  const resultBox = document.getElementById('lan-probe-result');
  try {
    const info = await call('query_lan_server', { ip, port });
    if (resultBox) {
      resultBox.style.display = 'flex';
      document.getElementById('probe-server-name').textContent = info.server_name || 'Deadlock Server';
      document.getElementById('probe-ping-ms').textContent = `${info.ping_ms} ms`;
      document.getElementById('probe-map-name').textContent = info.map_name || 'dl_midtown';
      document.getElementById('probe-players').textContent = `${info.players}/${info.max_players}`;
    }
  } catch (err) {
    if (resultBox) resultBox.style.display = 'none';
    showModal(t('stdLanTitle'), `${state.lang === 'fa' ? 'پاسخی از سرور دریافت نشد:' : 'No response from server:'} ${err}`, [{ label: t('ok') }]);
  } finally {
    if (probeBtn) probeBtn.disabled = false;
  }
}

async function copyClientConsoleCmd() {
  const input = document.getElementById('lan-client-target-ip');
  const raw = input ? input.value.trim().replace(/^connect\s+/i, '') : '127.0.0.1:27005';
  const cmd = `connect ${raw}`;
  await copyToClipboard(cmd);
  showToast(state.lang === 'fa' ? `دستور اتصال کپی شد: ${cmd}` : `Copied: ${cmd}`, 'info');
}

function onVipSkipDeadworksChange(checked) {
  const modGroup = document.getElementById('vip-mod-group');
  if (modGroup) {
    modGroup.style.opacity = checked ? '0.35' : '1';
    modGroup.style.pointerEvents = checked ? 'none' : 'auto';
  }
}
window.onVipSkipDeadworksChange = onVipSkipDeadworksChange;

async function copyClientShareCmd() {
  const target = sessionState.clientConnectTarget || sessionState.connectTarget || '127.0.0.1:27016';
  const clean = target.startsWith('connect ') ? target : `connect ${target}`;
  const code = sessionState.roomCode ? (state.lang === 'fa' ? `کد لابی: ${sessionState.roomCode} · ` : `Room Code: ${sessionState.roomCode} · `) : '';
  const full = `${code}${clean}`;
  await copyToClipboard(full);
  showToast(state.lang === 'fa' ? `دستور اتصال برای دوستان کپی شد: ${clean}` : `Copied for friends: ${clean}`, 'info');
}
window.copyClientShareCmd = copyClientShareCmd;

// ---------- VIP Mesh Actions ----------
window.setVipConnectionMode = function(mode) {
  lanState.vipMode = mode;
  const relayTab = document.getElementById('btn-vip-mode-relay');
  const wintunTab = document.getElementById('btn-vip-mode-wintun');
  if (relayTab) relayTab.classList.toggle('active', mode === 'relay');
  if (wintunTab) wintunTab.classList.toggle('active', mode === 'wintun');
};

async function createVipRoomAction() {
  const nickname = document.getElementById('vip-host-nickname')?.value?.trim() || 'Host';
  const skipDeadworks = document.getElementById('vip-skip-deadworks')?.checked ?? false;
  const modSelect = document.getElementById('vip-host-mod-mode');
  const chosenMod = skipDeadworks ? 'none' : (modSelect ? modSelect.value : 'vanilla');
  const btn = document.getElementById('btn-vip-create-room');
  if (btn) btn.disabled = true;

  try {
    const selectedMode = lanState.vipMode || 'relay';
    if (selectedMode === 'wintun') {
      const hasBinaries = await call('check_vip_binaries_cmd');
      if (!hasBinaries) {
        const msg = state.lang === 'fa'
          ? 'کارت شبکه مجازی در سیستم شناسایی نشد. لطفاً حالت رله پرسرعت (پیشنهادی) را انتخاب کنید.'
          : 'Virtual network driver (Wintun) not detected. Please switch to Fast VPS Relay mode.';
        showModal(t('vipLanTitle'), msg, [{ label: t('ok') }]);
        return;
      }
    }

    if (!skipDeadworks) {
      // Host Preflight & Setup Deadworks / GameInfo
      const ready = await handleHostPreflightAndSetup(chosenMod);
      if (!ready) return;
    }

    const res = await call('create_vip_room_cmd', {
      apiUrl: null,
      nickname,
      mode: selectedMode,
      isModded: !skipDeadworks,
      modMode: chosenMod,
      enableSdr: false,
    });
    if (res.success && res.room_code) {
      lanState.vipRoomCode = res.room_code;
      lanState.vipHostIp = res.host_ip || '10.10.1.1';
      lanState.vipConnectCmd = res.connect_cmd || 'connect localhost:27005';
      lanState.vipClientConnectCmd = res.client_connect_cmd || (selectedMode === 'relay' ? 'connect localhost:27016' : `connect ${lanState.vipHostIp}:27005`);
      lanState.vipIsHost = true;

      showToast(
        state.lang === 'fa'
          ? (skipDeadworks ? 'لابی اختصاصی بدون تغییر فایل‌ها ایجاد شد.' : 'لابی اختصاصی با موفقیت ساخته شد.')
          : (skipDeadworks ? 'VIP lobby created (no file changes).' : 'VIP lobby created successfully.'),
        'success'
      );

      const targetHost = selectedMode === 'relay' ? 'localhost:27005' : `${lanState.vipHostIp}:27005`;

      enterActiveSession('host', {
        connectionType: selectedMode === 'relay' ? 'vip_relay' : 'vip_wintun',
        roomCode: res.room_code,
        connectTarget: targetHost,
        clientConnectTarget: lanState.vipClientConnectCmd,
        modMode: chosenMod,
        skipDeadworks: skipDeadworks,
        hostIp: res.host_ip || '10.10.1.1',
        publicPort: 27005,
        nickname: nickname,
      });
    }
  } catch (err) {
    const errStr = String(err.message || err);
    if (errStr.includes('740') || errStr.includes('elevation') || errStr.includes('Administrator')) {
      showModal(
        t('vipLanTitle'),
        state.lang === 'fa'
          ? 'حالت کارت شبکه مجازی نیازمند دسترسی ادمین (Administrator) است. آیا مایلید برنامه با دسترسی مدیر اجرا شود؟ (پیشنهاد: می‌توانید از حالت رله پرسرعت استفاده کنید که بدون نیاز به دسترسی ادمین کار می‌کند).'
          : 'Wintun mode requires Administrator elevation. Alternatively, use Fast VPS Relay mode which requires no elevation.',
        [
          { label: state.lang === 'fa' ? 'اجرا به عنوان Administrator' : 'Restart as Admin', action: restartAsAdmin, primary: true },
          { label: t('cancel') }
        ]
      );
    } else {
      showModal(t('vipLanTitle'), `خطا در ایجاد اتاق: ${err}`, [{ label: t('ok') }]);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function joinVipRoomAction() {
  const code = document.getElementById('vip-join-code')?.value?.trim();
  const nickname = document.getElementById('vip-join-nickname')?.value?.trim() || 'Player';
  if (!code || code.length !== 6) {
    showModal(t('vipLanTitle'), state.lang === 'fa' ? 'لطفاً کد ۶ رقمی معتبر وارد کنید.' : 'Please enter a valid 6-digit code.', [{ label: t('ok') }]);
    return;
  }

  const btn = document.getElementById('btn-vip-join-room');
  if (btn) btn.disabled = true;

  try {
    const res = await call('join_vip_room_cmd', { apiUrl: null, roomCode: code, nickname });
    if (res.success) {
      lanState.vipRoomCode = code;
      lanState.vipHostIp = res.host_ip || '10.10.1.1';
      lanState.vipConnectCmd = res.connect_cmd || (res.connection_mode === 'relay' ? 'connect localhost:27016' : `connect ${lanState.vipHostIp}:27005`);
      lanState.vipIsHost = false;

      const isNoDeadworks = res.is_modded === false || res.mod_mode === 'none';

      enterActiveSession('client', {
        connectionType: res.connection_mode === 'relay' ? 'vip_relay' : 'vip_wintun',
        roomCode: code,
        connectTarget: lanState.vipConnectCmd,
        clientConnectTarget: lanState.vipConnectCmd,
        modMode: res.mod_mode || (isNoDeadworks ? 'none' : 'vanilla'),
        skipDeadworks: isNoDeadworks,
        nickname: nickname,
      });
    }
  } catch (err) {
    showModal(t('vipLanTitle'), `خطا در ورود به اتاق: ${err}`, [{ label: t('ok') }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function launchVipDedicatedServerAction() {
  return startSessionDedicatedServerAction();
}

async function stopVipDedicatedServerAction() {
  return stopSessionDedicatedServerAction();
}

async function launchVipDeadlockAction(role) {
  return autoJoinActiveSessionAction();
}

async function leaveVipRoomAction() {
  return leaveActiveSessionAction();
}

function startVipPeerPolling(code) {
  stopVipPeerPolling();
  lanState.vipPollTimer = setInterval(async () => {
    try {
      const status = await call('get_vip_room_status_cmd', { apiUrl: null, roomCode: code });
      if (status && status.peers) {
        renderVipPeers(status.peers);
      }
    } catch (_) {}
  }, 3000);
}

function stopVipPeerPolling() {
  if (lanState.vipPollTimer) {
    clearInterval(lanState.vipPollTimer);
    lanState.vipPollTimer = null;
  }
}

function renderVipPeers(peers) {
  const lists = [document.getElementById('vip-peers-list'), document.getElementById('vip-join-peers-list')];
  const isRelay = lanState.vipMode === 'relay';
  for (const list of lists) {
    if (!list) continue;
    list.innerHTML = '';
    for (const p of peers) {
      const div = document.createElement('div');
      div.className = 'vip-peer-item';
      const icon = p.is_host ? '<i class="fa-solid fa-crown" style="color:gold"></i>' : '<i class="fa-solid fa-user" style="color:var(--deadlock-cyan)"></i>';
      const statusStr = p.online ? (state.lang === 'fa' ? '🟢 آنلاین' : '🟢 Online') : (state.lang === 'fa' ? '⚪ در انتظار' : '⚪ Standby');
      const ipOrRole = isRelay
        ? (p.is_host ? (state.lang === 'fa' ? 'میزبان' : 'Host') : (state.lang === 'fa' ? 'متصل به رله' : 'Relay Client'))
        : p.ip;
      const safeName = escapeHtml(p.name || 'Player');
      const safeRole = escapeHtml(ipOrRole || '');
      div.innerHTML = `${icon} <span>${safeName} (${safeRole}) - ${statusStr}</span>`;
      list.appendChild(div);
    }
  }
}

async function copyVipCode() {
  if (!lanState.vipRoomCode) return;
  await copyToClipboard(lanState.vipRoomCode);
  const digits = document.getElementById('vip-room-code-digits');
  if (digits) {
    const orig = digits.textContent;
    digits.textContent = state.lang === 'fa' ? 'کپی شد!' : 'COPIED!';
    setTimeout(() => { digits.textContent = orig; }, 1400);
  }
}

async function copyVipConnectCmd() {
  const cmd = lanState.vipClientConnectCmd || 'connect localhost:27016';
  await copyToClipboard(cmd);
  const textSpan = document.getElementById('vip-copy-connect-text');
  if (textSpan) {
    const orig = textSpan.textContent;
    textSpan.textContent = state.lang === 'fa' ? 'کپی شد! در کنسول بازی پیست کنید' : 'Copied! (Paste into F7 console)';
    setTimeout(() => { textSpan.textContent = orig; }, 2000);
  }
}

async function copyVipJoinCmd() {
  const cmd = lanState.vipConnectCmd || 'connect localhost:27016';
  await copyToClipboard(cmd);
  const textSpan = document.getElementById('vip-join-copy-text');
  if (textSpan) {
    const orig = textSpan.textContent;
    textSpan.textContent = state.lang === 'fa' ? 'کپی شد! در کنسول بازی پیست کنید' : 'Copied! (Paste into F7 console)';
    setTimeout(() => { textSpan.textContent = orig; }, 2000);
  }
}

async function refreshVipLobbiesList() {
  const container = document.getElementById('vip-lobby-list');
  if (!container) return;

  container.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;padding:8px;text-align:center;">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>
      ${state.lang === 'fa' ? 'در حال دریافت لیست لابی‌ها...' : 'Fetching active lobbies...'}
    </div>
  `;

  try {
    const rooms = await call('list_vip_rooms_cmd', { apiUrl: null });
    if (!rooms || rooms.length === 0) {
      container.innerHTML = `
        <div style="font-size:11px;color:#94a3b8;padding:12px;text-align:center;background:rgba(0,0,0,0.2);border-radius:8px;">
          ${state.lang === 'fa' ? 'هیچ لابی فعالی در حال حاضر یافت نشد. می‌توانید خودتان میزبان اولین اتاق باشید!' : 'No active lobbies found. Be the first to host a room!'}
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    for (const r of rooms) {
      const card = document.createElement('div');
      card.className = 'vip-lobby-card';

      const isCursed = r.mod_mode === 'cursed_arena' || r.mod_mode === 'cursedarena';
      const isNone = !r.is_modded || r.mod_mode === 'none';
      const modeClass = isNone ? 'vanilla' : (isCursed ? 'cursed-arena' : (r.mod_mode === 'ability_brawl' ? 'ability-brawl' : (r.mod_mode === 'automatch' ? 'automatch' : 'vanilla')));
      const modeLabel = isNone
        ? (state.lang === 'fa' ? 'بدون ماد (ساده)' : 'Vanilla (No Mods)')
        : (state.lang === 'fa'
            ? (isCursed ? 'کرسد آرنا (دوئل)' : (r.mod_mode === 'ability_brawl' ? 'ماد درفت اسکیل' : (r.mod_mode === 'automatch' ? 'مسابقه ۶ به ۶' : 'دد‌ورکس پایه')))
            : (isCursed ? 'Cursed Arena (1v1)' : (r.mod_mode === 'ability_brawl' ? 'Ability Brawl' : (r.mod_mode === 'automatch' ? 'AutoMatch 6v6' : 'Deadworks Base'))));
      const moddedPrefix = isNone ? '' : (state.lang === 'fa' ? (r.is_modded ? 'ماد شده · ' : '') : (r.is_modded ? 'MODDED · ' : ''));
      const isModdedBadge = `<span class="tag-modded ${modeClass}">${moddedPrefix}${modeLabel}</span>`;
      const netTypeStr = r.mode === 'wintun'
        ? (state.lang === 'fa' ? 'کارت شبکه مجازی' : 'Wintun')
        : (state.lang === 'fa' ? 'رله پرسرعت' : 'Fast Relay');

      const safeRoomCode = escapeHtml(r.room_code || '');
      const safeHostName = escapeHtml(r.host_nickname || (state.lang === 'fa' ? 'میزبان' : 'Host'));
      const safePeerCount = Number(r.peer_count) || 1;

      card.innerHTML = `
        <div class="vip-lobby-info">
          <span class="vip-lobby-code">${safeRoomCode}</span>
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="vip-lobby-host-name"><i class="fa-solid fa-crown" style="color:gold;font-size:11px;margin-right:4px;"></i>${safeHostName}</span>
              ${isModdedBadge}
            </div>
            <div class="vip-lobby-meta">
              <span class="vip-lobby-players"><i class="fa-solid fa-users"></i> ${safePeerCount} ${state.lang === 'fa' ? 'بازیکن' : 'players'}</span>
              <span style="font-size:10px;color:#64748b;">· ${netTypeStr}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-lobby-quickjoin">
          <i class="fa-solid fa-arrow-right-to-bracket"></i>
          <span>${state.lang === 'fa' ? 'ورود' : 'Join'}</span>
        </button>
      `;

      const btnJoin = card.querySelector('.btn-lobby-quickjoin');
      if (btnJoin) {
        btnJoin.addEventListener('click', () => selectAndJoinVipLobby(r.room_code));
      }
      container.appendChild(card);
    }
  } catch (err) {
    container.innerHTML = `
      <div style="font-size:11px;color:#f87171;padding:8px;text-align:center;">
        ${state.lang === 'fa' ? 'خطا در ارتباط با سرور: ' : 'Failed to reach server: '} ${err}
      </div>
    `;
  }
}

function selectAndJoinVipLobby(code) {
  const codeInput = document.getElementById('vip-join-code');
  if (codeInput) {
    codeInput.value = code;
  }
  joinVipRoomAction();
}

window.createVipRoomAction = createVipRoomAction;
window.joinVipRoomAction = joinVipRoomAction;
window.launchVipDedicatedServerAction = launchVipDedicatedServerAction;
window.stopVipDedicatedServerAction = stopVipDedicatedServerAction;
window.launchVipDeadlockAction = launchVipDeadlockAction;
window.leaveVipRoomAction = leaveVipRoomAction;
window.copyVipCode = copyVipCode;
window.copyVipConnectCmd = copyVipConnectCmd;
window.copyVipJoinCmd = copyVipJoinCmd;
window.redeemVipKeyAction = redeemVipKeyAction;
window.redeemVipExtendKeyAction = redeemVipExtendKeyAction;
window.toggleVipExtendInput = toggleVipExtendInput;
window.copyHwid = copyHwid;
window.clearModCacheAction = clearModCacheAction;
window.renderModCacheList = renderModCacheList;
window.selectSessionModMode = selectSessionModMode;
window.enterActiveSession = enterActiveSession;
window.leaveActiveSessionAction = leaveActiveSessionAction;
window.autoJoinActiveSessionAction = autoJoinActiveSessionAction;
window.copySessionTarget = copySessionTarget;
window.copyLobbyCode = copyLobbyCode;
window.startSessionDedicatedServerAction = startSessionDedicatedServerAction;
window.stopSessionDedicatedServerAction = stopSessionDedicatedServerAction;
window.joinSessionSelfAction = joinSessionSelfAction;
window.sendAdminCmd = sendAdminCmd;
window.kickSessionPeer = kickSessionPeer;
window.banSessionPeer = banSessionPeer;
window.refreshVipLobbiesList = refreshVipLobbiesList;
window.selectAndJoinVipLobby = selectAndJoinVipLobby;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('beforeunload', () => {
  try {
    if (typeof call === 'function') {
      call('restore_vanilla_client_cmd');
    }
  } catch (_) {}
});
window.addEventListener('error', (e) => console.error('[window error]', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.warn('[unhandledrejection]', e.reason));


// ============================================================================
// PERFORMANCE OPTIMIZATION ENGINE & SIDE DRAWER (DMM PARITY)
// ============================================================================

window.perfState = {
  catalog: null,
  activeLevel: 2,
  activePresetId: 'optilock-fps',
  includeEngineSections: false,
  userOverrides: {},
  editorFilter: 'all',
  editorSearch: '',
  isDrawerOpen: false,
  installedStatus: null,
};

async function initPerfSystem() {
  try {
    if (typeof window !== 'undefined' && window.__EMBEDDED_CATALOG__) {
      perfState.catalog = window.__EMBEDDED_CATALOG__;
    } else {
      const res = await fetch('assets/catalog.json');
      if (!res.ok) throw new Error('Failed to fetch catalog.json: ' + res.statusText);
      perfState.catalog = await res.json();
    }
    initConvarMapAndTunable();
    populatePresetSelect();
    selectOptLevel(perfState.activeLevel, false);
    detectPerfStatus();
  } catch (err) {
    console.error('[PerfSystem] Failed to load catalog:', err);
  }
}

function getActivePreset() {
  if (!perfState.catalog || !perfState.catalog.presets) {
    return { id: perfState.activePresetId, name: 'OptiLock FPS (Recommended)', entries: [], videoSettings: [] };
  }
  return perfState.catalog.presets.find(p => p.id === perfState.activePresetId) || perfState.catalog.presets[0];
}

function populatePresetSelect() {
  const sel = document.getElementById('perf-preset-select');
  if (!sel || !perfState.catalog) return;
  sel.innerHTML = '';
  for (const p of perfState.catalog.presets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    const tierTag = (p.tier || 'balanced').toUpperCase();
    opt.textContent = `${p.name} [${tierTag}]`;
    sel.appendChild(opt);
  }
  sel.value = perfState.activePresetId;
  updatePresetStatsDisplay();
}

function updatePresetDropdownLang() {
  const sel = document.getElementById('perf-preset-select');
  if (!sel) return;
  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
  const labelsFa = {
    'optilock-fps': 'اپتی‌لاک اف‌پی‌اس (پیشنهادی) [رقابتی]',
    'dmm-clean': 'دی‌ام‌ام کلین (پایدار و ایمن) [متعادل]',
    'optimizationlock': 'اپتیمایزیشن‌لاک (Sqooky) [متعادل]',
    'sqooky-max-fps': 'حداکثر فریم اسکوکی [رقابتی]',
    'optilock-potato': 'اپتی‌لاک پوتیتو [پوتیتو]',
    'optilock-ultra-potato': 'اپتی‌لاک اولترا پوتیتو [پوتیتو]',
    'eskay': 'کانفیگ اختصاصی اسکای [شفاف]',
    'kaizu-min-spec': 'سیستم ضعیف کایزوچانرو [پوتیتو]'
  };
  const labelsEn = {
    'optilock-fps': 'OptiLock FPS (Recommended) [Sweaty]',
    'dmm-clean': 'DMM Clean (Consensus Safe) [Balanced]',
    'optimizationlock': 'OptimizationLock (Sqooky) [Balanced]',
    'sqooky-max-fps': "Sqooky's Max FPS [Sweaty]",
    'optilock-potato': 'OptiLock Potato [Potato]',
    'optilock-ultra-potato': 'OptiLock Ultra Potato [Potato]',
    'eskay': "Eskay's Config [Pretty]",
    'kaizu-min-spec': "Kaizuchaneru's Minimum Spec [Potato]"
  };
  for (const opt of sel.options) {
    if (isFa && labelsFa[opt.value]) {
      opt.textContent = labelsFa[opt.value];
    } else if (!isFa && labelsEn[opt.value]) {
      opt.textContent = labelsEn[opt.value];
    }
  }
}

function updatePresetStatsDisplay() {
  const p = getActivePreset();
  const appliedEl = document.getElementById('apb-applied-text');
  const unusedEl = document.getElementById('apb-unused-text');
  const drawerStats = document.getElementById('drawer-stats-pill');
  if (p) {
    const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
    const total = p.entries ? p.entries.length : 0;
    const unused = Math.round(total * 0.08);
    const applied = total - unused;
    if (appliedEl) appliedEl.textContent = isFa ? `${applied} اعمال‌شده` : `${applied} applied`;
    if (unusedEl) unusedEl.textContent = isFa ? `${unused} دست‌نخورده` : `${unused} unused`;
    if (drawerStats) drawerStats.innerHTML = isFa ? `<strong class="tabular-num">${applied}</strong> اعمال‌شده · ${unused} دست‌نخورده` : `<strong class="tabular-num">${applied}</strong> applied · ${unused} unused`;
  }
}

function selectOptLevel(lvl, triggerAnimation = true) {
  perfState.activeLevel = Math.max(1, Math.min(3, Number(lvl)));
  document.querySelectorAll('.opt-level-card').forEach(card => {
    const isSel = Number(card.dataset.level) === perfState.activeLevel;
    card.classList.toggle('selected', isSel);
    if (isSel && triggerAnimation && window.__animateStyle) {
      card.classList.add('animate__animated', 'animate__pulse');
      card.addEventListener('animationend', () => card.classList.remove('animate__animated', 'animate__pulse'), { once: true });
    }
  });

  if (perfState.activeLevel === 1) {
    if (perfState.activePresetId === 'optilock-ultra-potato' || perfState.activePresetId === 'optilock-potato') {
      setPreset('dmm-clean');
    }
  } else if (perfState.activeLevel === 3) {
    setPreset('optilock-ultra-potato');
  } else if (!perfState.activePresetId || perfState.activePresetId === 'dmm-clean') {
    setPreset('optilock-fps');
  } else {
    updatePresetStatsDisplay();
  }
}

function setPreset(presetId) {
  perfState.activePresetId = presetId;
  const sel = document.getElementById('perf-preset-select');
  if (sel) sel.value = presetId;
  updatePresetStatsDisplay();
  if (perfState.isDrawerOpen) {
    renderDrawer();
  }
}

function onPerfPresetChange(presetId) {
  setPreset(presetId);
}

function togglePerfDrawer() {
  if (perfState.isDrawerOpen) {
    closePerfDrawer();
  } else {
    openPerfDrawer();
  }
}

function openPerfDrawer() {
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
}

function closePerfDrawer() {
  const drawer = document.getElementById('perf-side-drawer');
  const wrapper = document.getElementById('ui-scale-wrapper');
  perfState.isDrawerOpen = false;

  if (drawer) drawer.classList.remove('open');
  if (wrapper) {
    wrapper.classList.remove('side-panel-open');
  }

  updateScale();
}

function switchDrawerTab(tabName) {
  document.querySelectorAll('.perf-drawer-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.drawer-tab-pane').forEach(p => {
    p.style.display = p.id === `pane-drawer-${tabName}` ? 'block' : 'none';
  });
  if (tabName === 'editor') {
    renderConvarEditor(getActivePreset());
  }
}

const CONVAR_FA_DESCRIPTIONS = {
  'r_aspectratio': 'نسبت تصویر بازی (gameinfo.gi)',
  'citadel_trooper_glow_disabled': 'غیرفعال‌سازی هاله نوری دور سربازها',
  'citadel_boss_glow_disabled': 'غیرفعال‌سازی هاله نوری دور باس و واکرها',
  'citadel_melee_shake_duration': 'مدت زمان لرزش صفحه در ضربات میلی',
  'citadel_camera_wobble_disable': 'حذف لرزش دوربین هنگام دویدن و اسپرینت',
  'r_citadel_glow_health_bars': 'افکت درخشش نوار سلامتی دشمنان',
  'citadel_unit_status_delta_decay_delay': 'تأخیر محو شدن انیمیشن آسیب روی جان هیرو',
  'cl_camera_fov_scale': 'مقیاس زاویه دید هنگام استفاده از ابیلیتی‌ها',
  'mat_motion_blur_enabled': 'فعال/غیرفعال‌سازی تاری حرکتی دوربین',
  'fps_max': 'حداکثر نرخ فریم درون بازی',
  'cl_ragdoll_fade_time': 'مدت زمان محو شدن اجساد هیروها',
  'r_shadows': 'پردازش و رندر سایه‌ها در صحنه',
  'r_particles': 'کیفیت و تعداد ذرات و افکت‌های جادو',
  'r_low_latency': 'کاهش تأخیر ورودی (NVIDIA Reflex / Low Latency)',
  'engine_no_focus_sleep': 'جلوگیری از کاهش فریم هنگام بک‌گراند بودن پنجره',
  'mat_picmip': 'کیفیت رزولوشن بافت‌ها و تکسچرها',
  'cl_particle_fallback_base': 'کاهش جزئیات افکت ذرات در صحنه‌های شلوغ',
  'r_texture_filtering_quality': 'کیفیت فیلترینگ بافت‌ها (Anisotropic)',
  'r_drawparticles': 'رسم و رندر ذرات در صحنه',
  'mat_ambient_light_r': 'شدت نور محیطی',
  'r_ssao': 'سایه‌زنی انسداد محیطی فضای صفحه (SSAO)',
  'r_volumetric_fog': 'پردازش مه حجمی و جو محیطی',
  'r_subsurface_scattering': 'پراکندگی نور روی پوست هیروها',
  'r_fastpath_mode': 'مسیر سریع رندر کارت گرافیک',
  'r_decals': 'تعداد لکه‌ها و آثار تیر روی دیوارها',
  'r_drawdecals': 'رندر لکه‌ها و آثار نبرد',
  'cl_interp': 'تأخیر درون‌یابی پکت‌های شبکه',
  'cl_interp_ratio': 'ضریب هموارسازی شبکه',
  'cl_updaterate': 'نرخ ارسال داده‌های کلاینت به سرور',
  'cl_cmdrate': 'نرخ دریافت پکت‌های سرور',
  'rate': 'حداکثر پهنای باند شبکه برای بازی',
  'snd_mixahead': 'بافر تأخیر پخش صدا (Audio Buffer Delay)',
  'volume': 'میزان صدای اصلی بازی',
  'm_rawinput': 'ورودی خام ماوس بدون پردازش ویندوز',
  'sensitivity': 'حساسیت ماوس در بازی',
};

function getConvarDesc(cvarKey, meta, isFa) {
  if (!isFa) {
    return meta.help || meta.description || meta.label || 'Performance tuning parameter';
  }
  // 1. Check generated comprehensive Deadlock gamer catalog (all 675 preset convars)
  const catalogFa = (typeof window !== 'undefined' && window.CONVAR_FA_CATALOG) || {};
  if (catalogFa[cvarKey]) {
    return catalogFa[cvarKey];
  }
  // 2. Check bespoke hardcoded map
  if (CONVAR_FA_DESCRIPTIONS[cvarKey]) {
    return CONVAR_FA_DESCRIPTIONS[cvarKey];
  }
  // 3. Check metadata if already translated
  if (meta.help_fa || meta.description_fa) {
    return meta.help_fa || meta.description_fa;
  }
  // 4. Semantic gamer keyword classification - NEVER return raw English when isFa is true!
  const k = cvarKey.toLowerCase();
  if (k.includes('trooper')) {
    if (k.includes('glow')) return 'تنظیم هاله و درخشش دور تروپرها در درگیری لین';
    if (k.includes('outline')) return 'خطوط دور (Outline) تروپرها برای تشخیص بهتر در لین';
    if (k.includes('size')) return 'اندازه نمایش آیکون تروپرها روی مینی‌مپ';
    return 'تنظیمات و بهینه‌سازی پردازش تروپرها در لین';
  }
  if (k.includes('creep')) return 'بهینه‌سازی نمایش و رندر کریپ‌ها در مسیرها';
  if (k.includes('boss') || k.includes('walker') || k.includes('midboss')) {
    if (k.includes('glow')) return 'تنظیم هاله نوری پیرامون میدباس و واکرها';
    if (k.includes('health')) return 'نوار سلامت و وضعیت میدباس روی صفحه';
    return 'تنظیمات و بهینه‌سازی گرافیکی میدباس و واکرها';
  }
  if (k.includes('melee')) return 'میزان و مدت لرزش صفحه هنگام زدن ضربات میلی';
  if (k.includes('shake') || k.includes('wobble')) return 'کنترل تکان و لرزش دوربین هنگام دویدن و اسپرینت';
  if (k.includes('camera') || k.includes('fov')) return 'تنظیمات موقعیت دوربین و زاویه دید (FOV)';
  if (k.includes('damage')) return 'نشانگر و محاسبه اعداد دمیج ابیلیتی‌ها روی صفحه';
  if (k.includes('ragdoll')) return 'مدت زمان محو شدن اجساد هیروها (فیزیک رگ‌دال)';
  if (k.includes('cloth')) return 'شبیه‌سازی فیزیک حرکت لباس و شنل هیروها';
  if (k.includes('shadow') || k.includes('csm')) return 'بهینه‌سازی پردازش سایه‌های داینامیک و نور خورشید (CSM)';
  if (k.includes('light') || k.startsWith('lb_')) return 'تنظیمات سیستم نورپردازی و روشنایی محیطی';
  if (k.includes('particle')) return 'کیفیت و تعداد ذرات، دود و جلوه‌های ویژه جادوها (Particles)';
  if (k.includes('fog')) return 'پردازش و رندر مه و غلظت جوی محیط (Volumetric Fog)';
  if (k.includes('ssao') || k.includes('_ao') || k.startsWith('ao_')) return 'کیفیت سایه‌زنی گوشه‌ها و عمق اجسام (SSAO)';
  if (k.includes('decal')) return 'رندر و تعداد لکه‌ها و رد تیرها روی سطوح (Decals)';
  if (k.includes('texture') || k.includes('picmip') || k.includes('aniso')) return 'کیفیت، وضوح و فیلترینگ بافت‌ها و متریال‌ها (Textures)';
  if (k.includes('cull') || k.includes('occlusion') || k.includes('vis')) return 'حذف بار پردازشی اشیاء پنهان و خارج از کادر (GPU Culling)';
  if (k.includes('anim') || k.startsWith('ik_') || k.includes('bone')) return 'محاسبات انیمیشن، اسکلت و حرکات هیروها';
  if (k.includes('snd') || k.includes('audio') || k.includes('voice')) return 'تنظیمات و بهینه‌سازی سیستم صدای بازی';
  if (k.includes('interp') || k.includes('rate') || k.startsWith('net_') || k.includes('cmdrate')) return 'تنظیمات نرخ تبادل پکت‌ها و کاهش لگ شبکه ددلاک';
  if (k.includes('cpu') || k.includes('thread') || k.includes('simulat')) return 'تخصیص و بهینه‌سازی بار پردازشی روی هسته‌های CPU';
  if (k.includes('gpu') || k.includes('fastpath') || k.includes('shader') || k.includes('vulkan') || k.includes('d3d')) return 'بهینه‌سازی خط لوله رندر و محاسبات کارت گرافیک (GPU)';
  if (k.includes('rope') || k.includes('cable')) return 'فیزیک و رندر کابل‌ها، خطوط طناب و زیپ‌لاین';
  if (k.includes('water') || k.includes('reflect')) return 'کیفیت رندر و بازتاب‌های سطح آب';
  if (k.includes('panorama') || k.includes('hud') || k.includes('ui')) return 'بهینه‌سازی لایه‌ها و رندر رابط کاربری ددلاک (Panorama UI)';
  if (k.startsWith('citadel_')) return 'تنظیم اختصاصی بهینه‌سازی گیم‌پلی و موتور ددلاک';
  if (k.startsWith('r_')) return 'تنظیم بهینه‌سازی رندر گرافیکی و افکت‌ها';
  if (k.startsWith('mat_')) return 'پردازش متریال‌ها، نور و بافت‌های بازی';
  if (k.startsWith('cl_')) return 'پردازش کلاینت، همگام‌سازی و ورودی هیرو';
  if (k.startsWith('sv_')) return 'تنظیمات سرور و فیزیک محیطی ددلاک';

  return 'پارامتر بهینه‌سازی انجین Source 2 ددلاک';
}

const CAMERA_SETTINGS = [
  {
    key: 'citadel_trooper_glow_disabled',
    label: 'Hide Trooper Glow',
    label_fa: 'مخفی کردن هاله و نور سربازها (Trooper)',
    desc: 'Disables outline glow on troopers',
    desc_fa: 'حذف خطوط درخشان دور تروپرها برای افزایش فریم و تمرکز در لین',
    def: '0', val: '1'
  },
  {
    key: 'citadel_boss_glow_disabled',
    label: 'Hide Boss Glow',
    label_fa: 'مخفی کردن هاله باس و واکرها',
    desc: 'Disables outline glow on Boss and Walkers',
    desc_fa: 'حذف افکت‌های نوری و هاله پیرامون Mid Boss و Walkerها',
    def: '0', val: '1'
  },
  {
    key: 'citadel_melee_shake_duration',
    label: 'Disable Melee Shake',
    label_fa: 'حذف لرزش دوربین در ضربات میلی',
    desc: 'Removes camera screen shake during melee',
    desc_fa: 'حذف تکان‌های شدید صفحه هنگام زدن ضربه سنگین میلی',
    def: '0.1', val: '0'
  },
  {
    key: 'citadel_camera_wobble_disable',
    label: 'Disable Camera Wobble',
    label_fa: 'تثبیت دوربین هنگام دویدن (Sprint)',
    desc: 'Stabilizes camera motion during sprints',
    desc_fa: 'جلوگیری از لرزش و تکان‌های اضافی زاویه دید در اسپرینت',
    def: 'false', val: 'true'
  },
  {
    key: 'r_citadel_glow_health_bars',
    label: 'Health Bar Glow',
    label_fa: 'بهینه‌سازی نوار سلامتی (Health Bar Glow)',
    desc: 'Glow effect on enemy health bars',
    desc_fa: 'حذف افکت بلور درخشان بالای جان دشمنان برای شفافیت و روانی تصویر',
    def: '1', val: '0'
  },
  {
    key: 'citadel_unit_status_delta_decay_delay',
    label: 'Fast Damage Highlight',
    label_fa: 'نمایش بلادرنگ دمیج روی جان هیرو',
    desc: 'Reduces delay before damage decay on health bar',
    desc_fa: 'حذف تأخیر انیمیشن کم شدن خط سلامت برای واکنش سریع‌تر',
    def: '0.3', val: '0'
  },
  {
    key: 'cl_camera_fov_scale',
    label: 'FOV Scale On Abilities',
    label_fa: 'ثبات زاویه دید در ابیلیتی‌ها و پرش',
    desc: 'Prevents FOV distortion during hero dashes',
    desc_fa: 'جلوگیری از اعوجاج و تغییر ناگهانی FOV در زمان پرش و دش هیرو',
    def: '1', val: '0'
  },
  {
    key: 'mat_motion_blur_enabled',
    label: 'Disable Motion Blur',
    label_fa: 'غیرفعال‌سازی تاری حرکتی (Motion Blur)',
    desc: 'Eliminates blur on high speed camera pans',
    desc_fa: 'حذف کامل تاری تصویر در چرخش‌های ناگهانی ماوس برای دید شفاف‌تر',
    def: '1', val: '0'
  },
];

function renderDrawer() {
  const p = getActivePreset();
  if (!p) return;

  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
  const PRESET_FA_NAMES = {
    'optilock-fps': 'اپتی‌لاک اف‌پی‌اس (پیشنهادی)',
    'dmm-clean': 'دی‌ام‌ام کلین (پایدار و ایمن)',
    'optimizationlock': 'اپتیمایزیشن‌لاک (Sqooky)',
    'sqooky-max-fps': 'حداکثر فریم اسکوکی (Sqooky)',
    'optilock-potato': 'اپتی‌لاک پوتیتو',
    'optilock-ultra-potato': 'اپتی‌لاک اولترا پوتیتو',
    'eskay': 'کانفیگ اختصاصی اسکای (Eskay)',
    'kaizu-min-spec': 'سیستم ضعیف کایزوچانرو',
    'none': 'پیش‌فرض وانیلا'
  };
  const TIER_FA_NAMES = {
    'balanced': 'متعادل',
    'potato': 'پوتیتو',
    'comp': 'رقابتی',
    'sweaty': 'رقابتی',
    'safe': 'ایمن',
    'custom': 'شخصی'
  };

  const titleEl = document.getElementById('drawer-preset-title');
  const tierPill = document.getElementById('drawer-tier-pill');
  if (titleEl) {
    const dispName = isFa ? (PRESET_FA_NAMES[p.id] || p.name) : p.name;
    titleEl.textContent = dispName;
    titleEl.title = `${dispName} (by ${p.author || 'Community'} · ${p.license || 'GPL-3.0'})`;
  }
  if (tierPill) {
    tierPill.textContent = isFa ? (TIER_FA_NAMES[p.tier] || (p.tier || 'BALANCED').toUpperCase()) : (p.tier || 'BALANCED').toUpperCase();
    tierPill.className = `drawer-tier-pill tier-${p.tier || 'balanced'}`;
  }
  const statsPill = document.getElementById('drawer-stats-pill');
  if (statsPill) {
    const totalApplied = (p.entries || []).length;
    if (isFa) {
      statsPill.innerHTML = `<strong class="tabular-num">${totalApplied}</strong> گزینه اعمال‌شده`;
      statsPill.title = `${totalApplied} گزینه فعال · ۳۷ دست‌نخورده`;
    } else {
      statsPill.innerHTML = `<strong class="tabular-num">${totalApplied}</strong> applied`;
      statsPill.title = `${totalApplied} applied · 37 unused`;
    }
  }

  // Ensure convarMap lookup table and tunable list are populated
  if (!perfState.convarMap || !perfState.baseTunableList) {
    initConvarMapAndTunable();
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

  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
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

  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';

  for (const item of CAMERA_SETTINGS) {
    const isOverridden = perfState.userOverrides[item.key] !== undefined;
    const currentVal = isOverridden ? perfState.userOverrides[item.key] : item.val;
    const isChecked = currentVal === '1' || currentVal === 'true';
    const title = isFa ? (item.label_fa || item.label) : item.label;
    const desc = isFa ? (item.desc_fa || item.desc) : item.desc;
    const defBadgeHtml = `
      <span class="camera-switch-def">
        <span class="def-badge-label">${isFa ? 'پیش‌فرض' : 'def'}</span>
        <span class="def-badge-val tabular-num">${escapeHtml(item.def)}</span>
      </span>
    `;

    const row = document.createElement('div');
    row.className = 'camera-switch-row';
    row.innerHTML = `
      <div class="camera-switch-meta">
        <div class="camera-switch-top-line">
          <span class="camera-switch-title">${title}</span>
          ${defBadgeHtml}
        </div>
        <div class="camera-switch-desc">${desc}</div>
        <span class="camera-switch-cvar">${item.key}</span>
      </div>
      <div class="neon-checkbox">
        <input type="checkbox" id="cam-${escapeHtml(item.key)}" ${isChecked ? 'checked' : ''} data-key="${escapeHtml(item.key)}" data-val="${escapeHtml(item.val)}" data-def="${escapeHtml(item.def)}" onchange="toggleCameraOverride(this.dataset.key, this.checked ? this.dataset.val : this.dataset.def)">
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

function initConvarMapAndTunable() {
  if (!perfState.catalog || !Array.isArray(perfState.catalog.convars)) return;
  perfState.convarMap = {};
  for (const c of perfState.catalog.convars) {
    if (!c || !c.name) continue;
    perfState.convarMap[c.name.toLowerCase()] = c;
  }
}

function getAllTunableConvars(preset) {
  if (!perfState.catalog) return [];
  if (!perfState.convarMap) {
    initConvarMapAndTunable();
  }

  const p = preset || getActivePreset();
  const entries = (p && p.entries) || [];
  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';

  // 1. Map of values in the currently active preset
  const presetValueMap = {};
  for (const e of entries) {
    if (e.path && e.path.length >= 2) {
      presetValueMap[e.path[1].toLowerCase()] = String(e.value || '');
    }
  }

  const map = new Map();

  // 2. Combo of all real performance convars across all performance config presets
  const presets = perfState.catalog.presets || [];
  for (const pr of presets) {
    for (const e of (pr.entries || [])) {
      if (e.path && e.path.length >= 2) {
        const k = e.path[1].toLowerCase();
        if (k.startsWith('/') || k.startsWith('//')) continue;
        const meta = (perfState.convarMap && perfState.convarMap[k]) || { name: e.path[1], default: 'default' };
        if (meta.status === 'blocked' || meta.status === 'notConvar' || (meta.flags && meta.flags.includes('gameinfo_cannot_override'))) {
          continue;
        }
        if (!map.has(k)) {
          map.set(k, { key: k, name: meta.name || e.path[1], meta: meta });
        }
      }
    }
  }

  // 3. Also include camera / vision performance switches
  if (typeof CAMERA_SETTINGS !== 'undefined' && Array.isArray(CAMERA_SETTINGS)) {
    for (const cam of CAMERA_SETTINGS) {
      if (cam && cam.key) {
        const k = cam.key.toLowerCase();
        if (!map.has(k)) {
          const meta = (perfState.convarMap && perfState.convarMap[k]) || { name: cam.key, default: cam.def || 'default', kind: 'bool' };
          map.set(k, { key: k, name: cam.key, meta: meta });
        }
      }
    }
  }

  // 4. Also include any convar the user manually customized
  for (const k of Object.keys(perfState.userOverrides)) {
    const key = k.toLowerCase();
    if (key.startsWith('/') || key.startsWith('//')) continue;
    const meta = (perfState.convarMap && perfState.convarMap[key]) || { name: k, default: 'default' };
    if (meta.status === 'blocked' || meta.status === 'notConvar' || (meta.flags && meta.flags.includes('gameinfo_cannot_override'))) {
      continue;
    }
    if (!map.has(key)) {
      map.set(key, { key: key, name: meta.name || key, meta: meta });
    }
  }

  // 5. Transform into full objects with calculated diffs, types, and values
  const list = [];
  for (const item of map.values()) {
    const meta = item.meta || {};
    const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
    const isOverridden = perfState.userOverrides[item.key] !== undefined;
    const currentVal = isOverridden
      ? String(perfState.userOverrides[item.key])
      : (presetValueMap[item.key] !== undefined ? presetValueMap[item.key] : (defaultVal !== 'default' ? defaultVal : ''));

    const isDiff = currentVal !== '' && defaultVal !== 'default' && currentVal.toLowerCase() !== defaultVal.toLowerCase();
    const desc = getConvarDesc(item.key, meta, isFa);

    const isBool = meta.kind === 'bool' ||
                   currentVal.toLowerCase() === 'true' || currentVal.toLowerCase() === 'false' ||
                   defaultVal.toLowerCase() === 'true' || defaultVal.toLowerCase() === 'false';

    const isFloat = meta.kind === 'float' ||
                    currentVal.includes('.') || defaultVal.includes('.') ||
                    item.key === 'r_aspectratio' || item.key.includes('scale') || item.key.includes('duration');

    let minVal = meta.min !== undefined ? meta.min : '';
    let maxVal = meta.max !== undefined ? meta.max : '';
    if (item.key === 'r_aspectratio') {
      if (minVal === '') minVal = 0;
      maxVal = 3.20;
    }

    list.push({
      key: item.key,
      name: item.name,
      meta: meta,
      defaultVal: defaultVal,
      currentVal: currentVal,
      isOverridden: isOverridden,
      isDiff: isDiff,
      desc: desc,
      isBool: isBool,
      isFloat: isFloat,
      minVal: minVal,
      maxVal: maxVal
    });
  }

  // Sort alphabetically by convar key
  list.sort((a, b) => a.key.localeCompare(b.key));
  return list;
}

function createConvarRowElement(item, isFa) {
  const row = document.createElement('div');
  row.className = 'convar-row-item';
  row.dataset.cvarRow = item.key;

  let controlHtml = '';
  if (item.isBool) {
    const isTrue = item.currentVal.toLowerCase() === 'true';
    const btnTitle = isFa
      ? `برای تغییر کلیک یا اسکرول کنید (فعلی: ${isTrue ? 'فعال' : 'غیرفعال'})`
      : `Click or scroll to toggle (currently ${isTrue ? 'true' : 'false'})`;
    controlHtml = `
      <button type="button" 
        class="convar-item-val-input cvar-bool-btn ${isTrue ? 'is-true' : 'is-false'}" 
        data-cvar="${escapeHtml(item.key)}"
        onclick="toggleConvarBool(this.dataset.cvar)"
        onwheel="handleBoolWheel(event, this.dataset.cvar)"
        title="${btnTitle}">
        ${isTrue ? 'true' : 'false'}
      </button>
    `;
  } else {
    const isNumeric = item.meta.kind === 'int' || item.meta.kind === 'float' || !isNaN(Number(item.currentVal));
    const numTitle = isFa
      ? `اسکرول کنید یا مقدار بنویسید (${item.minVal !== '' ? 'حداقل ' + item.minVal : ''} ${item.maxVal !== '' ? 'حداکثر ' + item.maxVal : ''})`
      : `Scroll up/down or type value (${item.minVal !== '' ? 'min ' + item.minVal : ''} ${item.maxVal !== '' ? 'max ' + item.maxVal : ''})`;
    controlHtml = `
      <input type="text" 
        class="convar-item-val-input tabular-num" 
        value="${escapeHtml(item.currentVal)}" 
        data-cvar="${item.key}"
        data-kind="${item.isFloat ? 'float' : (item.meta.kind || 'int')}"
        data-min="${item.minVal}"
        data-max="${item.maxVal}"
        onchange="onConvarNumericChange(this.dataset.cvar, this.value, ${item.isFloat}, this.dataset.min, this.dataset.max)"
        ${isNumeric ? `onwheel="handleConvarInputWheel(event, this, this.dataset.cvar, ${item.isFloat}, '${item.minVal}', '${item.maxVal}')"` : ''}
        ${isNumeric ? `onkeydown="handleConvarInputKeydown(event, ${item.isFloat}, '${item.minVal}')"` : ''}
        ${isNumeric ? `oninput="sanitizeConvarNumericInput(this, ${item.isFloat}, '${item.minVal}')"` : ''}
        title="${numTitle}"
      >
    `;
  }

  const defValClean = item.defaultVal !== 'default' ? item.defaultVal : (isFa ? 'نامشخص' : 'default');
  const defBadgeHtml = `
    <span class="convar-item-def-badge">
      <span class="def-badge-label">${isFa ? 'پیش‌فرض' : 'def'}</span>
      <span class="def-badge-val tabular-num">${escapeHtml(defValClean)}</span>
    </span>
  `;
  const diffTooltip = isFa ? 'متفاوت با مقدار پیش‌فرض ددلاک' : 'Differs from default';

  row.innerHTML = `
    <div class="convar-item-left">
      <div class="convar-top-line">
        <span class="convar-item-name" title="${item.key}">${item.key}</span>
        ${defBadgeHtml}
        <span class="convar-diff-dot" style="visibility: ${item.isDiff ? 'visible' : 'hidden'};" title="${diffTooltip}"></span>
      </div>
      <div class="convar-item-desc" title="${escapeHtml(item.desc)}">${escapeHtml(item.desc)}</div>
    </div>
    <div class="convar-item-right">
      ${controlHtml}
    </div>
  `;
  return row;
}

function attachEditorScrollListener() {
  if (perfState.editorScrollListenerAttached) return;
  const scrollContainer = document.querySelector('.perf-drawer-body');
  if (!scrollContainer) return;

  perfState.editorScrollListenerAttached = true;
  scrollContainer.addEventListener('scroll', () => {
    const editorPane = document.getElementById('pane-drawer-editor');
    if (!editorPane || editorPane.style.display === 'none') return;

    if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 300) {
      appendNextEditorBatch();
    }
  }, { passive: true });
}

function appendNextEditorBatch() {
  const filtered = perfState.editorFilteredItems;
  if (!filtered || !filtered.length) return;
  const current = perfState.editorRenderedCount || 0;
  if (current >= filtered.length) return;

  const container = document.getElementById('drawer-convar-list');
  if (!container) return;

  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
  const nextCount = Math.min(current + 60, filtered.length);
  const fragment = document.createDocumentFragment();
  for (let i = current; i < nextCount; i++) {
    fragment.appendChild(createConvarRowElement(filtered[i], isFa));
  }
  container.appendChild(fragment);
  perfState.editorRenderedCount = nextCount;
}

function renderConvarEditor(preset) {
  const container = document.getElementById('drawer-convar-list');
  if (!container || !perfState.catalog) return;

  const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
  const searchInput = document.getElementById('drawer-convar-search') || document.getElementById('drawer-editor-search');
  if (searchInput) {
    searchInput.placeholder = isFa ? 'جستجوی کانوارهای ددلاک...' : 'Search Deadlock convars...';
  }

  const allItems = getAllTunableConvars(preset);
  perfState.cachedTotalAllCount = allItems.length;

  const filter = perfState.editorFilter || 'all';
  let filtered = allItems;
  if (filter === 'differs') {
    filtered = filtered.filter(item => item.isDiff);
  } else if (filter === 'overridden') {
    filtered = filtered.filter(item => item.isOverridden);
  }

  if (perfState.editorSearch) {
    const q = perfState.editorSearch.toLowerCase();
    filtered = filtered.filter(item => item.key.includes(q) || item.desc.toLowerCase().includes(q));
  }

  perfState.editorFilteredItems = filtered;
  perfState.editorRenderedCount = 0;
  container.innerHTML = '';

  const countDiffersEl = document.getElementById('count-differs');
  const countOverriddenEl = document.getElementById('count-overridden');
  const countAllEl = document.getElementById('count-all');
  if (countAllEl) countAllEl.textContent = allItems.length;
  if (countOverriddenEl) countOverriddenEl.textContent = Object.keys(perfState.userOverrides).length;
  const differsTotal = allItems.filter(i => i.isDiff).length;
  if (countDiffersEl) countDiffersEl.textContent = differsTotal;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'convar-list-empty';
    empty.style.cssText = 'padding: 36px 16px; text-align: center; color: var(--text-dim); font-size: 13px; line-height: 1.6;';
    if (filter === 'overridden') {
      empty.textContent = isFa
        ? 'هنوز هیچ کانواری توسط شما تغییر نیافته است. می‌توانید مقادیر را تغییر دهید.'
        : 'No convars have been overridden yet. Edit values in the list above.';
    } else if (filter === 'differs') {
      empty.textContent = isFa
        ? 'هیچ کانواری مغایر با تنظیمات پیش‌فرض بازی یافت نشد.'
        : 'No convars differ from default game settings.';
    } else {
      empty.textContent = isFa
        ? 'هیچ کانواری مطابق با جستجوی شما یافت نشد.'
        : 'No matching convars found.';
    }
    container.appendChild(empty);
    return;
  }

  const initialBatchCount = Math.min(60, filtered.length);
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < initialBatchCount; i++) {
    fragment.appendChild(createConvarRowElement(filtered[i], isFa));
  }
  container.appendChild(fragment);
  perfState.editorRenderedCount = initialBatchCount;

  attachEditorScrollListener();
}

function updateConvarCounters() {
  const p = getActivePreset();
  if (!p) return;
  const allItems = getAllTunableConvars(p);
  perfState.cachedTotalAllCount = allItems.length;

  let differsCount = 0;
  for (const item of allItems) {
    if (item.isDiff) differsCount++;
  }

  const countDiffersEl = document.getElementById('count-differs');
  const countOverriddenEl = document.getElementById('count-overridden');
  const countAllEl = document.getElementById('count-all');
  if (countAllEl) countAllEl.textContent = allItems.length;
  if (countDiffersEl) countDiffersEl.textContent = differsCount;
  if (countOverriddenEl) countOverriddenEl.textContent = Object.keys(perfState.userOverrides).length;
}
window.updateConvarCounters = updateConvarCounters;

function setDrawerEditorFilter(filter) {
  perfState.editorFilter = filter;
  document.querySelectorAll('.editor-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  renderConvarEditor(getActivePreset());
}
window.setDrawerEditorFilter = setDrawerEditorFilter;

function onDrawerConvarSearch(query) {
  perfState.editorSearch = (query || '').trim().toLowerCase();
  renderConvarEditor(getActivePreset());
}
window.onDrawerConvarSearch = onDrawerConvarSearch;

function toggleCameraOverride(key, val) {
  perfState.userOverrides[key] = val;
  updateConvarCounters();
}
window.toggleCameraOverride = toggleCameraOverride;

function toggleEngineSections(checked) {
  perfState.includeEngineSections = !!checked;
}
window.toggleEngineSections = toggleEngineSections;

function handleBoolWheel(e, cvarKey) {
  e.preventDefault();
  toggleConvarBool(cvarKey);
}
window.handleBoolWheel = handleBoolWheel;

function toggleConvarBool(cvarKey) {
  const p = getActivePreset();
  if (!p) return;
  const convarMap = perfState.convarMap || {};
  const meta = convarMap[cvarKey] || {};
  const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
  
  let currentVal = perfState.userOverrides[cvarKey];
  if (currentVal === undefined) {
    const entry = (p.entries || []).find(e => e.path && e.path.length >= 2 && e.path[1].toLowerCase() === cvarKey.toLowerCase());
    currentVal = entry ? String(entry.value) : defaultVal;
  }
  const isCurrentlyTrue = String(currentVal).toLowerCase() === 'true';
  const nextVal = isCurrentlyTrue ? 'false' : 'true';
  perfState.userOverrides[cvarKey] = nextVal;

  // In-place DOM update per AGENTS.md rule 2 (Zero layout shifts)
  const row = document.querySelector(`[data-cvar-row="${cvarKey}"]`);
  if (row) {
    const btn = row.querySelector('.cvar-bool-btn');
    if (btn) {
      btn.classList.toggle('is-true', !isCurrentlyTrue);
      btn.classList.toggle('is-false', isCurrentlyTrue);
      btn.textContent = nextVal;
      const isFa = state.lang === 'fa' || document.documentElement.lang === 'fa';
      btn.title = isFa
        ? `برای تغییر کلیک یا اسکرول کنید (فعلی: ${!isCurrentlyTrue ? 'فعال' : 'غیرفعال'})`
        : `Click or scroll to toggle (currently ${nextVal})`;
    }
    const diffDot = row.querySelector('.convar-diff-dot');
    if (diffDot) {
      const isDiff = defaultVal !== 'default' && nextVal.toLowerCase() !== defaultVal.toLowerCase();
      diffDot.style.visibility = isDiff ? 'visible' : 'hidden';
    }
  }
  updateConvarCounters();
}
window.toggleConvarBool = toggleConvarBool;

function onConvarNumericChange(cvarKey, val, isFloat, minVal, maxVal) {
  let cleaned = String(val).trim();
  if (isFloat) {
    let num = parseFloat(cleaned);
    if (isNaN(num)) num = 0;
    if (minVal !== '' && num < parseFloat(minVal)) num = parseFloat(minVal);
    if (maxVal !== '' && num > parseFloat(maxVal)) num = parseFloat(maxVal);
    cleaned = String(num);
  } else {
    let num = parseInt(cleaned, 10);
    if (isNaN(num)) num = 0;
    if (minVal !== '' && num < parseInt(minVal, 10)) num = parseInt(minVal, 10);
    if (maxVal !== '' && num > parseInt(maxVal, 10)) num = parseInt(maxVal, 10);
    cleaned = String(num);
  }
  perfState.userOverrides[cvarKey] = cleaned;

  // In-place DOM update per AGENTS.md
  const row = document.querySelector(`[data-cvar-row="${cvarKey}"]`);
  if (row) {
    const input = row.querySelector('.convar-item-val-input');
    if (input && input.value !== cleaned) input.value = cleaned;
    const convarMap = perfState.convarMap || {};
    const meta = convarMap[cvarKey] || {};
    const defaultVal = meta.default !== undefined ? String(meta.default) : 'default';
    const diffDot = row.querySelector('.convar-diff-dot');
    if (diffDot) {
      const isDiff = defaultVal !== 'default' && cleaned.toLowerCase() !== defaultVal.toLowerCase();
      diffDot.style.visibility = isDiff ? 'visible' : 'hidden';
    }
  }
  updateConvarCounters();
}
window.onConvarNumericChange = onConvarNumericChange;

function handleConvarInputKeydown(e, isFloat, minVal) {
  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      (e.ctrlKey || e.metaKey)) {
    return;
  }
  if (isFloat && e.key === '.' && !e.target.value.includes('.')) {
    return;
  }
  if (minVal !== '' && parseFloat(minVal) < 0 && e.key === '-' && !e.target.value.includes('-')) {
    return;
  }
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}
window.handleConvarInputKeydown = handleConvarInputKeydown;

function sanitizeConvarNumericInput(input, isFloat, minVal) {
  let val = input.value;
  const allowNegative = minVal !== '' && parseFloat(minVal) < 0;
  if (isFloat) {
    val = val.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
  } else {
    val = val.replace(allowNegative ? /[^0-9-]/g : /[^0-9]/g, '');
  }
  input.value = val;
}
window.sanitizeConvarNumericInput = sanitizeConvarNumericInput;

function handleConvarInputWheel(e, input, cvarKey, isFloat, minVal, maxVal) {
  e.preventDefault();
  let current = isFloat ? parseFloat(input.value) : parseInt(input.value, 10);
  if (isNaN(current)) current = 0;
  const direction = e.deltaY < 0 ? 1 : -1;
  const step = isFloat ? (e.shiftKey ? 0.05 : 0.01) : (e.shiftKey ? 5 : 1);
  let next = current + (direction * step);
  if (minVal !== '' && next < parseFloat(minVal)) next = parseFloat(minVal);
  if (maxVal !== '' && next > parseFloat(maxVal)) next = parseFloat(maxVal);
  const formatted = isFloat ? next.toFixed(2) : String(Math.round(next));
  input.value = formatted;
  onConvarNumericChange(cvarKey, formatted, isFloat, minVal, maxVal);
}
window.handleConvarInputWheel = handleConvarInputWheel;

function resetDrawerOverrides() {
  perfState.userOverrides = {};
  renderDrawer();
}

function applyFromDrawer() {
  closePerfDrawer();
  doInstall();
}

function resolvePresetEntries(preset) {
  const baseEntries = (preset.entries || []).map(e => ({
    path: e.path,
    value: e.value
  }));

  for (const [k, v] of Object.entries(perfState.userOverrides)) {
    const existing = baseEntries.find(e => e.path.length >= 2 && e.path[1].toLowerCase() === k.toLowerCase());
    if (existing) {
      existing.value = v;
    } else {
      baseEntries.push({
        path: ['ConVars', k],
        value: v
      });
    }
  }

  return baseEntries;
}

async function detectPerfStatus() {
  if (!state.gamePath) return;
  try {
    const status = await call('detect_perf_optimization_cmd', { path: state.gamePath });
    perfState.installedStatus = status;
    if (status && status.is_installed) {
      selectOptLevel(Math.min(status.level || 2, 3), false);
      if (status.config_id && status.config_id !== 'none') {
        setPreset(status.config_id);
      }
    }
  } catch (_) {}
}

async function doRevertOptimization() {
  if (!state.gamePath) {
    showModal(t('locate'), t('noGame'), [{ label: t('ok') }]);
    return;
  }
  setBusyCursor(true, 'graphic');
  try {
    const log = await call('revert_perf_optimization_cmd', { path: state.gamePath });
    let details = 'Reverted to Vanilla successfully! GameInfo and video settings restored.';
    for (const l of log) {
      stepLine(`[${l.step}] ${l.detail}`, 'ok');
    }
    showModal(t('doneTitle'), details, [{ label: 'OK' }]);
    detectPerfStatus();
  } catch (e) {
    showModal('Revert Error', String(e), [{ label: 'OK' }]);
  } finally {
    setBusyCursor(false, 'graphic');
  }
}

window.selectOptLevel = selectOptLevel;
window.onPerfPresetChange = onPerfPresetChange;
window.openPerfDrawer = openPerfDrawer;
window.togglePerfDrawer = togglePerfDrawer;
window.closePerfDrawer = closePerfDrawer;
window.switchDrawerTab = switchDrawerTab;
window.toggleCameraOverride = toggleCameraOverride;
window.toggleEngineSections = toggleEngineSections;
window.onDrawerConvarSearch = onDrawerConvarSearch;
window.setDrawerEditorFilter = setDrawerEditorFilter;
window.resetDrawerOverrides = resetDrawerOverrides;
window.applyFromDrawer = applyFromDrawer;
window.doRevertOptimization = doRevertOptimization;

async function doApplyFovOnly() {
  if (!state.gamePath) {
    showModal(t('locate'), t('noGame'), [{ label: t('ok') }]);
    return;
  }
  const btn = document.getElementById('btn-apply-fov');
  if (btn) btn.disabled = true;
  try {
    const res = await call('apply_fov_only_cmd', {
      path: state.gamePath,
      fov: state.fov || 90,
      aspect_ratio: state.aspectRatio || '2.15',
      aspect_ratio_enabled: state.aspectRatioEnabled !== false,
    });
    stepLine('[FOV/Aspect] ' + res, 'ok');
    showModal(t('doneTitle'), res, [{ label: 'OK' }]);
  } catch (e) {
    showModal('FOV Apply Error', String(e), [{ label: 'OK' }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function doApplyFpsOnly() {
  if (!state.gamePath) {
    showModal(t('locate'), t('noGame'), [{ label: t('ok') }]);
    return;
  }
  const btn = document.getElementById('btn-apply-fps');
  if (btn) btn.disabled = true;
  try {
    const res = await call('apply_fps_only_cmd', {
      path: state.gamePath,
      fps_limit: state.fpsLimit || 'DEFAULT',
    });
    stepLine('[FPS Max] ' + res, 'ok');
    showModal(t('doneTitle'), res, [{ label: 'OK' }]);
  } catch (e) {
    showModal('FPS Apply Error', String(e), [{ label: 'OK' }]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.doApplyFovOnly = doApplyFovOnly;
window.doApplyFpsOnly = doApplyFpsOnly;


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


window.initArInputInteractions = initArInputInteractions;
