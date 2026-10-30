import re
import json

with open(r'd:\Claude\DLPBooster\ui\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Force dark mode on html tag directly
html = html.replace('<html lang="fa" dir="ltr">', '<html lang="fa" dir="ltr" class="dark" style="color-scheme: dark;">')

# 2. Head meta tags & subtle fixes style
meta_patch = '''  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#06090e" />
'''
html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0" />', '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' + meta_patch)

subtle_style = '''  <style id="dlp-subtle-enhancements">
    :root, html, body {
      color-scheme: dark !important;
    }

    /* Universal Dark Mode styling for ALL native select elements & options */
    select,
    select option,
    select optgroup {
      color-scheme: dark !important;
      background-color: #0a101b !important;
      background: #0a101b !important;
      color: #f8fafc !important;
      border-color: rgba(249, 115, 22, 0.4) !important;
    }

    select option {
      background-color: #0a101b !important;
      background: #0a101b !important;
      color: #f8fafc !important;
      padding: 8px 12px !important;
      font-size: 13px !important;
    }

    select option:checked,
    select option:hover {
      background-color: #1e293b !important;
      background: #1e293b !important;
      color: #f97316 !important;
    }

    /* Cyber Custom Dropdown Component for Engine Config */
    .apb-select-wrap {
      position: relative !important;
    }

    .apb-custom-select-trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(14, 23, 38, 0.85);
      border: 1px solid rgba(249, 115, 22, 0.35);
      border-radius: 6px;
      color: #ffedd5;
      font-family: 'Rajdhani', 'Vazirmatn', sans-serif;
      font-size: 0.84rem;
      font-weight: 700;
      padding: 3px 10px;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 0 8px rgba(249, 115, 22, 0.15);
    }

    .apb-custom-select-trigger:hover,
    .apb-custom-select-trigger.is-open {
      border-color: var(--deadlock-orange);
      background: rgba(22, 34, 55, 0.95);
      box-shadow: 0 0 14px rgba(249, 115, 22, 0.35);
      color: #ffffff;
    }

    .apb-custom-chevron {
      font-size: 10px;
      color: var(--deadlock-orange);
      transition: transform 0.2s ease;
    }

    .apb-custom-select-trigger.is-open .apb-custom-chevron {
      transform: rotate(180deg);
    }

    .apb-custom-options-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 310px;
      background: #090e17;
      border: 1px solid rgba(249, 115, 22, 0.45);
      border-radius: 8px;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.95), 0 0 20px rgba(249, 115, 22, 0.25);
      z-index: 99999;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      animation: animate__fadeIn 0.15s ease;
      max-height: 280px;
      overflow-y: auto;
    }

    .apb-custom-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 5px;
      color: #cbd5e1;
      font-family: 'Rajdhani', 'Vazirmatn', sans-serif;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.12s ease, color 0.12s ease;
    }

    .apb-custom-option:hover {
      background: rgba(249, 115, 22, 0.18);
      color: #ffffff;
      border-left: 3px solid var(--deadlock-orange);
      padding-left: 9px;
    }

    .apb-custom-option.selected {
      background: rgba(249, 115, 22, 0.25);
      color: #ffedd5;
      font-weight: 700;
      border-left: 3px solid var(--deadlock-orange);
    }

    .apb-custom-option-check {
      color: var(--deadlock-orange);
      font-size: 11px;
    }

    /* -------------------------------------------------------------
       PERFECTLY REWORKED DRAWER (2-LINE HEADER - NO TITLE SQUISHING)
       ------------------------------------------------------------- */
    .perf-side-panel,
    .perf-side-drawer {
      position: fixed !important;
      right: 24px !important;
      top: 50% !important;
      transform: translateY(-50%) translateX(calc(100% + 40px)) !important;
      width: 450px !important;
      height: 600px !important;
      max-height: 88vh !important;
      background: radial-gradient(circle at 50% 0%, #131c2d 0%, #080c14 100%) !important;
      backdrop-filter: blur(28px) saturate(190%) !important;
      border: 1px solid rgba(249, 115, 22, 0.45) !important;
      border-radius: 12px !important;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(249, 115, 22, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      box-sizing: border-box !important;
      z-index: 99 !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, visibility 0.35s !important;
    }

    .perf-side-panel.open,
    .perf-side-drawer.open {
      transform: translateY(-50%) translateX(0) !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      visibility: visible !important;
    }

    /* Header: Strict 2 Lines */
    .perf-drawer-header {
      padding: 10px 14px 8px 14px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 7px !important;
      flex-shrink: 0 !important;
      background: rgba(10, 15, 25, 0.7) !important;
      border-radius: 12px 12px 0 0 !important;
    }

    /* Line 1: Badge + Full Unclipped Title + Stats + Close Button */
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
      padding: 2px 6px !important;
      border-radius: 4px !important;
      background: rgba(249, 115, 22, 0.2) !important;
      color: var(--deadlock-orange) !important;
      border: 1px solid rgba(249, 115, 22, 0.45) !important;
      flex-shrink: 0 !important;
      letter-spacing: 0.5px !important;
    }

    .perf-drawer-title {
      margin: 0 !important;
      font-size: 0.88rem !important;
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

    /* Line 2: Segmented Tabs Strip */
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
    }

    /* Drawer Body */
    .perf-drawer-body {
      flex: 1 1 auto !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding: 10px 14px !important;
      box-sizing: border-box !important;
      min-height: 0 !important;
    }

    .drawer-section-label {
      font-family: 'Rajdhani', 'Vazirmatn', sans-serif !important;
      font-size: 0.75rem !important;
      font-weight: 700 !important;
      color: #94a3b8 !important;
      margin-bottom: 8px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
    }

    /* -------------------------------------------------------------
       REWORKED TAB 2: CAMERA & VISION (COMPACT, HIGH-DENSITY ROWS)
       ------------------------------------------------------------- */
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

    /* -------------------------------------------------------------
       REWORKED TAB 3: CONVAR EDITOR (COMPACT PRO TABLE & FILTER)
       ------------------------------------------------------------- */
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

    .convar-item-desc {
      font-size: 0.68rem !important;
      color: #94a3b8 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      line-height: 1.1 !important;
    }

    .convar-item-val-input {
      width: 46px !important;
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
    }

    /* Category Bars Breakdown */
    .category-bars-list {
      display: flex !important;
      flex-direction: column !important;
      gap: 5px !important;
      margin-bottom: 12px !important;
    }

    .category-bar-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 0.75rem !important;
      background: rgba(255, 255, 255, 0.02) !important;
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      border-radius: 6px !important;
      padding: 5px 8px !important;
      transition: all 0.15s ease !important;
    }

    .category-bar-row:hover {
      background: rgba(249, 115, 22, 0.07) !important;
      border-color: rgba(249, 115, 22, 0.25) !important;
    }

    .category-bar-left {
      display: flex !important;
      align-items: center !important;
      gap: 7px !important;
      width: 140px !important;
      flex-shrink: 0 !important;
    }

    .category-bar-icon {
      font-size: 11px !important;
      color: var(--deadlock-orange) !important;
      width: 14px !important;
      text-align: center !important;
    }

    .category-bar-label {
      font-weight: 600 !important;
      color: #cbd5e1 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      font-size: 0.75rem !important;
    }

    .category-bar-track {
      flex: 1 !important;
      height: 6px !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border-radius: 3px !important;
      overflow: hidden !important;
      margin: 0 10px !important;
    }

    .category-bar-fill {
      height: 100% !important;
      background: linear-gradient(90deg, #f97316, #fb923c) !important;
      border-radius: 3px !important;
      box-shadow: 0 0 8px rgba(249, 115, 22, 0.4);
    }

    .category-bar-count {
      width: 32px !important;
      text-align: right !important;
      font-weight: 700 !important;
      color: #f1f5f9 !important;
      font-size: 0.74rem !important;
      font-family: var(--font-mono, monospace) !important;
    }

    .drawer-engine-notice {
      background: rgba(14, 21, 35, 0.85) !important;
      border: 1px solid rgba(249, 115, 22, 0.3) !important;
      border-radius: 8px !important;
      padding: 8px 12px !important;
      margin-top: 8px !important;
      box-shadow: 0 0 14px rgba(249, 115, 22, 0.08) !important;
    }

    .engine-sections-toggle-card {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      cursor: pointer !important;
    }

    .engine-toggle-title {
      font-size: 0.76rem !important;
      font-weight: 700 !important;
      color: #f8fafc !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }

    .engine-toggle-hint {
      font-size: 0.66rem !important;
      color: #94a3b8 !important;
      margin-top: 2px !important;
    }

    /* Drawer Footer */
    .perf-drawer-footer {
      padding: 9px 14px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      display: flex !important;
      gap: 10px !important;
      background: rgba(10, 15, 25, 0.85) !important;
      border-radius: 0 0 12px 12px !important;
      flex-shrink: 0 !important;
    }

    .btn-drawer-apply {
      flex: 1.4 !important;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%) !important;
      border: 1px solid #f97316 !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      font-size: 0.82rem !important;
      padding: 8px 12px !important;
      border-radius: 6px !important;
      box-shadow: 0 0 16px rgba(249, 115, 22, 0.35) !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 7px !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
    }

    .btn-drawer-apply:hover {
      filter: brightness(1.1) !important;
      box-shadow: 0 0 20px rgba(249, 115, 22, 0.5) !important;
    }

    .btn-drawer-reset {
      flex: 1 !important;
      background: rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      color: #94a3b8 !important;
      font-weight: 600 !important;
      font-size: 0.78rem !important;
      padding: 8px 10px !important;
      border-radius: 6px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
    }

    .btn-drawer-reset:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #ffffff !important;
    }

    /* 1. Subtle, high-contrast Cyberpunk focus ring (keyboard only, never on click) */
    :focus-visible {
      outline: 2px solid var(--deadlock-cyan) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.6) !important;
    }
    button:focus:not(:focus-visible),
    [role="button"]:focus:not(:focus-visible),
    .pro-card:focus:not(:focus-visible),
    .opt-level-card:focus:not(:focus-visible),
    .renderer-pill:focus:not(:focus-visible),
    .ar-pill:focus:not(:focus-visible),
    .win-ctl:focus:not(:focus-visible) {
      outline: none !important;
    }

    /* 2. Jitter-free Tabular Numerals on all metrics */
    .fov-val-chip,
    .fps-val-badge,
    .ar-real-input,
    .renderer-pill,
    .pill-val,
    .latency-progress-pct,
    .ping-val,
    .fov-bound,
    .tabular-num,
    .apb-stats-chip,
    .level-num,
    .drawer-stats-pill {
      font-variant-numeric: tabular-nums !important;
      font-feature-settings: "tnum" 1 !important;
    }

    /* 3. Subpixel font smoothing & crisp scale */
    #ui-scale-wrapper {
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      transform-origin: top center;
    }

    /* 4. Touch action manipulation for instant click response */
    button, [role="button"], .renderer-pill, .ar-pill, .opt-level-card, .pro-card {
      touch-action: manipulation;
    }

    /* 5. Modal overscroll containment */
    .modal-box, .error-diag-modal-box, .doorman-test-modal-box, .preset-modal-box, .revert-confirm-modal-box {
      overscroll-behavior: contain;
    }

    /* 6. Styled Cyberpunk Confirmation Dialog for Revert */
    .revert-confirm-modal-box {
      width: 480px;
      max-width: 92vw;
      background: radial-gradient(circle at 50% 0%, #151d2c 0%, #0c121e 100%);
      border: 1px solid rgba(249, 115, 22, 0.4);
      box-shadow: 0 0 30px rgba(0,0,0,0.85), 0 0 20px rgba(249, 115, 22, 0.25);
      border-radius: var(--radius);
      padding: 24px;
      animation: animate__fadeIn 0.2s ease;
    }
    .revert-modal-icon-badge {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: rgba(249, 115, 22, 0.15);
      border: 1px solid var(--deadlock-orange);
      color: var(--deadlock-orange);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      box-shadow: 0 0 14px var(--deadlock-orange-glow);
      margin-bottom: 14px;
    }
    .revert-modal-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 8px;
    }
    .revert-modal-desc {
      font-size: 0.85rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .revert-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  </style>
'''
html = html.replace('</head>', subtle_style + '\n</head>')

# 3. Image dimensions
html = html.replace('class="dlp-icon-play" alt="" />', 'class="dlp-icon-play" width="16" height="16" alt="" />')
html = html.replace('class="hero-app-icon" alt="DLPHub" />', 'class="hero-app-icon" width="72" height="72" alt="DLPHub" />')
html = html.replace('class="bg-trooper bg-trooper-left" alt="" />', 'class="bg-trooper bg-trooper-left" width="340" height="700" alt="" />')
html = html.replace('class="bg-trooper bg-trooper-right" alt="" />', 'class="bg-trooper bg-trooper-right" width="340" height="700" alt="" />')
html = html.replace('<img src="assets/dlp.png" alt="DLP" />', '<img src="assets/dlp.png" width="24" height="24" alt="DLP" />')

# 4. Pro-cards keyboard accessibility & roles
html = html.replace('<div class="pro-card active" id="card-graphic">', '<div class="pro-card active" id="card-graphic" role="tab" tabindex="0" aria-selected="true" aria-controls="panel-graphic">')
html = html.replace('<div class="pro-card" id="card-latency">', '<div class="pro-card" id="card-latency" role="tab" tabindex="0" aria-selected="false" aria-controls="panel-latency">')
html = html.replace('<div class="pro-card" id="card-lan">', '<div class="pro-card" id="card-lan" role="tab" tabindex="0" aria-selected="false" aria-controls="panel-lan">')
html = html.replace('<div class="pro-card" id="card-advanced">', '<div class="pro-card" id="card-advanced" role="tab" tabindex="0" aria-selected="false" aria-controls="panel-advanced">')

# 5. Opt level cards keyboard accessibility
html = html.replace('<div class="opt-level-card" data-level="1"', '<div class="opt-level-card" role="button" tabindex="0" data-level="1"')
html = html.replace('<div class="opt-level-card selected" data-level="2"', '<div class="opt-level-card selected" role="button" tabindex="0" data-level="2"')
html = html.replace('<div class="opt-level-card" data-level="3"', '<div class="opt-level-card" role="button" tabindex="0" data-level="3"')
html = html.replace('<div class="opt-level-card" data-level="4"', '<div class="opt-level-card" role="button" tabindex="0" data-level="4"')

# 6. Form inputs aria-labels
html = html.replace('id="path-input" placeholder="D:\\SteamLibrary', 'id="path-input" aria-label="مسیر پوشه ددلاک / Deadlock Folder Path" placeholder="D:\\SteamLibrary')
html = html.replace('id="fov-slider" min="70"', 'id="fov-slider" aria-label="زاویه دید / Field of View Slider" min="70"')
html = html.replace('id="ar-slider" min="1.33"', 'id="ar-slider" aria-label="نسبت تصویر / Aspect Ratio Slider" min="1.33"')
html = html.replace('id="ar-input" class="ar-real-input"', 'id="ar-input" aria-label="عدد نسبت تصویر / Aspect Ratio Value" class="ar-real-input"')

# 7. Live status aria-live
html = html.replace('id="step-log" class="step-log"', 'id="step-log" class="step-log" role="status" aria-live="polite"')

# 8. Hook Revert / Vanilla to Cyber Confirmation Modal
html = html.replace('onclick="doRevertOptimization()" data-i18n-tooltip="revertVanillaTooltip"', 'onclick="askRevertConfirmation()" data-i18n-tooltip="revertVanillaTooltip"')

# 9. Enhance .apb-select-wrap with custom dark dropdown trigger
custom_select_html = '''                <div class="apb-select-wrap" id="apb-dropdown-container">
                  <div class="apb-custom-select-trigger" id="apb-custom-select-trigger" onclick="toggleCustomDropdown()" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox">
                    <span id="apb-custom-select-label">OptiLock FPS (Recommended) [Sweaty]</span>
                    <i class="fa-solid fa-chevron-down apb-custom-chevron"></i>
                  </div>
                  <div class="apb-custom-options-menu" id="apb-custom-options-menu" style="display:none;" role="listbox">
                    <div class="apb-custom-option selected" data-value="optilock-fps" onclick="selectCustomOption('optilock-fps', this)">
                      <span>OptiLock FPS (Recommended) [Sweaty]</span>
                      <i class="fa-solid fa-check apb-custom-option-check"></i>
                    </div>
                    <div class="apb-custom-option" data-value="dmm-clean" onclick="selectCustomOption('dmm-clean', this)">
                      <span>DMM Clean (Consensus Safe) [Balanced]</span>
                    </div>
                    <div class="apb-custom-option" data-value="optimizationlock" onclick="selectCustomOption('optimizationlock', this)">
                      <span>OptimizationLock (Sqooky) [Balanced]</span>
                    </div>
                    <div class="apb-custom-option" data-value="sqooky-max-fps" onclick="selectCustomOption('sqooky-max-fps', this)">
                      <span>Sqooky's Max FPS [Sweaty]</span>
                    </div>
                    <div class="apb-custom-option" data-value="optilock-potato" onclick="selectCustomOption('optilock-potato', this)">
                      <span>OptiLock Potato [Potato]</span>
                    </div>
                    <div class="apb-custom-option" data-value="optilock-ultra-potato" onclick="selectCustomOption('optilock-ultra-potato', this)">
                      <span>OptiLock Ultra Potato [Potato]</span>
                    </div>
                    <div class="apb-custom-option" data-value="eskay" onclick="selectCustomOption('eskay', this)">
                      <span>Eskay's Config [Pretty]</span>
                    </div>
                    <div class="apb-custom-option" data-value="kaizu-min-spec" onclick="selectCustomOption('kaizu-min-spec', this)">
                      <span>Kaizuchaneru's Minimum Spec [Potato]</span>
                    </div>
                  </div>
                  <!-- Hidden native select kept for full internal logic & event sync -->
                  <select class="apb-select" id="perf-preset-select" style="display:none;" onchange="onPerfPresetChange(this.value)">
                    <option value="optilock-fps">OptiLock FPS (Recommended) [Sweaty]</option>
                    <option value="dmm-clean">DMM Clean (Consensus Safe) [Balanced]</option>
                    <option value="optimizationlock">OptimizationLock (Sqooky) [Balanced]</option>
                    <option value="sqooky-max-fps">Sqooky's Max FPS [Sweaty]</option>
                    <option value="optilock-potato">OptiLock Potato [Potato]</option>
                    <option value="optilock-ultra-potato">OptiLock Ultra Potato [Potato]</option>
                    <option value="eskay">Eskay's Config [Pretty]</option>
                    <option value="kaizu-min-spec">Kaizuchaneru's Minimum Spec [Potato]</option>
                  </select>
                </div>'''

apb_wrap_pattern = re.compile(r'<div class="apb-select-wrap">.*?<select class="apb-select".*?</select>\s*</div>', re.DOTALL)
html = apb_wrap_pattern.sub(custom_select_html, html)

# 10. REWORKED PERF DRAWER MARKUP (UNCLIPPED TITLE, REFINED CAMERA & CONVAR LISTS)
reworked_drawer_html = '''    <!-- Performance Details & Settings Side Panel (Reworked 2-Line Header) -->
    <aside class="perf-side-panel perf-side-drawer" id="perf-side-drawer" aria-label="Performance Details & Settings">
      <!-- 2-Line Compact Drawer Header (Never Truncates Title) -->
      <div class="perf-drawer-header">
        <!-- Line 1: Badge + Full Unclipped Title + Compact Stats + Close Button -->
        <div class="perf-drawer-header-row1">
          <div class="drawer-header-left">
            <span class="drawer-tier-pill" id="drawer-tier-pill">SWEATY</span>
            <h3 class="perf-drawer-title" id="drawer-preset-title" title="OptiLock FPS (Recommended)">OptiLock FPS (Recommended)</h3>
          </div>
          <div class="drawer-header-right">
            <span class="drawer-stats-pill" id="drawer-stats-pill" title="348 applied · 37 unused">
              <strong class="tabular-num">348</strong> applied · <strong class="tabular-num">37</strong> unused
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
            <i class="fa-solid fa-sliders"></i> <span data-i18n="drawerTabEditor">ویرایشگر کانفارها</span>
          </button>
        </div>
      </div>

      <!-- Drawer Body -->
      <div class="perf-drawer-body">
        <!-- Sub-Tab 1: Overview / Category Breakdown -->
        <div class="drawer-tab-pane active" id="pane-drawer-overview">
          <div class="drawer-section-label">
            <span data-i18n="whatItChanges">تعداد تنظیمات تغییر یافته بر اساس دسته‌بندی</span>
            <span class="tabular-num" style="color:var(--deadlock-orange); font-size:0.7rem;">۳۴۸ متغیر</span>
          </div>
          
          <div class="category-bars-list" id="drawer-category-bars">
            <!-- Populated dynamically via JS -->
          </div>

          <div class="drawer-engine-notice">
            <label class="engine-sections-toggle-card">
              <div class="neon-checkbox">
                <input type="checkbox" id="sw-engine-sections" onchange="toggleEngineSections(this.checked)">
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
              <div class="engine-toggle-text">
                <span class="engine-toggle-title">
                  <i class="fa-solid fa-shield-halved" style="color:var(--deadlock-orange); font-size:11px;"></i>
                  <span data-i18n="includeEngineSections">اعمال بخش‌های موتوری انجین (Network/Render)</span>
                </span>
                <span class="engine-toggle-hint" data-i18n="includeEngineHint">تغییر این بخش‌ها ممکن است توسط سرورهای رسمی مسدود شود</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Sub-Tab 2: Camera & Vision (High Density Pro List) -->
        <div class="drawer-tab-pane" id="pane-drawer-camera" style="display:none">
          <div class="drawer-section-label">
            <span data-i18n="cameraVisibilityTitle">بهینه‌سازی دوربین و دید در بازی</span>
            <span class="tabular-num" style="color:var(--deadlock-cyan); font-size:0.7rem;">۸ تنظیم کلیدی</span>
          </div>
          <div class="camera-switches-list" id="drawer-camera-switches">
            <!-- Populated dynamically with high density rows -->
          </div>
        </div>

        <!-- Sub-Tab 3: Full ConVar Settings Editor (High Density Pro Table) -->
        <div class="drawer-tab-pane" id="pane-drawer-editor" style="display:none">
          <div class="editor-search-bar">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="drawer-convar-search" placeholder="Search Deadlock convars..." oninput="filterConvars(this.value)">
          </div>
          <div class="editor-filter-chips">
            <button type="button" class="editor-chip active" id="chip-filter-all" data-filter="all" onclick="applyConvarFilter('all')">
              <span>همه</span> (<span class="tabular-num" id="count-all">348</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-differs" data-filter="differs" onclick="applyConvarFilter('differs')">
              <span>متفاوت با بازی</span> (<span class="tabular-num" id="count-differs">46</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-overridden" data-filter="overridden" onclick="applyConvarFilter('overridden')">
              <span>تغییر یافته توسط شما</span> (<span class="tabular-num" id="count-overridden">0</span>)
            </button>
          </div>
          <div class="editor-convar-list" id="drawer-convar-list">
            <!-- Populated dynamically with pro convar rows -->
          </div>
        </div>
      </div>

      <!-- Drawer Footer -->
      <div class="perf-drawer-footer">
        <button type="button" class="btn-drawer-apply" onclick="applyFromDrawer()">
          <i class="fa-solid fa-check"></i> <span data-i18n="applyConfig">اعمال کانفیگ روی بازی</span>
        </button>
        <button type="button" class="btn-drawer-reset" onclick="resetDrawerOverrides()">
          <i class="fa-solid fa-arrow-rotate-left"></i> <span data-i18n="resetOverrides">بازنشانی تغییرات دستی</span>
        </button>
      </div>
    </aside>'''

drawer_pattern = re.compile(r'<aside class="perf-side-panel perf-side-drawer".*?</aside>', re.DOTALL)
html = drawer_pattern.sub(reworked_drawer_html, html)

# 11. Revert confirmation modal markup & script injection
revert_modal_markup = '''  <!-- Modal: Confirm Revert to Vanilla -->
  <div class="modal-overlay" id="modal-confirm-revert" style="display:none" role="dialog" aria-modal="true" aria-labelledby="revert-dialog-title">
    <div class="modal-box revert-confirm-modal-box">
      <div class="revert-modal-icon-badge" aria-hidden="true">
        <i class="fa-solid fa-arrow-rotate-left"></i>
      </div>
      <div class="revert-modal-title" id="revert-dialog-title" data-i18n="revertConfirmTitle">بازگردانی کانفیگ اصلی بازی (Vanilla)؟</div>
      <div class="revert-modal-desc" data-i18n="revertConfirmDesc">
        با این کار فایل‌های gameinfo.gi و video.txt به حالت پیش‌فرض اولیه برمی‌گردند و تمام تنظیمات سفارشی و مادها پاک می‌شوند. فایل پشتیبان شما محفوظ می‌ماند.
      </div>
      <div class="revert-modal-actions">
        <button type="button" class="btn-reset btn-sm" onclick="closeRevertConfirmModal()">
          <span data-i18n="btnCancel">انصراف</span>
        </button>
        <button type="button" class="btn-apply btn-sm" onclick="executeConfirmedRevert()" style="background: linear-gradient(135deg, #dc2626, #b91c1c); border-color: #ef4444; color: #fff;">
          <i class="fa-solid fa-check"></i>
          <span data-i18n="btnConfirmRevert">تأیید و بازگردانی</span>
        </button>
      </div>
    </div>
  </div>
'''

script_patch = '''  <script>
    // Browser Preview Simulator Shim (provides realistic IPC responses so everything works smoothly in Chrome/Edge preview)
    if (!window.__TAURI__) {
      window.__TAURI__ = {
        core: {
          invoke: async (cmd, args) => {
            if (cmd === 'get_settings') {
              return { lang: 'fa', fov: 90, aspect_ratio: '2.15', mode: 'T2', fps_max: 0, renderer: 'default' };
            }
            if (cmd === 'get_app_version') return '0.1.4';
            if (cmd === 'running_from_pkg') return false;
            if (cmd === 'check_for_updates') return null;
            if (cmd === 'check_admin_status') return true;
            if (cmd === 'find_game') return { deadlock: 'D:\\\\SteamLibrary\\\\steamapps\\\\common\\\\Deadlock' };
            if (cmd === 'check_running') return [];
            if (cmd === 'detect_tier_cmd') return { current_tier: 'T2' };
            if (cmd === 'set_settings') return true;
            if (cmd === 'revert_perf_optimization_cmd') {
              return [
                { step: 'GameInfo', detail: 'Vanilla gameinfo.gi restored successfully.' },
                { step: 'Video', detail: 'video.txt restored.' }
              ];
            }
            if (cmd === 'install_optimization_cmd') {
              return [
                { step: 'Backup', detail: 'Original configuration backed up.' },
                { step: 'OptiLock', detail: 'Applied successfully to Deadlock!' }
              ];
            }
            return null;
          }
        },
        invoke: async (cmd, args) => window.__TAURI__.core.invoke(cmd, args)
      };
    }

    // Custom Cyber Dropdown Logic for Engine Config
    function toggleCustomDropdown() {
      const menu = document.getElementById('apb-custom-options-menu');
      const trigger = document.getElementById('apb-custom-select-trigger');
      if (!menu || !trigger) return;
      const isOpen = menu.style.display !== 'none';
      menu.style.display = isOpen ? 'none' : 'flex';
      trigger.classList.toggle('is-open', !isOpen);
      trigger.setAttribute('aria-expanded', !isOpen);
    }

    function closeCustomDropdown() {
      const menu = document.getElementById('apb-custom-options-menu');
      const trigger = document.getElementById('apb-custom-select-trigger');
      if (menu) menu.style.display = 'none';
      if (trigger) {
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    }

    function selectCustomOption(val, el) {
      const label = document.getElementById('apb-custom-select-label');
      const nativeSelect = document.getElementById('perf-preset-select');
      
      document.querySelectorAll('.apb-custom-option').forEach(opt => {
        opt.classList.remove('selected');
        const check = opt.querySelector('.apb-custom-option-check');
        if (check) check.remove();
      });
      el.classList.add('selected');
      const checkIcon = document.createElement('i');
      checkIcon.className = 'fa-solid fa-check apb-custom-option-check';
      el.appendChild(checkIcon);

      const text = el.querySelector('span').textContent;
      if (label) label.textContent = text;
      closeCustomDropdown();

      if (nativeSelect) {
        nativeSelect.value = val;
        if (typeof onPerfPresetChange === 'function') {
          onPerfPresetChange(val);
        }
      }

      // Update drawer title cleanly without overflowing
      const drawerTitle = document.getElementById('drawer-preset-title');
      if (drawerTitle) {
        const cleanName = text.split(' [')[0];
        drawerTitle.textContent = cleanName;
        drawerTitle.title = cleanName;
      }
    }

    // Revert Confirmation Modal Controls
    function askRevertConfirmation() {
      const modal = document.getElementById('modal-confirm-revert');
      if (modal) modal.style.display = 'flex';
    }
    function closeRevertConfirmModal() {
      const modal = document.getElementById('modal-confirm-revert');
      if (modal) modal.style.display = 'none';
    }
    function executeConfirmedRevert() {
      closeRevertConfirmModal();
      if (typeof doRevertOptimization === 'function') {
        doRevertOptimization();
      }
    }

    // Rich Categories Data & Renderer for Drawer Overview
    const REAL_DRAWER_CATEGORIES = [
      { key: 'shadows', label_fa: 'سایه‌ها و انسداد محیطی', label_en: 'Shadows & Occlusion', icon: 'fa-moon', count: 81, pct: 90 },
      { key: 'physics', label_fa: 'فیزیک و اجساد هیروها', label_en: 'Physics & Ragdolls', icon: 'fa-person-falling', count: 56, pct: 72 },
      { key: 'world', label_fa: 'مدل‌ها و جزییات جهان (LOD)', label_en: 'World & Mesh LOD', icon: 'fa-mountain', count: 53, pct: 68 },
      { key: 'engine', label_fa: 'هسته موتور سورس ۲', label_en: 'Source 2 Engine Core', icon: 'fa-microchip', count: 46, pct: 60 },
      { key: 'cpu', label_fa: 'پردازنده و زمان‌بندی رشته‌ها', label_en: 'CPU & Threading', icon: 'fa-bolt', count: 43, pct: 55 },
      { key: 'particles', label_fa: 'افکت‌ها و ذرات فایت', label_en: 'Particles & Combat FX', icon: 'fa-fire', count: 36, pct: 48 },
      { key: 'textures', label_fa: 'بافت‌ها و حافظه ویدیویی', label_en: 'Textures & VRAM', icon: 'fa-layer-group', count: 31, pct: 40 },
      { key: 'lighting', label_fa: 'نورپردازی و مه محیطی', label_en: 'Lighting & Volumetrics', icon: 'fa-lightbulb', count: 25, pct: 32 },
      { key: 'camera', label_fa: 'دوربین و فیلترهای بصری', label_en: 'Camera & Filters', icon: 'fa-eye', count: 18, pct: 24 }
    ];

    // High Density Camera Settings
    const REAL_CAMERA_SETTINGS = [
      { key: 'citadel_trooper_glow_disabled', label: 'Hide Trooper Glow', def: '0', val: '1', checked: true },
      { key: 'citadel_boss_glow_disabled', label: 'Hide Boss Glow', def: '0', val: '1', checked: true },
      { key: 'citadel_melee_shake_duration', label: 'Disable Melee Shake', def: '0.1', val: '0', checked: false },
      { key: 'citadel_camera_wobble_disable', label: 'Disable Camera Wobble', def: 'false', val: 'true', checked: true },
      { key: 'r_citadel_glow_health_bars', label: 'Health Bar Glow', def: '1', val: '0', checked: false },
      { key: 'citadel_unit_status_delta_decay_delay', label: 'Fast Damage Decay', def: '0.3', val: '0', checked: true },
      { key: 'cl_camera_fov_scale', label: 'FOV Scale On Abilities', def: '1', val: '0', checked: false },
      { key: 'mat_motion_blur_enabled', label: 'Disable Motion Blur', def: '1', val: '0', checked: true }
    ];

    // Sample ConVars List for Tab 3
    const REAL_CONVAR_ITEMS = [
      { name: 'r_shadows', val: '0', def: '1', desc: 'Disables dynamic hero shadows for high framerate', diff: true },
      { name: 'cl_ragdoll_limit', val: '0', def: '20', desc: 'Removes dead hero bodies instantly from lanes', diff: true },
      { name: 'mat_picmip', val: '2', def: '0', desc: 'Downsamples high resolution world textures', diff: true },
      { name: 'r_particle_cull', val: '1', def: '0', desc: 'Skips drawing distant spell particles in fights', diff: true },
      { name: 'engine_no_focus_sleep', val: '0', def: '50', desc: 'Eliminates frametime hitches on focus changes', diff: true },
      { name: 'cloth_update', val: '0', def: '1', desc: 'Halts CPU cloth simulation on hero capes', diff: true },
      { name: 'r_drawdecals', val: '0', def: '1', desc: 'Disables wall bullet holes and blood splatters', diff: true },
      { name: 'fps_max', val: '0', def: '144', desc: 'Uncaps frame rate to native monitor refresh rate', diff: true },
      { name: 'rate', val: '1000000', def: '786432', desc: 'Max network bytes per second from server', diff: true },
      { name: 'cl_updaterate', val: '128', def: '64', desc: 'Snapshots requested per second from server', diff: true },
      { name: 'r_drawparticles', val: '1', def: '1', desc: 'Renders in-game particle effects', diff: false },
      { name: 'mat_viewportscale', val: '1.0', def: '1.0', desc: 'Internal 3D rendering resolution factor', diff: false }
    ];

    let currentConvarFilter = 'all';
    let currentConvarSearch = '';

    function populateReworkedDrawer() {
      // 1. Overview Tab
      const catList = document.getElementById('drawer-category-bars');
      if (catList) {
        catList.innerHTML = '';
        const isFa = document.documentElement.lang === 'fa';
        REAL_DRAWER_CATEGORIES.forEach(c => {
          const row = document.createElement('div');
          row.className = 'category-bar-row';
          row.innerHTML = `
            <div class="category-bar-left">
              <i class="fa-solid ${c.icon} category-bar-icon"></i>
              <span class="category-bar-label">${isFa ? c.label_fa : c.label_en}</span>
            </div>
            <div class="category-bar-track">
              <div class="category-bar-fill" style="width: ${c.pct}%;"></div>
            </div>
            <span class="category-bar-count tabular-num">${c.count}</span>
          `;
          catList.appendChild(row);
        });
      }

      // 2. Camera Tab (High-Density Rows)
      const camList = document.getElementById('drawer-camera-switches');
      if (camList) {
        camList.innerHTML = '';
        REAL_CAMERA_SETTINGS.forEach(item => {
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
            <label class="neon-checkbox" style="margin:0;">
              <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="notifyChange('Toggled ${item.key}')">
              <div class="neon-checkbox__frame">
                <div class="neon-checkbox__box">
                  <div class="neon-checkbox__check-container">
                    <svg viewBox="0 0 24 24" class="neon-checkbox__check"><path d="M3,12.5l7,7L21,5"></path></svg>
                  </div>
                  <div class="neon-checkbox__glow"></div>
                  <div class="neon-checkbox__borders"><span></span><span></span><span></span><span></span></div>
                </div>
              </div>
            </label>
          `;
          camList.appendChild(row);
        });
      }

      // 3. ConVar Editor Tab (High-Density Table)
      renderConvarList();
    }

    function renderConvarList() {
      const editorList = document.getElementById('drawer-convar-list');
      if (!editorList) return;
      editorList.innerHTML = '';

      let filtered = REAL_CONVAR_ITEMS.filter(c => {
        if (currentConvarFilter === 'differs' && !c.diff) return false;
        if (currentConvarFilter === 'overridden') return false; // initially none
        if (currentConvarSearch) {
          const s = currentConvarSearch.toLowerCase();
          return c.name.toLowerCase().includes(s) || c.desc.toLowerCase().includes(s);
        }
        return true;
      });

      filtered.forEach(c => {
        const item = document.createElement('div');
        item.className = 'convar-row-item';
        item.innerHTML = `
          <div class="convar-item-left">
            <div class="convar-top-line">
              <span class="convar-item-name">${c.name}</span>
              <span class="convar-item-def-badge">def: ${c.def}</span>
            </div>
            <div class="convar-item-desc">${c.desc}</div>
          </div>
          <input type="text" class="convar-item-val-input tabular-num" value="${c.val}" onchange="notifyChange('${c.name} override: ' + this.value)">
        `;
        editorList.appendChild(item);
      });
    }

    function filterConvars(query) {
      currentConvarSearch = query.trim();
      renderConvarList();
    }

    function applyConvarFilter(filterName) {
      currentConvarFilter = filterName;
      document.querySelectorAll('.editor-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === filterName);
      });
      renderConvarList();
    }

    // Intercept togglePerfDrawer to ensure rich drawer content is always rendered
    window.togglePerfDrawer = function() {
      const drawer = document.getElementById('perf-side-drawer');
      const wrapper = document.getElementById('ui-scale-wrapper');
      if (!drawer) return;
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        drawer.classList.remove('open');
        if (wrapper) wrapper.classList.remove('side-panel-open');
      } else {
        drawer.classList.add('open');
        if (wrapper) wrapper.classList.add('side-panel-open');
        populateReworkedDrawer();
      }
    };

    window.closePerfDrawer = function() {
      const drawer = document.getElementById('perf-side-drawer');
      const wrapper = document.getElementById('ui-scale-wrapper');
      if (drawer) drawer.classList.remove('open');
      if (wrapper) wrapper.classList.remove('side-panel-open');
    };

    window.switchDrawerTab = function(tabName) {
      document.querySelectorAll('.perf-drawer-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      document.querySelectorAll('.drawer-tab-pane').forEach(p => {
        p.style.display = p.id === `pane-drawer-${tabName}` ? 'block' : 'none';
      });
    };

    // Keyboard support for pro-cards, custom dropdown & modal dismiss
    document.addEventListener('DOMContentLoaded', () => {
      populateReworkedDrawer();

      document.querySelectorAll('.pro-card').forEach(card => {
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });

      const trigger = document.getElementById('apb-custom-select-trigger');
      if (trigger) {
        trigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCustomDropdown();
          }
        });
      }

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeCustomDropdown();
          closeRevertConfirmModal();
          closePerfDrawer();
        }
      });

      document.addEventListener('click', (e) => {
        const container = document.getElementById('apb-dropdown-container');
        if (container && !container.contains(e.target)) {
          closeCustomDropdown();
        }
      });

      const revModal = document.getElementById('modal-confirm-revert');
      if (revModal) {
        revModal.addEventListener('click', (e) => {
          if (e.target === revModal) closeRevertConfirmModal();
        });
      }
    });
  </script>
'''

html = html.replace('<div id="dlp-custom-cursor"', revert_modal_markup + '\n  <div id="dlp-custom-cursor"')
html = html.replace('<script src="vendor/motion/motion.js"></script>', script_patch + '\n  <script src="vendor/motion/motion.js"></script>')

with open(r'd:\Claude\DLPBooster\ui\preview-v2.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('preview-v2.html successfully updated with compact camera and convar editor tabs!')
