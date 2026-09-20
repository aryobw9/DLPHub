// WebView2 runtime availability check (first-run guidance).
// If the Evergreen Runtime is missing, Windows users get a native dialog with
// the official Microsoft download link instead of a silent window failure.
//
// WebView2Loader.dll is resolved dynamically: Tauri already loads/links it, so
// GetModuleHandle finds it; otherwise we LoadLibrary it from the exe dir.

#[cfg(windows)]
mod imp {
    type GetVerFn = unsafe extern "system" fn(*const u16, *mut *mut u16) -> i32;

    unsafe fn get_proc(name: &[u8]) -> Option<GetVerFn> {
        #[link(name = "kernel32")]
        extern "system" {
            fn GetModuleHandleW(name: *const u16) -> isize;
            fn LoadLibraryW(name: *const u16) -> isize;
            fn GetProcAddress(module: isize, name: *const u8) -> isize;
        }
        let wide = |s: &str| -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() };

        let dll = wide("WebView2Loader.dll");
        let mut module = GetModuleHandleW(dll.as_ptr());
        if module == 0 {
            module = LoadLibraryW(dll.as_ptr());
        }
        if module == 0 {
            return None;
        }
        let addr = GetProcAddress(module, name.as_ptr());
        if addr == 0 {
            return None;
        }
        Some(std::mem::transmute(addr))
    }

    pub fn runtime_version() -> Option<String> {
        unsafe fn call(get_ver: GetVerFn) -> Option<String> {
            let mut out: *mut u16 = std::ptr::null_mut();
            let hr = get_ver(std::ptr::null(), &mut out); // NULL folder = Evergreen
            if hr < 0 || out.is_null() {
                return None;
            }
            let mut len = 0usize;
            while *out.add(len) != 0 {
                len += 1;
            }
            let text = String::from_utf16_lossy(std::slice::from_raw_parts(out, len));
            #[link(name = "ole32")]
            extern "system" {
                fn CoTaskMemFree(p: *mut std::ffi::c_void);
            }
            CoTaskMemFree(out.cast());
            if text.is_empty() { None } else { Some(text) }
        }
        let f: Option<GetVerFn> =
            unsafe { get_proc(b"GetAvailableCoreWebView2BrowserVersionString\0") };
        f.and_then(|f| unsafe { call(f) })
    }

    pub fn guide_download_and_exit() -> ! {
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

            let msg = "DLPHub needs the Microsoft WebView2 Runtime to render its interface.\n\n\
It is a small, official Microsoft component (already present on most Windows 10/11 systems).\n\n\
Press OK to open the official Microsoft download page,\n\
then install it and run DLPHub again.";
            let text = wide(msg);
            let caption = wide("DLPHub — Missing Component");
            let clicked = MessageBoxW(0, text.as_ptr(), caption.as_ptr(), 0x40 | 0x1); // INFO | OKCANCEL

            if clicked == 1 {
                let open = wide("open");
                let url = wide("https://developer.microsoft.com/microsoft-edge/webview2/");
                ShellExecuteW(0, open.as_ptr(), url.as_ptr(), std::ptr::null(), std::ptr::null(), 1);
            }
        }
        std::process::exit(0)
    }
}

#[cfg(windows)]
pub use imp::{guide_download_and_exit, runtime_version};

#[cfg(not(windows))]
pub fn runtime_version() -> Option<String> {
    None // non-Windows uses WebKitGTK, managed by the OS package manager
}

#[cfg(not(windows))]
pub fn guide_download_and_exit() -> ! {
    std::process::exit(0)
}
