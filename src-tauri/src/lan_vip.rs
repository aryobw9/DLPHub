// DLPHub Pure In-House LAN VIP Module
// Connects to the Iranian VPS Coordinator REST API on http://5.57.32.52:48080
// Coordinates room sessions and manages network engines (Relay Mode & Wintun Mode).
// Zero-Trust Security: Enforces Hardware-Bound Cryptographic VIP Session Tokens.

use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::hwid::get_machine_hwid;
use crate::lan_engine::{is_wintun_available, start_lan_engine, stop_lan_engine};
use crate::lan_relay::{start_client_relay, start_host_relay, stop_relay};
use crate::lan_supervisor::stop_dedicated_server;

pub const DEFAULT_VIP_API: &str = "http://5.57.32.52:48080";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VipSession {
    pub vip_token: Option<String>,
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
pub struct VipStatusResponse {
    pub is_vip: bool,
    pub days_remaining: Option<f64>,
    pub vip_until: Option<f64>,
    pub hwid: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipCreateResponse {
    pub success: bool,
    pub room_code: Option<String>,
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
    pub connection_mode: Option<String>,
    pub relay_port: Option<u16>,
    pub host_ip: Option<String>,
    pub is_modded: Option<bool>,
    pub mod_mode: Option<String>,
    pub enable_sdr: Option<bool>,
    pub peers: Option<Vec<VipPeer>>,
    pub error: Option<String>,
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
) -> Result<VipRedeemResponse, String> {
    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let hwid = get_machine_hwid();
    let clean_key = license_key.trim().to_uppercase();
    let nick = nickname.unwrap_or_else(|| "Player".to_string());

    let url = format!("{}/api/vip/redeem", api_base.trim_end_matches('/'));
    let body = serde_json::json!({
        "license_key": clean_key,
        "hwid": hwid,
        "nickname": nick
    });

    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("Failed to reach VIP Coordinator at {url}: {e}"))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !data["success"].as_bool().unwrap_or(false) {
        let err_msg = data["detail"].as_str()
            .or_else(|| data["error"].as_str())
            .unwrap_or("Failed to redeem VIP key");
        return Err(err_msg.to_string());
    }

    let vip_token = data["vip_token"].as_str().map(|s| s.to_string());
    let vip_until = data["vip_until"].as_f64();
    let days_remaining = data["days_remaining"].as_f64();
    let message = data["message"].as_str().map(|s| s.to_string());

    // Save session locally
    let sess = VipSession {
        vip_token,
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
) -> Result<VipStatusResponse, String> {
    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let hwid = get_machine_hwid();
    let sess = load_vip_session();

    let url = format!("{}/api/vip/check", api_base.trim_end_matches('/'));
    let body = serde_json::json!({
        "hwid": hwid,
        "vip_token": sess.vip_token
    });

    let resp = match client.post(&url).json(&body).send().await {
        Ok(r) => r,
        Err(_) => {
            // Offline fallback: check local unexpired timestamp if token exists
            if let (Some(_), Some(until)) = (sess.vip_token, sess.vip_until) {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64();
                if until > now {
                    return Ok(VipStatusResponse {
                        is_vip: true,
                        days_remaining: Some(((until - now) / 86400.0 * 10.0).round() / 10.0),
                        vip_until: Some(until),
                        hwid,
                        error: None,
                    });
                }
            }
            return Ok(VipStatusResponse {
                is_vip: false,
                days_remaining: None,
                vip_until: None,
                hwid,
                error: Some("Unable to reach verification server".to_string()),
            });
        }
    };

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let is_vip = data["is_vip"].as_bool().unwrap_or(false);
    let days_remaining = data["days_remaining"].as_f64();
    let vip_until = data["vip_until"].as_f64();

    // If server refreshed or provided valid token, update local cache
    if is_vip {
        if let Some(new_token) = data["vip_token"].as_str() {
            let mut updated_sess = sess;
            updated_sess.vip_token = Some(new_token.to_string());
            updated_sess.vip_until = vip_until;
            save_vip_session(&updated_sess);
        }
    }

    Ok(VipStatusResponse {
        is_vip,
        days_remaining,
        vip_until,
        hwid,
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
) -> Result<VipCreateResponse, String> {
    let hwid = get_machine_hwid();
    let sess = load_vip_session();

    let token = sess.vip_token.ok_or_else(|| {
        "VIP subscription required. Please activate your VIP license key first.".to_string()
    })?;

    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/create", api_base.trim_end_matches('/'));
    let clean_nick = if nickname.trim().is_empty() { "Host" } else { nickname.trim() };
    let clean_mode = mode.as_deref().unwrap_or("relay").trim().to_lowercase();
    let clean_is_modded = is_modded.unwrap_or(true);
    let clean_mod_mode = mod_mode.unwrap_or_else(|| "vanilla".to_string());
    let clean_enable_sdr = enable_sdr.unwrap_or(false);

    let body = serde_json::json!({
        "host_nickname": clean_nick,
        "mode": clean_mode,
        "is_modded": clean_is_modded,
        "mod_mode": clean_mod_mode,
        "enable_sdr": clean_enable_sdr,
        "hwid": hwid,
        "vip_token": token
    });

    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("Failed to reach Coordinator at {url}: {e}"))?;

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
    let relay_target = data["relay_target"].as_str().unwrap_or("5.57.32.52:28001").to_string();

    let (host_connect_cmd, client_connect_cmd) = if actual_mode == "relay" {
        start_host_relay(room_token, relay_target, 27005).await?;
        ("connect localhost:27005".to_string(), "connect localhost:27016".to_string())
    } else {
        start_lan_engine(room_token, vip, mask)?;
        (format!("connect {vip}:27005"), format!("connect {vip}:27005"))
    };

    Ok(VipCreateResponse {
        success: true,
        room_code: Some(room_code),
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
) -> Result<VipJoinResponse, String> {
    let hwid = get_machine_hwid();
    let sess = load_vip_session();

    let token = sess.vip_token.ok_or_else(|| {
        "VIP subscription required. Please activate your VIP license key first.".to_string()
    })?;

    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/join", api_base.trim_end_matches('/'));
    let clean_nick = if nickname.trim().is_empty() { "Player" } else { nickname.trim() };
    let body = serde_json::json!({
        "room_code": room_code.trim(),
        "nickname": clean_nick,
        "hwid": hwid,
        "vip_token": token
    });

    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| format!("Failed to join room at {url}: {e}"))?;

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
    let relay_target = data["relay_target"].as_str().unwrap_or("5.57.32.52:28001").to_string();
    let is_modded = data["is_modded"].as_bool().unwrap_or(false);
    let mod_mode = data["mod_mode"].as_str().unwrap_or("vanilla").to_string();
    let enable_sdr = data["enable_sdr"].as_bool().unwrap_or(false);

    let client_connect_cmd = if actual_mode == "relay" {
        start_client_relay(room_token, clean_nick.to_string(), relay_target, 27016).await?;
        "connect localhost:27016".to_string()
    } else {
        start_lan_engine(room_token, vip, mask)?;
        format!("connect {host_vip}:27005")
    };

    // Prepare client assets in background
    let _ = crate::lan_supervisor::prepare_modded_client(&mod_mode).await;

    Ok(VipJoinResponse {
        success: true,
        room_code: Some(room_code.trim().to_string()),
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
    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/status/{}", api_base.trim_end_matches('/'), room_code.trim());
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let status: VipRoomStatus = resp.json().await.map_err(|e| e.to_string())?;
    Ok(status)
}

pub async fn leave_vip_room(
    custom_api_url: Option<String>,
    room_code: String,
) -> Result<(), String> {
    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let hwid = get_machine_hwid();
    let url = format!("{}/api/room/{}", api_base.trim_end_matches('/'), room_code.trim());
    let mut req = client.delete(&url);
    if !hwid.is_empty() {
        req = req.header("X-HWID", hwid);
    }
    let _ = req.send().await;

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
) -> Result<(), String> {
    let hwid = get_machine_hwid();
    let sess = load_vip_session();
    let token = sess.vip_token.unwrap_or_default();

    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/{}/kick", api_base.trim_end_matches('/'), room_code.trim());
    let body = serde_json::json!({
        "hwid": hwid,
        "vip_token": token,
        "target_nickname": peer_name.trim(),
    });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Kick failed with status {}", resp.status()));
    }
    Ok(())
}

pub async fn ban_vip_peer(
    custom_api_url: Option<String>,
    room_code: String,
    peer_name: String,
) -> Result<(), String> {
    let hwid = get_machine_hwid();
    let sess = load_vip_session();
    let token = sess.vip_token.unwrap_or_default();

    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/{}/ban", api_base.trim_end_matches('/'), room_code.trim());
    let body = serde_json::json!({
        "hwid": hwid,
        "vip_token": token,
        "target_nickname": peer_name.trim(),
    });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Ban failed with status {}", resp.status()));
    }
    Ok(())
}

pub async fn unban_vip_peer(
    custom_api_url: Option<String>,
    room_code: String,
    peer_name: String,
) -> Result<(), String> {
    let hwid = get_machine_hwid();
    let sess = load_vip_session();
    let token = sess.vip_token.unwrap_or_default();

    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/{}/unban", api_base.trim_end_matches('/'), room_code.trim());
    let body = serde_json::json!({
        "hwid": hwid,
        "vip_token": token,
        "target_nickname": peer_name.trim(),
    });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Unban failed with status {}", resp.status()));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VipRoomSummary {
    pub room_code: String,
    pub host_nickname: Option<String>,
    pub mode: Option<String>,
    pub is_modded: Option<bool>,
    pub mod_mode: Option<String>,
    pub enable_sdr: Option<bool>,
    pub peer_count: Option<usize>,
}

pub async fn list_vip_rooms(
    custom_api_url: Option<String>,
) -> Result<Vec<VipRoomSummary>, String> {
    let api_base = custom_api_url.filter(|u| !u.trim().is_empty()).unwrap_or_else(|| DEFAULT_VIP_API.to_string());
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/api/room/list", api_base.trim_end_matches('/'));
    let resp = match client.get(&url).send().await {
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
