# DEADLOCK MODDING & AI CREATIVE ENVIRONMENT
### Master Workspace Reference, Tool Catalog & Agent Onboarding Guide

> **Notice for AI Agents & Developers:** This file is the primary context anchor for this project. Any agent starting a new conversation in this workspace MUST read this document to understand the local paths, installed toolchains, game mounting rules, and creative workflows.

---

## 1. Quick Directory & Path Reference

| Component | Path on Disk | Purpose |
| :--- | :--- | :--- |
| **Workspace Root** | `d:\Claude\Modding\Deadlock\` | Mod development scripts, scraped knowledge, documentation. |
| **Deadlock Game Root** | `D:\SteamLibrary\steamapps\common\Deadlock\` | Vanilla game installation (Steam App ID: `1422450`). |
| **Citadel Game Dir** | `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\` | Game assets, configs, vanilla `gameinfo.gi`. |
| **Custom Mod Staging** | `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\` | **Target folder for all mods.** Automatically loaded by `gameinfo.gi`. |
| **Vanilla Localization** | `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\resource\localization\` | English & multi-language ability/shop text files. |
| **Modding Tools Root** | `d:\Claude\Modding\Deadlock\tools\` | Compilers, viewers, and VPK utilities. |
| **Source 2 Viewer (GUI)** | `d:\Claude\Modding\Deadlock\tools\Source2Viewer.exe` | GUI tool for interactive inspection. **DO NOT run in CLI scripts (hangs).** |
| **Source 2 Viewer (CLI)** | `d:\Claude\Modding\Deadlock\tools\cli\Source2Viewer-CLI.exe` | **Headless CLI binary.** Always use for scripted VPK export/decompile. |
| **Reduced CSDK 12** | `d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\` | Valve Source 2 SDK: `resourcecompiler.exe` (`bin_cs2\win64`), Hammer. |
| **VPKEdit CLI & GUI** | `d:\Claude\Modding\Deadlock\tools\vpkedit\` | `vpkeditcli.exe` & `vpkedit.exe` for creating/packing `.vpk` packages. |
| **Blender 4.2.3 LTS** | `D:\games\Blender\blender.exe` | 3D modeling, UV unwrapping, baking, rigging, animations. |
| **ArtCraft Suite** | `D:\games\ArtCraft\artcraft-launcher.exe` | PhotoCraft (raster), VectorCraft (SVG), CadCraft, etc. |
| **Blender MCP Socket** | `127.0.0.1:9876` | JSON-RPC bridge allowing AI agents to control Blender headlessly. |

---

## 2. Documentation Library

1. [**`DEADLOCK_MODDING_INTELLIGENCE_DOC.md`**](file:///d:/Claude/Modding/Deadlock/DEADLOCK_MODDING_INTELLIGENCE_DOC.md)  
   Comprehensive Source 2 modding documentation:
   - VPK package structure (`pak01_dir.vpk`)
   - `gameinfo.gi` search path priority mechanics
   - Hero model replacement and skin textures
   - Audio events and soundbanks
   - Map editing & Hammer 5 setups

2. [**`AI_CREATIVE_WORKFLOWS_MCP_DOC.md`**](file:///d:/Claude/Modding/Deadlock/AI_CREATIVE_WORKFLOWS_MCP_DOC.md)  
   Exhaustive 2,250+ line technical handbook for AI agents:
   - Blender MCP JSON-RPC protocol specifications
   - Three.js to Blender conversion algorithms and coordinate math ($+90^\circ$ X-rotation)
   - Blender 4.2+ Geometry Nodes programmatic construction (`tree.interface.new_socket`)
   - Cycles headless PBR texture baking (Normals, AO, Curvature)
   - Rigging & game engine 4-bone vertex influence normalizer
   - Closed-loop multimodal visual feedback (offscreen turntable capture)
   - ComfyUI headless API texture synthesis
   - 25+ error troubleshooting almanac

3. [**`DEADLOCK_LAN_LAUNCHER_ARCHITECTURE_DOC.md`**](file:///d:/Claude/Modding/Deadlock/DEADLOCK_LAN_LAUNCHER_ARCHITECTURE_DOC.md)  
   Complete engineering blueprint for Deadlock LAN Launchers & DLP Hub:
   - Source 2 Steam Networking Sockets (GNS) and identity check mechanics
   - Native Go UDP loopback proxy architecture (replaces `jesus_proxy.exe`)
   - Client match connection and dedicated server host manager in Go
   - Valve A2S_INFO server query protocol (live ping, player count, map name)
   - Wails v2 / Tauri v2 desktop architecture, UPnP auto port-forwarding, and build pipeline

---

## 3. Installed CLI & Scripting Toolchains

### A. VPK Management via `vpkeditcli`
Pack any folder of loose files into a standard VPK:
```powershell
& "d:\Claude\Modding\Deadlock\tools\vpkedit\vpkeditcli.exe" -o "D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\pak01_dir.vpk" "path\to\mod_folder"
```

Extract an existing VPK:
```powershell
& "d:\Claude\Modding\Deadlock\tools\vpkedit\vpkeditcli.exe" -e "path\to\output_dir" "path\to\input.vpk"
```

### B. Asset & Texture Compilation via Valve `resourcecompiler.exe`
> [!IMPORTANT]
> **Schema Mismatch Warning:** NEVER use `Reduced_CSDK_12\game\bin\win64\resourcecompiler.exe` against Deadlock game paths! It fails with `ParticleFloatType_t Mismatch (particleslib)`.  
> **Always use the CS2 binary:** `d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe` with `-game "D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\citadel"`.

Compile raw source assets (`.vmat`, `.vmdl`, `.vtex`, `.vsnd`) into engine binaries:
```powershell
& "d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe" -game "D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\citadel" -f -i "path\to\asset.vtex"
```

### C. Headless Inspection & Decompilation via `Source2Viewer-CLI.exe`
> [!WARNING]
> Do NOT launch `tools\Source2Viewer.exe` in background tasks or CLI scripts. It is a WinForms/WPF GUI executable and hangs indefinitely without outputting to stdout.

Decompile specific assets directly from game VPKs:
```powershell
& "d:\Claude\Modding\Deadlock\tools\cli\Source2Viewer-CLI.exe" -i "D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\pak01_dir.vpk" -f "materials/overlays/signs_bodega" -o "path\to\output_dir" -d
```
List files in a package without dumping:
```powershell
& "d:\Claude\Modding\Deadlock\tools\cli\Source2Viewer-CLI.exe" -i "D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\pak01_dir.vpk" -f "materials/signage/" -l
```

### D. Developer Tools & Hammer 5
Launch Deadlock with developer tool suite enabled:
```powershell
& "d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin\win64\Deadlock_with_tools.exe"
# OR via the CSDK Configuration Launcher:
& "d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\csdkcfg.exe"
```

### E. Python Source 2 Stack
The following libraries are installed in Python 3.11:
- `vpk`: Read and extract VPK packages natively.
- `vdf`: Parse Valve KeyValues1 text format.
- `keyvalues3` & `kv3parser`: Parse and serialize Valve KeyValues3 (KV3) formats.
- `srctools`: Complete Valve engine library for parsing BSP, VMF, VMT, VPK.
- `Pillow` & `numpy`: Image channel manipulation and texture packing.

---

## 4. Modding Workflows & Recipes

### Workflow 1: Localization & Text (Persian/Farsi & BiDi Engine)
- **Source Vanilla Files:**
  - Hero abilities, lore & stats: `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\resource\localization\citadel_heroes\citadel_heroes_english.txt`
  - Shop items & upgrades: `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\resource\localization\citadel_mods\citadel_mods_english.txt`
- **Target Custom Deployment:**
  - `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_heroes\citadel_heroes_english.txt`
  - `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_mods\citadel_mods_english.txt`
- **Engine Rules & Architecture:**
  - **The 44-Hero Roster:** Deadlock's engine defines 44 heroes (IDs 1–44, including unreleased/experimental heroes). Always localize the complete 44-hero manifest.
  - **Ground Truth vs Hallucinations:** Never translate abilities or stats from LLM internal memory; parse vanilla strings directly from `citadel_heroes_english.txt` and `heroes.vdata`.
  - **Preserved Tokens:** Keep ability names in English. Preserve all engine placeholders `{s:...}`, `{g:...}`, `{k:...}` intact.
  - **Tier Upgrade LTR Rule (CRITICAL):** Never prepend `\u200F` (RLM) to tier upgrade tokens (`_t[123]_desc`). Tier cards must remain LTR so stats (`+25% Weapon Damage`) stay anchored to the left.
  - **BiDi Unicode Formatting:** English inside parentheses wrapped with `\u202A({inner})\u202C`; technical gaming terms clumped with Non-Breaking Spaces (`\u00A0`); inline tags padded with `\u00A0\u00A0\u202A{tag}\u202C\u200F`; `<br>` and `<span class=\"diminish\">` suffixed with `\u200F`.
- **Automated Tooling & Pipeline:**
  - Formatter & BiDi logic: `d:\Claude\Modding\Deadlock\hero_bidi_helper.py`
  - Master builder: `python d:\Claude\Modding\Deadlock\build_all44_perfect_localization.py`
  - Pre-flight syntax validator: `python d:\Claude\Modding\Deadlock\validate_final_mod.py`
  - Translation batches repository: `d:\Claude\Modding\Deadlock\localization_batches/` (batches 1 through 5_extra)
- **Deployment Notes:** Zero compilation needed. Loose text files in `citadel\custom\` override vanilla game files directly. Repack into `citadel\custom\pak82_dir.vpk` when the game is closed.

### Workflow 2: Shop Catalog Backgrounds (Panorama UI)
- **Target Assets:** `panorama/images/shop/catalog/`
  - `catalog_shop_bg_weapon_psd.vtex_c` (Weapon upgrades category)
  - `catalog_shop_bg_vitality_psd.vtex_c` (Vitality upgrades category)
  - `catalog_shop_bg_spirit_psd.vtex_c` (Spirit upgrades category)
  - `catalog_shop_popular_bg_psd.vtex_c` (Popular builds tab)
  - `catalog_shop_generic_bg2_psd.vtex_c` (All items / Generic tab)
  - `catalog_shop_filter_bg_psd.vtex_c` (Filter drawer background)
- **Format:** Uncompressed BGRA8888 raw stream.
- **Fast Patching:** Uncompressed `.vtex_c` files can be modified by replacing raw BGRA pixel bytes while preserving the original binary header (`build_and_pack_shop_logo.py`).
- **Margins & Offsets:**
  - Weapon, Vitality, Spirit: `size=(190, 190)`, bottom-right margin `(50, 60)`.
  - Popular, Generic, Filter: `size=(180, 180)`, bottom-right margin `(50, 210)` (extra bottom clearance avoids UI action buttons).
- **Automation Script:** `python d:\Claude\Modding\Deadlock\build_and_pack_shop_logo.py --auto`

### Workflow 3: Map Signages, Posters & Billboards (3D Overlays & Materials)
- **Target Assets:**
  - **Times Square / Broadway Billboards (4K Atlas):**  
    `materials/signage/signs_broadway_01_psd_e9c4ad49.vtex_c` (Material: `materials/signage/signs_broadway_01.vmat_c`)
    - Banners: `HEX JAZZ RECORDS` (Orange: `(90, 60, 610, 2030)`, Blue: `(1990, 60, 2510, 2030)`)
    - Posters: `Cassandra Totem` (`(2860, 2110, 3450, 3210)`), `DIMENSIONAL CHESS` (`(880, 2100, 1920, 3010)`)
  - **York Docks & Greenwich Street Signs (2K Bodega/Cola Sheet):**  
    `materials/overlays/signs_bodega01a_color_png_93bba988.vtex_c` & `d5c7e675` (Material: `materials/overlays/signs_bodega01a.vmat_c`)
    - Red Cross Cola center dark box: `x=1545..1845, y=880..1740`.
    - **CRITICAL UV ROTATION RULE:** Bodega wall signs are stored vertically on the texture sheet but mapped horizontally in-game. Custom logos/text MUST be rotated **90° counter-clockwise** before baking into the sheet so they appear right-side-up on the wall!
- **Compilation Format:** BC7 compressed texture (`VTEX_FORMAT_BC7`). Authored via DMX KeyValues2 `.vtex` definition files and compiled using `Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe`.
- **Automation Script:** `python d:\Claude\Modding\Deadlock\build_and_deploy_map_logos.py`

### Workflow 4: 3D Props & Custom Hero Skins
- **Step 1:** Decompile hero or prop using `Source2Viewer-CLI.exe` (`.vmdl_c` $\to$ `.gltf` or `.dmx`).
- **Step 2:** Modify geometry in **Blender 4.2.3**.
- **Step 3 (Crucial):** Run vertex weight normalizer to clamp vertex influences to **maximum 4 bone weights** (see Section 15 of `AI_CREATIVE_WORKFLOWS_MCP_DOC.md`).
- **Step 4:** Compile via `resourcecompiler.exe` into `citadel\custom\models\...`.

---

## 5. Non-Negotiable Engine Constraints for AI Agents

1. **`SearchPaths` & Mod Staging Priority:**
   - Never overwrite vanilla `citadel\pak01_dir.vpk`.
   - Mod search paths load loose files in `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\` FIRST before loading `.vpk` packages.
   - Deploying loose files allows instant hot-reloading without repacking VPKs.
2. **VPK File Lock Handling:**
   - When Deadlock is open, `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\pak82_dir.vpk` is locked by the OS (`PermissionError`).
   - If the game is running, deploy loose files directly into `citadel\custom\...`. Once the game closes, execute VPK repacking.
3. **Source 2 Texture Compiling (DMX KeyValues2 Syntax):**
   - Source 2 `.vtex` files are **DMX KeyValues2**, NOT KeyValues3. Header must strictly be:  
     `<!-- dmx encoding keyvalues2_noids 1 format vtex 1 -->`
   - Must declare `m_inputTextureArray`, `m_textureOutputChannelArray`, and `CDmeImageProcessor`.
4. **Physics Hulls (`vphys`):**
   - Source 2 VPhysics2 **strictly forbids concave collision meshes**.
   - All collision geometry must be strictly convex hulls (`bmesh.ops.convex_hull`).
5. **Rigging Bone Limit:**
   - Standard units: Max 128 bones.
   - Cinematic hero rigs: Max 256 bones.
   - Vertex weights: Strict maximum of 4 non-zero bone influences per vertex.
6. **Three.js to Blender Coordinate Space:**
   - Three.js is Y-Up; Blender/Source 2 is Z-Up.
   - Always apply $+90^\circ$ rotation around the X-axis: $X_b = X_t, Y_b = -Z_t, Z_b = Y_t$.
7. **Blender 4.2+ Geometry Nodes API:**
   - Sockets must be declared using `tree.interface.new_socket()`.
   - Never use deprecated Blender 3.x `tree.inputs.new()`.
8. **Blender MCP Socket Execution:**
   - The MCP addon runs on `127.0.0.1:9876`.
   - Registered in `C:\Users\Aryo\.gemini\config\mcp_config.json`.
