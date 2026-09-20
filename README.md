# DLPHub

GUI for Deadlock performance optimization: performance tier installs, POTATO mode,
backup/restore, per-user FOV, FA/EN interface, and network latency diagnostics.

## Download

Get `DLPHub_0.1.0_x64-setup.exe` from the
[Releases page](https://github.com/aryobw9/DLPHub/releases) (bare exe in a
zip also works — the app is self-contained).

**SmartScreen note:** the exe is unsigned in early releases. Windows may show a
blue warning — click "More info" → "Run anyway". This is expected and goes away
with signed releases later.

## What it does

- **Tier 1 / 2 / 3**: performance configs for `gameinfo.gi` + `cfg\video.txt` plus
  the matching addon set (tier 1–3 skip the 3 look-changing mods, POTATO installs
  only those 3).
- **POTATO**: absolute minimum visuals for max FPS.
- **FOV 70–120**: per-user field of view with aspect-ratio anchors, applied on
  every install.
- **New Deadlock UI toggle**: writes the `citadel_unit_status_use_new` managed
  block to `cfg\autoexec.cfg` on the next install (your own autoexec content is
  never touched).
- **Backup / Restore**: every install is preceded by automatic `.dlp.bak`
  snapshots (permanent, never deleted). Manual backups land in
  `%APPDATA%\DLPBooster\backups\` and can be restored from the history list —
  restore removes exactly the addons this tool added (tracked in
  `addons_manifest.txt`) and keeps your own mods.
- **TEMP modes** (tester code required): tier config with ALL 9 mods including
  the look-changing ones. Ask for a code.
- **Guard**: close Deadlock and its mod manager before applying or restoring files.
  There is no user-facing override for live game writes.
- **Updates**: manual downloads only. The updater plugin is registered but no
  startup check/download/install flow is implemented; automatic updates and
  signed updater artifacts are not enabled in the current build.

## For developers

- `src-tauri/build_payload.py` zips the private console payload from
  `D:\Claude\ddlock` into `src-tauri/payload.zip` before every build. That zip is
  **never committed** (gitignored, stays private). Everything else is MIT.
- Tests: `cargo test -p dlp-core` (payload, discovery, fov, merge goldens,
  detect fixtures, addon collision matrix, backup/restore roundtrip, install
  sandbox e2e).
- Build: `npm run build` regenerates the payload before Tauri builds. Direct
  `npm run tauri build` or `cargo build` requires first running
  `python src-tauri/build_payload.py` from the project root.
- Payload packer check: `python src-tauri/test_build_payload.py` (temporary files only).
- Custom cursors: `ui/assets/cursors/*.png` are sliced from
  `tools/cursor-sheet.png` by `python tools/slice_cursors.py` (Pillow). Re-run
  it after editing the sheet; hotspots regenerate into `cursors.json` and are
  wired to CSS vars in `ui/style.css`.
- Windows GNU builds require Winlibs and Cargo on PATH:
  `export PATH="/d/mingw64/bin:$HOME/.cargo/bin:$PATH"`.
- Portable packages require the matching `WebView2Loader.dll` and an installed
  WebView2 Runtime. Refresh the portable ZIP after rebuilding the executable.
- Publishing releases and enabling signed automatic updates are separate tasks;
  neither is performed by the build command. Never commit signing keys.
