# Frontend Architecture Map: UI, State & Routing (`ui/`)

This document is the authoritative structural map of DLPBooster's frontend layer. All paths are exact relative paths from the repository root.

> [!IMPORTANT]
> The frontend is located in the **[`ui/`](../ui/)** directory (NOT a traditional `src/` directory). It is implemented in vanilla HTML5, modern ES6+ JavaScript, and responsive CSS with Tauri v2 global bridge bindings (`window.__TAURI__`).

---

## 1. Views, Panels & Modals

### View Navigation & Routing (`selectCardByKey(tabKey)`)
Navigation is tabless and card-driven: the user selects a top hero card (`#card-{tabKey}`) which activates the corresponding panel (`#panel-{tabKey}`) in [`ui/index.html`](../ui/index.html#L380) via `selectCardByKey` in [`ui/app.js`](../ui/app.js#L3672).

| Card & Panel ID | Tab Key | Feature / Domain Controlled | Key Elements & Controller Functions |
| :--- | :--- | :--- | :--- |
| `#card-graphic`<br>`#panel-graphic` | `graphic` | Graphics presets, hardware tier detection, Deadlock video configs, FPS limiter, FOV slider. | - Preset cards: Competitive, Balanced, Quality, Ultra<br>- `detectTier()`: Benchmarks CPU/GPU<br>- `installMode()`: Patches video settings<br>- `applyFpsMax()` / `applyFov()` |
| `#card-latency`<br>`#panel-latency` | `latency` | Network & matchmaking latency suite: Valve SDR clusters, DNS benchmark/switcher, OS network tweaks. | - Subtabs (`switchLatencySubtab`):<br>&nbsp;&nbsp;â€¢ `clusters`: Valve SDR pings, firewall blocking, presets<br>&nbsp;&nbsp;â€¢ `dns`: Gaming DNS benchmark & netsh switcher<br>&nbsp;&nbsp;â€¢ `system`: Nagle/throttling registry tweaks |
| `#card-lan`<br>`#panel-lan` | `lan` | Deadlock LAN & Dedicated lobby hub: Temporarily displays a "Coming Soon..." maintenance card while LAN/mesh features undergo updates. | - Host Setup (`#lan-panel-host`, `#vip-host-setup-view`):<br>&nbsp;&nbsp;â€¢ Map input (`#session-map-select`, defaults `dl_midtown`)<br>&nbsp;&nbsp;â€¢ Conn mode (`#vip-host-conn-mode`: Wintun / Relay)<br>&nbsp;&nbsp;â€¢ Server mode (`#vip-host-mod-mode`: Vanilla / Deadworks)<br>- Join Setup (`#lan-panel-join`, `#vip-join-setup-view`)<br>- Active Session Bar (`#active-session-card`): Real-time roster, ping, connect command (`connect IP:port`), VConsole2 commander |
| `#card-advanced`<br>`#panel-advanced` | `advanced` | Low-level convar overrides, diagnostics report, backup manager, revert to original files. | - `revertToOriginal()`: Restores pure vanilla game files<br>- `createBackup()` / `restoreBackup()`: Zip archives<br>- `runDiagnostics()`: System hardware & path report |

---

### Drawers & Slide-Out Panels
Managed via CSS classes (`.open`, `.active`) and backdrop overlays:

| Drawer Element ID | Controller Function | Domain / Purpose |
| :--- | :--- | :--- |
| `#perf-tuning-drawer`<br>([`ui/index.html:1700`](../ui/index.html#L1700)) | `openPerfDrawer()`<br>`togglePerfDrawer()`<br>([`ui/app.js:2830`](../ui/app.js#L2830)) | **Engine Convar Overlay Drawer:** Advanced real-time performance and rendering convar editor. Includes subtabs: `drawer-tab-overview` (active overrides), `drawer-tab-camera` (FOV, distance, crosshairs), and `drawer-tab-editor` (raw KV table editor). |
| `#friends-side-drawer`<br>([`ui/index.html:1709`](../ui/index.html#L1709)) | `openFriendsDrawer()`<br>`toggleFriendsDrawer()`<br>([`ui/app.js:7740`](../ui/app.js#L7740)) | **Social & Matchmaking Hub:** Temporarily displays a "Coming Soon..." card while social/party features undergo updates. Subtabs (`switchFriendsTab`): `friends` (online status, direct lobby invite/join), `requests` (incoming friend requests), and `add` (search and add via `DLP-XXXXXX` friend code). |

---

### Modals & Dialogs
Centered floating modals with backdrop blur and keyboard `Escape` dismissal:

| Modal Element ID | Trigger Function | Purpose |
| :--- | :--- | :--- |
| `#modal-profile`<br>([`ui/index.html:2180`](../ui/index.html#L2180)) | `openProfileModal()`<br>([`ui/app.js:7890`](../ui/app.js#L7890)) | Displays user profile: nickname inline editor (`startInlineNicknameEdit`), friend code, TeamSpeak status, MMR, and match history. |
| `#modal-auth`<br>([`ui/index.html:2290`](../ui/index.html#L2290)) | `openAuthModal()`<br>([`ui/app.js:7390`](../ui/app.js#L7390)) | TeamSpeak ClientQuery OTP authentication. Displays `!hub <otp>` instruction and polls VPS verification status (`startAuthPolling`). |
| `#modal`<br>([`ui/index.html:2410`](../ui/index.html#L2410)) | `showModalAlert()`<br>`showModalConfirm()`<br>([`ui/app.js:830`](../ui/app.js#L830)) | Universal modal for alerts, notices, and destructive action confirmations. |
| `#modal-confirm-revert`<br>([`ui/index.html:2450`](../ui/index.html#L2450)) | Triggered from Advanced tab | Warning dialog before completely reverting Deadlock files to vanilla. |
| `#modal-save-preset`<br>([`ui/index.html:2480`](../ui/index.html#L2480)) | `openSavePresetModal()` | Dialog to name and save custom user graphics convar preset. |
| `#modal-error-diag`<br>([`ui/index.html:2520`](../ui/index.html#L2520)) | `showAppErrorModal()` | Diagnostic error inspector displaying stack traces and log export button. |

---

## 2. State Slices & Reactive Stores

All application state is defined and maintained in [`ui/app.js`](../ui/app.js). State changes trigger targeted DOM updates without a virtual DOM overhead.

### Global State Slice (`state` - [`ui/app.js:52-80`](../ui/app.js#L52))
```javascript
const state = {
  lang: 'fa',                // Active language: 'fa' | 'en' | 'ru'
  activeTab: 'graphic',      // Active main panel: 'graphic' | 'latency' | 'lan' | 'advanced'
  gamePath: null,            // Validated Deadlock install path
  lastPath: null,            // Last detected or picked path
  fov: 90,                   // Custom FOV setting (80-120)
  fpsMax: 0,                 // FPS limiter (0 = uncapped)
  aspectRatio: '2.15',       // Aspect ratio setting
  aspectRatioEnabled: true,  // Custom aspect ratio toggle
  heroPotato: false,         // Hero Potato addon for potato mode (pak33_dir.vpk)
  selectedMode: null,        // Active graphics preset name
  detectedTier: null,        // Detected hardware tier: 'low' | 'med' | 'high' | 'ultra'
  running: false,            // Deadlock game process running flag
  busyTab: null,             // Current loading/busy tab key
  vipNickname: 'Player',     // User's LAN/VIP lobby display nickname
  lastValvePings: null,      // Latest ping sweep results
};
```

### Performance State (`perfState` - [`ui/app.js:5910`](../ui/app.js#L5910))
Tracks graphics engine configurations, optimization tiers, and active presets:
- `activeLevel`: Active optimization level (1 = CPU / High Graphics, 2 = CPU + GPU / Recommended, 3 = PotatoLock).
- `activePresetId`: Selected preset (default `'optilock-fps'` for Level 2, `'optilock-ultra-potato'` for Level 3).
- `isDrawerOpen`: Whether the tweaks and details side-drawer is open.
- `userOverrides`: User-customized convar values.

### Active Session State (`sessionState` - [`ui/app.js:4210`](../ui/app.js#L4210))
Tracks active multiplayer rooms, server instances, and mesh network tunnels:
- `active`: Boolean indicating if a lobby session is currently running.
- `isHost`: Boolean indicating whether the local user is hosting.
- `roomCode`: 6-digit lobby room code (e.g., `488374`).
- `connMode`: `'wintun'` (P2P mesh VPN) or `'relay'` (driverless server relay).
- `modMode`: `'vanilla'` (standard game) or `'deadworks'` (modded Source 2 server).
- `hostIp`, `port`: Target connection endpoint (e.g., `10.10.1.1:27005`).
- `peers`: Array of connected player peer objects `{ peer_id, nickname, ping_ms, hwid }`.

### User Profile & Social State (`userProfile` - [`ui/app.js:7120`](../ui/app.js#L7120))
Persisted in `localStorage` (`dlp_user_profile`):
```javascript
let userProfile = {
  is_guest: true,            // Guest vs verified TeamSpeak user
  nickname: 'Player',        // Synced across dlp_nickname / vip_nickname
  friend_code: 'DLP-GUEST',  // Unique friend code (e.g. DLP-78A92F)
  ts_uid: null,              // Linked TeamSpeak 3 Unique ID
  role: 'player',            // 'player' | 'admin' | 'vip'
  mmr: 2000,                 // Matchmaking rating
  matches_count: 0,          // Total matches played
  wins_count: 0              // Total matches won
};
```

---

## 3. Shared Helpers, Utilities & APIs

- **IPC Invocation Bridge (`call(cmd, args)` - [`ui/app.js:420`](../ui/app.js#L420)):**
  Wraps `window.__TAURI__.core.invoke` (or `window.__TAURI__.invoke`). Translates all errors into standardized exceptions and logs to console.
- **Event Bus Listeners ([`ui/app.js:1255-1270`](../ui/app.js#L1255)):**
  - Listens to `mod-download-progress` to update progress bar during mod downloading.
  - Listens to `server-loader-progress` during Deadworks server package extraction.
- **Localization Engine (`applyLang()`, `t(key)` - [`ui/app.js:180-260`](../ui/app.js#L180)):**
  Dynamically reads translations from [`ui/i18n/{lang}.json`](../ui/i18n/) and updates text content, placeholders, and tooltips on DOM nodes tagged with `data-i18n` or `data-i18n-placeholder`.
- **Profile UI Synchronizer (`updateProfileUI()` - [`ui/app.js:7280`](../ui/app.js#L7280)):**
  Keeps header nickname, avatar, online indicator, friend drawer code, and profile modal aligned with the current `userProfile`.
- **Clipboard Utility (`copyToClipboard(text, notify)` - [`ui/app.js:3800`](../ui/app.js#L3800)):**
  Copies connect strings (`connect 10.10.1.1:27005`) and lobby codes to the Windows clipboard with a floating toast notification.
- **VPS Coordinator API Base:**
  `const VPS_API_BASE = 'http://5.57.32.52:48080';` ([`ui/app.js:7395`](../ui/app.js#L7395)). Used for TS verification, room heartbeat, and friend list syncing.
