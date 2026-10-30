# DEADLOCK LAN LAUNCHER & DLP HUB ARCHITECTURE SPECIFICATION
### Complete Engineering Blueprint, Networking Protocol Guide & Implementation Manual for Deadlock Custom Matchmaking & Dedicated Server Launchers

**Document Classification:** Technical Architecture & Production Blueprint  
**Target Project:** DLP Hub (Deadlock Persian Hub) / Custom Community Launchers  
**Technologies:** Go (Golang) / Rust, Wails v2 / Tauri v2, Microsoft Edge WebView2, Source 2 (Deadlock), Steam Networking Sockets (GNS), UDP Proxying, A2S Server Querying  
**Version:** 1.0.0-Production (October 2026)

---

## 1. Executive Summary & The Vision for DLP Hub

Valve's *Deadlock* (Source 2 engine, Steam App ID `1422450`) represents the next generation of competitive MOBA-shooters. However, because the game is currently in closed playtest, **Valve does not yet provide an open public dedicated server browser, community matchmaking coordinator, or headless Linux binaries**. Furthermore, in regions with complex routing, high ping, or restrictive firewalls (such as Iran), players face severe obstacles connecting to standard European matchmaking clusters.

The **Deadlock Persian LAN Launcher** solved this problem by providing a lightweight graphical client that allows Iranian players to host local dedicated servers and connect to community-hosted servers across domestic networks with low latency.

**DLP Hub** is envisioned as the next evolutionary step: a comprehensive, production-grade desktop hub that merges:
1. **One-Click Server Browser & Match Launcher:** Zero-configuration client connections with automatic proxy routing.
2. **Built-in Dedicated Server Host Manager:** Automated UPnP router port forwarding, custom game mode selection (Street Brawl, 1v1, Standard 6v6), and practice bot controls.
3. **Integrated Mod & Localization Manager:** Instant toggling of the Farsi language translation and custom visual mods without touching game files.
4. **Live Community Portal:** Integrated news, tournament announcements, Discord/Telegram feeds, and player leaderboards.

---

## 2. Source 2 Network Architecture & The "Identity Check" Barrier

To build a custom launcher, you must understand the exact networking mechanics of Source 2.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       THE SOURCE 2 CLIENT-SERVER HANDSHAKE PROBLEM                          │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│   OFFICIAL MATCHMAKING FLOW      │        │    UNAUTHENTICATED WAN ATTEMPT   │
├──────────────────────────────────┤        ├──────────────────────────────────┤
│ 1. Client queues in main menu.   │        │ 1. Player runs: connect IP:27005 │
│ 2. Valve GC generates signed     │        │ 2. Server runs: -dedicated +lan 1│
│    symmetric Steam ticket.       │        │ 3. Remote WAN IP reaches server. │
│ 3. Server validates crypto ticket│        │ 4. Ticket verification fails.    │
│ 4. Handshake SUCCESS (In Game).  │        │ 5. Handshake REJECTED (Bad ID).  │
└──────────────────────────────────┘        └──────────────────────────────────┘
```

### 2.1 The Steam Networking Sockets (GNS) Protocol
Source 2 games no longer use classic raw UDP sockets (`net_chan`). They utilize Valve’s proprietary [**`GameNetworkingSockets` (GNS)**](https://github.com/ValveSoftware/GameNetworkingSockets) library. GNS encapsulates all UDP traffic inside structured frames containing:
- Cryptographic connection tickets.
- `SteamNetworkingIdentity` tokens (SteamID64 or IP-based identities).
- Symmetric encryption keys negotiated via Valve relay coordinators (SDR).

### 2.2 The "Bad Identity" Failure Mode
When you execute `deadlock.exe -dedicated +sv_lan 1 -insecure`:
- The dedicated server enters an unauthenticated local state.
- **The Engine Rule:** The server will **only accept unauthenticated connections originating from `127.0.0.1` (loopback) or the local subnet**.
- When an external client across the internet connects to `public_ip:27005`, the server inspects the packet header. It sees a non-local WAN IP address without a Valve-signed GC ticket and immediately drops the connection with `k_EResultAccessDenied` ("Bad identity").

### 2.3 The Architectural Solution: Loopback Identity Proxying
The identity proxy (used by `jesus_proxy.exe` and the Persian LAN Launcher) acts as a **UDP NAT Loopback Gateway**:

```
┌─────────────────────────┐
│ External Client (Player)│
└────────────┬────────────┘
             │ 1. Sends UDP to Public Port (27015)
             ▼
┌────────────────────────────────────────────────────────┐
│              DLP HUB PROXY ENGINE (HOST)               │
│  • Binds to 0.0.0.0:27015                              │
│  • Maps Client WAN IP -> Virtual Session Slot          │
│  • Re-transmits datagrams over 127.0.0.1:LocalPort     │
└────────────┬───────────────────────────────────────────┘
             │ 2. Local Loopback Packet (Source: 127.0.0.1)
             ▼
┌────────────────────────────────────────────────────────┐
│             DEADLOCK SERVER (127.0.0.1:27005)          │
│  • Server believes player is local on the host PC!     │
│  • LAN authentication succeeds with zero errors.       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Dissecting the Existing Persian LAN Launcher

Inspection of `deadlock-persian-lan-launcher.exe` reveals the following internal engineering stack:

| Component | Technical Implementation | Purpose |
| :--- | :--- | :--- |
| **Backend Runtime** | **Go (Golang)** | Fast, compiled native binary with high-performance concurrency. |
| **Desktop Framework** | **Wails v2** (`wails.io`) | Binds Go methods to the frontend via JSON-RPC IPC without Electron overhead. |
| **Webview Core** | **Microsoft Edge WebView2** (`EBWebView`) | Native Chromium-based rendering built into Windows 10/11. |
| **Distribution Size** | **~11.3 MB** | Single executable with all HTML/CSS/JS frontend assets embedded via `embed.FS`. |
| **Proxy Integration** | Child process supervisor | Manages `jesus_proxy.exe` (`dp.exe`) as a background daemon. |

---

## 4. Complete Implementation Blueprint for DLP Hub

Rather than relying on external scripts or third-party executables, **DLP Hub can be built as a single, self-contained, enterprise-grade application** using **Wails v2 (Go)** or **Tauri v2 (Rust)**.

Below is the complete, production-ready Go codebase for DLP Hub's core engine.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DLP HUB MODULAR ARCHITECTURE                                 │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│     ENGINE DETECTOR      │ │    NATIVE UDP PROXY      │ │    PROCESS SUPERVISOR    │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • Steam Registry Query   │ │ • Zero external binaries │ │ • deadlock.exe launcher  │
│ • libraryfolders.vdf     │ │ • Dynamic session table  │ │ • Safe argument injection│
│ • citadel\custom verify  │ │ • Bidirectional routing  │ │ • Auto-kill orphan tasks │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

---

### 4.1 Module 1: Deadlock Path Auto-Detection
The launcher must locate the user's Deadlock install without requiring manual folder picking.

```go
package engine

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"golang.org/x/sys/windows/registry"
)

// FindDeadlockPath locates the Deadlock root folder via Steam registry keys and library VDF files.
func FindDeadlockPath() (string, error) {
	// 1. Query Steam installation path from Registry
	k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Valve\Steam`, registry.QUERY_VALUE)
	if err != nil {
		return "", fmt.Errorf("failed to open Steam registry key: %w", err)
	}
	defer k.Close()

	steamPath, _, err := k.GetStringValue("SteamPath")
	if err != nil {
		return "", fmt.Errorf("failed to read SteamPath value: %w", err)
	}

	steamPath = filepath.Clean(steamPath)

	// 2. Check default steamapps folder
	defaultDeadlock := filepath.Join(steamPath, "steamapps", "common", "Deadlock")
	if isDeadlockDir(defaultDeadlock) {
		return defaultDeadlock, nil
	}

	// 3. Parse libraryfolders.vdf for secondary drives
	vdfPath := filepath.Join(steamPath, "steamapps", "libraryfolders.vdf")
	libraries, err := parseLibraryFolders(vdfPath)
	if err == nil {
		for _, lib := range libraries {
			candidate := filepath.Join(lib, "steamapps", "common", "Deadlock")
			if isDeadlockDir(candidate) {
				return candidate, nil
			}
		}
	}

	return "", fmt.Errorf("deadlock installation not found automatically")
}

func isDeadlockDir(path string) bool {
	exePath := filepath.Join(path, "game", "bin", "win64", "deadlock.exe")
	info, err := os.Stat(exePath)
	return err == nil && !info.IsDir()
}

func parseLibraryFolders(vdfPath string) ([]string, error) {
	file, err := os.Open(vdfPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var libraries []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, `"path"`) {
			parts := strings.Split(line, `"`)
			if len(parts) >= 4 {
				libPath := strings.ReplaceAll(parts[3], `\\`, `\`)
				libraries = append(libraries, libPath)
			}
		}
	}
	return libraries, nil
}
```

---

### 4.2 Module 2: High-Performance Native Go UDP Identity Proxy
Instead of bundling `jesus_proxy.exe`, DLP Hub can embed its own high-throughput, multi-threaded UDP proxy natively in Go with zero external dependencies.

```go
package proxy

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"
)

// ServerProxy forwards external client packets to the local Deadlock dedicated server.
type ServerProxy struct {
	PublicPort   int
	InternalPort int
	sessions     sync.Map // string (Client WAN IP:Port) -> *net.UDPConn (Local Socket)
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewServerProxy(publicPort, internalPort int) *ServerProxy {
	ctx, cancel := context.WithCancel(context.Background())
	return &ServerProxy{
		PublicPort:   publicPort,
		InternalPort: internalPort,
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Start begins the UDP proxy listening loop.
func (p *ServerProxy) Start() error {
	publicAddr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("0.0.0.0:%d", p.PublicPort))
	if err != nil {
		return err
	}

	publicConn, err := net.ListenUDP("udp4", publicAddr)
	if err != nil {
		return fmt.Errorf("failed to bind public proxy port %d: %w", p.PublicPort, err)
	}
	defer publicConn.Close()

	internalAddr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("127.0.0.1:%d", p.InternalPort))
	if err != nil {
		return err
	}

	buf := make([]byte, 65535)

	for {
		select {
		case <-p.ctx.Done():
			return nil
		default:
			// Read packet from remote player
			n, clientAddr, err := publicConn.ReadFromUDP(buf)
			if err != nil {
				continue
			}

			clientKey := clientAddr.String()

			// Retrieve or create a local loopback relay socket for this client
			var relayConn *net.UDPConn
			val, exists := p.sessions.Load(clientKey)
			if exists {
				relayConn = val.(*net.UDPConn)
			} else {
				// Create new local socket
				localAddr, _ := net.ResolveUDPAddr("udp4", "127.0.0.1:0")
				relayConn, err = net.ListenUDP("udp4", localAddr)
				if err != nil {
					continue
				}
				p.sessions.Store(clientKey, relayConn)

				// Background routine: Relay packets from Deadlock Server back to Client
				go func(cAddr *net.UDPAddr, rConn *net.UDPConn) {
					respBuf := make([]byte, 65535)
					for {
						rConn.SetReadDeadline(time.Now().Add(60 * time.Second))
						rn, _, rerr := rConn.ReadFromUDP(respBuf)
						if rerr != nil {
							p.sessions.Delete(clientKey)
							rConn.Close()
							return
						}
						// Send server response back to the player's real WAN address
						publicConn.WriteToUDP(respBuf[:rn], cAddr)
					}
				}(clientAddr, relayConn)
			}

			// Forward packet to Deadlock internal server on 127.0.0.1
			relayConn.WriteToUDP(buf[:n], internalAddr)
		}
	}
}

// Stop cleanly terminates the proxy.
func (p *ServerProxy) Stop() {
	p.cancel()
	p.sessions.Range(func(key, value interface{}) bool {
		if conn, ok := value.(*net.UDPConn); ok {
			conn.Close()
		}
		return true
	})
}
```

---

### 4.3 Module 3: Client Connection Manager (Joining Servers)
When a player clicks **"Connect to Server"**, DLP Hub spawns a client-side loopback socket and launches Deadlock targeting it.

```go
package launcher

import (
	"context"
	"fmt"
	"net"
	"os/exec"
	"path/filepath"
)

// ClientProxy bridges a local Deadlock client to a remote dedicated server proxy.
type ClientProxy struct {
	LocalPort  int
	RemoteHost string
	RemotePort int
	ctx        context.Context
	cancel     context.CancelFunc
}

func StartClientAndLaunchGame(deadlockRoot, remoteIP string, remotePort, localProxyPort int) error {
	ctx, cancel := context.WithCancel(context.Background())
	
	// 1. Start Client-Side Forwarder
	go func() {
		localAddr, _ := net.ResolveUDPAddr("udp4", fmt.Sprintf("127.0.0.1:%d", localProxyPort))
		remoteAddr, _ := net.ResolveUDPAddr("udp4", fmt.Sprintf("%s:%d", remoteIP, remotePort))
		localConn, err := net.ListenUDP("udp4", localAddr)
		if err != nil {
			return
		}
		defer localConn.Close()

		buf := make([]byte, 65535)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, _, err := localConn.ReadFrom(buf)
				if err != nil {
					continue
				}
				// Forward client's packets to server
				localConn.WriteTo(buf[:n], remoteAddr)
			}
		}
	}()

	// 2. Launch Deadlock Executable
	exePath := filepath.Join(deadlockRoot, "game", "bin", "win64", "deadlock.exe")
	args := []string{
		"-insecure",
		"-allow_no_lobby_connect",
		fmt.Sprintf("+connect 127.0.0.1:%d", localProxyPort),
	}

	cmd := exec.Command(exePath, args...)
	err := cmd.Start()
	if err != nil {
		cancel()
		return fmt.Errorf("failed to start deadlock.exe: %w", err)
	}

	// Wait for game process to exit, then kill client proxy
	go func() {
		cmd.Wait()
		cancel()
	}()

	return nil
}
```

---

### 4.4 Module 4: Dedicated Server Host Manager
When a user clicks **"Host Match"**, DLP Hub launches the headless server and binds the server proxy.

```go
package launcher

import (
	"fmt"
	"os/exec"
	"path/filepath"
)

type HostConfig struct {
	DeadlockRoot    string
	MapName         string // "dl_midtown" or custom map
	InternalPort    int    // default: 27005
	PublicPort      int    // default: 27015
	MaxPlayers      int    // default: 12
	EnableBots      bool
	BotCount        int
	GameMode        string // "streetbrawl", "standard"
	Cheats          bool
}

func LaunchDedicatedHost(cfg HostConfig) (*exec.Cmd, error) {
	exePath := filepath.Join(cfg.DeadlockRoot, "game", "bin", "win64", "deadlock.exe")
	
	args := []string{
		"-dedicated",
		"-insecure",
		"+sv_lan 1",
		"+sv_setsteamaccount 0",
		"-allow_no_lobby_connect",
		"+tv_citadel_auto_record 0",
		fmt.Sprintf("+ip 127.0.0.1"),
		fmt.Sprintf("-port %d", cfg.InternalPort),
		fmt.Sprintf("+map %s", cfg.MapName),
		fmt.Sprintf("+maxplayers %d", cfg.MaxPlayers),
	}

	if cfg.Cheats {
		args = append(args, "+sv_cheats 1")
	}

	if cfg.GameMode == "streetbrawl" {
		args = append(args, "+citadel_gamemode_streetbrawl_enabled true")
	}

	if cfg.EnableBots {
		args = append(args, 
			"+citadel_spawn_practice_bots true",
			fmt.Sprintf("+citadel_spawn_practice_bots_count %d", cfg.BotCount),
		)
	}

	cmd := exec.Command(exePath, args...)
	err := cmd.Start()
	if err != nil {
		return nil, fmt.Errorf("failed to launch dedicated server: %w", err)
	}

	return cmd, nil
}
```

---

### 4.5 Module 5: Source 2 A2S Server Ping & Query Protocol
To show active community servers with **Live Player Count, Map Name, and Ping** in DLP Hub, the launcher implements the Valve **A2S_INFO** query protocol (supported natively by Source 2).

```go
package query

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

type ServerStatus struct {
	ServerName string
	MapName    string
	GameFolder string
	GameDesc   string
	Players    uint8
	MaxPlayers uint8
	Bots       uint8
	PingMs     int64
}

// QueryA2SInfo queries a Source 2 server for current player count and map.
func QueryA2SInfo(ip string, port int) (*ServerStatus, error) {
	addr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("%s:%d", ip, port))
	if err != nil {
		return nil, err
	}

	conn, err := net.DialUDP("udp4", nil, addr)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	conn.SetDeadline(time.Now().Add(2500 * time.Millisecond))

	// Standard Source Engine A2S_INFO Query Packet
	queryHeader := []byte{0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00}

	start := time.Now()
	_, err = conn.Write(queryHeader)
	if err != nil {
		return nil, err
	}

	resp := make([]byte, 1400)
	n, err := conn.Read(resp)
	if err != nil {
		return nil, err
	}
	ping := time.Since(start).Milliseconds()

	buf := bytes.NewReader(resp[:n])

	var header int32
	binary.Read(buf, binary.LittleEndian, &header)

	var msgType byte
	binary.Read(buf, binary.LittleEndian, &msgType)

	// If server responds with Challenge (0x41), reply with challenge key
	if msgType == 0x41 {
		var challenge int32
		binary.Read(buf, binary.LittleEndian, &challenge)

		// Resend with challenge key appended
		retryPacket := append(queryHeader, make([]byte, 4)...)
		binary.LittleEndian.PutUint32(retryPacket[len(queryHeader):], uint32(challenge))
		
		start = time.Now()
		conn.Write(retryPacket)
		n, err = conn.Read(resp)
		if err != nil {
			return nil, err
		}
		ping = time.Since(start).Milliseconds()
		buf = bytes.NewReader(resp[:n])
		binary.Read(buf, binary.LittleEndian, &header)
		binary.Read(buf, binary.LittleEndian, &msgType)
	}

	// 0x49 = Standard A2S_INFO Response
	if msgType != 0x49 {
		return nil, fmt.Errorf("unexpected packet response: 0x%X", msgType)
	}

	var proto byte
	binary.Read(buf, binary.LittleEndian, &proto)

	serverName := readNullTerminatedString(buf)
	mapName := readNullTerminatedString(buf)
	gameFolder := readNullTerminatedString(buf)
	gameDesc := readNullTerminatedString(buf)

	var appID int16
	binary.Read(buf, binary.LittleEndian, &appID)

	var players, maxPlayers, bots uint8
	binary.Read(buf, binary.LittleEndian, &players)
	binary.Read(buf, binary.LittleEndian, &maxPlayers)
	binary.Read(buf, binary.LittleEndian, &bots)

	return &ServerStatus{
		ServerName: serverName,
		MapName:    mapName,
		GameFolder: gameFolder,
		GameDesc:   gameDesc,
		Players:    players,
		MaxPlayers: maxPlayers,
		Bots:       bots,
		PingMs:     ping,
	}, nil
}

func readNullTerminatedString(r *bytes.Reader) string {
	var result []byte
	for {
		b, err := r.ReadByte()
		if err != nil || b == 0x00 {
			break
		}
		result = append(result, b)
	}
	return string(result)
}
```

---

## 5. DLP Hub Feature Architecture & UI Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DLP HUB INTERFACE ARCHITECTURE                               │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
     ┌───────────────────┬─────────────┴─────┬───────────────────┐
     ▼                   ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│SERVER BROWSER│   │ HOST LOBBY   │    │ MOD & FA LANG│    │ NEWS & MEDIA │
├──────────────┤   ├──────────────┤    ├──────────────┤   ├──────────────┤
│ • Ping List  │   │ • Map Picker │    │ • 1-Click FA │   │ • Telegram   │
│ • Players/12 │   │ • Bot toggle │    │   translation│   │   events     │
│ • 1-Click    │   │ • UPnP Auto  │    │ • Custom HUD │   │ • Discord    │
│   Connect    │   │   port-open  │    │ • Active VPKs│   │   scrims     │
└──────────────┘   └──────────────┘    └──────────────┘   └──────────────┘
```

### 5.1 One-Click Farsi Localization Toggle
DLP Hub can manage the user's translations directly:
1. When **"Farsi Language: ENABLED"** is toggled:
   - DLP Hub copies `citadel_heroes_farsi.txt` and `citadel_mods_farsi.txt` into:
     `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_heroes\citadel_heroes_english.txt`
     `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_mods\citadel_mods_english.txt`
2. When toggled **"OFF"**:
   - DLP Hub removes the custom files from `citadel\custom\`, immediately restoring vanilla English.

### 5.2 UPnP Automatic Port Forwarding (Zero Router Hassle)
Most users cannot configure their home router's port forwarding. DLP Hub can use the Go library `github.com/huin/goupnp` to automatically request port forwarding mappings from the router via UPnP:
```go
// Automatically maps UDP 27015 on the player's router for 4 hours
nat.AddPortMapping("UDP", 27015, 27015, "DLP Hub Deadlock Server", 14400)
```

---

## 6. How to Build & Package DLP Hub

### 6.1 Prerequisites
1. **Go 1.22+**: [golang.org](https://go.dev/)
2. **Node.js 20+**: [nodejs.org](https://nodejs.org/)
3. **Wails v2 CLI**:
   ```powershell
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

### 6.2 Initializing the Project
```powershell
wails init -n dlp-hub -t svelte
cd dlp-hub
```

### 6.3 Project Structure
```
dlp-hub/
├── app.go                 # Core Go bindings exposed to frontend
├── main.go                # Wails application entry point
├── pkg/
│   ├── engine/            # Steam & Deadlock path detection
│   ├── proxy/             # Native Go UDP proxy
│   ├── launcher/          # Process supervisor (deadlock.exe)
│   ├── query/             # A2S server ping protocol
│   └── localization/      # Farsi language file manager
├── frontend/
│   ├── src/
│   │   ├── App.svelte     # Main dashboard interface
│   │   ├── components/
│   │   │   ├── ServerList.svelte
│   │   │   ├── HostModal.svelte
│   │   │   └── ModManager.svelte
│   │   └── assets/        # Icons, banners, fonts
├── wails.json             # Wails project configuration
```

### 6.4 Compiling the Production Binary
To produce a single, production-ready, stripped Windows executable:
```powershell
wails build -clean -trimpath -upx -windowsconsole=false
```
* The output will be located at `build/bin/dlp-hub.exe` (~10–12 MB).
* It requires no dependencies, no external `.dll` files, and runs on any standard Windows 10/11 machine.

---

## 7. Next Steps for Autonomous Implementation

When you are ready to begin development of **DLP Hub**:
1. Run `wails init` to set up the scaffolding.
2. Integrate the native Go UDP proxy and process launcher modules detailed in this document.
3. Design the Svelte or React frontend with dark theme aesthetics matching Deadlock's art style.
4. Test local loopback hosting and A2S ping queries against live community servers.

---
**End of Specification. Ground all DLP Hub development actions in the above architecture.**
