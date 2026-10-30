// DLPHub High-Speed In-House UDP Port Relay Module
// Provides zero-driver, zero-admin, zero-network-adapter connection to Iranian VPS relay
//
// Host Mode:
// - Communicates with VPS on `5.57.32.52:<relay_port>`
// - Demultiplexes incoming packets by 2-byte client_id into local virtual UDP sockets on 127.0.0.1
// - Sends game packets to local dedicated server on 127.0.0.1:27005 (or 27015)
// - Streams dedicated server responses back to VPS tagged with client_id
//
// Client Mode:
// - Listens on 127.0.0.1:<local_port> (default 27016)
// - Streams Deadlock packets to VPS on `5.57.32.52:<relay_port>`
// - Streams VPS responses back to Deadlock client on 127.0.0.1:27016

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

const MAGIC_RELAY_HOST: &[u8] = b"DLPH";
const MAGIC_RELAY_CLIENT: &[u8] = b"DLPC";

static RELAY_RUNNING: AtomicBool = AtomicBool::new(false);
static RELAY_STOP_SIGNAL: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();

fn get_stop_signal() -> Arc<AtomicBool> {
    RELAY_STOP_SIGNAL.get_or_init(|| Arc::new(AtomicBool::new(false))).clone()
}

#[allow(dead_code)]
pub fn is_relay_active() -> bool {
    RELAY_RUNNING.load(Ordering::SeqCst)
}

pub fn stop_relay() {
    let stop_sig = get_stop_signal();
    stop_sig.store(true, Ordering::SeqCst);
    RELAY_RUNNING.store(false, Ordering::SeqCst);
}

/// Host Relay: receives multiplexed client packets from VPS relay and forwards to local dedicated server
pub async fn start_host_relay(
    room_token: u32,
    vps_addr_str: String,
    _internal_server_port: u16,
) -> Result<(), String> {
    stop_relay();
    tokio::time::sleep(Duration::from_millis(100)).await;

    let stop_sig = get_stop_signal();
    stop_sig.store(false, Ordering::SeqCst);

    let vps_addr: SocketAddr = vps_addr_str
        .parse()
        .map_err(|e| format!("Invalid VPS relay address '{vps_addr_str}': {e}"))?;

    let relay_sock = Arc::new(
        UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Failed to bind local relay UDP socket: {e}"))?,
    );

    let target_dedicated: SocketAddr = "127.0.0.1:27005".parse().unwrap();
    let target_listen: SocketAddr = "127.0.0.1:27015".parse().unwrap();

    RELAY_RUNNING.store(true, Ordering::SeqCst);

    // 1. Host Keepalive task
    let keepalive_stop = stop_sig.clone();
    let keepalive_sock = relay_sock.clone();
    tokio::spawn(async move {
        let mut msg = Vec::with_capacity(8);
        msg.extend_from_slice(MAGIC_RELAY_HOST);
        msg.extend_from_slice(&room_token.to_be_bytes());

        while !keepalive_stop.load(Ordering::Relaxed) {
            let _ = keepalive_sock.send_to(&msg, vps_addr).await;
            for _ in 0..30 {
                if keepalive_stop.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    });

    // 2. Incoming Demultiplexer task
    let demux_stop = stop_sig.clone();
    let demux_relay_sock = relay_sock.clone();
    let client_sockets: Arc<RwLock<HashMap<u16, Arc<UdpSocket>>>> =
        Arc::new(RwLock::new(HashMap::new()));

    tokio::spawn(async move {
        let mut buf = vec![0u8; 65535];

        while !demux_stop.load(Ordering::Relaxed) {
            let recv_res = tokio::time::timeout(
                Duration::from_millis(500),
                demux_relay_sock.recv_from(&mut buf),
            )
            .await;

            match recv_res {
                Ok(Ok((len, src))) => {
                    if src == vps_addr && len > 2 {
                        let client_id = u16::from_be_bytes([buf[0], buf[1]]);
                        let payload = &buf[2..len];

                        // Lookup or create virtual loopback socket for client_id
                        let sock_opt = {
                            let map = client_sockets.read().await;
                            map.get(&client_id).cloned()
                        };

                        let virtual_sock = match sock_opt {
                            Some(s) => s,
                            None => {
                                if client_sockets.read().await.len() >= 64 {
                                    continue;
                                }
                                match UdpSocket::bind("127.0.0.1:0").await {
                                    Ok(vs) => {
                                        let vs_arc = Arc::new(vs);
                                        client_sockets.write().await.insert(client_id, vs_arc.clone());

                                        // Spawn response reader from dedicated server back to relay
                                        let vs_reader = vs_arc.clone();
                                        let vs_relay = demux_relay_sock.clone();
                                        let vs_stop = demux_stop.clone();
                                        let vs_sockets = client_sockets.clone();
                                        tokio::spawn(async move {
                                            let mut r_buf = vec![0u8; 65535];
                                            let mut idle_ticks: u32 = 0;
                                            while !vs_stop.load(Ordering::Relaxed) {
                                                let r_res = tokio::time::timeout(
                                                    Duration::from_millis(500),
                                                    vs_reader.recv_from(&mut r_buf),
                                                )
                                                .await;

                                                match r_res {
                                                    Ok(Ok((r_len, _))) => {
                                                        idle_ticks = 0;
                                                        let mut out = Vec::with_capacity(r_len + 2);
                                                        out.extend_from_slice(&client_id.to_be_bytes());
                                                        out.extend_from_slice(&r_buf[..r_len]);
                                                        let _ = vs_relay.send_to(&out, vps_addr).await;
                                                    }
                                                    Ok(Err(_)) => break,
                                                    Err(_) => {
                                                        idle_ticks += 1;
                                                        if idle_ticks >= 240 {
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            vs_sockets.write().await.remove(&client_id);
                                        });

                                        vs_arc
                                    }
                                    Err(_) => continue,
                                }
                            }
                        };

                        let target = if crate::lan_supervisor::get_server_status().is_running {
                            target_dedicated
                        } else {
                            target_listen
                        };
                        let _ = virtual_sock.send_to(payload, target).await;
                    }
                }
                Ok(Err(_)) => break,
                Err(_) => {}
            }
        }
    });

    Ok(())
}

/// Client Relay: listens locally on 127.0.0.1:<local_port> and forwards UDP to VPS relay
pub async fn start_client_relay(
    room_token: u32,
    nickname: String,
    vps_addr_str: String,
    local_port: u16,
) -> Result<(), String> {
    stop_relay();
    tokio::time::sleep(Duration::from_millis(100)).await;

    let stop_sig = get_stop_signal();
    stop_sig.store(false, Ordering::SeqCst);

    let vps_addr: SocketAddr = vps_addr_str
        .parse()
        .map_err(|e| format!("Invalid VPS relay address '{vps_addr_str}': {e}"))?;

    let local_sock = Arc::new(
        UdpSocket::bind(format!("127.0.0.1:{local_port}"))
            .await
            .map_err(|e| format!("Failed to bind client local proxy on port {local_port}: {e}"))?,
    );

    let relay_sock = Arc::new(
        UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Failed to bind client relay egress socket: {e}"))?,
    );

    RELAY_RUNNING.store(true, Ordering::SeqCst);

    // 1. Keepalive task
    let keepalive_stop = stop_sig.clone();
    let keepalive_sock = relay_sock.clone();
    let nick_bytes = nickname.into_bytes();
    tokio::spawn(async move {
        let mut msg = Vec::with_capacity(8 + nick_bytes.len());
        msg.extend_from_slice(MAGIC_RELAY_CLIENT);
        msg.extend_from_slice(&room_token.to_be_bytes());
        msg.extend_from_slice(&nick_bytes);

        while !keepalive_stop.load(Ordering::Relaxed) {
            let _ = keepalive_sock.send_to(&msg, vps_addr).await;
            for _ in 0..30 {
                if keepalive_stop.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    });

    let client_target_addr: Arc<RwLock<Option<SocketAddr>>> = Arc::new(RwLock::new(None));

    // 2. Deadlock -> Relay (Ingress)
    let ing_stop = stop_sig.clone();
    let ing_local = local_sock.clone();
    let ing_relay = relay_sock.clone();
    let ing_target = client_target_addr.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; 65535];
        while !ing_stop.load(Ordering::Relaxed) {
            let recv_res = tokio::time::timeout(
                Duration::from_millis(500),
                ing_local.recv_from(&mut buf),
            )
            .await;

            match recv_res {
                Ok(Ok((len, src))) => {
                    *ing_target.write().await = Some(src);
                    let _ = ing_relay.send_to(&buf[..len], vps_addr).await;
                }
                Ok(Err(_)) => break,
                Err(_) => {}
            }
        }
    });

    // 3. Relay -> Deadlock (Egress)
    let eg_stop = stop_sig.clone();
    let eg_local = local_sock.clone();
    let eg_relay = relay_sock.clone();
    let eg_target = client_target_addr.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; 65535];
        while !eg_stop.load(Ordering::Relaxed) {
            let recv_res = tokio::time::timeout(
                Duration::from_millis(500),
                eg_relay.recv_from(&mut buf),
            )
            .await;

            match recv_res {
                Ok(Ok((len, src))) => {
                    if src == vps_addr {
                        let target_opt = *eg_target.read().await;
                        if let Some(target) = target_opt {
                            let _ = eg_local.send_to(&buf[..len], target).await;
                        }
                    }
                }
                Ok(Err(_)) => break,
                Err(_) => {}
            }
        }
    });

    Ok(())
}
