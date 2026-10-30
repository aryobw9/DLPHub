#[allow(
    non_snake_case,
    non_upper_case_globals,
    non_camel_case_types,
    dead_code,
    clippy::all
)]
pub mod Microsoft {
    pub mod Web {
        pub mod WebView2 {
            pub mod Win32 {
                mod windows_link {
                    extern "system" {
                        fn LoadLibraryW(lpLibFileName: *const u16) -> *mut core::ffi::c_void;
                        fn GetModuleHandleW(lpModuleName: *const u16) -> *mut core::ffi::c_void;
                        fn GetProcAddress(
                            hModule: *mut core::ffi::c_void,
                            lpProcName: *const u8,
                        ) -> *mut core::ffi::c_void;
                        fn GetEnvironmentVariableW(
                            lpName: *const u16,
                            lpBuffer: *mut u16,
                            nSize: u32,
                        ) -> u32;
                    }

                    const EMBEDDED_DLL: &[u8] = include_bytes!("../x64/WebView2Loader.dll");

                    unsafe fn load_webview2_loader() -> *mut core::ffi::c_void {
                        // 1. Check if already loaded in this process
                        let dll_name: [u16; 18] = [
                            'W' as u16, 'e' as u16, 'b' as u16, 'V' as u16, 'i' as u16, 'e' as u16,
                            'w' as u16, '2' as u16, 'L' as u16, 'o' as u16, 'a' as u16, 'd' as u16,
                            'e' as u16, 'r' as u16, '.' as u16, 'd' as u16, 'l' as u16, 0,
                        ];
                        let mut handle = GetModuleHandleW(dll_name.as_ptr());
                        if !handle.is_null() {
                            return handle;
                        }

                        // 2. Try standard search paths (includes SetDllDirectory)
                        handle = LoadLibraryW(dll_name.as_ptr());
                        if !handle.is_null() {
                            return handle;
                        }

                        // 3. Fallback to %APPDATA%\DLPHub\WebView2Loader.dll
                        let mut appdata_buf = [0u16; 32768];
                        let appdata_var: [u16; 8] = [
                            'A' as u16, 'P' as u16, 'P' as u16, 'D' as u16, 'A' as u16, 'T' as u16,
                            'A' as u16, 0,
                        ];
                        let len = GetEnvironmentVariableW(
                            appdata_var.as_ptr(),
                            appdata_buf.as_mut_ptr(),
                            32768,
                        );
                        if len > 0 && (len as usize) < 32000 {
                            let subpath = "\\DLPHub\\WebView2Loader.dll";
                            let mut i = len as usize;
                            for c in subpath.encode_utf16() {
                                appdata_buf[i] = c;
                                i += 1;
                            }
                            appdata_buf[i] = 0;

                            handle = LoadLibraryW(appdata_buf.as_ptr());
                            if !handle.is_null() {
                                return handle;
                            }

                            // If file does not exist, extract it from embedded bytes
                            let path_str = String::from_utf16_lossy(&appdata_buf[..i]);
                            let p = std::path::Path::new(&path_str);
                            if let Some(parent) = p.parent() {
                                let _ = std::fs::create_dir_all(parent);
                            }
                            let _ = std::fs::write(p, EMBEDDED_DLL);

                            handle = LoadLibraryW(appdata_buf.as_ptr());
                            if !handle.is_null() {
                                return handle;
                            }
                        }

                        // 4. Fallback to %TEMP%\DLPHub\WebView2Loader.dll
                        let temp_dir = std::env::temp_dir().join("DLPHub");
                        let _ = std::fs::create_dir_all(&temp_dir);
                        let temp_dll = temp_dir.join("WebView2Loader.dll");
                        let _ = std::fs::write(&temp_dll, EMBEDDED_DLL);
                        let wide_temp: Vec<u16> = temp_dll
                            .as_os_str()
                            .to_string_lossy()
                            .encode_utf16()
                            .chain(core::iter::once(0))
                            .collect();
                        LoadLibraryW(wide_temp.as_ptr())
                    }

                    pub unsafe fn resolve_proc(name: &[u8]) -> *mut core::ffi::c_void {
                        static HMODULE_CACHE: core::sync::atomic::AtomicUsize =
                            core::sync::atomic::AtomicUsize::new(0);
                        let mut h = HMODULE_CACHE.load(core::sync::atomic::Ordering::Relaxed);
                        if h == 0 {
                            let loaded = load_webview2_loader();
                            if loaded.is_null() {
                                return core::ptr::null_mut();
                            }
                            h = loaded as usize;
                            HMODULE_CACHE.store(h, core::sync::atomic::Ordering::Relaxed);
                        }
                        GetProcAddress(h as *mut core::ffi::c_void, name.as_ptr())
                    }

                    macro_rules! link_webview2 {
                        ($library:literal $abi:literal fn $function:ident ( $($arg:ident : $arg_ty:ty),* $(,)? ) -> $ret:ty) => {
                            #[inline]
                            pub unsafe fn $function($($arg : $arg_ty),*) -> $ret {
                                type Func = unsafe extern "system" fn($($arg_ty),*) -> $ret;
                                static ADDR: core::sync::atomic::AtomicUsize =
                                    core::sync::atomic::AtomicUsize::new(0);
                                let mut ptr = ADDR.load(core::sync::atomic::Ordering::Relaxed);
                                if ptr == 0 {
                                    let resolved = $crate::Microsoft::Web::WebView2::Win32::windows_link::resolve_proc(
                                        concat!(stringify!($function), "\0").as_bytes(),
                                    );
                                    if resolved.is_null() {
                                        return windows_core::HRESULT(-2147467259); // E_FAIL
                                    }
                                    ptr = resolved as usize;
                                    ADDR.store(ptr, core::sync::atomic::Ordering::Relaxed);
                                }
                                let f: Func = core::mem::transmute(ptr);
                                f($($arg),*)
                            }
                        };
                    }

                    pub(crate) use link_webview2 as link;
                }

                include!("bindings.rs");
            }
        }
    }
}

pub mod declared_interfaces;

#[cfg(test)]
mod test {
    use windows_core::w;

    use crate::Microsoft::Web::WebView2::Win32::*;

    #[test]
    fn compare_eq() {
        let mut result = 1;
        unsafe { CompareBrowserVersions(w!("1.0.0"), w!("1.0.0"), &mut result) }.unwrap();
        assert_eq!(0, result);
    }

    #[test]
    fn compare_lt() {
        let mut result = 0;
        unsafe { CompareBrowserVersions(w!("1.0.0"), w!("1.0.1"), &mut result) }.unwrap();
        assert_eq!(-1, result);
    }

    #[test]
    fn compare_gt() {
        let mut result = 0;
        unsafe { CompareBrowserVersions(w!("2.0.0"), w!("1.0.1"), &mut result) }.unwrap();
        assert_eq!(1, result);
    }
}
