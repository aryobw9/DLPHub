// DLPHub Source 2 A2S Server Query Protocol Implementation
// Standard Valve A2S_INFO query over UDP with challenge handling.

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A2SServerInfo {
    pub server_name: String,
    pub map_name: String,
    pub game_folder: String,
    pub game_desc: String,
    pub players: u8,
    pub max_players: u8,
    pub bots: u8,
    pub ping_ms: u64,
    pub online: bool,
}

pub async fn query_a2s_info(ip: &str, port: u16) -> Result<A2SServerInfo, String> {
    let target_addr: SocketAddr = format!("{ip}:{port}")
        .parse()
        .map_err(|e| format!("Invalid server address {ip}:{port}: {e}"))?;

    let socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("Failed to bind query socket: {e}"))?;

    // Standard Source Engine A2S_INFO Query Packet
    // Header: \xFF\xFF\xFF\xFF (4 bytes) + 'T' (0x54) + "Source Engine Query\0"
    let mut query_packet = vec![
        0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67,
        0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00,
    ];

    let start = Instant::now();
    socket
        .send_to(&query_packet, target_addr)
        .await
        .map_err(|e| format!("Failed to send query packet: {e}"))?;

    let mut buf = vec![0u8; 2048];
    let (mut len, _) = tokio::time::timeout(Duration::from_millis(2500), socket.recv_from(&mut buf))
        .await
        .map_err(|_| "Server query timed out (server offline or port blocked)".to_string())?
        .map_err(|e| format!("Failed to receive query response: {e}"))?;

    let mut ping_ms = start.elapsed().as_millis() as u64;

    // Check if response is challenge (0x41)
    if len >= 9 && buf[4] == 0x41 {
        let challenge = &buf[5..9];
        // Append 4-byte challenge to query and retry
        query_packet.extend_from_slice(challenge);

        let retry_start = Instant::now();
        socket
            .send_to(&query_packet, target_addr)
            .await
            .map_err(|e| format!("Failed to resend query with challenge: {e}"))?;

        len = tokio::time::timeout(Duration::from_millis(2500), socket.recv_from(&mut buf))
            .await
            .map_err(|_| "Challenge response timed out".to_string())?
            .map_err(|e| format!("Failed to receive challenge response: {e}"))?
            .0;

        ping_ms = retry_start.elapsed().as_millis() as u64;
    }

    // Expect 0x49 (A2S_INFO Response) and at least 6 bytes (4 header + 1 type + 1 protocol byte)
    if len < 6 || buf[4] != 0x49 {
        return Err(format!(
            "Unexpected or truncated packet response from server (len: {len}, type: 0x{:02X})",
            if len > 4 { buf[4] } else { 0 }
        ));
    }

    // Parse payload starting at offset 5 (protocol version)
    let payload = &buf[5..len];
    let mut cursor = 1; // skip protocol byte

    let server_name = read_null_term_string(payload, &mut cursor);
    let map_name = read_null_term_string(payload, &mut cursor);
    let game_folder = read_null_term_string(payload, &mut cursor);
    let game_desc = read_null_term_string(payload, &mut cursor);

    // Skip AppID (2 bytes safely)
    cursor = (cursor + 2).min(payload.len());

    let players = if cursor < payload.len() {
        let p = payload[cursor];
        cursor += 1;
        p
    } else {
        0
    };

    let max_players = if cursor < payload.len() {
        let mp = payload[cursor];
        cursor += 1;
        mp
    } else {
        12
    };

    let bots = if cursor < payload.len() {
        let b = payload[cursor];
        b
    } else {
        0
    };

    Ok(A2SServerInfo {
        server_name,
        map_name,
        game_folder,
        game_desc,
        players,
        max_players,
        bots,
        ping_ms,
        online: true,
    })
}

fn read_null_term_string(data: &[u8], cursor: &mut usize) -> String {
    let mut bytes = Vec::new();
    while *cursor < data.len() {
        let b = data[*cursor];
        *cursor += 1;
        if b == 0 {
            break;
        }
        bytes.push(b);
    }
    String::from_utf8_lossy(&bytes).to_string()
}
