# AGENTS.md - DLPBooster / DLPHub UI Engineering Directive

> **MANDATORY UI DIRECTIVE FOR ALL AGENTS WORKING ON DLPBOOSTER / DLPHUB**

## 1. Tab Switching & Transition Animation Standard
When implementing or modifying UI panel navigation (tab switching between panels such as Graphics, Latency, LAN, Advanced, Drawer tabs, etc.):
- **NEVER use complex, multi-child staggered animations**: Do NOT write dozens of lines of `.card:nth-child(n)` delay rules with staggered scales. They cause GPU paint churn, visual jitter, and bloated stylesheets.
- **ALWAYS use the Unified Overall Panel Transition**:
  Apply a single, lightweight, hardware-accelerated fade + subtle blur transition directly on the active container (`.panel.panel-revealing`):
  ```css
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
  ```
- **Animation Duration**: Strictly between `0.20s` and `0.25s` (`0.22s` recommended). In JS `setTimeout`, remove the class after `250ms`.
- **Accessibility / Reduced Motion**: Always ensure `body.reduced-motion` and `@media (prefers-reduced-motion: reduce)` set `animation: none !important;`.

## 2. Dynamic Settings & In-Place DOM Mutation (Zero Layout Shifts)
- **Zero Layout Shifts**: When users interact with settings, toggles, numbers, or sliders (especially in large lists like the ConVar Editor in Tab 3), NEVER wipe out and rebuild the whole list (`container.innerHTML = ''`).
- **In-Place DOM Mutation**:
  - Update the specific input value, boolean button state/classes, and diff indicator in-place via DOM selectors (e.g. `[data-cvar-row="..."]`).
  - Keep layout-affecting badges (such as `.convar-diff-dot`) permanently in DOM flow using `visibility: visible / hidden` and set container flex lines to `flex-wrap: nowrap !important;`.
  - Update top counter badges (`#count-differs`, `#count-overridden`) directly without re-rendering rows.

## 3. Custom Pointer & Cursor Scaling Standard
- Custom flame pointer cursors are scaled to **51px × 51px** (`busy` mode is **70px × 70px**).
- Target dot is **5px × 5px**.
- Hotspots in `CURSOR_HOTSPOTS` and CSS variables (`--cur-*`):
  - `pointer`: strictly **13, 15** (preserved per user directive).
  - Fingertip/arrow tip calibrations: `default: 12, 9`, `click: 6, 11`, `click_right: 7, 11`, `grab: 23, 28`, `text: 8, 12`, `link: 6, 14`, `help: 7, 9`, `busy: 35, 35`, `nwse: 16, 14`, `nesw: 11, 14`, `ns: 19, 17`, `ew: 26, 19`, `move: 22, 26`.

## 4. Side Tab / Details Drawer Architecture Standard
- **Zero Overlap & Side-by-Side Placement**: The side drawer (`#perf-side-drawer`) MUST NEVER be positioned with arbitrary viewport-fixed coordinates (`position: fixed; right: 24px`). It must be positioned relative to `#main-ui` (`position: absolute; top: 0; left: calc(100% + 14px)`).
- **Y-Axis Alignment & Full Height**: Must span the full height of the main panel plus tab buttons (`top: 0 !important; height: 522px !important; max-height: 522px !important;`, aligning with the top of the 72px cards deck down to the bottom of the 440px viewport).
- **Drawer Width**: Strictly **410px** (fits all 3 sub-tabs comfortably without overlapping or bloat).
- **Windowed & Fullscreen Responsive Centering**: Handled in `updateScale()`. When the drawer opens, `baseW = 1344px` and `#ui-scale-wrapper` shifts left by `212px` (half the drawer width) so the combined (Main Tab + Side Tab) unit is centered symmetrically on screen. In windowed mode, both scale together proportionally, keeping the side tab strictly on the side and never covering the main tab.

## 5. Language Transition Blurring & Shimmer Standard
When adding new tabs, panels, preset cards, or buttons:
- **Comprehensive Coverage**: NEVER leave new panels (such as LAN or redesigned Graphic Presets) out of language switch animation rules.
- **Rules to Maintain**:
  - `body.lang-transitioning`: Dim container backgrounds and borders; blur buttons (`filter: blur(2px)`); blur inputs (`filter: blur(2px)`); apply skeleton pulse and blur to text (`filter: blur(3px); animation: vf-skeleton-pulse 1.8s ease-in-out infinite;`).
  - `body.lang-transitioning.to-fa ::after` & `to-en ::after`: Apply the directional shimmering gradient sweep over all primary cards.
  - `body.lang-revealing`: Apply `animation: vf-grid-tile-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) backwards;` with directional staggered delays across the active items.
