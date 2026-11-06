# DLPBooster Agent Guide & Architecture Router

This file is the root directory router for AI agents working in this codebase. Read this first to locate code instantly without broad searches.

---

## 1. Agent Navigation Protocol (CRITICAL)

1. **NEVER run broad codebase searches or read random files to figure out where a feature lives.** Cold-start file scanning wastes tool calls and clutters context.
2. **Always check `AGENTS.md` first, then read the specific lookup table in `.agents/` before opening code:**
   - For Tauri commands or events: Read [`.agents/ipc-registry.md`](.agents/ipc-registry.md) for the exact Rust handler line, dependencies, and frontend caller.
   - For Rust core, lifecycle, state, or storage: Read [`.agents/backend-map.md`](.agents/backend-map.md) for modules, static globals, and registry/disk paths.
   - For UI panels, drawers, modals, or frontend state: Read [`.agents/frontend-map.md`](.agents/frontend-map.md) for DOM IDs, state slices, and controller functions.
3. **When modifying an IPC command, check [`.agents/ipc-registry.md`](.agents/ipc-registry.md)** to immediately locate both the Rust handler in `src-tauri/` and the frontend caller in `ui/app.js`.

---

## 2. High-Level Architecture & Tech Stack

- **Framework:** Tauri v2.6+ (`tauri = "2"`, `tauri-build = "2"`) with custom frameless window (`decorations: false`).
- **Backend Core:** Rust 2021 Edition (`dlpbooster_lib` + `dlp-core` workspace crate), Tokio, Reqwest (Rustls), Win32 API, Wintun 0.5.
- **Frontend Layer:** **[`ui/`](ui/)** (NOT `src/`). Vanilla ES6+ JavaScript, HTML5, CSS3, FontAwesome, Tauri global bridge (`window.__TAURI__`).
- **External Coordinator:** Python VPS coordinator (`server_vps.py` running on `5.57.32.52:48080`) for lobby discovery and TS3 OTP authentication.

```text
DLPBooster/
â”œâ”€â”€ .agents/                  # Agent lookup tables (ipc-registry, backend-map, frontend-map)
â”œâ”€â”€ AGENTS.md                # Root master router (this file)
â”œâ”€â”€ package.json             # Root npm configuration (scripts: predev, dev, build)
â”œâ”€â”€ server_vps.py            # Iran VPS lobby coordinator & TeamSpeak OTP auth server
â”œâ”€â”€ src-tauri/               # Rust Tauri application layer
â”‚   â”œâ”€â”€ Cargo.toml           # Workspace manifest (dlpbooster + dlp-core)
â”‚   â”œâ”€â”€ tauri.conf.json      # Tauri v2 configuration (frontendDist: "../ui")
â”‚   â”œâ”€â”€ src/                 # Main app crate (commands, lib, LAN engine, latency, storage)
â”‚   â””â”€â”€ dlp-core/            # Core engine crate (kvedit, fov, detect, backup, install)
â””â”€â”€ ui/                      # Frontend distribution directory
    â”œâ”€â”€ index.html           # Main UI DOM structure (panels, drawers, modals)
    â”œâ”€â”€ app.js               # Main frontend controller (IPC caller, state, routing)
    â”œâ”€â”€ style.css            # Custom CSS styling (dark theme, glassmorphism)
    â”œâ”€â”€ i18n/                # Localization JSON files (fa.json, en.json, ru.json)
    â”œâ”€â”€ assets/              # Icons, banners, wallpapers
    â””â”€â”€ vendor/              # Bundled third-party libraries (FontAwesome, Animate.css)
```

---

## 3. Fast Verification Commands

> [!TIP]
> DO NOT run `npm run build` or heavy release bundles during incremental development. Use these fast checks:

- **Frontend JS Syntax Check (Runs in <100ms):**
  ```powershell
  node --check ui/app.js
  ```
- **Backend Rust Type & Compiler Check (Runs in ~5s incremental):**
  ```powershell
  cargo check --manifest-path src-tauri/Cargo.toml
  ```
- **Local Dev Server (Full Tauri launch):**
  ```powershell
  npm run dev
  ```

---

## 4. State & Communication Summary

- **IPC Bridge:** [`ui/app.js`](ui/app.js) calls `call('cmd_name', args)` which invokes `window.__TAURI__.core.invoke`.
- **Rust State:** No `tauri::State` via `.manage()`. State is stored in domain-specific `static Mutex<T>` / `AtomicBool` globals in `lan_supervisor`, `lan_engine`, `lan_relay`, `storage`, and `latency`.
- **Frontend State:** Centered in `state` (app settings/tab), `sessionState` (active room/lobby/VPN), and `userProfile` (identity/MMR/TS) in [`ui/app.js`](ui/app.js).

---

## 5. Index Maintenance Rule

> [!IMPORTANT]
> **MANDATORY MAINTENANCE RULE FOR ALL AGENTS:**
> Whenever you add, rename, or delete a file, `#[tauri::command]`, state struct, global static, or store slice, you **MUST** update the corresponding file in `.agents/` (`ipc-registry.md`, `backend-map.md`, or `frontend-map.md`) before completing your task.
