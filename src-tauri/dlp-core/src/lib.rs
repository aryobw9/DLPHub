// DLP core logic: payload embed, discovery, detect, kvedit, addons, guard,
// settings, backup, install orchestrator. No Tauri dependency — everything
// unit-testable without linking the GUI stack (windows-gnu test-exe workaround:
// tao/muda import comctl32 v6 TaskDialogIndirect which the test harness
// manifest does not activate -> STATUS_ENTRYPOINT_NOT_FOUND).
pub mod addons;
pub mod backup;
pub mod detect;
pub mod discovery;
pub mod fov;
pub mod guard;
pub mod install;
pub mod kvedit;
pub mod logger;
pub mod payload;
pub mod settings;
