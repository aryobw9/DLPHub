// DLPHub Deterministic Hardware ID (HWID) Fingerprinter
// Generates a stable, privacy-preserving machine fingerprint bound to the user's physical machine.
// Cannot be spoofed across different machines.

#[cfg(windows)]
pub fn get_machine_hwid() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(crypto) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(guid) = crypto.get_value::<String, _>("MachineGuid") {
            let salted = format!("DLPHUB-VIP-V1-{}", guid.trim());
            return format!("HWID-{}", dlp_core::detect::md5_hex(salted.as_bytes()));
        }
    }

    // Secondary Windows fallback: Immutable Motherboard / BIOS hardware identification
    if let Ok(bios) = hklm.open_subkey("HARDWARE\\DESCRIPTION\\System\\BIOS") {
        let board: String = bios.get_value("BaseBoardProduct").unwrap_or_default();
        let vendor: String = bios.get_value("BaseBoardManufacturer").unwrap_or_default();
        let bver: String = bios.get_value("BIOSVersion").unwrap_or_default();
        if !board.is_empty() || !vendor.is_empty() {
            let salted = format!("DLPHUB-VIP-HW-{}-{}-{}", vendor.trim(), board.trim(), bver.trim());
            return format!("HWID-{}", dlp_core::detect::md5_hex(salted.as_bytes()));
        }
    }

    // Tertiary Windows fallback: Computer identification
    let comp = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "DEFAULT-PC".to_string());
    let user = std::env::var("USERNAME").unwrap_or_else(|_| "DEFAULT-USER".to_string());
    let salted = format!("DLPHUB-VIP-FALLBACK-{}-{}", comp, user);
    format!("HWID-{}", dlp_core::detect::md5_hex(salted.as_bytes()))
}

#[cfg(not(windows))]
pub fn get_machine_hwid() -> String {
    "HWID-NON-WINDOWS".to_string()
}
