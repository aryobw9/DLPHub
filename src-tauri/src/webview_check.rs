// WebView2 runtime availability check (first-run guidance).
// Checks official Windows registry keys and filesystem locations for
// Microsoft Edge WebView2 Runtime.

#[cfg(windows)]
mod imp {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    /// Checks if the WebView2 Runtime is installed on the machine.
    pub fn runtime_version() -> Option<String> {
        // 1. Official Microsoft WebView2 Registry GUIDs
        // {F3017226-FE2A-4295-8BDF-00C3A9A7E4C5} = Evergreen WebView2 Runtime
        // {2CD8A007-E189-40E2-A350-D5810284A071} = Beta
        // {0D50BFEC-CD6A-4F9A-964C-4BE74F2A9DA0} = Dev
        // {65C35B14-6C1D-4122-AC46-7148CC9D6497} = Canary
        const CLIENT_GUIDS: &[&str] = &[
            "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
            "{2CD8A007-E189-40E2-A350-D5810284A071}",
            "{0D50BFEC-CD6A-4F9A-964C-4BE74F2A9DA0}",
            "{65C35B14-6C1D-4122-AC46-7148CC9D6497}",
        ];

        let hives = [
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients"),
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\EdgeUpdate\Clients"),
            (HKEY_CURRENT_USER, r"Software\Microsoft\EdgeUpdate\Clients"),
        ];

        for (hive, base) in hives {
            let root = RegKey::predef(hive);
            for guid in CLIENT_GUIDS {
                let subkey = format!(r"{base}\{guid}");
                if let Ok(key) = root.open_subkey(&subkey) {
                    if let Ok(pv) = key.get_value::<String, _>("pv") {
                        let trimmed = pv.trim();
                        if !trimmed.is_empty() && trimmed != "0.0.0.0" {
                            return Some(trimmed.to_string());
                        }
                    }
                }
            }
        }

        // 2. Standard filesystem paths fallback
        let edge_dirs = [
            r"C:\Program Files (x86)\Microsoft\EdgeWebView\Application",
            r"C:\Program Files\Microsoft\EdgeWebView\Application",
        ];

        for dir in edge_dirs {
            let p = std::path::Path::new(dir);
            if p.is_dir() {
                if let Ok(entries) = std::fs::read_dir(p) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
                            && entry.path().is_dir()
                        {
                            return Some(name);
                        }
                    }
                }
            }
        }

        None
    }

    pub fn guide_download_and_exit() {
        let wide = |s: &str| -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() };

        unsafe {
            #[link(name = "user32")]
            extern "system" {
                fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, kind: u32) -> i32;
            }
            #[link(name = "shell32")]
            extern "system" {
                fn ShellExecuteW(
                    hwnd: isize,
                    op: *const u16,
                    file: *const u16,
                    params: *const u16,
                    dir: *const u16,
                    show: i32,
                ) -> isize;
            }

            let msg = "DLPHub requires the Microsoft WebView2 Runtime to render its user interface.\n\n\
It is an official Microsoft component (pre-installed on most Windows 10/11 systems).\n\n\
Press OK to open the official Microsoft download page,\n\
or press Cancel to attempt launching anyway.";
            let text = wide(msg);
            let caption = wide("DLPHub — Microsoft WebView2 Notice");
            let clicked = MessageBoxW(0, text.as_ptr(), caption.as_ptr(), 0x40 | 0x1); // INFO | OKCANCEL

            if clicked == 1 {
                // OK clicked: open download page and exit
                let open = wide("open");
                let url = wide("https://developer.microsoft.com/microsoft-edge/webview2/");
                ShellExecuteW(0, open.as_ptr(), url.as_ptr(), std::ptr::null(), std::ptr::null(), 1);
                std::process::exit(0);
            }
            // If Cancel clicked, do NOT force exit; allow Tauri to proceed.
        }
    }
}

#[cfg(windows)]
pub use imp::{guide_download_and_exit, runtime_version};

#[cfg(not(windows))]
pub fn runtime_version() -> Option<String> {
    None
}

#[cfg(not(windows))]
pub fn guide_download_and_exit() {}
