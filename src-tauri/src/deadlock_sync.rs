// Deadlock Custom Match Synchronization & Webhook Service
// Reads the most recent Match ID from citadel/console.log and dispatches it to your API.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// =========================================================================
// Configuration: Update these constants with your website / API endpoint
// =========================================================================
pub const DEFAULT_WEBHOOK_URL: &str = "https://your-api.com/api/matches/report";
pub const DEFAULT_AUTH_TOKEN: Option<&str> = None; // e.g., Some("Bearer your_secret_key_here")

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchSyncResult {
    pub success: bool,
    pub match_id: Option<String>,
    pub message: String,
    pub http_status: Option<u16>,
    pub is_placeholder_url: bool,
}

#[derive(Debug, Serialize)]
struct MatchWebhookPayload {
    match_id: String,
    source: String,
    detected_at: u64,
}

/// Resolve the absolute path to Deadlock's console.log.
pub fn resolve_console_log() -> Result<PathBuf, String> {
    // 1. Try settings last_path first
    let s = dlp_core::settings::load();
    if let Some(p) = s.last_path {
        if !p.trim().is_empty() {
            let candidate = Path::new(&p).join("game").join("citadel").join("console.log");
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    // 2. Fall back to automatic discovery via Steam registry / libraries
    if let Some(found) = dlp_core::discovery::find_game() {
        let candidate = Path::new(&found.deadlock).join("game").join("citadel").join("console.log");
        if candidate.is_file() {
            return Ok(candidate);
        }
        return Err(format!(
            "Deadlock folder located, but 'console.log' does not exist yet. Please launch Deadlock with -condebug enabled at least once."
        ));
    }

    Err("Deadlock installation folder could not be located. Please locate the game in DLPHub first.".into())
}

/// Query the last detected Match ID without sending any webhook (read-only).
#[tauri::command]
pub fn get_last_match_id() -> Result<String, String> {
    let log_path = resolve_console_log()?;
    let id = dlp_core::match_id::extract_last_match_id_from_file(&log_path)?;
    Ok(id.to_string())
}

/// Locate console.log, extract the last Match ID, and post to the configured Webhook API.
#[tauri::command]
pub async fn sync_last_match(
    custom_endpoint: Option<String>,
    custom_token: Option<String>,
) -> Result<MatchSyncResult, String> {
    // 1. Locate console.log
    let log_path = resolve_console_log()?;

    // 2. Extract the most recent match_id
    let match_id = dlp_core::match_id::extract_last_match_id_from_file(&log_path)?;
    let match_id_str = match_id.to_string();

    // 3. Determine endpoint & auth token
    let endpoint = custom_endpoint
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_WEBHOOK_URL.to_string());

    let token = custom_token
        .filter(|s| !s.trim().is_empty())
        .or_else(|| DEFAULT_AUTH_TOKEN.map(|s| s.to_string()));

    // 4. Safe placeholder check:
    // If the endpoint is still the default placeholder, do not make a failing HTTP call.
    // Return a successful detection result so the user can test the button by hand immediately!
    if endpoint == "https://your-api.com/api/matches/report" {
        return Ok(MatchSyncResult {
            success: true,
            match_id: Some(match_id_str.clone()),
            message: format!(
                "Match #{match_id_str} detected successfully! (Webhook is currently using the placeholder URL. Update DEFAULT_WEBHOOK_URL in src-tauri/src/deadlock_sync.rs when your API is ready)",
            ),
            http_status: None,
            is_placeholder_url: true,
        });
    }

    // 5. Build HTTP request
    let client = reqwest::Client::builder()
        .user_agent("DLPHub-MatchSync/0.1")
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let payload = MatchWebhookPayload {
        match_id: match_id_str.clone(),
        source: "dlphub_sync_button".to_string(),
        detected_at: now_secs,
    };

    let mut req = client.post(&endpoint).json(&payload);

    if let Some(auth) = token {
        req = req.header("Authorization", auth);
    }

    // 6. Send request
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Webhook request failed: {e}"))?;

    let status = resp.status();
    let status_code = status.as_u16();

    if status.is_success() {
        Ok(MatchSyncResult {
            success: true,
            match_id: Some(match_id_str.clone()),
            message: format!("Match #{match_id_str} reported successfully to API! (HTTP {status_code})"),
            http_status: Some(status_code),
            is_placeholder_url: false,
        })
    } else {
        let err_body = resp
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());
        Ok(MatchSyncResult {
            success: false,
            match_id: Some(match_id_str),
            message: format!("Server returned error {status_code}: {err_body}"),
            http_status: Some(status_code),
            is_placeholder_url: false,
        })
    }
}
