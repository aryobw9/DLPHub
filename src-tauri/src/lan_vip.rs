// DLPHub Pure In-House LAN VIP Module
// Connects to the Iranian VPS Coordinator REST API on https://deadlockpersian.com
// Coordinates room sessions and manages network engines (Relay Mode & Wintun Mode).
// Zero-Trust Security: Enforces Hardware-Bound Cryptographic VIP Session Tokens.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::Duration;

use crate::hwid::get_machine_hwid;
use crate::lan_engine::{is_wintun_available, start_lan_engine, stop_lan_engine, DEFAULT_VPS_UDP};
use crate::lan_relay::{start_client_relay, start_host_relay, stop_relay};
use crate::lan_supervisor::stop_dedicated_server;

pub const DEFAULT_VIP_API: &str = "https://deadlockpersian.com";
pub const FALLBACK_VIP_API: &str = "http://92.42.207.96:48080";

static ACTIVE_API_INDEX: AtomicUsize = AtomicUsize::new(0);
static LAST_FALLBACK_TS: AtomicU64 = AtomicU64::new(0);

// Cooldown to retry HTTPS primary after falling back to HTTP (in seconds)
const HTTPS_RETRY_INTERVAL_SECS: u64 = 60;

fn current_timestamp_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn mark_vip_api_success(api_base: &str) {
    let trimmed = api_base.trim_end_matches('/');
    if trimmed.eq_ignore_ascii_case(FALLBACK_VIP_API) {
        ACTIVE_API_INDEX.store(1, Ordering::Relaxed);
        LAST_FALLBACK_TS.store(current_timestamp_secs(), Ordering::Relaxed);
    } else if trimmed.eq_ignore_ascii_case(DEFAULT_VIP_API) {
        ACTIVE_API_INDEX.store(0, Ordering::Relaxed);
    }
}

pub fn get_active_vip_api() -> &'static str {
    if ACTIVE_API_INDEX.load(Ordering::Relaxed) == 1 {
        let last_fallback = LAST_FALLBACK_TS.load(Ordering::Relaxed);
        let now = current_timestamp_secs();
        if now.saturating_sub(last_fallback) >= HTTPS_RETRY_INTERVAL_SECS {
            // Periodic retry of HTTPS primary
            ACTIVE_API_INDEX.store(0, Ordering::Relaxed);
            DEFAULT_VIP_API
        } else {
            FALLBACK_VIP_API
        }
    } else {
        DEFAULT_VIP_API
    }
}

pub fn ordered_candidates() -> Vec<String> {
    let active = get_active_vip_api();
    let other = if active == DEFAULT_VIP_API { FALLBACK_VIP_API } else { DEFAULT_VIP_API };
    vec![active.to_string(), other.to_string()]
}

pub fn get_vip_api_candidates(custom_api_url: Option<&str>) -> Vec<String> {
    if let Some(custom) = custom_api_url.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let trimmed = custom.trim_end_matches('/');
        if trimmed.eq_ignore_ascii_case(DEFAULT_VIP_API) {
            ordered_candidates()
        } else if trimmed.eq_ignore_ascii_case(FALLBACK_VIP_API) {
            vec![FALLBACK_VIP_API.to_string(), DEFAULT_VIP_API.to_string()]
        } else {
            // Explicit developer/custom URL: do not fall back to production endpoint
            vec![trimmed.to_string()]
        }
    } else {
        ordered_candidates()
    }
}

/// VIP is account-bound: every privileged call must carry the TeamSpeak session token.
fn require_account_token(token: Option<String>) -> Result<String, String> {
    token
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "SIGN_IN_REQUIRED: sign in with TeamSpeak to use VIP".to_string())
}

fn account_header(token: Option<&str>) -> Option<Vec<(String, String)>> {
    token
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .map(|t| vec![("X-User-Token".to_string(), t.to_string())])
}

async fn execute_vip_request(
    client: &reqwest::Client,
    candidates: &[String],
    method: reqwest::Method,
    path: &str,
    body: Option<&serde_json::Value>,
    headers: Option<&[(String, String)]>,
    is_idempotent: bool,
) -> Result<reqwest::Response, String> {
    let mut last_error = String::new();
    for (idx, api_base) in candidates.iter().enumerate() {
        let url = format!("{}/{}", api_base.trim_end_matches('/'), path.trim_start_matches('/'));
        let mut req = client.request(method.clone(), &url);
        if let Some(h_list) = headers {
            for (k, v) in h_list {
                req = req.header(k.as_str(), v.as_str());
            }
        }
        if let Some(b) = body {
            req = req.json(b);
        }

        let resp_res = req.send().await;
        let resp = match resp_res {
            Ok(r) => {
                let status = r.status();
                if (status.is_server_error() || status == reqwest::StatusCode::GATEWAY_TIMEOUT)
                    && idx + 1 < candidates.len()
                {
                    eprintln!("[VIP API] HTTP {status} from {url}, trying fallback...");
                    last_error = format!("HTTP {status} from {url}");
                    continue;
                }
                r
            }
            Err(e) => {
                eprintln!("[VIP API] Request to {url} failed ({e})");
                last_error = format!("Failed to reach VIP Coordinator at {url}: {e}");
                if (e.is_connect() || is_idempotent) && idx + 1 < candidates.len() {
                    eprintln!("[VIP API] Attempting fallback endpoint...");
                    continue;
                }
                return Err(last_error);
            }
        };

        mark_vip_api_success(api_base);
        return Ok(resp);
    }
    Err(last_error)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VipSession {
    pub vip_until: Option<f64>,
    pub last_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipRedeemResponse {
    pub success: bool,
    pub days_remaining: Option<f64>,
    pub vip_until: Option<f64>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipDevice {
    pub hwid: String,
    pub label: Option<String>,
    pub first_seen: Option<f64>,
    pub last_seen: Option<f64>,
    pub is_current: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipStatusResponse {
    pub is_vip: bool,
    pub days_remaining: Option<f64>,
    pub vip_until: Option<f64>,
    pub hwid: String,
    #[serde(default)]
    pub devices: Vec<VipDevice>,
    pub device_cap: Option<usize>,
    pub unbind_available_at: Option<f64>,
    #[serde(default)]
    pub sign_in_required: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipCreateResponse {
    pub success: bool,
    pub room_code: Option<String>,
    pub room_name: Option<String>,
    pub has_password: Option<bool>,
    pub is_hidden: Option<bool>,
    pub max_players: Option<usize>,
    pub connection_mode: Option<String>,
    pub host_ip: Option<String>,
    pub relay_port: Option<u16>,
    pub connect_cmd: Option<String>,
    pub client_connect_cmd: Option<String>,
    pub is_modded: Option<bool>,
    pub mod_mode: Option<String>,
    pub enable_sdr: Option<bool>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipJoinResponse {
    pub success: bool,
    pub room_code: Option<String>,
    pub room_name: Option<String>,
    pub has_password: Option<bool>,
    pub is_hidden: Option<bool>,
    pub max_players: Option<usize>,
    pub connection_mode: Option<String>,
    pub host_ip: Option<String>,
    pub connect_cmd: Option<String>,
    pub is_modded: Option<bool>,
    pub mod_mode: Option<String>,
    pub enable_sdr: Option<bool>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipPeer {
    pub name: String,
    pub ip: String,
    pub online: bool,
    pub is_host: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipRoomStatus {
    pub success: Option<bool>,
    pub room_code: Option<String>,
    pub room_name: Option<String>,
    pub has_password: Option<bool>,
    pub is_hidden: Option<bool>,
    pub max_players: Option<usize>,
    pub connection_mode: Option<String>,
    pub relay_port: Option<u16>,
    pub host_ip: Option<String>,
    pub is_modded: Option<bool>,
    pub mod_mode: Option<String>,
    pub enable_sdr: Option<bool>,
    pub peers: Option<Vec<VipPeer>>,
    pub error: Option<String>,
}

/// UDP packet-switch endpoint advertised by the coordinator, with a legacy
/// fallback so older servers that omit it keep working.
pub fn resolve_vps_udp(data: &serde_json::Value) -> String {
    if let Some(s) = data["udp_server"].as_str() {
        let s = s.trim();
        if !s.is_empty() {
            return s.to_string();
        }
    }
    if let Some(ip) = data["vps_ip"].as_str() {
        let ip = ip.trim();
        if !ip.is_empty() {
            let port = data["vps_udp_port"].as_u64().unwrap_or(48000);
            return format!("{ip}:{port}");
        }
    }
    DEFAULT_VPS_UDP.to_string()
}

fn get_session_file() -> std::path::PathBuf {
    dlp_core::settings::data_dir().join("vip_session.json")
}

pub fn load_vip_session() -> VipSession {
    let path = get_session_file();
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(sess) = serde_json::from_str::<VipSession>(&data) {
            return sess;
        }
    }
    VipSession::default()
}

pub fn save_vip_session(sess: &VipSession) {
    let path = get_session_file();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(data) = serde_json::to_string_pretty(sess) {
        let _ = std::fs::write(&path, data);
    }
}

pub fn check_vip_binaries_installed() -> bool {
    is_wintun_available()
}

/// Redeem a VIP License key from the VPS Coordinator
pub async fn redeem_vip_license(
    custom_api_url: Option<String>,
    license_key: String,
    nickname: Option<String>,
    account_token: Option<String>,
) -> Result<VipRedeemResponse, String> {
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let hwid = get_machine_hwid();
    let clean_key = license_key.trim().to_uppercase();
    let nick = nickname.unwrap_or_else(|| "Player".to_string());
    let body = serde_json::json!({
        "license_key": clean_key,
        "hwid": hwid,
        "nickname": nick
    });

    let resp = execute_vip_request(&client, &candidates, reqwest::Method::POST, "/api/vip/redeem", Some(&body), headers.as_deref(), false).await?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !data["success"].as_bool().unwrap_or(false) {
        let err_msg = data["detail"].as_str()
            .or_else(|| data["error"].as_str())
            .unwrap_or("Failed to redeem VIP key");
        return Err(err_msg.to_string());
    }

    let vip_until = data["vip_until"].as_f64();
    let days_remaining = data["days_remaining"].as_f64();
    let message = data["message"].as_str().map(|s| s.to_string());

    // Cache only the expiry: the entitlement lives on the account, not on this machine.
    let sess = VipSession {
        vip_until,
        last_key: Some(clean_key),
    };
    save_vip_session(&sess);

    Ok(VipRedeemResponse {
        success: true,
        days_remaining,
        vip_until,
        message,
        error: None,
    })
}

/// Check live VIP License validity with VPS Coordinator
pub async fn check_vip_license_status(
    custom_api_url: Option<String>,
    account_token: Option<String>,
) -> Result<VipStatusResponse, String> {
    let headers = account_header(account_token.as_deref());
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let hwid = get_machine_hwid();
    let sess = load_vip_session();

    let body = serde_json::json!({
        "hwid": hwid
    });

    let resp = match execute_vip_request(&client, &candidates, reqwest::Method::POST, "/api/vip/check", Some(&body), headers.as_deref(), true).await {
        Ok(r) => r,
        Err(_) => {
            // Offline fallback: only what the last successful check cached.
            if let Some(until) = sess.vip_until {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64();
                if until > now {
                    return Ok(VipStatusResponse {
                        is_vip: true,
                        days_remaining: Some(((until - now) / 86400.0 * 10.0).round() / 10.0),
                        vip_until: Some(until),
                        hwid: hwid.clone(),
                        devices: Vec::new(),
                        device_cap: None,
                        unbind_available_at: None,
                        sign_in_required: false,
                        error: None,
                    });
                }
            }
            return Ok(VipStatusResponse {
                is_vip: false,
                days_remaining: None,
                vip_until: None,
                hwid: hwid.clone(),
                devices: Vec::new(),
                device_cap: None,
                unbind_available_at: None,
                sign_in_required: false,
                error: Some("Unable to reach verification server".to_string()),
            });
        }
    };

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let is_vip = data["is_vip"].as_bool().unwrap_or(false);
    let days_remaining = data["days_remaining"].as_f64();
    let vip_until = data["vip_until"].as_f64();

    let devices: Vec<VipDevice> = data["devices"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<VipDevice>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default();
    let device_cap = data["device_cap"].as_u64().map(|n| n as usize);
    let unbind_available_at = data["unbind_available_at"].as_f64();
    let sign_in_required = data["reason"].as_str() == Some("SIGN_IN_REQUIRED");

    if is_vip {
        let mut updated_sess = sess;
        updated_sess.vip_until = vip_until;
        save_vip_session(&updated_sess);
    }

    Ok(VipStatusResponse {
        is_vip,
        days_remaining,
        vip_until,
        hwid,
        devices,
        device_cap,
        unbind_available_at,
        sign_in_required,
        error: None,
    })
}


pub async fn create_vip_room(
    custom_api_url: Option<String>,
    nickname: String,
    mode: Option<String>,
    is_modded: Option<bool>,
    mod_mode: Option<String>,
    enable_sdr: Option<bool>,
    room_name: Option<String>,
    is_hidden: Option<bool>,
    password: Option<String>,
    max_players: Option<usize>,
    account_token: Option<String>,
) -> Result<VipCreateResponse, String> {
    let hwid = get_machine_hwid();
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));

    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let clean_nick = if nickname.trim().is_empty() { "Host" } else { nickname.trim() };
    let clean_mode = mode.as_deref().unwrap_or("relay").trim().to_lowercase();
    let clean_is_modded = is_modded.unwrap_or(true);
    let clean_mod_mode = mod_mode.unwrap_or_else(|| "vanilla".to_string());
    let clean_enable_sdr = enable_sdr.unwrap_or(false);
    let clean_room_name = room_name.filter(|s| !s.trim().is_empty());
    let clean_is_hidden = is_hidden.unwrap_or(false);
    let clean_password = password.filter(|p| !p.trim().is_empty());
    let clean_max_players = max_players.unwrap_or(12);

    let mut body = serde_json::json!({
        "host_nickname": clean_nick,
        "mode": clean_mode,
        "is_modded": clean_is_modded,
        "mod_mode": clean_mod_mode,
        "enable_sdr": clean_enable_sdr,
        "is_hidden": clean_is_hidden,
        "max_players": clean_max_players,
        "hwid": hwid
    });
    if let Some(rn) = clean_room_name {
        body["room_name"] = serde_json::Value::String(rn);
    }
    if let Some(pwd) = clean_password {
        body["password"] = serde_json::Value::String(pwd);
    }

    let resp = execute_vip_request(&client, &candidates, reqwest::Method::POST, "/api/room/create", Some(&body), headers.as_deref(), false).await?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !data["success"].as_bool().unwrap_or(false) {
        let err_msg = data["detail"].as_str()
            .or_else(|| data["error"].as_str())
            .unwrap_or("Failed to create room");
        return Err(err_msg.to_string());
    }

    let room_code = data["room_code"].as_str().unwrap_or_default().to_string();
    let room_token = data["room_token"].as_u64().unwrap_or_default() as u32;
    let actual_mode = data["connection_mode"].as_str().or_else(|| data["mode"].as_str()).unwrap_or(&clean_mode).to_string();
    let vip = data["virtual_ip"].as_str().or_else(|| data["vip"].as_str()).unwrap_or("10.10.1.1");
    let mask = data["subnet_mask"].as_str().or_else(|| data["netmask"].as_str()).unwrap_or("255.255.255.0");
    let relay_port = data["relay_port"].as_u64().unwrap_or(28001) as u16;
    let relay_target = data["relay_target"].as_str().map(|s| s.to_string()).unwrap_or_else(|| {
        let vps_ip = data["vps_ip"].as_str().unwrap_or("92.42.207.96");
        format!("{vps_ip}:{relay_port}")
    });
    let udp_server = resolve_vps_udp(&data);

    let (host_connect_cmd, client_connect_cmd) = if actual_mode == "relay" {
        start_host_relay(room_token, relay_target, 27005).await?;
        ("connect localhost:27005".to_string(), "connect localhost:27016".to_string())
    } else {
        start_lan_engine(room_token, vip, mask, &udp_server)?;
        (format!("connect {vip}:27005"), format!("connect {vip}:27005"))
    };

    let res_room_name = data["room_name"].as_str().map(|s| s.to_string());
    let res_has_password = data["has_password"].as_bool();
    let res_is_hidden = data["is_hidden"].as_bool();
    let res_max_players = data["max_players"].as_u64().map(|n| n as usize);

    Ok(VipCreateResponse {
        success: true,
        room_code: Some(room_code),
        room_name: res_room_name,
        has_password: res_has_password,
        is_hidden: res_is_hidden,
        max_players: res_max_players,
        connection_mode: Some(actual_mode),
        host_ip: Some(vip.to_string()),
        relay_port: Some(relay_port),
        connect_cmd: Some(host_connect_cmd),
        client_connect_cmd: Some(client_connect_cmd),
        is_modded: Some(clean_is_modded),
        mod_mode: Some(clean_mod_mode),
        enable_sdr: Some(clean_enable_sdr),
        error: None,
    })
}

pub async fn join_vip_room(
    custom_api_url: Option<String>,
    room_code: String,
    nickname: String,
    password: Option<String>,
    account_token: Option<String>,
) -> Result<VipJoinResponse, String> {
    let hwid = get_machine_hwid();
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));

    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let clean_nick = if nickname.trim().is_empty() { "Player" } else { nickname.trim() };
    let clean_password = password.filter(|p| !p.trim().is_empty());
    let mut body = serde_json::json!({
        "room_code": room_code.trim(),
        "nickname": clean_nick,
        "hwid": hwid
    });
    if let Some(pwd) = clean_password {
        body["password"] = serde_json::Value::String(pwd);
    }

    let resp = execute_vip_request(&client, &candidates, reqwest::Method::POST, "/api/room/join", Some(&body), headers.as_deref(), false).await?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !data["success"].as_bool().unwrap_or(false) {
        let err_msg = data["detail"].as_str()
            .or_else(|| data["error"].as_str())
            .unwrap_or("Failed to join room");
        return Err(err_msg.to_string());
    }

    let room_token = data["room_token"].as_u64().unwrap_or_default() as u32;
    let actual_mode = data["connection_mode"].as_str().or_else(|| data["mode"].as_str()).unwrap_or("relay").to_string();
    let vip = data["virtual_ip"].as_str().or_else(|| data["vip"].as_str()).unwrap_or("10.10.1.2");
    let mask = data["subnet_mask"].as_str().or_else(|| data["netmask"].as_str()).unwrap_or("255.255.255.0");
    let host_vip = data["host_vip"].as_str().or_else(|| data["host_ip"].as_str()).unwrap_or("10.10.1.1").to_string();
    let relay_port = data["relay_port"].as_u64().unwrap_or(28001) as u16;
    let relay_target = data["relay_target"].as_str().map(|s| s.to_string()).unwrap_or_else(|| {
        let vps_ip = data["vps_ip"].as_str().unwrap_or("92.42.207.96");
        format!("{vps_ip}:{relay_port}")
    });
    let udp_server = resolve_vps_udp(&data);
    let is_modded = data["is_modded"].as_bool().unwrap_or(false);
    let mod_mode = data["mod_mode"].as_str().unwrap_or("vanilla").to_string();
    let enable_sdr = data["enable_sdr"].as_bool().unwrap_or(false);

    let client_connect_cmd = if actual_mode == "relay" {
        start_client_relay(room_token, clean_nick.to_string(), relay_target, 27016).await?;
        "connect localhost:27016".to_string()
    } else {
        start_lan_engine(room_token, vip, mask, &udp_server)?;
        format!("connect {host_vip}:27005")
    };

    // Prepare client assets in background
    let _ = crate::lan_supervisor::prepare_modded_client(&mod_mode).await;

    let res_room_name = data["room_name"].as_str().map(|s| s.to_string());
    let res_has_password = data["has_password"].as_bool();
    let res_is_hidden = data["is_hidden"].as_bool();
    let res_max_players = data["max_players"].as_u64().map(|n| n as usize);

    Ok(VipJoinResponse {
        success: true,
        room_code: Some(room_code.trim().to_string()),
        room_name: res_room_name,
        has_password: res_has_password,
        is_hidden: res_is_hidden,
        max_players: res_max_players,
        connection_mode: Some(actual_mode),
        host_ip: Some(host_vip),
        connect_cmd: Some(client_connect_cmd),
        is_modded: Some(is_modded),
        mod_mode: Some(mod_mode),
        enable_sdr: Some(enable_sdr),
        error: None,
    })
}

pub async fn get_vip_room_status(
    custom_api_url: Option<String>,
    room_code: String,
) -> Result<VipRoomStatus, String> {
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let path = format!("/api/room/status/{}", room_code.trim());
    let resp = execute_vip_request(&client, &candidates, reqwest::Method::GET, &path, None, None, true).await?;
    let status: VipRoomStatus = resp.json().await.map_err(|e| e.to_string())?;
    Ok(status)
}

pub async fn leave_vip_room(
    custom_api_url: Option<String>,
    room_code: String,
    account_token: Option<String>,
) -> Result<(), String> {
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    // The host proves control with the account session; a bare HWID is public and
    // must never authorise closing a room.
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));
    let path = format!("/api/room/{}", room_code.trim());
    let _ = execute_vip_request(
        &client,
        &candidates,
        reqwest::Method::DELETE,
        &path,
        None,
        headers.as_deref(),
        true,
    ).await;

    stop_relay();
    stop_lan_engine();
    let _ = stop_dedicated_server();

    if let Some(found) = dlp_core::discovery::find_game() {
        let _ = crate::lan_supervisor::restore_gameinfo_vanilla(std::path::Path::new(&found.deadlock));
    }

    Ok(())
}

pub async fn kick_vip_peer(
    custom_api_url: Option<String>,
    room_code: String,
    peer_name: String,
    account_token: Option<String>,
) -> Result<(), String> {
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));

    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let path = format!("/api/room/{}/kick", room_code.trim());
    let body = serde_json::json!({
        "target_nickname": peer_name.trim(),
    });
    let resp = execute_vip_request(&client, &candidates, reqwest::Method::POST, &path, Some(&body), headers.as_deref(), false).await?;
    if !resp.status().is_success() {
        return Err(format!("Kick failed with status {}", resp.status()));
    }
    let data: serde_json::Value = resp.json().await.unwrap_or_default();
    if data["success"].as_bool() == Some(false) {
        return Err(data["message"].as_str().unwrap_or("Kick failed").to_string());
    }
    Ok(())
}

pub async fn ban_vip_peer(
    custom_api_url: Option<String>,
    room_code: String,
    peer_name: String,
    account_token: Option<String>,
) -> Result<(), String> {
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));

    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let path = format!("/api/room/{}/ban", room_code.trim());
    let body = serde_json::json!({
        "target_nickname": peer_name.trim(),
    });
    let resp = execute_vip_request(&client, &candidates, reqwest::Method::POST, &path, Some(&body), headers.as_deref(), false).await?;
    if !resp.status().is_success() {
        return Err(format!("Ban failed with status {}", resp.status()));
    }
    let data: serde_json::Value = resp.json().await.unwrap_or_default();
    if data["success"].as_bool() == Some(false) {
        return Err(data["message"].as_str().unwrap_or("Ban failed").to_string());
    }
    Ok(())
}

pub async fn unban_vip_peer(
    custom_api_url: Option<String>,
    room_code: String,
    peer_name: String,
    account_token: Option<String>,
) -> Result<(), String> {
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));

    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let path = format!("/api/room/{}/unban", room_code.trim());
    let body = serde_json::json!({
        "target_nickname": peer_name.trim(),
    });
    let resp = execute_vip_request(&client, &candidates, reqwest::Method::POST, &path, Some(&body), headers.as_deref(), false).await?;
    if !resp.status().is_success() {
        return Err(format!("Unban failed with status {}", resp.status()));
    }
    let data: serde_json::Value = resp.json().await.unwrap_or_default();
    if data["success"].as_bool() == Some(false) {
        return Err(data["message"].as_str().unwrap_or("Unban failed").to_string());
    }
    Ok(())
}

/// Bound devices for the signed-in account (the HWID seats).
pub async fn list_vip_devices(
    custom_api_url: Option<String>,
    account_token: Option<String>,
) -> Result<Vec<VipDevice>, String> {
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = execute_vip_request(
        &client,
        &candidates,
        reqwest::Method::GET,
        "/api/account/devices",
        None,
        headers.as_deref(),
        true,
    )
    .await?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["devices"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<VipDevice>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default())
}

pub async fn unbind_vip_device(
    custom_api_url: Option<String>,
    hwid: String,
    account_token: Option<String>,
) -> Result<(), String> {
    let token = require_account_token(account_token)?;
    let headers = account_header(Some(token.as_str()));
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let path = format!("/api/account/devices/{}/unbind", hwid.trim());
    let resp = execute_vip_request(
        &client,
        &candidates,
        reqwest::Method::POST,
        &path,
        None,
        headers.as_deref(),
        false,
    )
    .await?;
    if !resp.status().is_success() {
        let data: serde_json::Value = resp.json().await.unwrap_or_default();
        return Err(data["detail"]
            .as_str()
            .unwrap_or("Failed to unbind device")
            .to_string());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipRoomSummary {
    pub room_code: String,
    pub room_name: Option<String>,
    pub host_nickname: Option<String>,
    pub mode: Option<String>,
    pub is_modded: Option<bool>,
    pub mod_mode: Option<String>,
    pub enable_sdr: Option<bool>,
    pub has_password: Option<bool>,
    pub is_hidden: Option<bool>,
    pub peer_count: Option<usize>,
    pub max_players: Option<usize>,
}

pub async fn list_vip_rooms(
    custom_api_url: Option<String>,
) -> Result<Vec<VipRoomSummary>, String> {
    let candidates = get_vip_api_candidates(custom_api_url.as_deref());
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = match execute_vip_request(&client, &candidates, reqwest::Method::GET, "/api/room/list", None, None, true).await {
        Ok(r) => r,
        Err(_) => return Ok(Vec::new()),
    };

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    if let Some(rooms_arr) = data["rooms"].as_array() {
        for r in rooms_arr {
            if let Ok(item) = serde_json::from_value::<VipRoomSummary>(r.clone()) {
                results.push(item);
            }
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_candidate_ordering_and_pinning() {
        // Reset to default
        mark_vip_api_success(DEFAULT_VIP_API);
        assert_eq!(get_active_vip_api(), DEFAULT_VIP_API);
        let list1 = get_vip_api_candidates(None);
        assert_eq!(list1[0], DEFAULT_VIP_API);
        assert_eq!(list1[1], FALLBACK_VIP_API);

        // Switch to fallback
        mark_vip_api_success(FALLBACK_VIP_API);
        assert_eq!(get_active_vip_api(), FALLBACK_VIP_API);
        let list2 = get_vip_api_candidates(None);
        assert_eq!(list2[0], FALLBACK_VIP_API);
        assert_eq!(list2[1], DEFAULT_VIP_API);

        // Custom URL override: should only contain the custom endpoint
        let custom = get_vip_api_candidates(Some("http://127.0.0.1:8080"));
        assert_eq!(custom.len(), 1);
        assert_eq!(custom[0], "http://127.0.0.1:8080");

        // Reset back to primary
        mark_vip_api_success(DEFAULT_VIP_API);
    }
}


