#!/usr/bin/env python3
"""
DLPHub Dedicated In-House LAN Router Service v2.4 (Super-Secure VIP License Edition)
Runs on Iran VPS (5.57.32.52):
- TCP 48080: REST API for room creation, joining, status, health, and VIP license management
- Dynamic UDP (28001-28249): Dedicated zero-driver UDP Port Relays (Relay Mode)
- UDP 48000: High-speed async UDP game packet switch for Wintun mesh
- Zero-Trust Cryptographic VIP Licensing:
  * Hardware ID (HWID) Device Fingerprinting
  * N-time-use keys with customizable duration
  * Server-side HMAC-SHA256 Signed Session Tokens (cannot be forged even if client is open-sourced)
  * Server-side VIP enforcement: room creation and join rejected without valid cryptographic token
  * Full Admin Console API for key generation, listing, revocation, and device banning
- Security Hardened:
  * Anti-Spoofing, Rate Limiting, Capacity Limits
  * Unprivileged system user (dlplan)
"""

import asyncio
import os
import random
import secrets
import socket
import sqlite3
import struct
import time
import hmac
import hashlib
from typing import Dict, Tuple, Optional, List, Any
from fastapi import FastAPI, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse
from pydantic import BaseModel, Field
import uvicorn

BASE_DIR = "/opt/dlp-lan-server"
DB_PATH = os.path.join(BASE_DIR, "vip_licenses.db")
ADMIN_SECRET_FILE = os.path.join(BASE_DIR, ".admin_secret")
HMAC_SECRET_FILE = os.path.join(BASE_DIR, ".hmac_secret")

VPS_PUBLIC_IP = "5.57.32.52"
UDP_PORT = 48000
HTTP_PORT = 48080
MAX_ACTIVE_ROOMS = 100

MAGIC_BYTES = b"DLP1"
TYPE_HANDSHAKE = 0x01
TYPE_PONG = 0x02
TYPE_PACKET = 0x03
TYPE_LEAVE = 0x04

MAGIC_RELAY_HOST = b"DLPH"
MAGIC_RELAY_CLIENT = b"DLPC"
MAGIC_RELAY_ACK = b"DLPA"
MAGIC_RELAY_PONG = b"DLPO"

# Initialize Secrets
def load_or_create_secret(filepath: str) -> str:
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            val = f.read().strip()
            if val:
                return val
    secret = secrets.token_hex(32)
    with open(filepath, "w") as f:
        f.write(secret)
    try:
        os.chmod(filepath, 0o600)
    except Exception:
        pass
    return secret

ADMIN_SECRET = load_or_create_secret(ADMIN_SECRET_FILE)
HMAC_SECRET = load_or_create_secret(HMAC_SECRET_FILE)

# ----------------- VIP License Manager -----------------
class LicenseManager:
    def __init__(self, db_path: str = DB_PATH, hmac_secret: str = HMAC_SECRET):
        self.db_path = db_path
        self.hmac_secret = hmac_secret
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS licenses (
                    key TEXT PRIMARY KEY,
                    max_uses INTEGER NOT NULL DEFAULT 1,
                    times_used INTEGER NOT NULL DEFAULT 0,
                    duration_seconds INTEGER NOT NULL DEFAULT 2592000,
                    created_at REAL NOT NULL,
                    expires_at REAL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    note TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS activations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    license_key TEXT NOT NULL,
                    hwid TEXT NOT NULL,
                    nickname TEXT,
                    activated_at REAL NOT NULL,
                    vip_until REAL NOT NULL,
                    last_seen REAL NOT NULL,
                    is_revoked INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(license_key) REFERENCES licenses(key)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_activations_hwid ON activations(hwid)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_activations_key ON activations(license_key)")
            conn.commit()

    def create_licenses(self, count: int, duration_seconds: int, max_uses: int = 1, note: str = "", prefix: str = "DLP-VIP") -> List[str]:
        keys = []
        now = time.time()
        with self._get_conn() as conn:
            for _ in range(count):
                p1 = secrets.token_hex(2).upper()
                p2 = secrets.token_hex(2).upper()
                p3 = secrets.token_hex(2).upper()
                key = f"{prefix}-{p1}-{p2}-{p3}"
                conn.execute(
                    "INSERT INTO licenses (key, max_uses, times_used, duration_seconds, created_at, is_active, note) VALUES (?, ?, 0, ?, ?, 1, ?)",
                    (key, max_uses, duration_seconds, now, note)
                )
                keys.append(key)
            conn.commit()
        return keys

    def generate_token(self, hwid: str, vip_until: float, activated_at: float) -> str:
        payload = f"{hwid}:{int(vip_until)}:{int(activated_at)}"
        sig = hmac.new(self.hmac_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return f"{payload}:{sig}"

    def verify_token(self, token: str, expected_hwid: str) -> Tuple[bool, str]:
        if not token or not expected_hwid:
            return False, "Missing token or HWID"
        parts = token.split(":")
        if len(parts) != 4:
            return False, "Malformed token structure"
        hwid, vip_until_s, act_at_s, sig = parts
        if hwid != expected_hwid:
            return False, "Device hardware ID mismatch"

        payload = f"{hwid}:{vip_until_s}:{act_at_s}"
        expected_sig = hmac.new(self.hmac_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return False, "Invalid token cryptographic signature"

        vip_until = float(vip_until_s)
        now = time.time()
        if now > vip_until:
            return False, "VIP subscription expired"

        # Check revocation in DB
        with self._get_conn() as conn:
            cur = conn.execute("SELECT is_revoked FROM activations WHERE hwid = ? ORDER BY vip_until DESC LIMIT 1", (hwid,))
            row = cur.fetchone()
            if row and row["is_revoked"]:
                return False, "Device hardware ID is revoked/banned"

        return True, "Valid"

    def redeem_key(self, key: str, hwid: str, nickname: str = "Player") -> Dict[str, Any]:
        key = key.strip().upper()
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM licenses WHERE key = ?", (key,))
            lic = cur.fetchone()
            if not lic:
                return {"success": False, "error": "Invalid license key"}
            if not lic["is_active"]:
                return {"success": False, "error": "License key is deactivated or revoked"}
            if lic["expires_at"] and now > lic["expires_at"]:
                return {"success": False, "error": "License key has expired before redemption"}

            # Check if this hwid already activated this key
            cur = conn.execute("SELECT * FROM activations WHERE license_key = ? AND hwid = ?", (key, hwid))
            existing = cur.fetchone()
            if existing:
                if existing["is_revoked"]:
                    return {"success": False, "error": "This device has been revoked"}
                vip_until = existing["vip_until"]
                if vip_until < now:
                    return {"success": False, "error": "This key has already expired on this device"}
                token = self.generate_token(hwid, vip_until, existing["activated_at"])
                return {
                    "success": True,
                    "vip_token": token,
                    "vip_until": vip_until,
                    "duration_seconds": lic["duration_seconds"],
                    "days_remaining": round((vip_until - now) / 86400.0, 1),
                    "message": "License refreshed successfully"
                }

            # Check max_uses
            if lic["times_used"] >= lic["max_uses"]:
                return {
                    "success": False,
                    "error": f"Key activation limit reached (Used {lic['times_used']}/{lic['max_uses']} times)"
                }

            # Cumulative extension: add duration onto existing active subscription if any
            cur = conn.execute("SELECT MAX(vip_until) as max_until FROM activations WHERE hwid = ? AND is_revoked = 0", (hwid,))
            user_existing = cur.fetchone()
            base_time = now
            if user_existing and user_existing["max_until"] and user_existing["max_until"] > now:
                base_time = user_existing["max_until"]

            vip_until = base_time + lic["duration_seconds"]

            conn.execute("UPDATE licenses SET times_used = times_used + 1 WHERE key = ?", (key,))
            conn.execute(
                "INSERT INTO activations (license_key, hwid, nickname, activated_at, vip_until, last_seen, is_revoked) VALUES (?, ?, ?, ?, ?, ?, 0)",
                (key, hwid, nickname, now, vip_until, now)
            )
            conn.commit()

            token = self.generate_token(hwid, vip_until, now)
            days_rem = round((vip_until - now) / 86400.0, 1)
            return {
                "success": True,
                "vip_token": token,
                "vip_until": vip_until,
                "duration_seconds": lic["duration_seconds"],
                "days_remaining": days_rem,
                "message": f"VIP activated successfully! ({days_rem} days remaining)"
            }

    def check_vip_status(self, hwid: str, token: Optional[str] = None) -> Dict[str, Any]:
        now = time.time()
        if token:
            valid, _ = self.verify_token(token, hwid)
            if valid:
                parts = token.split(":")
                vip_until = float(parts[1])
                remaining_sec = max(0.0, vip_until - now)
                return {
                    "is_vip": True,
                    "vip_until": vip_until,
                    "seconds_remaining": int(remaining_sec),
                    "days_remaining": round(remaining_sec / 86400.0, 1),
                    "vip_token": token
                }

        # Fallback to DB query for this HWID
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM activations WHERE hwid = ? AND is_revoked = 0 ORDER BY vip_until DESC LIMIT 1", (hwid,))
            act = cur.fetchone()
            if act and act["vip_until"] > now:
                vip_until = act["vip_until"]
                token = self.generate_token(hwid, vip_until, act["activated_at"])
                remaining_sec = vip_until - now
                return {
                    "is_vip": True,
                    "vip_until": vip_until,
                    "seconds_remaining": int(remaining_sec),
                    "days_remaining": round(remaining_sec / 86400.0, 1),
                    "vip_token": token
                }

        return {"is_vip": False, "reason": "No active VIP subscription"}

license_mgr = LicenseManager()

# ----------------- FastAPI App -----------------
app = FastAPI(title="DLPHub LAN Engine & VIP License Server", version="2.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_admin_key(x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key")):
    if not x_admin_key or not hmac.compare_digest(x_admin_key.strip(), ADMIN_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Admin Secret Key")

# ----------------- Models -----------------
class RedeemKeyReq(BaseModel):
    license_key: str = Field(..., max_length=64)
    hwid: str = Field(..., max_length=128)
    nickname: Optional[str] = Field("Player", max_length=32)

class CheckVipReq(BaseModel):
    hwid: str = Field(..., max_length=128)
    vip_token: Optional[str] = Field(None, max_length=512)

class AdminGenerateKeysReq(BaseModel):
    count: int = Field(1, ge=1, le=500)
    duration_days: float = Field(30.0, ge=0.01)
    max_uses: int = Field(1, ge=1, le=100)
    note: Optional[str] = Field("", max_length=256)
    prefix: Optional[str] = Field("DLP-VIP", max_length=16)

class AdminRevokeKeyReq(BaseModel):
    license_key: str = Field(..., max_length=64)

class AdminRevokeHwidReq(BaseModel):
    hwid: str = Field(..., max_length=128)

class CreateRoomReq(BaseModel):
    host_nickname: Optional[str] = Field("Host", max_length=32)
    nickname: Optional[str] = Field(None, max_length=32)
    mode: Optional[str] = Field("relay", max_length=16)
    is_modded: Optional[bool] = Field(False)
    mod_mode: Optional[str] = Field("vanilla", max_length=32)
    enable_sdr: Optional[bool] = Field(False)
    hwid: str = Field(..., max_length=128)
    vip_token: str = Field(..., max_length=512)

class JoinRoomReq(BaseModel):
    room_code: str = Field(..., max_length=12)
    nickname: Optional[str] = Field("Player", max_length=32)
    mode: Optional[str] = Field("relay", max_length=16)
    hwid: str = Field(..., max_length=128)
    vip_token: str = Field(..., max_length=512)

class RoomAdminActionReq(BaseModel):
    hwid: str = Field(..., max_length=128)
    vip_token: str = Field(..., max_length=512)
    target_nickname: Optional[str] = Field(None, max_length=32)
    peer_nickname: Optional[str] = Field(None, max_length=32)

class PeerSession:
    def __init__(self, nickname: str, virtual_ip: str, is_host: bool):
        self.nickname = nickname[:32]
        self.virtual_ip = virtual_ip
        self.is_host = is_host
        self.endpoint: Optional[Tuple[str, int]] = None
        self.last_seen: float = time.time()

class GameRoom:
    def __init__(self, code: str, token: int, host_nickname: str, subnet_index: int, mode: str = "relay", is_modded: bool = False, mod_mode: str = "vanilla", enable_sdr: bool = False):
        self.code = code
        self.token = token
        self.host_nickname = host_nickname[:32]
        self.subnet_index = subnet_index
        self.mode = mode
        self.is_modded = is_modded
        self.mod_mode = mod_mode
        self.enable_sdr = enable_sdr
        self.banned_nicknames = set()
        self.relay_port = 28000 + subnet_index
        self.relay_transport: Optional[asyncio.DatagramTransport] = None
        self.relay_protocol: Optional['RoomRelayProtocol'] = None
        self.created_at = time.time()
        self.last_activity = time.time()
        self.next_ip_suffix = 2
        self.peers: Dict[str, PeerSession] = {}
        host_ip = f"10.10.{subnet_index}.1"
        self.peers[host_ip] = PeerSession(host_nickname, host_ip, is_host=True)

    def allocate_ip(self, nickname: str) -> str:
        if self.next_ip_suffix > 250:
            raise HTTPException(status_code=400, detail="Room is full (max 249 players)")
        ip = f"10.10.{self.subnet_index}.{self.next_ip_suffix}"
        self.next_ip_suffix += 1
        self.peers[ip] = PeerSession(nickname, ip, is_host=False)
        self.last_activity = time.time()
        return ip

    def close_relay(self):
        if self.relay_transport and not self.relay_transport.is_closing():
            try:
                self.relay_transport.close()
            except Exception:
                pass
            self.relay_transport = None

class RoomRelayProtocol(asyncio.DatagramProtocol):
    def __init__(self, room: GameRoom):
        self.room = room
        self.transport: Optional[asyncio.DatagramTransport] = None
        self.host_endpoint: Optional[Tuple[str, int]] = None
        self.clients_by_addr: Dict[Tuple[str, int], int] = {}
        self.clients_by_id: Dict[int, Tuple[str, int]] = {}
        self.client_last_seen: Dict[int, float] = {}
        self.client_nicknames: Dict[int, str] = {}
        self.next_client_id: int = 1

    def connection_made(self, transport):
        self.transport = transport
        sock = transport.get_extra_info("socket")
        if sock:
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 4 * 1024 * 1024)
            except Exception:
                pass
        print(f"[RELAY] Room {self.room.code} active on 0.0.0.0:{self.room.relay_port}")

    def datagram_received(self, data: bytes, addr: Tuple[str, int]):
        now = time.time()
        self.room.last_activity = now

        # Host Handshake: b"DLPH" + 4B token
        if len(data) >= 8 and data[:4] == MAGIC_RELAY_HOST:
            token = struct.unpack("!I", data[4:8])[0]
            if token == self.room.token:
                self.host_endpoint = addr
                host_ip = f"10.10.{self.room.subnet_index}.1"
                if host_ip in self.room.peers:
                    self.room.peers[host_ip].endpoint = addr
                    self.room.peers[host_ip].last_seen = now
                if self.transport:
                    self.transport.sendto(MAGIC_RELAY_ACK, addr)
                return

        # Client Handshake: b"DLPC" + 4B token + [nickname]
        if len(data) >= 8 and data[:4] == MAGIC_RELAY_CLIENT:
            token = struct.unpack("!I", data[4:8])[0]
            if token == self.room.token:
                nick = data[8:].decode("utf-8", errors="ignore").strip() or "Player"
                cid = self.clients_by_addr.get(addr)
                if cid is None:
                    cid = self.next_client_id
                    self.next_client_id += 1
                    self.clients_by_addr[addr] = cid
                    self.clients_by_id[cid] = addr

                self.client_last_seen[cid] = now
                self.client_nicknames[cid] = nick

                client_ip = f"10.10.{self.room.subnet_index}.{cid + 1}"
                if client_ip not in self.room.peers:
                    self.room.peers[client_ip] = PeerSession(nick, client_ip, is_host=False)
                self.room.peers[client_ip].endpoint = addr
                self.room.peers[client_ip].last_seen = now
                self.room.peers[client_ip].nickname = nick

                if self.transport:
                    self.transport.sendto(MAGIC_RELAY_PONG, addr)
                return

        # Packet from Host -> Client: [2B client_id] + game_payload
        if self.host_endpoint and addr == self.host_endpoint:
            if len(data) > 2:
                cid = struct.unpack("!H", data[:2])[0]
                target_endpoint = self.clients_by_id.get(cid)
                if target_endpoint and self.transport:
                    self.transport.sendto(data[2:], target_endpoint)
            return

        # Packet from Client -> Host: game_payload
        if addr != self.host_endpoint:
            cid = self.clients_by_addr.get(addr)
            if cid is None:
                cid = self.next_client_id
                self.next_client_id += 1
                self.clients_by_addr[addr] = cid
                self.clients_by_id[cid] = addr

            self.client_last_seen[cid] = now
            client_ip = f"10.10.{self.room.subnet_index}.{cid + 1}"
            if client_ip in self.room.peers:
                self.room.peers[client_ip].last_seen = now
                self.room.peers[client_ip].endpoint = addr

            if self.host_endpoint and self.transport:
                framed = struct.pack("!H", cid) + data
                self.transport.sendto(framed, self.host_endpoint)

# Global State
rooms: Dict[str, GameRoom] = {}
token_to_room: Dict[int, GameRoom] = {}
used_subnets = set()
udp_transport = None

creation_rate_limits: Dict[str, List[float]] = {}

def check_rate_limit(client_ip: str):
    now = time.time()
    timestamps = creation_rate_limits.get(client_ip, [])
    timestamps = [t for t in timestamps if now - t < 60.0]
    if len(timestamps) >= 10:
        raise HTTPException(status_code=429, detail="Too many room creation requests. Please wait a minute.")
    timestamps.append(now)
    creation_rate_limits[client_ip] = timestamps

def get_next_subnet() -> int:
    for i in range(1, 250):
        if i not in used_subnets:
            used_subnets.add(i)
            return i
    raise HTTPException(status_code=503, detail="Server capacity reached (all subnets allocated)")

# ----------------- Client VIP Endpoints -----------------
@app.post("/api/vip/redeem")
def redeem_vip_key(req: RedeemKeyReq):
    res = license_mgr.redeem_key(req.license_key, req.hwid, req.nickname or "Player")
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to redeem key"))
    return res

@app.post("/api/vip/check")
def check_vip_status(req: CheckVipReq):
    return license_mgr.check_vip_status(req.hwid, req.vip_token)

# ----------------- Admin Console Endpoints -----------------
@app.post("/api/admin/keys/generate")
def admin_generate_keys(req: AdminGenerateKeysReq, _auth: None = Depends(verify_admin_key)):
    duration_sec = int(req.duration_days * 86400)
    keys = license_mgr.create_licenses(
        count=req.count,
        duration_seconds=duration_sec,
        max_uses=req.max_uses,
        note=req.note or "",
        prefix=req.prefix or "DLP-VIP"
    )
    return {
        "success": True,
        "count": len(keys),
        "duration_days": req.duration_days,
        "max_uses": req.max_uses,
        "note": req.note,
        "keys": keys
    }

@app.get("/api/admin/keys/list")
def admin_list_keys(_auth: None = Depends(verify_admin_key)):
    with license_mgr._get_conn() as conn:
        cur = conn.execute("SELECT * FROM licenses ORDER BY created_at DESC LIMIT 200")
        licenses = []
        for row in cur.fetchall():
            # fetch activations for each key
            act_cur = conn.execute("SELECT hwid, nickname, activated_at, vip_until, is_revoked FROM activations WHERE license_key = ?", (row["key"],))
            acts = [dict(a) for a in act_cur.fetchall()]
            licenses.append({
                "key": row["key"],
                "max_uses": row["max_uses"],
                "times_used": row["times_used"],
                "duration_days": round(row["duration_seconds"] / 86400.0, 1),
                "created_at": row["created_at"],
                "is_active": bool(row["is_active"]),
                "note": row["note"],
                "activations": acts
            })
    return {"success": True, "count": len(licenses), "licenses": licenses}

@app.post("/api/admin/keys/revoke")
def admin_revoke_key(req: AdminRevokeKeyReq, _auth: None = Depends(verify_admin_key)):
    with license_mgr._get_conn() as conn:
        conn.execute("UPDATE licenses SET is_active = 0 WHERE key = ?", (req.license_key.strip().upper(),))
        conn.execute("UPDATE activations SET is_revoked = 1 WHERE license_key = ?", (req.license_key.strip().upper(),))
        conn.commit()
    return {"success": True, "message": f"License key {req.license_key} and all its activations have been revoked"}

@app.post("/api/admin/hwid/revoke")
def admin_revoke_hwid(req: AdminRevokeHwidReq, _auth: None = Depends(verify_admin_key)):
    with license_mgr._get_conn() as conn:
        conn.execute("UPDATE activations SET is_revoked = 1 WHERE hwid = ?", (req.hwid.strip(),))
        conn.commit()
    return {"success": True, "message": f"Hardware ID {req.hwid} banned and revoked"}

@app.get("/api/admin/stats")
def admin_stats(_auth: None = Depends(verify_admin_key)):
    now = time.time()
    with license_mgr._get_conn() as conn:
        total_keys = conn.execute("SELECT COUNT(*) FROM licenses").fetchone()[0]
        used_keys = conn.execute("SELECT COUNT(*) FROM licenses WHERE times_used > 0").fetchone()[0]
        active_vips = conn.execute("SELECT COUNT(DISTINCT hwid) FROM activations WHERE vip_until > ? AND is_revoked = 0", (now,)).fetchone()[0]
    return {
        "success": True,
        "total_keys": total_keys,
        "used_keys": used_keys,
        "active_vip_devices": active_vips,
        "active_rooms": len(rooms)
    }

# ----------------- Verified Game Mod Storage & Streaming -----------------
MODS_DIR = os.path.join(BASE_DIR, "mods")

OFFICIAL_MODS = {
    "pak01_dir.vpk": {
        "name": "Higher Brightness",
        "size": 8538815,
        "sha256": "f85de14dac40a8a2297a1516159774a0c5ae5925e5d8a48341a3c771ac8e75c9",
    },
    "pak02_dir.vpk": {
        "name": "Reduce Clutter",
        "size": 549372,
        "sha256": "e5ad72b3ae74d85799e2dc95a715932625adc66037328dc976a7a53ce2029f62",
    },
    "pak03_dir.vpk": {
        "name": "Better Breakables",
        "size": 102990771,
        "sha256": "65e676367df25968a809401bebd63de5d28ff255722f022b922262972118f23a",
    },
    "pak30_dir.vpk": {
        "name": "Russian Potato",
        "size": 125160379,
        "sha256": "5e15bc1e76df19d5e05ffbea5d51335d63795dc41689e525b88f27405bdb9dcd",
    },
    "pak31_dir.vpk": {
        "name": "Potato Graphics",
        "size": 9347647,
        "sha256": "cb47a5fafa33d6510e2318c35cc7fa5d2a054bfb9e3809468e9db1711b0b9f78",
    },
}

@app.get("/api/mods/manifest")
def get_mods_manifest():
    return {
        "success": True,
        "count": len(OFFICIAL_MODS),
        "mods": OFFICIAL_MODS
    }

@app.get("/api/mods/download/{filename}")
def download_mod(filename: str):
    clean_name = os.path.basename(filename).strip()
    if clean_name not in OFFICIAL_MODS:
        raise HTTPException(status_code=404, detail=f"Mod '{clean_name}' not approved or not found")
    
    file_path = os.path.join(MODS_DIR, clean_name)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Mod '{clean_name}' missing from server storage")
    
    return FileResponse(
        path=file_path,
        filename=clean_name,
        media_type="application/octet-stream"
    )

# ----------------- Dedicated Server Loader Storage -----------------
SERVER_LOADER_ZIP = os.path.join(BASE_DIR, "server_loader.zip")

@app.get("/api/server-loader/download")
def download_server_loader():
    if not os.path.isfile(SERVER_LOADER_ZIP):
        raise HTTPException(status_code=404, detail="server_loader.zip not found on VPS")
    return FileResponse(
        path=SERVER_LOADER_ZIP,
        filename="server_loader.zip",
        media_type="application/zip"
    )

@app.get("/api/server-loader/status")
def server_loader_status():
    exists = os.path.isfile(SERVER_LOADER_ZIP)
    return {
        "available": exists,
        "size_bytes": os.path.getsize(SERVER_LOADER_ZIP) if exists else 0
    }

# ----------------- Game Room Endpoints -----------------
@app.get("/api/health")
def health():
    return {
        "status": "online",
        "engine": "DLPHub In-House LAN Router",
        "version": "2.4.0",
        "security": "zero-trust-vip",
        "vps_ip": VPS_PUBLIC_IP,
        "udp_port": UDP_PORT,
        "active_rooms": len(rooms)
    }

@app.post("/api/room/create")
async def create_room(req: CreateRoomReq, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)

    # 1. STRICT VIP CRYPTOGRAPHIC VERIFICATION
    valid, reason = license_mgr.verify_token(req.vip_token, req.hwid)
    if not valid:
        raise HTTPException(
            status_code=403,
            detail=f"VIP Access Denied: {reason}. Valid Iran VIP subscription is required to host or play."
        )

    if len(rooms) >= MAX_ACTIVE_ROOMS:
        raise HTTPException(status_code=503, detail="Server capacity reached. Try again later.")

    nick = req.host_nickname or req.nickname or "Host"
    mode = req.mode.strip().lower() if req.mode else "relay"
    if mode not in ("relay", "wintun"):
        mode = "relay"

    while True:
        code = str(random.randint(100000, 999999))
        if code not in rooms:
            break
    token = random.randint(10000000, 99999999)
    subnet_idx = get_next_subnet()

    is_modded = bool(req.is_modded)
    mod_mode = (req.mod_mode or "vanilla").strip().lower()
    enable_sdr = bool(req.enable_sdr)

    room = GameRoom(code, token, nick, subnet_idx, mode, is_modded=is_modded, mod_mode=mod_mode, enable_sdr=enable_sdr)
    rooms[code] = room
    token_to_room[token] = room

    # Start UDP Port Relay Endpoint
    loop = asyncio.get_running_loop()
    relay_transport, relay_protocol = await loop.create_datagram_endpoint(
        lambda: RoomRelayProtocol(room),
        local_addr=("0.0.0.0", room.relay_port)
    )
    room.relay_transport = relay_transport
    room.relay_protocol = relay_protocol

    host_ip = f"10.10.{subnet_idx}.1"
    gateway_ip = f"10.10.{subnet_idx}.254"

    return {
        "success": True,
        "room_code": code,
        "mode": mode,
        "connection_mode": mode,
        "is_modded": room.is_modded,
        "mod_mode": room.mod_mode,
        "enable_sdr": room.enable_sdr,
        "relay_port": room.relay_port,
        "relay_target": f"{VPS_PUBLIC_IP}:{room.relay_port}",
        "virtual_ip": host_ip,
        "vip": host_ip,
        "host_ip": host_ip,
        "host_vip": host_ip,
        "gateway_ip": gateway_ip,
        "netmask": "255.255.255.0",
        "subnet_mask": "255.255.255.0",
        "vps_ip": VPS_PUBLIC_IP,
        "vps_udp_port": UDP_PORT,
        "udp_server": f"{VPS_PUBLIC_IP}:{UDP_PORT}",
        "room_token": token,
        "is_host": True
    }

@app.post("/api/room/join")
def join_room(req: JoinRoomReq):
    # 1. STRICT VIP CRYPTOGRAPHIC VERIFICATION
    valid, reason = license_mgr.verify_token(req.vip_token, req.hwid)
    if not valid:
        raise HTTPException(
            status_code=403,
            detail=f"VIP Access Denied: {reason}. Valid Iran VIP subscription is required to join rooms."
        )

    code = req.room_code.strip()
    nick = req.nickname or "Player"
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room code not found or expired")

    room = rooms[code]
    if nick in room.banned_nicknames:
        raise HTTPException(status_code=403, detail="You have been banned from this room by the host")

    client_ip = room.allocate_ip(nick)
    host_ip = f"10.10.{room.subnet_index}.1"
    gateway_ip = f"10.10.{room.subnet_index}.254"

    return {
        "success": True,
        "room_code": code,
        "mode": room.mode,
        "connection_mode": room.mode,
        "is_modded": room.is_modded,
        "mod_mode": room.mod_mode,
        "enable_sdr": room.enable_sdr,
        "relay_port": room.relay_port,
        "relay_target": f"{VPS_PUBLIC_IP}:{room.relay_port}",
        "virtual_ip": client_ip,
        "vip": client_ip,
        "host_ip": host_ip,
        "host_vip": host_ip,
        "gateway_ip": gateway_ip,
        "netmask": "255.255.255.0",
        "subnet_mask": "255.255.255.0",
        "vps_ip": VPS_PUBLIC_IP,
        "vps_udp_port": UDP_PORT,
        "udp_server": f"{VPS_PUBLIC_IP}:{UDP_PORT}",
        "room_token": room.token,
        "host_nickname": room.host_nickname,
        "is_host": False
    }

@app.get("/api/room/status/{room_code}")
def room_status(room_code: str):
    code = room_code.strip()
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    room = rooms[code]
    now = time.time()
    peers_list = []
    host_ip = f"10.10.{room.subnet_index}.1"

    for ip, peer in room.peers.items():
        is_active = (now - peer.last_seen) < 35.0 and peer.endpoint is not None
        peers_list.append({
            "name": peer.nickname,
            "ip": ip,
            "online": is_active,
            "is_host": peer.is_host
        })

    return {
        "success": True,
        "room_code": code,
        "mode": room.mode,
        "connection_mode": room.mode,
        "is_modded": room.is_modded,
        "mod_mode": room.mod_mode,
        "enable_sdr": room.enable_sdr,
        "relay_port": room.relay_port,
        "relay_target": f"{VPS_PUBLIC_IP}:{room.relay_port}",
        "host_ip": host_ip,
        "host_vip": host_ip,
        "banned_count": len(room.banned_nicknames),
        "peers": peers_list
    }

@app.get("/api/room/list")
def list_active_rooms():
    now = time.time()
    room_list = []
    for code, room in rooms.items():
        if now - room.last_activity < 7200:
            room_list.append({
                "room_code": code,
                "host_nickname": room.host_nickname,
                "mode": room.mode,
                "is_modded": room.is_modded,
                "mod_mode": room.mod_mode,
                "enable_sdr": room.enable_sdr,
                "peer_count": len(room.peers),
            })
    return {"success": True, "count": len(room_list), "rooms": room_list}

@app.post("/api/room/{room_code}/kick")
def kick_peer(room_code: str, req: RoomAdminActionReq):
    code = room_code.strip()
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[code]
    valid, reason = license_mgr.verify_token(req.vip_token, req.hwid)
    if not valid:
        raise HTTPException(status_code=403, detail="Unauthorized")

    target = (req.target_nickname or req.peer_nickname or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Missing target nickname")

    target_lower = target.lower()
    found_ip = None
    for ip, peer in room.peers.items():
        if not peer.is_host and peer.nickname.lower() == target_lower:
            found_ip = ip
            break
    if found_ip:
        room.peers.pop(found_ip)
        return {"success": True, "message": f"Player {target} kicked"}
    return {"success": False, "message": "Player not found"}

@app.post("/api/room/{room_code}/ban")
def ban_peer(room_code: str, req: RoomAdminActionReq):
    code = room_code.strip()
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[code]
    valid, reason = license_mgr.verify_token(req.vip_token, req.hwid)
    if not valid:
        raise HTTPException(status_code=403, detail="Unauthorized")

    target = (req.target_nickname or req.peer_nickname or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Missing target nickname")

    room.banned_nicknames.add(target)
    target_lower = target.lower()
    found_ip = None
    for ip, peer in room.peers.items():
        if not peer.is_host and peer.nickname.lower() == target_lower:
            found_ip = ip
            break
    if found_ip:
        room.peers.pop(found_ip)
    return {"success": True, "message": f"Player {target} banned"}

@app.post("/api/room/{room_code}/unban")
def unban_peer(room_code: str, req: RoomAdminActionReq):
    code = room_code.strip()
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[code]
    valid, reason = license_mgr.verify_token(req.vip_token, req.hwid)
    if not valid:
        raise HTTPException(status_code=403, detail="Unauthorized")

    target = (req.target_nickname or req.peer_nickname or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Missing target nickname")

    room.banned_nicknames.discard(target)
    return {"success": True, "message": f"Player {target} unbanned"}

# ----------------- Deadworks Client Downloads -----------------
CLIENT_BOOTSTRAP_ZIP = os.path.join(BASE_DIR, "client_bootstrap.zip")
CLIENT_ABILITY_BRAWL_ZIP = os.path.join(BASE_DIR, "client_ability_brawl.zip")
CLIENT_CURSED_ARENA_ZIP = os.path.join(BASE_DIR, "client_cursed_arena.zip")

@app.get("/api/deadworks/client-bootstrap/download")
def download_client_bootstrap():
    for candidate in [CLIENT_BOOTSTRAP_ZIP, os.path.join(os.path.dirname(__file__), "client_bootstrap.zip")]:
        if os.path.isfile(candidate):
            return FileResponse(candidate, filename="client_bootstrap.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail="Client bootstrap zip not found on VPS")

@app.get("/api/deadworks/client-addon/{mode}/download")
def download_client_addon(mode: str):
    m = mode.strip().lower()
    if m == "ability_brawl":
        for candidate in [CLIENT_ABILITY_BRAWL_ZIP, os.path.join(os.path.dirname(__file__), "client_ability_brawl.zip")]:
            if os.path.isfile(candidate):
                return FileResponse(candidate, filename="client_ability_brawl.zip", media_type="application/zip")
    elif m in ("cursed_arena", "cursedarena"):
        for candidate in [CLIENT_CURSED_ARENA_ZIP, os.path.join(os.path.dirname(__file__), "client_cursed_arena.zip")]:
            if os.path.isfile(candidate):
                return FileResponse(candidate, filename="client_cursed_arena.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail=f"Addon for '{mode}' not found on VPS")

def calc_file_sha256(filepath: str) -> Optional[str]:
    if not os.path.isfile(filepath):
        return None
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

@app.get("/api/packages/manifest")
def get_packages_manifest():
    packages = {}
    files_to_check = {
        "server_loader.zip": SERVER_LOADER_ZIP,
        "client_bootstrap.zip": CLIENT_BOOTSTRAP_ZIP,
        "client_ability_brawl.zip": CLIENT_ABILITY_BRAWL_ZIP,
        "client_cursed_arena.zip": CLIENT_CURSED_ARENA_ZIP,
    }
    for name, path in files_to_check.items():
        if os.path.isfile(path):
            packages[name] = {
                "filename": name,
                "size_bytes": os.path.getsize(path),
                "sha256": calc_file_sha256(path),
            }
    return {
        "success": True,
        "packages": packages
    }

@app.delete("/api/room/{room_code}")
def delete_room(room_code: str):
    code = room_code.strip()
    if code in rooms:
        room = rooms.pop(code)
        room.close_relay()
        token_to_room.pop(room.token, None)
        used_subnets.discard(room.subnet_index)
        print(f"[ROOM] Deleted room {code}")
    return {"success": True}

# High-Speed UDP Packet Forwarder Protocol (for Wintun / Virtual IP mesh)
class GameRouterProtocol(asyncio.DatagramProtocol):
    def connection_made(self, transport):
        self.transport = transport
        global udp_transport
        udp_transport = transport
        sock = transport.get_extra_info("socket")
        if sock:
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 4 * 1024 * 1024)
            except Exception as e:
                print(f"[UDP ROUTER] Buffer optimization: {e}")
        print(f"[UDP ROUTER] Active on 0.0.0.0:{UDP_PORT}")

    def datagram_received(self, data: bytes, addr: Tuple[str, int]):
        if len(data) < 9 or data[:4] != MAGIC_BYTES:
            return

        token = struct.unpack("!I", data[4:8])[0]
        pkt_type = data[8]

        room = token_to_room.get(token)
        if not room:
            return

        now = time.time()
        room.last_activity = now

        # Handshake / Keepalive Ping (TYPE 0x01)
        if pkt_type == TYPE_HANDSHAKE:
            if len(data) >= 13:
                vip_str = socket.inet_ntoa(data[9:13])
                peer = room.peers.get(vip_str)
                if peer:
                    peer.endpoint = addr
                    peer.last_seen = now
                    pong = MAGIC_BYTES + struct.pack("!IB", token, TYPE_PONG)
                    self.transport.sendto(pong, addr)

        # Game IP Packet from Wintun (TYPE 0x03)
        elif pkt_type == TYPE_PACKET:
            ip_payload = data[9:]
            if len(ip_payload) < 20:
                return

            src_ip_str = socket.inet_ntoa(ip_payload[12:16])
            sender_peer = room.peers.get(src_ip_str)

            if not sender_peer:
                return

            sender_peer.endpoint = addr
            sender_peer.last_seen = now

            dst_ip_bytes = ip_payload[16:20]
            dst_ip_str = socket.inet_ntoa(dst_ip_bytes)

            if dst_ip_str in ("255.255.255.255", f"10.10.{room.subnet_index}.255"):
                for p in room.peers.values():
                    if p.endpoint and p.endpoint != addr:
                        self.transport.sendto(data, p.endpoint)
            else:
                dst_peer = room.peers.get(dst_ip_str)
                if dst_peer and dst_peer.endpoint:
                    self.transport.sendto(data, dst_peer.endpoint)

        # Graceful Leave (TYPE 0x04)
        elif pkt_type == TYPE_LEAVE:
            if len(data) >= 13:
                vip_str = socket.inet_ntoa(data[9:13])
                peer = room.peers.get(vip_str)
                if peer and peer.endpoint == addr:
                    peer.endpoint = None

async def room_cleaner_task():
    while True:
        await asyncio.sleep(60)
        now = time.time()
        to_remove = []
        for code, room in list(rooms.items()):
            if now - room.last_activity > 7200:
                to_remove.append(code)
        for code in to_remove:
            if code in rooms:
                r = rooms.pop(code)
                r.close_relay()
                token_to_room.pop(r.token, None)
                used_subnets.discard(r.subnet_index)
                print(f"[CLEANER] Auto-expired inactive room {code}")

        for ip in list(creation_rate_limits.keys()):
            recent = [t for t in creation_rate_limits[ip] if now - t < 60.0]
            if recent:
                creation_rate_limits[ip] = recent
            else:
                creation_rate_limits.pop(ip, None)

async def start_services():
    loop = asyncio.get_running_loop()
    await loop.create_datagram_endpoint(
        lambda: GameRouterProtocol(),
        local_addr=("0.0.0.0", UDP_PORT)
    )
    asyncio.create_task(room_cleaner_task())
    config = uvicorn.Config(app=app, host="0.0.0.0", port=HTTP_PORT, log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(start_services())
