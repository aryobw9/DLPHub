// Match ID extraction from Deadlock console.log
// Passive file inspection of Source 2 logs generated with -condebug.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use regex::Regex;

/// Locate Deadlock console.log given a Deadlock root folder.
pub fn find_console_log(deadlock_root: &Path) -> Option<PathBuf> {
    let p = deadlock_root.join("game").join("citadel").join("console.log");
    if p.is_file() {
        Some(p)
    } else {
        None
    }
}

/// Extract the last 64-bit Match ID from raw log text.
pub fn extract_last_match_id_from_text(text: &str) -> Option<u64> {
    // Regex patterns matching Source 2 / SDR Deadlock output:
    // 1. SteamNetSockets tickets: "Received Steam datagram ticket ... match_id=108286877"
    // 2. SDR connection tickets: "Received SDR connection ticket: ... match_id: 1234567890"
    // 3. Lobby creation: "Lobby 174155846094236459 for Match 108286877 created"
    // 4. Broadcast streams: "Playing Broadcast ... /1234567890"
    let re = Regex::new(r"(?i)(?:match_id\s*[:=]\s*|for\s+Match\s+|Playing Broadcast.*?/)(\d+)").ok()?;

    let mut last_id: Option<u64> = None;

    for caps in re.captures_iter(text) {
        if let Some(m) = caps.get(1) {
            if let Ok(id) = m.as_str().parse::<u64>() {
                // Ignore zero or invalid trivial IDs
                if id > 0 {
                    last_id = Some(id);
                }
            }
        }
    }

    last_id
}

/// Extract the last Match ID from console.log with fast tail-seeking.
/// Reads the trailing 2MB for near-instant execution (<2ms).
/// Falls back to full file read if not found in the tail chunk.
pub fn extract_last_match_id_from_file(path: &Path) -> Result<u64, String> {
    let mut file = File::open(path).map_err(|e| format!("Cannot open console.log: {e}"))?;
    let metadata = file.metadata().map_err(|e| format!("Cannot read file metadata: {e}"))?;
    let file_len = metadata.len();

    if file_len == 0 {
        return Err("console.log is empty. Play or connect to a match first.".into());
    }

    const TAIL_CHUNK_SIZE: u64 = 2 * 1024 * 1024; // 2MB

    // Fast path: read the last 2MB
    let read_size = file_len.min(TAIL_CHUNK_SIZE);
    let seek_pos = file_len.saturating_sub(read_size);
    file.seek(SeekFrom::Start(seek_pos))
        .map_err(|e| format!("Seek failed: {e}"))?;

    let mut buffer = vec![0u8; read_size as usize];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Read failed: {e}"))?;

    let tail_text = String::from_utf8_lossy(&buffer);
    if let Some(id) = extract_last_match_id_from_text(&tail_text) {
        return Ok(id);
    }

    // Fallback: If the log is larger than 256KB and had a large burst of lines
    // after match initialization, search the full file.
    if file_len > TAIL_CHUNK_SIZE {
        file.seek(SeekFrom::Start(0))
            .map_err(|e| format!("Full seek failed: {e}"))?;
        let mut full_buffer = Vec::with_capacity(file_len as usize);
        file.read_to_end(&mut full_buffer)
            .map_err(|e| format!("Full read failed: {e}"))?;
        let full_text = String::from_utf8_lossy(&full_buffer);
        if let Some(id) = extract_last_match_id_from_text(&full_text) {
            return Ok(id);
        }
    }

    // Check if the log file hasn't been updated in a while (e.g. game ran without -condebug)
    let is_stale = metadata
        .modified()
        .ok()
        .and_then(|t| t.elapsed().ok())
        .map(|d| d.as_secs() > 7200) // older than 2 hours
        .unwrap_or(false);

    if is_stale {
        return Err("Deadlock is not writing to console.log because '-condebug' is missing from Steam. Please right-click Deadlock in Steam -> Properties -> In 'Launch Options', type: -condebug -conclearlog (then restart Deadlock).".into());
    }

    Err("No Deadlock match ID found in console.log. Ensure you played or loaded into a match with -condebug enabled.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_sdr_ticket() {
        let log = r#"
[Client] Connecting to =[A:1:2847921:28491]...
[Networking] Received SDR connection ticket: routing_data: "test" match_id: 3418291048 player_id: 76561198000000000
[Client] Connected!
"#;
        assert_eq!(extract_last_match_id_from_text(log), Some(3418291048));
    }

    #[test]
    fn test_extract_plain_match_id() {
        let log = "Entering match with match_id: 9918237412 on server ams";
        assert_eq!(extract_last_match_id_from_text(log), Some(9918237412));
    }

    #[test]
    fn test_extract_playing_broadcast() {
        let log = "Playing Broadcast replay/live stream http://valve.relay/3344556677";
        assert_eq!(extract_last_match_id_from_text(log), Some(3344556677));
    }

    #[test]
    fn test_picks_most_recent_match() {
        let log = r#"
match_id: 1111111111
Game over.
Next game starting:
Received SDR connection ticket: match_id: 2222222222
"#;
        assert_eq!(extract_last_match_id_from_text(log), Some(2222222222));
    }

    #[test]
    fn test_extract_datagram_ticket_equals() {
        let log = r#"09/28 18:09:25 [SteamNetSockets] Received Steam datagram ticket for server steamid:90293608842076177 vport -1. match_id=108286877"#;
        assert_eq!(extract_last_match_id_from_text(log), Some(108286877));
    }

    #[test]
    fn test_extract_lobby_for_match() {
        let log = r#"09/28 18:09:25 Lobby 174155846094236459 for Match 108286877 created"#;
        assert_eq!(extract_last_match_id_from_text(log), Some(108286877));
    }

    #[test]
    fn test_live_file_on_machine_if_exists() {
        let live_path = PathBuf::from(r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\console.log");
        if live_path.is_file() {
            let res = extract_last_match_id_from_file(&live_path);
            assert!(res.is_ok(), "Expected live match id extraction to succeed: {:?}", res);
            assert!(res.unwrap() > 0);
        }
    }

    #[test]
    fn test_empty_or_unrelated_log() {
        let log = "Loading resource: sound/weapons/gun_fire.vsnd_c\nFrame time: 16.6ms";
        assert_eq!(extract_last_match_id_from_text(log), None);
    }
}
