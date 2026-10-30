// DLPHub Deadlock UDP Loopback Identity Proxy
//
// Solves the Source 2 / GNS "Bad identity" (k_EResultAccessDenied) error:
// When running `deadlock.exe -dedicated +sv_lan 1 -insecure`, the engine only
// accepts unauthenticated connections originating from loopback (127.0.0.1) or local subnet.
// External clients across WAN or virtual LAN (WireGuard/PacketCraft/etc.) get rejected.
//
// This proxy binds to 0.0.0.0:<public_port> (default 27015), maps each client's address
// to an isolated loopback socket (127.0.0.1:0), and forwards datagrams to 127.0.0.1:<internal_port> (default 27005).
// The dedicated server perceives all connections as coming from 127.0.0.1, bypassing the identity check.
// Server responses are transparently routed back to the client's real IP and port.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

pub struct ProxyConfig {
    pub bind_ip: String,
    pub public_port: u16,
    pub internal_port: u16,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            bind_ip: "0.0.0.0".to_string(),
            public_port: 27005,
            internal_port: 27006,
        }
    }
}

pub struct ProxyHandle {
    stop_flag: Arc<AtomicBool>,
}

impl ProxyHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::SeqCst);
    }
}

struct ClientSession {
    relay_socket: Arc<UdpSocket>,
    last_active: Arc<AtomicU64>,
}

pub async fn start_udp_proxy(config: ProxyConfig) -> Result<ProxyHandle, String> {
    let bind_addr: SocketAddr = format!("{}:{}", config.bind_ip, config.public_port)
        .parse()
        .map_err(|e| format!("Invalid bind address: {e}"))?;

    let public_socket = Arc::new(
        UdpSocket::bind(bind_addr)
            .await
            .map_err(|e| format!("Failed to bind public proxy on {bind_addr}: {e}"))?,
    );

    let internal_addr: SocketAddr = format!("127.0.0.1:{}", config.internal_port)
        .parse()
        .map_err(|e| format!("Invalid internal target address: {e}"))?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let sessions: Arc<RwLock<HashMap<SocketAddr, ClientSession>>> =
        Arc::new(RwLock::new(HashMap::new()));

    let stop_for_loop = Arc::clone(&stop_flag);
    let public_sock_for_loop = Arc::clone(&public_socket);
    let sessions_for_loop = Arc::clone(&sessions);

    // Main ingress listening loop
    tokio::spawn(async move {
        let mut buf = vec![0u8; 65535];
        let epoch = Instant::now();

        while !stop_for_loop.load(Ordering::Relaxed) {
            // Non-blocking or timeout recv to allow graceful shutdown
            let recv_res = tokio::time::timeout(
                Duration::from_millis(500),
                public_sock_for_loop.recv_from(&mut buf),
            )
            .await;

            match recv_res {
                Ok(Ok((len, client_addr))) => {
                    let now_secs = epoch.elapsed().as_secs();

                    // Check if session already exists
                    let session_opt = {
                        let read_guard = sessions_for_loop.read().await;
                        read_guard
                            .get(&client_addr)
                            .map(|s| (Arc::clone(&s.relay_socket), Arc::clone(&s.last_active)))
                    };

                    let relay_sock = match session_opt {
                        Some((sock, last_act)) => {
                            last_act.store(now_secs, Ordering::Relaxed);
                            sock
                        }
                        None => {
                            if sessions_for_loop.read().await.len() >= 64 {
                                continue;
                            }
                            // Create new local loopback relay socket
                            let local_bind: SocketAddr = "127.0.0.1:0".parse().unwrap();
                            match UdpSocket::bind(local_bind).await {
                                Ok(new_sock) => {
                                    let new_sock_arc = Arc::new(new_sock);
                                    let last_act = Arc::new(AtomicU64::new(now_secs));

                                    {
                                        let mut write_guard = sessions_for_loop.write().await;
                                        write_guard.insert(
                                            client_addr,
                                            ClientSession {
                                                relay_socket: Arc::clone(&new_sock_arc),
                                                last_active: Arc::clone(&last_act),
                                            },
                                        );
                                    }

                                    // Spawn background response relay loop for this client
                                    let sock_for_resp = Arc::clone(&new_sock_arc);
                                    let pub_for_resp = Arc::clone(&public_sock_for_loop);
                                    let stop_for_resp = Arc::clone(&stop_for_loop);
                                    let last_act_for_resp = Arc::clone(&last_act);
                                    let sessions_for_cleanup = Arc::clone(&sessions_for_loop);

                                    tokio::spawn(async move {
                                        let mut resp_buf = vec![0u8; 65535];
                                        while !stop_for_resp.load(Ordering::Relaxed) {
                                            let resp_res = tokio::time::timeout(
                                                Duration::from_secs(10),
                                                sock_for_resp.recv_from(&mut resp_buf),
                                            )
                                            .await;

                                            match resp_res {
                                                Ok(Ok((rn, _))) => {
                                                    last_act_for_resp
                                                        .store(epoch.elapsed().as_secs(), Ordering::Relaxed);
                                                    let _ = pub_for_resp
                                                        .send_to(&resp_buf[..rn], client_addr)
                                                        .await;
                                                }
                                                Ok(Err(_)) => break,
                                                Err(_) => {
                                                    // Inactivity timeout check (120s)
                                                    let idle = epoch
                                                        .elapsed()
                                                        .as_secs()
                                                        .saturating_sub(
                                                            last_act_for_resp.load(Ordering::Relaxed),
                                                        );
                                                    if idle > 120 {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                        sessions_for_cleanup.write().await.remove(&client_addr);
                                    });

                                    new_sock_arc
                                }
                                Err(_) => continue,
                            }
                        }
                    };

                    // Forward client packet to Deadlock internal dedicated server
                    let _ = relay_sock.send_to(&buf[..len], internal_addr).await;
                }
                Ok(Err(_)) => {}
                Err(_) => {} // Timeout tick, check stop_flag
            }
        }

        // Cleanup: clear all sessions
        sessions_for_loop.write().await.clear();
    });

    Ok(ProxyHandle { stop_flag })
}
