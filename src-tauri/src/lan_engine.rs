// DLPHub Pure In-Process TUN Adapter & High-Speed UDP Packet Forwarder
// Connects to the Iranian VPS UDP Packet Multiplexer on 5.57.32.52:48000
// Zero external binaries, zero sidecars, zero background daemons.

use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const WINTUN_DLL_BYTES: &[u8] = include_bytes!("../bin/x86_64-pc-windows-msvc/wintun.dll");
const VPS_UDP_ADDR: &str = "5.57.32.52:48000";

const MAGIC_BYTES: &[u8; 4] = b"DLP1";
const TYPE_HANDSHAKE: u8 = 0x01;
const TYPE_PACKET: u8 = 0x03;
const TYPE_LEAVE: u8 = 0x04;

pub struct LanEngineHandle {
    stop_flag: Arc<AtomicBool>,
    socket: Arc<UdpSocket>,
    session: Arc<wintun::Session>,
    room_token: u32,
    virtual_ip: String,
}

impl LanEngineHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        let _ = self.session.shutdown();

        // Send graceful LEAVE packet to VPS
        let mut leave = [0u8; 13];
        leave[0..4].copy_from_slice(MAGIC_BYTES);
        leave[4..8].copy_from_slice(&self.room_token.to_be_bytes());
        leave[8] = TYPE_LEAVE;
        let vip_octets: Vec<u8> = self
            .virtual_ip
            .split('.')
            .filter_map(|s| s.parse::<u8>().ok())
            .collect();
        if vip_octets.len() == 4 {
            leave[9..13].copy_from_slice(&vip_octets);
        }
        if let Ok(server_addr) = VPS_UDP_ADDR.parse::<SocketAddr>() {
            let _ = self.socket.send_to(&leave, server_addr);
        }
    }
}

static CURRENT_HANDLE: std::sync::Mutex<Option<LanEngineHandle>> = std::sync::Mutex::new(None);

pub fn ensure_wintun_dll() -> Result<PathBuf, String> {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let next_to_exe = parent.join("wintun.dll");
            if next_to_exe.exists() {
                return Ok(next_to_exe);
            }
        }
    }
    let local_dir = dlp_core::settings::data_dir();
    std::fs::create_dir_all(&local_dir).map_err(|e| e.to_string())?;
    let dll_path = local_dir.join("wintun.dll");
    if !dll_path.exists() || dll_path.metadata().map(|m| m.len()).unwrap_or(0) != WINTUN_DLL_BYTES.len() as u64 {
        std::fs::write(&dll_path, WINTUN_DLL_BYTES).map_err(|e| e.to_string())?;
    }
    Ok(dll_path)
}

pub fn is_wintun_available() -> bool {
    ensure_wintun_dll().is_ok()
}

pub fn start_lan_engine(room_token: u32, virtual_ip: &str, subnet_mask: &str) -> Result<(), String> {
    stop_lan_engine();

    let dll_path = ensure_wintun_dll()?;
    let wintun = unsafe { wintun::load_from_path(&dll_path) }
        .map_err(|e| format!("Failed to load wintun.dll: {e}"))?;

    // Create or open Wintun adapter
    let adapter = match wintun::Adapter::create(&wintun, "DLPHub LAN", "DLPHub Virtual Network", None) {
        Ok(a) => a,
        Err(create_err) => match wintun::Adapter::open(&wintun, "DLPHub LAN") {
            Ok(a) => a,
            Err(open_err) => {
                return Err(format!(
                    "Wintun adapter error (create: {create_err}, open: {open_err}). Administrator privileges are required to create virtual network interfaces."
                ));
            }
        },
    };

    virtual_ip
        .parse::<IpAddr>()
        .map_err(|e| format!("Invalid virtual IP '{virtual_ip}': {e}"))?;
    subnet_mask
        .parse::<IpAddr>()
        .map_err(|e| format!("Invalid subnet mask '{subnet_mask}': {e}"))?;

    // Retrieve adapter index and interface name
    let adapter_idx = adapter.get_adapter_index().unwrap_or(0);
    let adapter_name = adapter.get_name().unwrap_or_else(|_| "DLPHub LAN".to_string());

    // Asynchronously wait for Windows NDIS stack to register the interface, then configure IP
    let mut configured = false;
    for _attempt in 1..=10 {
        thread::sleep(Duration::from_millis(300));

        // 1. Primary method: Configure by numeric Interface Index (immune to any quoting/escaping bugs)
        if adapter_idx > 0 {
            let mut cmd = std::process::Command::new("netsh");
            cmd.args([
                "interface",
                "ipv4",
                "set",
                "address",
                &adapter_idx.to_string(),
                "source=static",
                &format!("address={virtual_ip}"),
                &format!("mask={subnet_mask}"),
            ]);
            cmd.creation_flags(0x0800_0000);
            if let Ok(out) = cmd.output() {
                if out.status.success() {
                    configured = true;
                    break;
                }
            }
        }

        // 2. Secondary method: Configure by clean adapter name (WITHOUT embedded quotes)
        let mut cmd = std::process::Command::new("netsh");
        cmd.args([
            "interface",
            "ipv4",
            "set",
            "address",
            &format!("name={adapter_name}"),
            "source=static",
            &format!("address={virtual_ip}"),
            &format!("mask={subnet_mask}"),
        ]);
        cmd.creation_flags(0x0800_0000);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                configured = true;
                break;
            }
        }

        // 3. Fallback method: PowerShell New-NetIPAddress
        if adapter_idx > 0 {
            let mut ps_cmd = std::process::Command::new("powershell");
            ps_cmd.args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Set-NetIPAddress -InterfaceIndex {} -IPAddress {} -PrefixLength 24 -ErrorAction SilentlyContinue; if (-not $?) {{ New-NetIPAddress -InterfaceIndex {} -IPAddress {} -PrefixLength 24 -ErrorAction SilentlyContinue }}",
                    adapter_idx, virtual_ip, adapter_idx, virtual_ip
                ),
            ]);
            ps_cmd.creation_flags(0x0800_0000);
            if let Ok(out) = ps_cmd.output() {
                if out.status.success() {
                    configured = true;
                    break;
                }
            }
        }
    }

    if configured {
        println!("[LAN ENGINE] Successfully bound static IP {} to interface #{} ({})", virtual_ip, adapter_idx, adapter_name);
    } else {
        eprintln!("[LAN ENGINE] Warning: Adapter IP address assignment completed with non-zero exit code.");
    }

    // Configure Windows Firewall to allow ICMP (ping) and Deadlock UDP (27005-27016) across all profiles
    #[cfg(windows)]
    {
        let mut fw_icmp = std::process::Command::new("netsh");
        fw_icmp.args([
            "advfirewall",
            "firewall",
            "add",
            "rule",
            "name=DLPHub LAN ICMP",
            "protocol=icmpv4:8,any",
            "dir=in",
            "action=allow",
            "profile=any",
        ]);
        fw_icmp.creation_flags(0x0800_0000);
        let _ = fw_icmp.output();

        let _ = std::process::Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "delete",
                "rule",
                "name=DLPHub LAN Game",
            ])
            .creation_flags(0x0800_0000)
            .output();

        let mut fw_game = std::process::Command::new("netsh");
        fw_game.args([
            "advfirewall",
            "firewall",
            "add",
            "rule",
            "name=DLPHub LAN Game",
            "protocol=UDP",
            "localport=27005-27016",
            "dir=in",
            "action=allow",
            "profile=any",
        ]);
        fw_game.creation_flags(0x0800_0000);
        let _ = fw_game.output();
    }

    let session = Arc::new(
        adapter
            .start_session(wintun::MAX_RING_CAPACITY)
            .map_err(|e| format!("Failed to start Wintun session: {e}"))?,
    );

    let socket = Arc::new(
        UdpSocket::bind("0.0.0.0:0").map_err(|e| format!("Failed to bind UDP socket: {e}"))?,
    );
    socket.set_read_timeout(Some(Duration::from_millis(500))).ok();
    let server_addr: SocketAddr = VPS_UDP_ADDR.parse::<SocketAddr>().map_err(|e| e.to_string())?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let token_bytes = room_token.to_be_bytes();
    let vip_octets: Vec<u8> = virtual_ip
        .split('.')
        .filter_map(|s| s.parse::<u8>().ok())
        .collect();

    // 1. Thread: Wintun (TUN) -> UDP Socket (VPS) - TYPE_PACKET (0x03)
    {
        let session_recv = session.clone();
        let socket_send = socket.clone();
        let stop_clone = stop_flag.clone();
        thread::Builder::new()
            .name("dlp-lan-tx".to_string())
            .spawn(move || {
                let mut header = [0u8; 9];
                header[0..4].copy_from_slice(MAGIC_BYTES);
                header[4..8].copy_from_slice(&token_bytes);
                header[8] = TYPE_PACKET; // 0x03

                while !stop_clone.load(Ordering::Relaxed) {
                    match session_recv.receive_blocking() {
                        Ok(packet) => {
                            let bytes = packet.bytes();
                            let mut datagram = Vec::with_capacity(9 + bytes.len());
                            datagram.extend_from_slice(&header);
                            datagram.extend_from_slice(bytes);
                            let _ = socket_send.send_to(&datagram, server_addr);
                        }
                        Err(_) => {
                            if stop_clone.load(Ordering::Relaxed) {
                                break;
                            }
                            thread::sleep(Duration::from_millis(1));
                        }
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn TX thread: {e}"))?;
    }

    // 2. Thread: UDP Socket (VPS) -> Wintun (TUN) - TYPE_PACKET (0x03)
    {
        let session_send = session.clone();
        let socket_recv = socket.clone();
        let stop_clone = stop_flag.clone();
        thread::Builder::new()
            .name("dlp-lan-rx".to_string())
            .spawn(move || {
                let mut buf = [0u8; 65535];
                while !stop_clone.load(Ordering::Relaxed) {
                    match socket_recv.recv_from(&mut buf) {
                        Ok((n, from_addr)) => {
                            if from_addr == server_addr && n >= 9 {
                                if &buf[0..4] == MAGIC_BYTES && buf[8] == TYPE_PACKET {
                                    let ip_payload = &buf[9..n];
                                    if let Ok(mut pkt) = session_send.allocate_send_packet(ip_payload.len() as u16) {
                                        pkt.bytes_mut().copy_from_slice(ip_payload);
                                        session_send.send_packet(pkt);
                                    }
                                }
                            }
                        }
                        Err(_) => {}
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn RX thread: {e}"))?;
    }

    // 3. Thread: Handshake & Keepalive Pinger (TYPE_HANDSHAKE 0x01)
    {
        let socket_ping = socket.clone();
        let stop_clone = stop_flag.clone();
        let octets_clone = vip_octets.clone();
        thread::Builder::new()
            .name("dlp-lan-keepalive".to_string())
            .spawn(move || {
                let mut hs = [0u8; 13];
                hs[0..4].copy_from_slice(MAGIC_BYTES);
                hs[4..8].copy_from_slice(&token_bytes);
                hs[8] = TYPE_HANDSHAKE; // 0x01
                if octets_clone.len() == 4 {
                    hs[9..13].copy_from_slice(&octets_clone);
                }

                // Initial burst handshake (send 3 times with 100ms interval for immediate NAT binding)
                for _ in 0..3 {
                    if stop_clone.load(Ordering::Relaxed) {
                        return;
                    }
                    let _ = socket_ping.send_to(&hs, server_addr);
                    thread::sleep(Duration::from_millis(100));
                }

                // Ongoing keepalive every 10 seconds to keep aggressive mobile CGNAT perpetually open
                while !stop_clone.load(Ordering::Relaxed) {
                    let _ = socket_ping.send_to(&hs, server_addr);
                    for _ in 0..100 {
                        if stop_clone.load(Ordering::Relaxed) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(100));
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn Keepalive thread: {e}"))?;
    }

    *CURRENT_HANDLE.lock().unwrap() = Some(LanEngineHandle {
        stop_flag,
        socket,
        session,
        room_token,
        virtual_ip: virtual_ip.to_string(),
    });

    Ok(())
}

pub fn stop_lan_engine() {
    if let Some(handle) = CURRENT_HANDLE.lock().unwrap().take() {
        handle.stop();
    }
}
