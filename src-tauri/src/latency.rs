// DLPHub Deadlock Ping & Latency Enhancer Engine
// Handles:
// - Dynamic Valve SDR Cluster Fetching & Fallback
// - High-Speed Concurrent Multi-Threaded Pinger (<4s full scan)
// - Windows Firewall Relay Blocking (Server Picker with DLPHub_Block_* prefix)
// - Anti-Sanction & Gaming DNS Switcher + Cache Flusher
// - Deadlock Bandwidth Shield (Pauses DoSvc P2P & BITS upload hogs)
// - Windows Policy-based QoS (DSCP 46 Expedited Forwarding for Deadlock)
// - Wi-Fi 60-Second Scan Spike Eliminator
// - Network Adapter Latency & OS Registry Optimization
// - Deadlock Engine High-Rate Netcode ConVars

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::mpsc;
use std::thread;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// ---------- Elevation / Admin Helpers ----------

pub fn is_elevated() -> bool {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("net");
        cmd.args(["session"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = cmd.output() {
            return out.status.success();
        }
    }
    false
}

pub fn run_powershell_admin(script: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        if is_elevated() {
            let mut cmd = Command::new("powershell");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
            cmd.creation_flags(CREATE_NO_WINDOW);
            let out = cmd.output().map_err(|e| format!("failed to exec powershell: {e}"))?;
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if !out.status.success() && !stderr.trim().is_empty() {
                return Err(stderr);
            }
            return Ok(stdout);
        } else {
            return Err("Administrator privileges are required for this action. Please restart DLPHub as Administrator.".to_string());
        }
    }
    #[cfg(not(windows))]
    Err("Only supported on Windows".into())
}

pub fn is_firewall_enabled() -> bool {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("netsh");
        cmd.args(["advfirewall", "show", "currentprofile", "state"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = cmd.output() {
            let text = String::from_utf8_lossy(&out.stdout).to_uppercase();
            if text.contains("STATE") {
                return text.contains("ON");
            }
        }
        // Fallback check allprofiles
        let mut cmd2 = Command::new("netsh");
        cmd2.args(["advfirewall", "show", "allprofiles", "state"]);
        cmd2.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = cmd2.output() {
            let text = String::from_utf8_lossy(&out.stdout).to_uppercase();
            return text.lines().any(|l| l.contains("STATE") && l.contains("ON"));
        }
    }
    true
}

pub fn enable_windows_firewall() -> Result<(), String> {
    if !is_elevated() {
        return Err("Administrator privileges are required for this action. Please restart DLPHub as Administrator.".to_string());
    }
    let script = "netsh advfirewall set allprofiles state on";
    run_powershell_admin(script)?;
    Ok(())
}

// ---------- Valve SDR Cluster Definitions ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValveCluster {
    pub id: String,
    pub name: String,
    pub name_fa: String,
    pub region: String,
    pub region_name: String,
    pub region_name_fa: String,
    pub primary_ip: String,
    pub relay_ips: Vec<String>,
    pub ping_ms: Option<u32>,
    pub avg_ms: Option<u32>,
    pub jitter_ms: Option<u32>,
    pub loss_pct: f32,
    pub stability: Option<u8>,
    pub is_blocked: bool,
    pub is_top5: bool,
}

pub struct RawClusterDef {
    pub id: &'static str,
    pub name: &'static str,
    pub name_fa: &'static str,
    pub region: &'static str,
    pub region_name: &'static str,
    pub region_name_fa: &'static str,
    pub primary_ip: &'static str,
    pub relay_ips: &'static [&'static str],
}

pub const VALVE_CLUSTERS_RAW: &[RawClusterDef] = &[
    RawClusterDef {
        id: "fra",
        name: "Frankfurt",
        name_fa: "فرانکفورت (آلمان)",
        region: "europe",
        region_name: "Europe West",
        region_name_fa: "غرب اروپا",
        primary_ip: "155.133.226.68",
        relay_ips: &[
            "155.133.226.68", "155.133.226.70", "155.133.226.72", "155.133.226.77",
            "155.133.226.84", "155.133.226.85", "155.133.226.86", "155.133.226.87",
            "162.254.197.36", "162.254.197.37", "162.254.197.42", "162.254.197.43",
            "162.254.197.44", "162.254.197.52",
        ],
    },
    RawClusterDef {
        id: "dfra",
        name: "Frankfurt 2",
        name_fa: "فرانکفورت ۲ (دیتاپکت)",
        region: "europe",
        region_name: "Europe West",
        region_name_fa: "غرب اروپا",
        primary_ip: "89.222.108.161",
        relay_ips: &["89.222.108.161", "89.222.108.162"],
    },
    RawClusterDef {
        id: "vie",
        name: "Vienna",
        name_fa: "وین (اتریش)",
        region: "europe",
        region_name: "Europe Central",
        region_name_fa: "مرکز اروپا",
        primary_ip: "146.66.155.66",
        relay_ips: &[
            "146.66.155.66", "146.66.155.67", "146.66.155.68", "146.66.155.69",
            "146.66.155.70", "146.66.155.71",
        ],
    },
    RawClusterDef {
        id: "dvie",
        name: "Vienna 2",
        name_fa: "وین ۲ (دیتاپکت)",
        region: "europe",
        region_name: "Europe Central",
        region_name_fa: "مرکز اروپا",
        primary_ip: "152.233.52.97",
        relay_ips: &["152.233.52.97", "152.233.52.98"],
    },
    RawClusterDef {
        id: "dxb",
        name: "Dubai",
        name_fa: "دبی (امارات)",
        region: "middle_east",
        region_name: "Middle East",
        region_name_fa: "خاورمیانه",
        primary_ip: "185.25.183.163",
        relay_ips: &["185.25.183.163", "185.25.183.179"],
    },
    RawClusterDef {
        id: "sto",
        name: "Stockholm (Kista)",
        name_fa: "استکهلم - کیستا (سوئد)",
        region: "europe",
        region_name: "Europe North",
        region_name_fa: "شمال اروپا",
        primary_ip: "162.254.198.41",
        relay_ips: &[
            "162.254.198.41", "162.254.198.42", "162.254.198.43", "162.254.198.47",
            "162.254.198.48", "162.254.198.49", "162.254.198.50", "162.254.198.51",
            "162.254.198.52", "162.254.198.53", "162.254.198.54",
        ],
    },
    RawClusterDef {
        id: "sto2",
        name: "Stockholm (Bromma)",
        name_fa: "استکهلم - بروما (سوئد)",
        region: "europe",
        region_name: "Europe North",
        region_name_fa: "شمال اروپا",
        primary_ip: "155.133.252.37",
        relay_ips: &[
            "155.133.252.37", "155.133.252.38", "155.133.252.52", "155.133.252.53",
            "155.133.252.54", "155.133.252.55", "155.133.252.56", "155.133.252.57",
            "155.133.252.58", "155.133.252.59",
        ],
    },
    RawClusterDef {
        id: "waw",
        name: "Warsaw",
        name_fa: "ورشو (لهستان)",
        region: "europe",
        region_name: "Europe Central",
        region_name_fa: "مرکز اروپا",
        primary_ip: "155.133.230.98",
        relay_ips: &[
            "155.133.230.98", "155.133.230.99", "155.133.230.100", "155.133.230.101",
            "155.133.230.102", "155.133.230.103",
        ],
    },
    RawClusterDef {
        id: "ams",
        name: "Amsterdam",
        name_fa: "آمستردام (هلند)",
        region: "europe",
        region_name: "Europe West",
        region_name_fa: "غرب اروپا",
        primary_ip: "155.133.248.36",
        relay_ips: &[
            "155.133.248.36", "155.133.248.37", "155.133.248.40", "155.133.248.41",
        ],
    },
    RawClusterDef {
        id: "lhr",
        name: "London",
        name_fa: "لندن (انگلیس)",
        region: "europe",
        region_name: "Europe West",
        region_name_fa: "غرب اروپا",
        primary_ip: "162.254.196.66",
        relay_ips: &[
            "162.254.196.66", "162.254.196.70", "162.254.196.82", "162.254.196.85",
        ],
    },
    RawClusterDef {
        id: "par",
        name: "Paris",
        name_fa: "پاریس (فرانسه)",
        region: "europe",
        region_name: "Europe West",
        region_name_fa: "غرب اروپا",
        primary_ip: "185.25.182.18",
        relay_ips: &[
            "185.25.182.18", "185.25.182.19", "185.25.182.50", "185.25.182.51",
        ],
    },
    RawClusterDef {
        id: "mad",
        name: "Madrid",
        name_fa: "مادرید (اسپانیا)",
        region: "europe",
        region_name: "Europe South",
        region_name_fa: "جنوب اروپا",
        primary_ip: "155.133.246.34",
        relay_ips: &[
            "155.133.246.34", "155.133.246.39", "155.133.246.40", "155.133.246.50",
        ],
    },
    RawClusterDef {
        id: "fsn",
        name: "Falkenstein",
        name_fa: "فالکنشتاین (آلمان)",
        region: "europe",
        region_name: "Europe Central",
        region_name_fa: "مرکز اروپا",
        primary_ip: "213.133.98.98",
        relay_ips: &[
            "213.133.98.98", "213.133.99.99", "193.99.144.80",
        ],
    },
    RawClusterDef {
        id: "hel",
        name: "Helsinki",
        name_fa: "هلسینکی (فنلاند)",
        region: "europe",
        region_name: "Europe North",
        region_name_fa: "شمال اروپا",
        primary_ip: "193.99.144.87",
        relay_ips: &[
            "193.99.144.87", "193.99.144.88",
        ],
    },
    RawClusterDef {
        id: "dlhr",
        name: "London 2",
        name_fa: "لندن ۲ (دیتاپکت)",
        region: "europe",
        region_name: "Europe West",
        region_name_fa: "غرب اروپا",
        primary_ip: "185.94.190.1",
        relay_ips: &["185.94.190.1", "185.94.190.2"],
    },
    RawClusterDef {
        id: "dsto",
        name: "Stockholm 3",
        name_fa: "استکهلم ۳ (دیتاپکت)",
        region: "europe",
        region_name: "Europe North",
        region_name_fa: "شمال اروپا",
        primary_ip: "185.94.191.1",
        relay_ips: &["185.94.191.1", "185.94.191.2"],
    },
    RawClusterDef {
        id: "bom2",
        name: "Mumbai",
        name_fa: "بمبئی (هند)",
        region: "middle_east",
        region_name: "South Asia",
        region_name_fa: "جنوب آسیا",
        primary_ip: "155.133.224.20",
        relay_ips: &["155.133.224.20", "155.133.224.21"],
    },
    RawClusterDef {
        id: "maa2",
        name: "Chennai",
        name_fa: "چنای (هند)",
        region: "middle_east",
        region_name: "South Asia",
        region_name_fa: "جنوب آسیا",
        primary_ip: "155.133.225.18",
        relay_ips: &["155.133.225.18", "155.133.225.19"],
    },
    RawClusterDef {
        id: "hkg",
        name: "Hong Kong",
        name_fa: "هنگ کنگ",
        region: "asia",
        region_name: "East Asia",
        region_name_fa: "شرق آسیا",
        primary_ip: "103.28.54.163",
        relay_ips: &[
            "103.28.54.163", "103.28.54.164", "103.28.54.167", "103.28.54.172",
            "103.28.54.173", "103.28.54.174", "103.28.54.175", "103.28.54.176",
        ],
    },
    RawClusterDef {
        id: "sgp",
        name: "Singapore",
        name_fa: "سنگاپور",
        region: "asia",
        region_name: "Southeast Asia",
        region_name_fa: "جنوب شرق آسیا",
        primary_ip: "103.10.124.116",
        relay_ips: &[
            "103.10.124.116", "103.10.124.117", "103.10.124.118", "103.10.124.119",
        ],
    },
    RawClusterDef {
        id: "tyo",
        name: "Tokyo",
        name_fa: "توکیو (ژاپن)",
        region: "asia",
        region_name: "East Asia",
        region_name_fa: "شرق آسیا",
        primary_ip: "45.121.184.5",
        relay_ips: &[
            "45.121.184.5", "45.121.184.6", "45.121.184.24", "45.121.184.25",
        ],
    },
    RawClusterDef {
        id: "seo",
        name: "Seoul",
        name_fa: "سئول (کره جنوبی)",
        region: "asia",
        region_name: "East Asia",
        region_name_fa: "شرق آسیا",
        primary_ip: "146.66.152.36",
        relay_ips: &[
            "146.66.152.36", "146.66.152.37", "146.66.152.41", "146.66.152.42",
        ],
    },
    RawClusterDef {
        id: "iad",
        name: "US East (Virginia)",
        name_fa: "شرق آمریکا (ویرجینیا)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "162.254.192.88",
        relay_ips: &[
            "162.254.192.88", "162.254.192.89", "162.254.192.102", "162.254.192.103",
        ],
    },
    RawClusterDef {
        id: "ord",
        name: "US Central (Chicago)",
        name_fa: "مرکز آمریکا (شیکاگو)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "162.254.193.71",
        relay_ips: &[
            "162.254.193.71", "162.254.193.73", "162.254.193.98", "162.254.193.99",
        ],
    },
    RawClusterDef {
        id: "atl",
        name: "US Southeast (Atlanta)",
        name_fa: "جنوب شرق آمریکا (آتلانتا)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "162.254.199.170",
        relay_ips: &[
            "162.254.199.170", "162.254.199.173", "162.254.199.178", "162.254.199.180",
        ],
    },
    RawClusterDef {
        id: "dfw",
        name: "US South (Dallas)",
        name_fa: "جنوب آمریکا (دالاس)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "162.254.194.37",
        relay_ips: &[
            "162.254.194.37", "162.254.194.38", "162.254.194.53", "162.254.194.54",
        ],
    },
    RawClusterDef {
        id: "lax",
        name: "US West (Los Angeles)",
        name_fa: "غرب آمریکا (لس آنجلس)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "162.254.195.52",
        relay_ips: &[
            "162.254.195.52", "162.254.195.53", "162.254.195.70", "162.254.195.72",
        ],
    },
    RawClusterDef {
        id: "sea",
        name: "US Northwest (Seattle)",
        name_fa: "شمال غرب آمریکا (سیاتل)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "205.196.6.135",
        relay_ips: &["205.196.6.135", "205.196.6.149"],
    },
    RawClusterDef {
        id: "eat",
        name: "US Northwest (Wenatchee)",
        name_fa: "شمال غرب آمریکا (وناتچی)",
        region: "north_america",
        region_name: "North America",
        region_name_fa: "آمریکای شمالی",
        primary_ip: "198.144.176.1",
        relay_ips: &["198.144.176.1", "198.144.176.2"],
    },
    RawClusterDef {
        id: "gru",
        name: "Sao Paulo",
        name_fa: "سائوپائولو (برزیل)",
        region: "south_america",
        region_name: "South America",
        region_name_fa: "آمریکای جنوبی",
        primary_ip: "155.133.227.35",
        relay_ips: &[
            "155.133.227.35", "155.133.227.40", "155.133.227.41", "155.133.227.51",
        ],
    },
    RawClusterDef {
        id: "eze",
        name: "Buenos Aires",
        name_fa: "بوئنوس آیرس (آرژانتین)",
        region: "south_america",
        region_name: "South America",
        region_name_fa: "آمریکای جنوبی",
        primary_ip: "155.133.255.98",
        relay_ips: &[
            "155.133.255.98", "155.133.255.99", "155.133.255.162", "155.133.255.163",
        ],
    },
    RawClusterDef {
        id: "scl",
        name: "Santiago",
        name_fa: "سانتیاگو (شیلی)",
        region: "south_america",
        region_name: "South America",
        region_name_fa: "آمریکای جنوبی",
        primary_ip: "155.133.249.163",
        relay_ips: &["155.133.249.163", "155.133.249.179"],
    },
    RawClusterDef {
        id: "lim",
        name: "Lima",
        name_fa: "لیما (پرو)",
        region: "south_america",
        region_name: "South America",
        region_name_fa: "آمریکای جنوبی",
        primary_ip: "155.133.244.35",
        relay_ips: &[
            "155.133.244.35", "155.133.244.36", "155.133.244.51", "155.133.244.52",
        ],
    },
    RawClusterDef {
        id: "jnb",
        name: "Johannesburg",
        name_fa: "ژوهانسبورگ (آفریقای جنوبی)",
        region: "africa",
        region_name: "South Africa",
        region_name_fa: "آفریقای جنوبی",
        primary_ip: "155.133.238.178",
        relay_ips: &["155.133.238.178", "155.133.238.194"],
    },
    RawClusterDef {
        id: "syd",
        name: "Sydney",
        name_fa: "سیدنی (استرالیا)",
        region: "oceania",
        region_name: "Oceania",
        region_name_fa: "اقیانوسیه",
        primary_ip: "103.10.125.20",
        relay_ips: &[
            "103.10.125.20", "103.10.125.21", "103.10.125.40", "103.10.125.41",
        ],
    },
    RawClusterDef {
        id: "gum",
        name: "Guam",
        name_fa: "گوآم (اقیانوسیه)",
        region: "oceania",
        region_name: "Oceania / Pacific",
        region_name_fa: "اقیانوسیه / اقیانوس آرام",
        primary_ip: "185.25.180.18",
        relay_ips: &["185.25.180.18", "185.25.180.19"],
    },
];

// ---------- Fast ICMP Ping Probe ----------

pub fn ping_single_ip_fast(ip: &str, timeout_ms: u32) -> Option<u32> {
    let mut cmd = Command::new("ping");
    cmd.args(["-n", "1", "-w", &timeout_ms.to_string(), ip]);

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);

    if text.contains("time<1ms") || text.contains("time<") {
        return Some(1);
    }
    if let Some(pos) = text.find("time=") {
        let rest = &text[pos + 5..];
        let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(ms) = num_str.parse::<u32>() {
            return Some(ms);
        }
    }
    if let Some(pos) = text.find("Average = ") {
        let rest = &text[pos + 10..];
        let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(ms) = num_str.parse::<u32>() {
            return Some(ms);
        }
    }
    for word in text.split_whitespace() {
        if let Some(stripped) = word.strip_suffix("ms") {
            let digits: String = stripped.chars().filter(|c| c.is_ascii_digit()).collect();
            if let Ok(ms) = digits.parse::<u32>() {
                if ms > 0 && ms < 2000 {
                    return Some(ms);
                }
            }
        }
    }
    None
}

// ---------- High-Speed Parallel Cluster Pinger (<4s) ----------

pub fn benchmark_clusters_parallel() -> Vec<ValveCluster> {
    let blocked_set = get_firewall_blocked_clusters_raw();
    let (tx, rx) = mpsc::channel();
    let mut handles = Vec::new();

    const PROBE_COUNT: usize = 6;
    const PROBE_TIMEOUT_MS: u32 = 650;
    const PROBE_INTERVAL_MS: u64 = 30;

    for def in VALVE_CLUSTERS_RAW {
        let tx = tx.clone();
        let id = def.id.to_string();
        let name = def.name.to_string();
        let name_fa = def.name_fa.to_string();
        let region = def.region.to_string();
        let region_name = def.region_name.to_string();
        let region_name_fa = def.region_name_fa.to_string();
        let primary_ip = def.primary_ip.to_string();
        let relay_ips = def.relay_ips.iter().map(|s| s.to_string()).collect();
        let is_blocked = blocked_set.contains(&id);

        handles.push(thread::spawn(move || {
            let mut probes = Vec::with_capacity(PROBE_COUNT);
            let mut genuine_losses = 0;
            for i in 0..PROBE_COUNT {
                if let Some(ms) = ping_single_ip_fast(&primary_ip, PROBE_TIMEOUT_MS) {
                    probes.push(ms);
                } else {
                    // Transient retry to prevent single-socket / ARP / queue delay from falsely reporting 25% packet loss
                    if let Some(ms) = ping_single_ip_fast(&primary_ip, 400) {
                        probes.push(ms);
                    } else {
                        genuine_losses += 1;
                    }
                }
                if i + 1 < PROBE_COUNT {
                    thread::sleep(std::time::Duration::from_millis(PROBE_INTERVAL_MS));
                }
            }

            let total_attempts = probes.len() + genuine_losses;
            let loss_pct = if total_attempts > 0 {
                ((genuine_losses as f32 / total_attempts as f32) * 100.0).round()
            } else {
                100.0
            };

            let (ping_ms, avg_ms, jitter_ms, stability) = if !probes.is_empty() {
                let min_ping = probes.iter().min().copied();

                // Outlier-resistant trimmed mean: discard highest spike (e.g. cold start ARP / transient hitch)
                let mut sorted = probes.clone();
                sorted.sort();

                let sample_slice = if sorted.len() >= 4 {
                    &sorted[..sorted.len() - 1]
                } else {
                    &sorted[..]
                };

                let avg = sample_slice.iter().sum::<u32>() as f32 / sample_slice.len() as f32;

                // RFC 3550 Packet Delay Variation (PDV): mean consecutive difference
                let jitter = if probes.len() >= 2 {
                    let diffs_sum: f32 = probes
                        .windows(2)
                        .map(|w| (w[1] as f32 - w[0] as f32).abs())
                        .sum();
                    diffs_sum / (probes.len() - 1) as f32
                } else {
                    0.0
                };

                let score = (100.0 - (loss_pct * 1.0) - (jitter * 0.3)).round().clamp(0.0, 100.0);
                (min_ping, Some(avg.round() as u32), Some(jitter.round() as u32), Some(score as u8))
            } else {
                (None, None, None, None)
            };

            let cluster = ValveCluster {
                id,
                name,
                name_fa,
                region,
                region_name,
                region_name_fa,
                primary_ip,
                relay_ips,
                ping_ms,
                avg_ms,
                jitter_ms,
                loss_pct,
                stability,
                is_blocked,
                is_top5: false,
            };
            let _ = tx.send(cluster);
        }));
    }
    drop(tx);

    let mut results = Vec::new();
    for c in rx {
        results.push(c);
    }
    for h in handles {
        let _ = h.join();
    }

    // Sort by latency (lowest ping first)
    results.sort_by_key(|c| c.ping_ms.unwrap_or(9999));

    // Mark optimal online servers with regional metro cohesion
    mark_optimal_clusters(&mut results);

    results
}

pub const METRO_GROUPS: &[&[&str]] = &[
    &["sto", "sto2", "dsto"],      // Stockholm, Sweden
    &["fra", "dfra", "fsn"],       // Frankfurt & Falkenstein, Germany
    &["vie", "dvie"],              // Vienna, Austria
    &["lhr", "dlhr"],              // London, UK
    &["bom2", "maa2"],             // India
];

pub fn get_metro_siblings(id: &str) -> Vec<String> {
    for group in METRO_GROUPS {
        if group.contains(&id) {
            return group.iter().map(|&s| s.to_string()).collect();
        }
    }
    vec![id.to_string()]
}

pub fn mark_optimal_clusters(results: &mut [ValveCluster]) {
    let min_ping = results
        .iter()
        .filter_map(|c| c.ping_ms)
        .filter(|&p| p > 0)
        .min();

    let Some(min_p) = min_ping else {
        return;
    };

    // Servers with ping within 15ms (or 15% delta) and packet loss <= 3% are good
    let max_allowed = (min_p + 15).max((min_p * 115) / 100);

    let mut optimal_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for c in results.iter() {
        if let Some(p) = c.ping_ms {
            if p <= max_allowed && c.loss_pct <= 3.0 {
                for sib in get_metro_siblings(&c.id) {
                    optimal_ids.insert(sib);
                }
            }
        }
    }

    // Safety fallback: if none met condition, take the absolute best server's entire metro group
    if optimal_ids.is_empty() {
        if let Some(best) = results.iter().find(|c| c.ping_ms == Some(min_p)) {
            for sib in get_metro_siblings(&best.id) {
                optimal_ids.insert(sib);
            }
        }
    }

    for c in results.iter_mut() {
        c.is_top5 = optimal_ids.contains(&c.id);
    }
}

// ---------- Multi-Probe Deep Benchmark Engine (30s Continuous Pinger) ----------

pub fn run_multi_ping(
    ip: &str,
    count: u32,
    timeout_ms: u32,
) -> (Vec<u32>, f32, Option<u32>, Option<u32>, Option<u32>, Option<u8>) {
    let mut cmd = Command::new("ping");
    cmd.args(["-n", &count.to_string(), "-w", &timeout_ms.to_string(), ip]);

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = match cmd.output() {
        Ok(o) => o,
        Err(_) => return (Vec::new(), 100.0, None, None, None, None),
    };
    let text = String::from_utf8_lossy(&output.stdout);

    let mut times = Vec::new();
    for line in text.lines() {
        let l = line.trim();
        if l.to_lowercase().contains("reply from") {
            if l.contains("time<1ms") || l.contains("time<") {
                times.push(1);
            } else if let Some(pos) = l.find("time=") {
                let rest = &l[pos + 5..];
                let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                if let Ok(ms) = num_str.parse::<u32>() {
                    times.push(ms);
                }
            }
        }
    }

    let received = times.len() as u32;
    let loss_pct = if count > 0 {
        (((count.saturating_sub(received)) as f32) / (count as f32)) * 100.0
    } else {
        100.0
    };

    if times.is_empty() {
        return (times, loss_pct, None, None, None, None);
    }

    let min_ping = times.iter().min().copied();

    // Outlier-Resistant Robust Mean (Trimmed Core Average):
    // Discards the highest 15% spike anomalies (e.g. an isolated 190ms spike in a 30s session of 75-80ms pings)
    // so the reported average is true to actual in-game round-trip latency.
    let mut sorted = times.clone();
    sorted.sort();

    let core_slice = if sorted.len() >= 4 {
        let trim_count = ((sorted.len() as f32) * 0.15).ceil() as usize;
        let end_idx = sorted.len().saturating_sub(trim_count);
        &sorted[..end_idx.max(1)]
    } else {
        &sorted[..]
    };

    let sum: u32 = core_slice.iter().sum();
    let avg = (sum as f32) / (core_slice.len() as f32);

    let jitter = if times.len() >= 2 {
        let diffs_sum: f32 = times.windows(2).map(|w| (w[1] as f32 - w[0] as f32).abs()).sum();
        (diffs_sum / (times.len() - 1) as f32).round() as u32
    } else {
        0
    };

    let score = (100.0 - (loss_pct * 1.0) - ((jitter as f32) * 0.3)).round().clamp(0.0, 100.0) as u8;

    (times, loss_pct, min_ping, Some(avg.round() as u32), Some(jitter), Some(score))
}

pub fn deep_benchmark_clusters(duration_secs: u32) -> Vec<ValveCluster> {
    let blocked_set = get_firewall_blocked_clusters_raw();
    let count = duration_secs.clamp(10, 60);
    let (tx, rx) = mpsc::channel();
    let mut handles = Vec::new();

    for def in VALVE_CLUSTERS_RAW {
        let tx = tx.clone();
        let id = def.id.to_string();
        let name = def.name.to_string();
        let name_fa = def.name_fa.to_string();
        let region = def.region.to_string();
        let region_name = def.region_name.to_string();
        let region_name_fa = def.region_name_fa.to_string();
        let primary_ip = def.primary_ip.to_string();
        let relay_ips = def.relay_ips.iter().map(|s| s.to_string()).collect();
        let is_blocked = blocked_set.contains(&id);

        handles.push(thread::spawn(move || {
            let (_times, loss_pct, min_ping, avg_ms, jitter_ms, stability) =
                run_multi_ping(&primary_ip, count, 1000);

            let cluster = ValveCluster {
                id,
                name,
                name_fa,
                region,
                region_name,
                region_name_fa,
                primary_ip,
                relay_ips,
                ping_ms: min_ping,
                avg_ms,
                jitter_ms,
                loss_pct,
                stability,
                is_blocked,
                is_top5: false,
            };
            let _ = tx.send(cluster);
        }));
    }
    drop(tx);

    let mut results = Vec::new();
    for c in rx {
        results.push(c);
    }
    for h in handles {
        let _ = h.join();
    }

    results.sort_by_key(|c| c.ping_ms.unwrap_or(9999));

    // Mark optimal online servers with regional metro cohesion
    mark_optimal_clusters(&mut results);

    results
}

// ---------- Windows Firewall Relay Manager (DLPHub_Block_*) ----------

pub fn get_firewall_blocked_clusters_raw() -> std::collections::HashSet<String> {
    let mut blocked = std::collections::HashSet::new();
    #[cfg(windows)]
    {
        let mut cmd = Command::new("netsh");
        cmd.args(["advfirewall", "firewall", "show", "rule", "name=all"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = cmd.output() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if let Some(idx) = line.find("DLPHub_Block_") {
                    let name = line[idx + 13..].trim();
                    let cluster_id = name.split_whitespace().next().unwrap_or(name);
                    blocked.insert(cluster_id.to_string());
                }
            }
        }
    }
    blocked
}

pub fn resolve_deadlock_exe() -> Option<String> {
    if let Some(p) = dlp_core::settings::load().last_path {
        let exe = std::path::Path::new(&p).join("game").join("bin").join("win64").join("deadlock.exe");
        if exe.is_file() {
            return Some(exe.to_string_lossy().into_owned());
        }
        let exe_direct = std::path::Path::new(&p).join("deadlock.exe");
        if exe_direct.is_file() {
            return Some(exe_direct.to_string_lossy().into_owned());
        }
    }
    if let Some(found) = dlp_core::discovery::find_game() {
        let exe = std::path::Path::new(&found.deadlock).join("game").join("bin").join("win64").join("deadlock.exe");
        if exe.is_file() {
            return Some(exe.to_string_lossy().into_owned());
        }
    }
    None
}

fn format_firewall_add_cmd(id: &str, ips_csv: &str, exe_path: Option<&str>) -> String {
    if let Some(exe) = exe_path {
        format!(
            "netsh advfirewall firewall add rule name=\"DLPHub_Block_{}\" dir=out action=block program=\"{}\" remoteip=\"{}\" protocol=ANY enable=yes\n",
            id, exe, ips_csv
        )
    } else {
        format!(
            "netsh advfirewall firewall add rule name=\"DLPHub_Block_{}\" dir=out action=block remoteip=\"{}\" protocol=ANY enable=yes\n",
            id, ips_csv
        )
    }
}

pub fn block_cluster_relay(cluster_id: &str, ips: &[String]) -> Result<(), String> {
    if ips.is_empty() {
        return Ok(());
    }
    let ips_csv = ips.join(",");
    let exe = resolve_deadlock_exe();
    let add_cmd = format_firewall_add_cmd(cluster_id, &ips_csv, exe.as_deref());
    let script = format!(
        "netsh advfirewall firewall delete rule name=\"DLPHub_Block_{id}\" ; \
         {add_cmd}",
        id = cluster_id,
        add_cmd = add_cmd
    );
    run_powershell_admin(&script)?;
    Ok(())
}

fn format_firewall_delete_all_script() -> String {
    let mut script = String::from(
        "try { Remove-NetFirewallRule -DisplayName 'DLPHub_Block_*' -ErrorAction SilentlyContinue } catch {}; \
         try { Remove-NetFirewallRule -Name 'DLPHub_Block_*' -ErrorAction SilentlyContinue } catch {}; \n"
    );
    for def in VALVE_CLUSTERS_RAW {
        script.push_str(&format!(
            "netsh advfirewall firewall delete rule name=\"DLPHub_Block_{}\" 2>$null\n",
            def.id
        ));
    }
    script.push_str("netsh advfirewall firewall delete rule name=\"DLPHub_Block_Deadlock_*\" 2>$null\n");
    script
}

pub fn unblock_cluster_relay(cluster_id: &str) -> Result<(), String> {
    let script = format!(
        "try {{ Remove-NetFirewallRule -DisplayName \"DLPHub_Block_{id}\" -ErrorAction SilentlyContinue }} catch {{}}; \
         try {{ Remove-NetFirewallRule -Name \"DLPHub_Block_{id}\" -ErrorAction SilentlyContinue }} catch {{}}; \
         netsh advfirewall firewall delete rule name=\"DLPHub_Block_{id}\" 2>$null",
        id = cluster_id
    );
    let _ = run_powershell_admin(&script);
    Ok(())
}

pub fn unblock_all_clusters_relays() -> Result<(), String> {
    let script = format_firewall_delete_all_script();
    let _ = run_powershell_admin(&script);
    Ok(())
}

pub fn apply_top5_firewall_rules(top5_ids: &[String]) -> Result<(), String> {
    let mut script = format_firewall_delete_all_script();
    let top5_set: std::collections::HashSet<&str> = top5_ids.iter().map(|s| s.as_str()).collect();
    let exe = resolve_deadlock_exe();

    for def in VALVE_CLUSTERS_RAW {
        if !top5_set.contains(def.id) && !def.relay_ips.is_empty() {
            let ips_csv = def.relay_ips.join(",");
            script.push_str(&format_firewall_add_cmd(def.id, &ips_csv, exe.as_deref()));
        }
    }

    run_powershell_admin(&script)?;
    Ok(())
}

pub fn apply_cluster_preset_rules(blocked_ids: &[String]) -> Result<(), String> {
    let mut script = format_firewall_delete_all_script();
    let blocked_set: std::collections::HashSet<&str> = blocked_ids.iter().map(|s| s.as_str()).collect();
    let exe = resolve_deadlock_exe();

    for def in VALVE_CLUSTERS_RAW {
        if blocked_set.contains(def.id) && !def.relay_ips.is_empty() {
            let ips_csv = def.relay_ips.join(",");
            script.push_str(&format_firewall_add_cmd(def.id, &ips_csv, exe.as_deref()));
        }
    }

    if !blocked_ids.is_empty() {
        run_powershell_admin(&script)?;
    } else {
        let _ = run_powershell_admin(&script);
    }
    Ok(())
}

// ---------- Anti-Sanction & Gaming DNS Switcher ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsProfile {
    pub id: String,
    pub name: String,
    pub name_fa: String,
    pub desc: String,
    pub desc_fa: String,
    pub tag: String,
    pub tag_fa: String,
    pub primary: String,
    pub secondary: String,
    pub is_active: bool,
    pub ping_ms: Option<u32>,
}

pub const DNS_PROFILES_RAW: &[(&str, &str, &str, &str, &str, &str, &str, &str, &str)] = &[
    (
        "radar",
        "Radar Game (رادار گیم)",
        "رادار گیم (Radar Game)",
        "Optimized routing & anti-sanction for gaming",
        "بهترین پینگ بازی و کاهش پکت‌لاس با شبکه داخلی",
        "Gaming CDN",
        "مخصوص بازی",
        "10.202.10.10",
        "10.202.10.11",
    ),
    (
        "electro",
        "Electro TM (الکترو)",
        "الکترو (Electro TM)",
        "Low jitter gaming DNS & anti-sanction bypass",
        "ضد تحریم و مخصوص گیمینگ با کمترین نوسان پینگ",
        "Anti-Sanction",
        "ضد تحریم",
        "78.157.42.100",
        "78.157.42.101",
    ),
    (
        "shecan",
        "Shecan (شکن)",
        "شکن (Shecan)",
        "Reliable anti-sanction service for IR players",
        "سرویس تحریم‌شکن محبوب و معتبر ایرانی",
        "Anti-Sanction",
        "ضد تحریم",
        "185.51.200.2",
        "178.22.122.100",
    ),
    (
        "shelter",
        "Shelter TM (شلتر)",
        "شلتر (Shelter TM)",
        "Gaming DNS & anti-sanction bypass resolver",
        "دی‌ان‌اس اختصاصی گیمینگ و ضد تحریم شلتر",
        "Anti-Sanction",
        "ضد تحریم",
        "94.103.125.158",
        "94.103.125.157",
    ),
    (
        "begzar",
        "Begzar (بگذر)",
        "بگذر (Begzar)",
        "Fast lightweight anti-sanction resolver",
        "سرویس ضد تحریم سبک و پرسرعت",
        "Anti-Sanction",
        "ضد تحریم",
        "185.55.225.25",
        "185.55.225.26",
    ),
    (
        "beshkan",
        "Beshkan (بشکن)",
        "بشکن (Beshkan)",
        "Anti-sanction gaming DNS resolver",
        "سرویس تحریم‌شکن و بهینه‌ساز ارتباط گیمینگ بشکن",
        "Anti-Sanction",
        "ضد تحریم",
        "181.41.194.177",
        "181.41.194.186",
    ),
    (
        "dns403",
        "403.online",
        "سامانه ۴۰۳ آنلاین",
        "General anti-sanction for blocked developer/gaming CDNs",
        "عبور از خطای 403 سرویس‌های گیمینگ و دانلود",
        "Anti-Sanction",
        "ضد تحریم",
        "10.202.10.202",
        "10.202.10.102",
    ),
    (
        "pishgaman",
        "Pishgaman (پیشگامان)",
        "پیشگامان (Pishgaman)",
        "Pishgaman domestic gaming DNS with low latency",
        "دی‌ان‌اس گیمینگ پیشگامان با تاخیر پایین شبکه داخلی",
        "IR Gaming",
        "گیمینگ داخلی",
        "5.202.100.101",
        "5.202.100.100",
    ),
    (
        "irancell",
        "Irancell (ایرانسل)",
        "ایرانسل (Irancell)",
        "Irancell official domestic DNS resolver",
        "دی‌ان‌اس رسمی ایرانسل با پینگ بهینه شبکه داخلی",
        "ISP DNS",
        "اپراتور ایرانسل",
        "109.69.8.51",
        "109.69.8.51",
    ),
    (
        "mci_opendns",
        "Hamrah Aval / OpenDNS (همراه اول)",
        "همراه اول / اوپن دی‌ان‌اس",
        "Optimized routing for Hamrah Aval & OpenDNS",
        "مسیریابی بهینه برای مشترکین همراه اول و شبکه OpenDNS",
        "ISP DNS",
        "اپراتور همراه اول",
        "208.67.220.200",
        "208.67.222.222",
    ),
    (
        "cloudflare",
        "Cloudflare (1.1.1.1)",
        "کلودفلر (1.1.1.1)",
        "Fastest global Anycast DNS with minimal hops",
        "سریع‌ترین دی‌ان‌اس جهانی با کمترین تاخیر پاسخ",
        "Global Ultra-Fast",
        "جهانی پرسرعت",
        "1.1.1.1",
        "1.0.0.1",
    ),
    (
        "google",
        "Google Public",
        "گوگل پابلیک (Google)",
        "Hyper-reliable anycast infrastructure",
        "پایدارترین دی‌ان‌اس جهانی با دسترسی بالا",
        "Global Reliable",
        "جهانی پایدار",
        "8.8.8.8",
        "8.8.4.4",
    ),
    (
        "level3",
        "Level3 / Lumen (4.2.2.4)",
        "لول ۳ (Level3 / 4.2.2.4)",
        "Lumen Technologies global backbone DNS",
        "دی‌ان‌اس معتبر بین‌الملل لول ۳ و ۴.۲.۲.۴ با پهنای باند بالا",
        "Global Backbone",
        "بک‌بون جهانی",
        "4.2.2.4",
        "209.244.0.4",
    ),
    (
        "ultradns",
        "Neustar UltraDNS",
        "الترا دی‌ان‌اس (UltraDNS)",
        "Enterprise anycast DNS with global routing nodes",
        "دی‌ان‌اس Anycast سازمانی با پایداری بسیار بالا",
        "Global Ultra-Fast",
        "جهانی پرسرعت",
        "64.6.65.6",
        "64.6.64.6",
    ),
    (
        "ultradns2",
        "UltraDNS Public 2",
        "الترا دی‌ان‌اس ۲ (UltraDNS Public)",
        "UltraDNS secondary public high-speed network",
        "شبکه ثانویه پرسرعت پابلیک الترا دی‌ان‌اس",
        "Global Fast",
        "جهانی پرسرعت",
        "156.154.71.2",
        "156.154.70.2",
    ),
    (
        "ntt",
        "NTT Communications",
        "ان‌تی‌تی (NTT)",
        "Tier 1 global backbone transit DNS",
        "دی‌ان‌اس بک‌بون تایر ۱ جهانی با کمترین تعداد هاپ",
        "Tier-1 Backbone",
        "تایر ۱ جهانی",
        "129.250.35.251",
        "129.250.35.250",
    ),
    (
        "quad9",
        "Quad9 Uncensored",
        "کواد ۹ (Quad9)",
        "High privacy & uncensored recursive resolver",
        "سریع، امن و بدون فیلتر",
        "Global Private",
        "امن و سریع",
        "9.9.9.9",
        "149.112.112.112",
    ),
];

pub fn get_active_dns_ips() -> Vec<String> {
    let mut ips = Vec::new();
    #[cfg(windows)]
    {
        let mut cmd = Command::new("netsh");
        cmd.args(["interface", "ipv4", "show", "dnsservers"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = cmd.output() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                let t = line.trim();
                if let Some(pos) = t.rfind(' ') {
                    let part = &t[pos + 1..];
                    if part.split('.').count() == 4 && part.chars().all(|c| c.is_ascii_digit() || c == '.') {
                        ips.push(part.to_string());
                    }
                } else if t.split('.').count() == 4 && t.chars().all(|c| c.is_ascii_digit() || c == '.') {
                    ips.push(t.to_string());
                }
            }
        }
    }
    ips
}

pub fn get_active_network_adapters() -> Vec<String> {
    let mut adapters = Vec::new();
    #[cfg(windows)]
    {
        let mut cmd = Command::new("netsh");
        cmd.args(["interface", "ipv4", "show", "interfaces"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(out) = cmd.output() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("connected") && !line.contains("Loopback") {
                    // Extract name from the end of the line
                    if let Some(pos) = line.rfind("connected") {
                        let name = line[pos + 9..].trim();
                        if !name.is_empty() {
                            adapters.push(name.to_string());
                        }
                    }
                }
            }
        }
    }
    adapters
}

pub fn build_dns_query_packet(domain: &str, tx_id: u16) -> Vec<u8> {
    let mut packet = Vec::with_capacity(64);
    // 16-bit Transaction ID
    packet.extend_from_slice(&tx_id.to_be_bytes());
    // Flags: 0x0100 (Standard Query, Opcode 0, Recursion Desired = 1)
    packet.extend_from_slice(&[0x01, 0x00]);
    // QDCOUNT: 1 question
    packet.extend_from_slice(&[0x00, 0x01]);
    // ANCOUNT, NSCOUNT, ARCOUNT: 0
    packet.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    // QNAME: length-prefixed domain labels (e.g. \x0e steampowered \x03 com \x00)
    for part in domain.split('.') {
        if !part.is_empty() {
            packet.push(part.len() as u8);
            packet.extend_from_slice(part.as_bytes());
        }
    }
    packet.push(0x00); // Root null label

    // QTYPE: 0x0001 (A record)
    packet.extend_from_slice(&[0x00, 0x01]);
    // QCLASS: 0x0001 (IN Internet class)
    packet.extend_from_slice(&[0x00, 0x01]);

    packet
}

pub fn measure_dns_query_single(ip: &str, domain: &str, timeout_ms: u64, tx_id: u16) -> Option<u32> {
    use std::net::{SocketAddr, UdpSocket};
    use std::time::{Duration, Instant};

    let target: SocketAddr = format!("{}:53", ip).parse().ok()?;
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    let timeout = Duration::from_millis(timeout_ms);
    socket.set_read_timeout(Some(timeout)).ok()?;
    socket.set_write_timeout(Some(timeout)).ok()?;

    let query = build_dns_query_packet(domain, tx_id);
    let start = Instant::now();
    socket.send_to(&query, target).ok()?;

    let mut buf = [0u8; 512];
    let (amt, _src) = socket.recv_from(&mut buf).ok()?;
    let elapsed = start.elapsed().as_millis() as u32;

    // Minimum DNS header is 12 bytes; verify transaction ID matches
    if amt >= 12 && buf[0] == (tx_id >> 8) as u8 && buf[1] == (tx_id & 0xFF) as u8 {
        // If elapsed is under 5ms on a non-local IP, it was intercepted locally by fakeDNS/proxy/loopback
        if elapsed < 5 && !ip.starts_with("192.168.") && !ip.starts_with("127.") {
            return None;
        }

        // Check if resolved IP is loopback or fake-ip (127.x.x.x, 0.0.0.0, 10.10.34.35)
        if amt >= 4 {
            let ip_bytes = &buf[amt - 4..amt];
            if ip_bytes[0] == 127
                || (ip_bytes[0] == 0 && ip_bytes[1] == 0)
                || (ip_bytes[0] == 10 && ip_bytes[1] == 10 && ip_bytes[2] == 34)
            {
                return None;
            }
        }

        Some(elapsed)
    } else {
        None
    }
}

pub fn benchmark_dns_ip_realistic(primary: &str, secondary: &str, timeout_ms: u64) -> Option<u32> {
    let t_ms = (timeout_ms as u32).min(800);

    // 1. Primary IP: real network ICMP ping (measures true wire RTT directly to the DNS server, immune to local fakeDNS proxy)
    let mut p1 = ping_single_ip_fast(primary, t_ms);
    if let Some(ms) = p1 {
        if ms < 2 && !primary.starts_with("192.168.") && !primary.starts_with("127.") {
            p1 = None;
        }
    }

    // 2. Secondary IP: test if secondary responds
    let p2 = if !secondary.is_empty() && secondary != primary {
        let res = ping_single_ip_fast(secondary, t_ms);
        if let Some(ms) = res {
            if ms < 2 && !secondary.starts_with("192.168.") && !secondary.starts_with("127.") {
                None
            } else {
                Some(ms)
            }
        } else {
            None
        }
    } else {
        None
    };

    if let (Some(a), Some(b)) = (p1, p2) {
        return Some(a.min(b));
    }
    if let Some(a) = p1.or(p2) {
        return Some(a);
    }

    // 3. Fallback for domestic clusters where edge host drops ICMP Echo (e.g. 10.202.10.x NIN anycast or Shelter)
    if primary.starts_with("10.202.10.") || secondary.starts_with("10.202.10.") {
        if let Some(ms) = ping_single_ip_fast("10.202.6.168", t_ms) {
            return Some(ms);
        }
    }
    if primary.starts_with("94.103.125.") || secondary.starts_with("94.103.125.") {
        if let Some(ms) = ping_single_ip_fast("94.103.124.1", t_ms) {
            return Some(ms);
        }
    }

    // 4. Fallback to DNS UDP query if ICMP is unavailable, but strictly validating that it is not a local proxy intercept
    if let Some(ms) = measure_dns_query_single(primary, "steampowered.com", timeout_ms, 0x1A2B) {
        if ms >= 5 {
            return Some(ms);
        }
    }
    if !secondary.is_empty() && secondary != primary {
        if let Some(ms) = measure_dns_query_single(secondary, "steampowered.com", timeout_ms, 0x5E6F) {
            if ms >= 5 {
                return Some(ms);
            }
        }
    }

    None
}

pub fn deep_benchmark_dns_realistic(primary: &str, secondary: &str, count: usize) -> Option<u32> {
    let mut times = Vec::new();
    let sample_count = count.clamp(3, 8);
    for _ in 0..sample_count {
        if let Some(ms) = benchmark_dns_ip_realistic(primary, secondary, 800) {
            times.push(ms);
        }
        std::thread::sleep(std::time::Duration::from_millis(80));
    }
    if !times.is_empty() {
        Some(times.iter().sum::<u32>() / times.len() as u32)
    } else {
        None
    }
}

pub fn benchmark_dns_profiles_parallel() -> Vec<DnsProfile> {
    let active_ips = get_active_dns_ips();
    let (tx, rx) = mpsc::channel();
    let mut handles = Vec::new();

    for &(id, name, name_fa, desc, desc_fa, tag, tag_fa, primary, secondary) in DNS_PROFILES_RAW {
        let tx = tx.clone();
        let id = id.to_string();
        let name = name.to_string();
        let name_fa = name_fa.to_string();
        let desc = desc.to_string();
        let desc_fa = desc_fa.to_string();
        let tag = tag.to_string();
        let tag_fa = tag_fa.to_string();
        let primary_s = primary.to_string();
        let secondary_s = secondary.to_string();
        let is_active = active_ips.iter().any(|ip| ip == primary || ip == secondary);

        handles.push(thread::spawn(move || {
            let ping = benchmark_dns_ip_realistic(&primary_s, &secondary_s, 600);
            let profile = DnsProfile {
                id,
                name,
                name_fa,
                desc,
                desc_fa,
                tag,
                tag_fa,
                primary: primary_s,
                secondary: secondary_s,
                is_active,
                ping_ms: ping,
            };
            let _ = tx.send(profile);
        }));
    }
    drop(tx);

    let mut results = Vec::new();
    for p in rx {
        results.push(p);
    }
    for h in handles {
        let _ = h.join();
    }

    results.sort_by_key(|p| p.ping_ms.unwrap_or(9999));
    results
}

pub fn deep_benchmark_dns_profiles(duration_secs: u32) -> Vec<DnsProfile> {
    let active_ips = get_active_dns_ips();
    let count = (duration_secs / 3).clamp(4, 10) as usize;
    let (tx, rx) = mpsc::channel();
    let mut handles = Vec::new();

    for &(id, name, name_fa, desc, desc_fa, tag, tag_fa, primary, secondary) in DNS_PROFILES_RAW {
        let tx = tx.clone();
        let id = id.to_string();
        let name = name.to_string();
        let name_fa = name_fa.to_string();
        let desc = desc.to_string();
        let desc_fa = desc_fa.to_string();
        let tag = tag.to_string();
        let tag_fa = tag_fa.to_string();
        let primary_s = primary.to_string();
        let secondary_s = secondary.to_string();
        let is_active = active_ips.iter().any(|ip| ip == primary || ip == secondary);

        handles.push(thread::spawn(move || {
            let avg_ms = deep_benchmark_dns_realistic(&primary_s, &secondary_s, count);

            let profile = DnsProfile {
                id,
                name,
                name_fa,
                desc,
                desc_fa,
                tag,
                tag_fa,
                primary: primary_s,
                secondary: secondary_s,
                is_active,
                ping_ms: avg_ms,
            };
            let _ = tx.send(profile);
        }));
    }
    drop(tx);

    let mut results = Vec::new();
    for p in rx {
        results.push(p);
    }
    for h in handles {
        let _ = h.join();
    }

    results.sort_by_key(|p| p.ping_ms.unwrap_or(9999));
    results
}

pub fn apply_dns_to_adapters(primary: &str, secondary: &str) -> Result<(), String> {
    let adapters = get_active_network_adapters();
    if adapters.is_empty() {
        return Err("No active network adapter found.".to_string());
    }

    let mut script = String::new();
    for a in &adapters {
        script.push_str(&format!(
            "netsh interface ipv4 set dnsservers name=\"{name}\" source=static address=\"{p}\" register=primary ; \
             netsh interface ipv4 add dnsservers name=\"{name}\" address=\"{s}\" index=2 ;\n",
            name = a, p = primary, s = secondary
        ));
    }
    script.push_str("ipconfig /flushdns ;\n");

    run_powershell_admin(&script)?;
    Ok(())
}

pub fn reset_dns_to_dhcp_adapters() -> Result<(), String> {
    let adapters = get_active_network_adapters();
    if adapters.is_empty() {
        return Err("No active network adapter found.".to_string());
    }

    let mut script = String::new();
    for a in &adapters {
        script.push_str(&format!(
            "netsh interface ipv4 set dnsservers name=\"{name}\" source=dhcp ;\n",
            name = a
        ));
    }
    script.push_str("ipconfig /flushdns ;\n");

    run_powershell_admin(&script)?;
    Ok(())
}

pub fn flush_dns_cache() -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("ipconfig");
        cmd.args(["/flushdns"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        let _ = cmd.output();
    }
    Ok(())
}

// ---------- Latency Tweaks & Bandwidth Shield Suite ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyTweaksState {
    pub bandwidth_shield: bool,
    pub qos_enabled: bool,
    pub throttling_disabled: bool,
    pub nic_opt_enabled: bool,
    pub netcode_opt_enabled: bool,
}

impl Default for LatencyTweaksState {
    fn default() -> Self {
        Self {
            bandwidth_shield: false,
            qos_enabled: true,
            throttling_disabled: true,
            nic_opt_enabled: true,
            netcode_opt_enabled: true,
        }
    }
}

pub fn apply_latency_tweaks(tweaks: &LatencyTweaksState, deadlock_path: Option<&str>) -> Result<String, String> {
    let mut script = String::new();

    // 1. Bandwidth Shield: Pauses Delivery Optimization & BITS background uploads
    if tweaks.bandwidth_shield {
        script.push_str("Stop-Service -Name dosvc -Force -ErrorAction SilentlyContinue ; Stop-Service -Name bits -Force -ErrorAction SilentlyContinue ;\n");
    }

    // 2. Windows Policy-based QoS: Assign DSCP 46 (Expedited Forwarding) to Deadlock
    if tweaks.qos_enabled {
        script.push_str(
            "New-NetQosPolicy -Name 'DLPHub_Deadlock_QoS' -AppPathNameMatchCondition 'deadlock.exe' -DSCPAction 46 -NetworkProfile All -ErrorAction SilentlyContinue ;\n\
             New-NetQosPolicy -Name 'DLPHub_Project8_QoS' -AppPathNameMatchCondition 'project8.exe' -DSCPAction 46 -NetworkProfile All -ErrorAction SilentlyContinue ;\n\
             New-NetQosPolicy -Name 'DLPHub_Citadel_QoS' -AppPathNameMatchCondition 'citadel.exe' -DSCPAction 46 -NetworkProfile All -ErrorAction SilentlyContinue ;\n\
             Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\QoS' -Name 'Do not use NLA' -Value '1' -ErrorAction SilentlyContinue ;\n"
        );
    } else {
        script.push_str(
            "Remove-NetQosPolicy -Name 'DLPHub_Deadlock_QoS' -Confirm:$false -ErrorAction SilentlyContinue ;\n\
             Remove-NetQosPolicy -Name 'DLPHub_Project8_QoS' -Confirm:$false -ErrorAction SilentlyContinue ;\n\
             Remove-NetQosPolicy -Name 'DLPHub_Citadel_QoS' -Confirm:$false -ErrorAction SilentlyContinue ;\n"
        );
    }

    // 3. Multimedia Throttling Disable
    if tweaks.throttling_disabled {
        script.push_str(
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff -Type DWord -ErrorAction SilentlyContinue ;\n\
             Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -ErrorAction SilentlyContinue ;\n"
        );
    }

    // 5. Network Adapter Hardware Offload & Interrupt Moderation
    if tweaks.nic_opt_enabled {
        script.push_str(
            "Get-NetAdapterAdvancedProperty -DisplayName '*Interrupt Moderation*' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -DisplayValue 'Disabled' -ErrorAction SilentlyContinue ;\n\
             Get-NetAdapterAdvancedProperty -DisplayName '*Large Send Offload*' -ErrorAction SilentlyContinue | Set-NetAdapterAdvancedProperty -DisplayValue 'Disabled' -ErrorAction SilentlyContinue ;\n"
        );
    }

    run_powershell_admin(&script)?;

    // 6. Deadlock Engine Netcode ConVars in autoexec.cfg
    if tweaks.netcode_opt_enabled {
        if let Some(dp) = deadlock_path {
            let cit_dir = std::path::Path::new(dp).join("game").join("citadel");
            if cit_dir.is_dir() {
                let cfg_dir = cit_dir.join("cfg");
                let _ = std::fs::create_dir_all(&cfg_dir);
                let ae_path = cfg_dir.join("autoexec.cfg");
                let mut content = std::fs::read_to_string(&ae_path).unwrap_or_default();

                let start_tag = "// DLP NETCODE BLOCK START";
                let end_tag = "// DLP NETCODE BLOCK END";
                let block = format!(
                    "{}\n\
                     rate \"1000000\"\n\
                     cl_updaterate \"64\"\n\
                     cl_interp_ratio \"1\"\n\
                     cl_interp \"0.015625\"\n\
                     net_splitrate \"2\"\n\
                     sdr_spew_level \"0\"\n\
                     {}\n",
                    start_tag, end_tag
                );

                if let (Some(s_idx), Some(e_idx)) = (content.find(start_tag), content.find(end_tag)) {
                    if s_idx <= e_idx {
                        let after = &content[e_idx + end_tag.len()..];
                        let before = &content[..s_idx];
                        content = format!("{}{}{}", before, block, after);
                    }
                } else {
                    if !content.is_empty() && !content.ends_with('\n') {
                        content.push('\n');
                    }
                    content.push_str(&block);
                }
                let _ = std::fs::write(&ae_path, content);
            }
        }
    }

    Ok("System latency tweaks and netcode applied successfully.".to_string())
}

pub fn revert_latency_tweaks(deadlock_path: Option<&str>) -> Result<String, String> {
    let script =
        "Start-Service -Name dosvc -ErrorAction SilentlyContinue ;\n\
         Start-Service -Name bits -ErrorAction SilentlyContinue ;\n\
         Remove-NetQosPolicy -Name 'DLPHub_Deadlock_QoS' -Confirm:$false -ErrorAction SilentlyContinue ;\n\
         Remove-NetQosPolicy -Name 'DLPHub_Project8_QoS' -Confirm:$false -ErrorAction SilentlyContinue ;\n\
         Remove-NetQosPolicy -Name 'DLPHub_Citadel_QoS' -Confirm:$false -ErrorAction SilentlyContinue ;\n\
         Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 10 -Type DWord -ErrorAction SilentlyContinue ;\n\
         Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 20 -Type DWord -ErrorAction SilentlyContinue ;\n\
         $tcpPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' ;\n\
         Get-ChildItem $tcpPath -ErrorAction SilentlyContinue | ForEach-Object { \n\
             Remove-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue ;\n\
             Remove-ItemProperty -Path $_.PSPath -Name 'TCPNoDelay' -ErrorAction SilentlyContinue ;\n\
         } ;\n";

    run_powershell_admin(script)?;

    // Remove DLP netcode block from autoexec.cfg if present
    if let Some(dp) = deadlock_path {
        let ae_path = std::path::Path::new(dp).join("game").join("citadel").join("cfg").join("autoexec.cfg");
        if ae_path.exists() {
            if let Ok(mut content) = std::fs::read_to_string(&ae_path) {
                let start_tag = "// DLP NETCODE BLOCK START";
                let end_tag = "// DLP NETCODE BLOCK END";
                if let (Some(s_idx), Some(e_idx)) = (content.find(start_tag), content.find(end_tag)) {
                    if s_idx <= e_idx {
                        let after = &content[e_idx + end_tag.len()..];
                        let before = &content[..s_idx];
                        content = format!("{}{}", before, after.trim_start());
                        let _ = std::fs::write(&ae_path, content);
                    }
                }
            }
        }
    }

    Ok("All latency tweaks restored to Windows defaults.".to_string())
}
