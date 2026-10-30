# DEADLOCK MODDING INTELLIGENCE DIRECTIVE
### Comprehensive Technical Reference & Systems Architecture for AI Coding Agents
**Document Classification:** Autonomous Agent Operational Guide  
**Target Engine:** Valve Source 2 Engine (x64 Windows Native / Proton Linux)  
**Game Title:** Valve's Deadlock (`appId: 1422450`)  
**Ecosystem Coverage:**
1. Valve Source 2 Asset Pipeline & VPK Client Modding (`deadlockmodding.pages.dev`, `github.com/Sqooky/Complete-Guide-to-the-Modding-Deadlock-Workflow`)
2. Deadlock Mod Manager Architecture & Distribution (`docs.deadlockmods.app/modding`)
3. Deadworks Dedicated Server .NET 10 Framework (`docs.deadworks.net`, `github.com/Deadworks-net/deadworks`)
4. Modlock WebAssembly Custom Gamemode Engine & Native Interop (`github.com/paralin/modlock`)
5. Hyperline Production Custom Client, Cloud Server Network & SDK (`hyperline.gg`, Discord `1546253926792429700`)
6. Community Engineering & Experimental Modding (Glutensnake Community `1345571549247438982`, `r/DeadlockTheGame`)

---

## 1. Executive Architectural Overview & Ecosystem Taxonomy

Deadlock is built on Valve's proprietary 64-bit Source 2 Engine. Unlike legacy Source 1 games (CS:GO, TF2) that utilized BSP geometry, VMT/VTF materials, and QC-compiled MDLs, Deadlock operates entirely on modern Source 2 resource architecture: KeyValues3 (KV3), VData schemas, compiled binary blocks (`*_c`), Animgraph2 skeletal animations, and Panorama UI.

Modding Deadlock spans three completely distinct technical paradigms and runtimes. An agent must evaluate the user's objective against this taxonomy before writing or editing files.

### 1.1 The Three Modding Paradigms

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  DEADLOCK MODDING ECOSYSTEM                                 │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│          TIER 1          │ │          TIER 2          │ │          TIER 3          │
│   Client-Side Assets     │ │  Dedicated Server .NET   │ │ In-Engine WASM Gamemodes │
│    & Content Modding     │ │   Plugin Architecture    │ │    & Native Interop      │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • Primary: Source 2 VPK  │ │ • Primary: Deadworks     │ │ • Primary: Modlock       │
│ • Target: Client/Local   │ │ • Target: Server Plugin  │ │ • Target: Custom Server  │
│ • Toolchain: CSDK 12,    │ │ • Runtime: .NET 10 SDK   │ │ • Runtime: Wasmtime/WASI │
│   S2V, CS2 Tools, Blender│ │   C# Class Library       │ │   TS, Luau, Python, Go   │
│ • Scope: Models, Skins,  │ │ • Scope: Server Admin,   │ │ • Scope: Custom Game     │
│   Sounds, UI Textures,   │ │   Game Logic, Modifiers, │ │   Modes, Quake Physics,  │
│   Panorama, Animations   │ │   Abilities, Tracing     │ │   Sandboxed Lua/TS Logic │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### 1.2 Paradigm Comparison Matrix

| Dimension | Tier 1: Client VPK Modding | Tier 2: Deadworks Server Plugins | Tier 3: Modlock WASM Custom Modes |
| :--- | :--- | :--- | :--- |
| **Primary Framework / Tool** | CSDK 12 / Source2Viewer / Blender | Deadworks Managed API (`net10.0`) | Modlock CLI / Wasmtime / SafetyHook |
| **Execution Environment** | Client Engine FileSystem SearchPath | Dedicated Server Native Host (`server.dll`) | Dedicated Server In-Process Detour / WASM |
| **Primary Languages** | KV3, VData, Python/Batch, C++ tools | C# (.NET 10.0 SDK) | TypeScript, JavaScript, Luau, Python, Go, C++23 |
| **Installation Directory** | `Deadlock/game/citadel/addons/` | `Deadlock/game/bin/win64/managed/plugins/` | Native host wrapper around `deadlock.exe` |
| **Packaging Format** | Valve Pack (`pak##_dir.vpk`) | Compiled Assemblies (`.dll`, `.pdb`) | Single WASM reactor module (`.wasm` + `mod.json`) |
| **Network Visibility** | Client-side only (unless server mounts) | Authoritative Server (affects all clients) | Authoritative Server + Protocol replication |
| **Client Requirement** | Client must have the VPK installed | Pure server-side (standard game client connects; custom UI requires launcher) | Custom client or connection via launcher / hyperline |
| **Anti-Cheat / Matchmaking** | Allowed in matchmaking if cosmetic; VData mods blocked in matchmaking | Requires `-insecure -dedicated` | Requires `-insecure -dedicated` |
| **Hot Reloading** | Requires game restart or resource reload | Native dynamic assembly swap on `.dll` copy | Instant zero-downtime hot reload via `holdReload()` |

---

## 2. Tier 1: Client-Side Content & Asset Modding (Source 2)

### 2.1 FileSystem SearchPath Hooking (`gameinfo.gi`)

Source 2 resolves resources hierarchically via search paths defined in KeyValues format inside `Deadlock/game/citadel/gameinfo.gi`. To enable addon mounting, `gameinfo.gi` must be patched to inject `Game citadel/addons`.

#### Patch Specification

Locate `FileSystem -> SearchPaths` in `game/citadel/gameinfo.gi` and ensure the exact hierarchy is maintained:

```kv3
FileSystem
{
    SearchPaths
    {
        Game_Language       citadel_*LANGUAGE*
        Game_LowViolence    citadel_lv
        Mod                 citadel
        Write               citadel
        Game                citadel/addons
        Game                citadel
        Mod                 core
        Write               core
        Game                core
        AddonRoot           citadel_addons
        OfficialAddonRoot   citadel_community_addons
    }
}
AddonConfig
{
    "UseOfficialAddons" "1"
}
```

> [!CRITICAL]
> 1. `Game citadel/addons` **must** be placed above `Game citadel` so addon files override base game assets.
> 2. Whenever Valve patches Deadlock via Steam, `gameinfo.gi` is frequently overwritten. The injection must be reapplied.
> 3. Avoid carriage-return (`\r\n` vs `\n`) corruption. Do not leave trailing `^M` line endings or unbalanced braces; an error will crash the game on startup: `Application unable to load gameinfo.gi file from directory "citadel" Failed to parse KeyValues`.

### 2.2 VPK Naming Conventions & Load Order Precedence

All client-side mods must be packed into a Valve Pack file placed in `Deadlock/game/citadel/addons/`.

- **Naming Syntax:** `pak##_dir.vpk` where `##` is a two-digit integer between `01` and `99`.
- **Precedence Rule:** Lower numbers take precedence over higher numbers (`pak01_dir.vpk` overrides `pak02_dir.vpk`).
- **File Limit:** Standard Source 2 VPK chunks are limited to **2.0 GB**. Larger mods must use multichunk packing (`pak01_dir.vpk` referencing `pak01_000.vpk`, `pak01_001.vpk`, etc.).

---

### 2.3 Source 2 Asset Architecture & Compilers

Source 2 enforces strict separation between **source assets** (`content/` directory) and **compiled binary resources** (`game/` directory, suffixed with `_c`).

| Asset Description | Source Extension | Compiled Extension | Source 2 Compiler | Technical Specification & Internal Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Valve Pack** | N/A | `.vpk` | `CS2 Workshop Manager` / `vpk.exe` | Archive packaging format, 2GB chunk limit. |
| **KeyValues3** | `.kv3` | `.kv3` | `CompileKV3` | Standard text/binary serialization format with GUID headers. |
| **Generic VData** | `.vdata` | `.vdata_c` | `CompileVData` | Defines heroes, abilities, items, decalgroups, modifiers, subclasses. |
| **Particle System** | `.vpcf` | `.vpcf_c` | `CompileParticle` | Authored via Particle Editor tool. |
| **Material Asset** | `.vmat` | `.vmat_c` | `CompileMaterial` | Authored via Material Editor; binds shaders, textures, and surface properties. |
| **Texture Asset** | `.vtex` / `.png` | `.vtex_c` | `CompileTexture` | Compiled image format. Authored via manual `.vtex`, VPDI, or VData lists. |
| **3D Model** | `.vmdl` | `.vmdl_c` | `CompileModel` | Authored in ModelDoc Editor; embeds meshes, LODs, hitboxes, materials. |
| **Sound Asset** | `.vsnd` / `.wav` | `.vsnd_c` | `CompileSound` | Compiled audio with embedded sample-rate and loop markers from `encoding.txt`. |
| **Sound Container** | `.vsnd` | `.vsnd_c` | `CompileSound` | Variant of `.vsnd` containing `CVoiceContainerBase` logic (VData sound entity). |
| **Sound Event Script**| `.vsndevts`| `.vsndevts_c`| `CompileSoundEventScript` | Declares soundevents, pitch/volume randomization, falloff curves. |
| **Sound Stack Script**| `.vsndstck`| `.vsndstck_c`| `CompileSoundStackScript` | Low-level DSP routing, operators, and parameters. |
| **Panorama Layout** | `.xml` | `.vxml_c` | `CompilePanorama` | Declarative UI markup skeleton. |
| **Panorama Styling** | `.css` | `.vcss_c` | `CompilePanorama` | CSS styling rules with Source 2 vendor extensions (`flow-children`). |
| **Panorama Dynamic** | `.vpdi` | `.vpdi_c` | `CompilePanorama` | Dynamic image manifest compiling source images to `.vtex_c`. |
| **Panorama Logic** | `.js` / `.ts` | `.vjs_c` / `.vts_c` | `CompileJavaScript` / `CompileTypeScript` | Panorama UI scripting layer. |
| **Pulse Graph** | `.vpulse` | `.vpulse_c` | `CompilePulseGraphDef` | Node-based visual scripting definition (Pulse Editor). |
| **Animgraph 2 Skel** | `.vnmskel` | `.vnmskel_c` | `CompileNmSkel` | Animgraph2 skeletal hierarchy, bone indices, bonemasks. |
| **Animgraph 2 Clip** | `.vnmclip` | `.vnmclip_c` | `CompileNmClip` | Animation clips, additive subtracts, frame events (`CNmIDEvent`). |
| **Animgraph 2 Graph**| `.vnmgraph` | `.vnmgraph_c` | `CompileNmGraph` | High-level state machines, transitions, blend trees. |
| **Map Asset** | `.vmap` | `.vpk` / `.vmap_c` | `CompileMap` (Hammer) | KeyValues2 Hammer map compiling worldnodes, lightmaps, entity lumps. |
| **Entity Lump** | `.vents` | `.vents_c` | `CompileEntityLump` | Entity declarations (`default_ents.vents`, point templates). |
| **Surface Properties**| `.vsurf` | `.vsurf_c` | `CompileSurfaceProperties`| Bullet penetration, physics friction, impact sounds. |
| **Response Rules** | `.vrr` | `.vrr_c` | `CompileResponseRules` | Context-driven dialogue and voice lines (`scripts/talker/`). |

---

### 2.4 CSDK 12 Toolchain & Workspace Layout

Community Source Development Kit 12 (**CSDK 12**) merges CS2 Workshop Tools with Deadlock build fixes.

#### Workspace Directory Hierarchy

```
Reduced_CSDK_12/
├── csdkcfg.exe                     # Configuration launcher tool
├── bin/                            # Standard tool binaries (compiles Animgraph 1)
├── bin_server/                     # Server-mode binaries (requires full game files)
├── bin_tools/                      # Tools binaries (fixes projected particle preview crashes)
├── bin_cs2/                        # CS2 binaries for standalone GUI Map Compiler
├── content/
│   └── citadel_addons/
│       └── <addon_name>/           # WORKSPACE: Raw sources (.vmdl, .png, .wav, .vdata, .vnmclip)
└── game/
    ├── citadel/                    # Base game files
    └── citadel_addons/
        └── <addon_name>/           # ARTIFACT: Compiled outputs (.vmdl_c, .vtex_c, .vsnd_c)
```

> [!IMPORTANT]
> - Addon names **must be strictly lowercase with no spaces** (e.g., `custom_skin_mod`). Uppercase or spaced directory names will fail to register in `csdkcfg.exe`.
> - Do not install CSDK inside cloud-synced folders (OneDrive, Google Drive, Dropbox), as lock contention breaks the Source 2 Asset Browser.

#### Binary Mode Selection Guide

- `bin`: Default tools. Compiles Animgraph 1; crashes on previewing certain projected particles.
- `bin_tools`: Preferred for model and particle work. Fixes projected particle preview crashes; cannot compile legacy Animgraph 1.
- `bin_server`: Launches Deadlock in dedicated server mode with live Material Editor, VData compiler, and Panorama hot-reloading.
- `bin_cs2`: Used by `GUIMapCompiler/CS2MapCompiler.exe` for baking map lightmaps.

---

### 2.5 Practical Mod Creation Workflows

#### A. Texture Compilation Architecture (`.vtex_c`)

Source 2 compiles raw raster images (PNG, TGA, PSD) into optimized engine texture containers (`.vtex_c`). Depending on the target system (Panorama UI vs. 3D World Materials), two primary workflows exist for programmatic/headless modification, alongside two SDK Asset Browser methods.

##### Method 1: Headless CLI Compilation via DMX `.vtex` & `resourcecompiler.exe` (Universal & Recommended)
This is the native Valve compiler workflow for compiling standard 3D world textures, decals, and overlays into GPU-compressed formats (such as BC7 or DXT5) with full mipmap generation.

1. **Crucial Compiler Binary Selection:**
   - **DO NOT** run `Reduced_CSDK_12\game\bin\win64\resourcecompiler.exe` against Deadlock assets. It throws an immediate fatal error:
     `ParticleFloatType_t Mismatch - Member Count (resourcecompiler.dll vs particles.dll)` and aborts.
   - **ALWAYS** invoke the CS2-derived binary:  
     `d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe`  
     with the argument `-game "D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\citadel"`.

2. **DMX KeyValues2 `.vtex` Definition Syntax:**
   Source 2 `.vtex` files are **DMX KeyValues2** files, NOT KeyValues3. Writing a KV3 header causes `Unserialize: Cannot determine encoding from file, and no encoding provided!`.
   The file must strictly be formatted as follows:

```kv
<!-- dmx encoding keyvalues2_noids 1 format vtex 1 -->
"CDmeVtex"
{
    "m_inputTextureArray" "element_array" 
    [
        "CDmeInputTexture"
        {
            "m_name" "string" "InputTexture0"
            "m_fileName" "string" "materials/overlays/my_custom_sign.png"
            "m_colorSpace" "string" "srgb"
            "m_typeString" "string" "2D"
        }
    ]
    "m_outputTypeString" "string" "2D"
    "m_outputFormat" "string" "BC7"
    "m_textureOutputChannelArray" "element_array"
    [
        "CDmeTextureOutputChannel"
        {
            "m_inputTextureArray" "string_array" [ "InputTexture0" ]
            "m_srcChannels" "string" "rgba"
            "m_dstChannels" "string" "rgba"
            "m_mipAlgorithm" "CDmeImageProcessor"
            {
                "m_algorithm" "string" "Box"
            }
            "m_outputColorSpace" "string" "srgb"
        }
    ]
}
```

3. **Compilation Command:**
   Place the `.png` and `.vtex` into `tools\Reduced_CSDK_12\content\citadel\materials\...`, then run:
```powershell
& "D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe" `
    -game "D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\citadel" `
    -f -i "D:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\content\citadel\materials\overlays\my_custom_sign.vtex"
```
   The compiled `.vtex_c` will be generated in `tools\Reduced_CSDK_12\game\citadel\materials\...`.

---

##### Method 2: Fast In-Place Byte Patching for Uncompressed Panorama Textures
Many 2D Panorama UI backgrounds (e.g. Shop catalog screens) are compiled by Valve as uncompressed `RGBA8888` / `BGRA8888` streams.
- **Binary Layout:** The `.vtex_c` consists of a Source 2 resource header (containing block descriptors `RED2` and `DATA`), followed by a continuous raw uncompressed byte buffer of length $W \times H \times 4$.
- **Fast Patching Logic:**
  1. Read the original `.vtex_c` binary.
  2. Compute `raw_len = width * height * 4`.
  3. Extract `header = vtex_bytes[:-raw_len]`.
  4. Convert the replacement PNG image from RGBA to BGRA (`Image.merge("RGBA", (b, g, r, a))`).
  5. Concatenate `new_vtex_bytes = header + bgra.tobytes()`.
  6. Write to destination. Zero external compilation required. (Implemented in `build_and_pack_shop_logo.py`).

---

##### Method 3: The VData Image List Compiler (CSDK Asset Browser)
Create `content/citadel_addons/<addon>/panorama/image_compiler.vdata`:

```kv3
<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
    generic_data_type = "panorama_image_list"
    image_list = 
    [
        "file://{images}/heroes/archer.psd",
        "file://{images}/heroes/archer_card.psd",
        "file://{images}/heroes/archer_mm.psd",
        "file://{images}/heroes/archer_sm.psd",
        "file://{images}/heroes/archer_vertical.psd"
    ]
}
```
*Action:* Open CSDK 12 Asset Browser, right-click `image_compiler.vdata`, select **Recompile -> Full**.

---

##### Method 4: Valve Panorama Dynamic Images (`.vpdi`)
Create `content/citadel_addons/<addon>/panorama/dynamic_images.vpdi`:

```kv3
"DynamicImages"
{
    "Explicit Files"
    {
        "{images}/heroes/custom_hero.png"           ""
        "{images}/heroes/custom_hero_card.png"      ""
        "{images}/heroes/custom_hero_mm.png"        ""
    }
}
```
*Action:* Recompile the `.vpdi` in Asset Browser. All images resolve under `{images}` (`panorama/images/`).

---

### 2.6 In-Game Map Signage, Overlays & 3D Billboards Architecture

Deadlock's streetscape features extensive in-world billboards, street vendor signs, and building posters mapped via `citadel_overlay.vfx` and `environment_layer.vfx` materials.

#### A. Times Square & Broadway Signage (4K Atlas)
- **Primary Material:** `materials/signage/signs_broadway_01.vmat_c`
- **Color Texture:** `materials/signage/signs_broadway_01_psd_e9c4ad49.vtex_c` (Format: `VTEX_FORMAT_BC7`, 4096 × 4096)
- **Key Billboard Coordinates:**
  1. **`HEX JAZZ RECORDS` (Orange Banner - Main Times Square Face):**  
     Bounding Box: `(90, 60, 610, 2030)` | Center: `(350, 1045)` | Sizing: $\approx 440 \times 440$ px.
  2. **`HEX JAZZ RECORDS` (Blue Banner - Times Square Corner Face):**  
     Bounding Box: `(1990, 60, 2510, 2030)` | Center: `(2250, 1045)` | Sizing: $\approx 440 \times 440$ px.
  3. **`Cassandra - NEW TOTEM MODELS` (Broadway Uptown Building):**  
     Bounding Box: `(2860, 2110, 3450, 3210)` | Center: `(3155, 2660)` | Sizing: $\approx 460 \times 460$ px over totem body.
  4. **`DIMENSIONAL CHESS` (Broadway Uptown Poster):**  
     Bounding Box: `(880, 2100, 1920, 3010)` | Circular Emblem Center: `(1600, 2750)` | Sizing: $\approx 460 \times 460$ px.

#### B. York Docks & Greenwich Street Signs (2K Bodega / Cola Sheet)
- **Primary Material:** `materials/overlays/signs_bodega01a.vmat_c`
- **Color Textures:**  
  `materials/overlays/signs_bodega01a_color_png_93bba988.vtex_c` (Diffuse color)  
  `materials/overlays/signs_bodega01a_color_png_d5c7e675.vtex_c` (Translucent/weathered pass)
- **Sign Bounds on Canvas:** `x: 1530..1860, y: 560..2040`
- **Dark Center Box ("Drink Red Cross Cola"):** `[1545, 880, 1845, 1740]` (Width 300 px, Height 860 px)
- **Background Color Tone:** RGB `(48, 44, 42)` / `#302C2A`.
- **THE 90° CCW UV ROTATION RULE (CRITICAL):**  
  The bodega wall sign is stored vertically on the texture atlas:
  - Bottom = Left side in-game (`PRODUCE TOILETRIES ASSORTED MEATS`)
  - Middle = Center in-game (`DRINK Red Cross COLA`)
  - Top = Right side in-game (`PAPERS CANDY FROZEN PARTS`)  
  *Engine UV Mapping:* The game rotates this texture slice **90° clockwise** when projecting onto in-game walls. Therefore, custom artwork/logos pasted onto this texture MUST be rotated **90° counter-clockwise** before saving, ensuring they render right-side-up in the game.
- **Reference Script:** `d:\Claude\Modding\Deadlock\build_and_deploy_map_logos.py`

---

### 2.7 Panorama Shop Catalog Architecture & Customization

The in-match item shop uses high-resolution raster background plates stored under `panorama/images/shop/catalog/`.

#### Catalog Texture Manifest:
| Texture Filename | Purpose / Tab | Bounding Box Margins | Logo Sizing |
| :--- | :--- | :--- | :--- |
| `catalog_shop_bg_weapon_psd.vtex_c` | Weapon Upgrades (Orange) | Bottom-Right `(50, 60)` | $190 \times 190$ px |
| `catalog_shop_bg_vitality_psd.vtex_c` | Vitality Upgrades (Green) | Bottom-Right `(50, 60)` | $190 \times 190$ px |
| `catalog_shop_bg_spirit_psd.vtex_c` | Spirit Upgrades (Purple) | Bottom-Right `(50, 60)` | $190 \times 190$ px |
| `catalog_shop_popular_bg_psd.vtex_c` | Popular Builds Tab | Bottom-Right `(50, 210)` | $180 \times 180$ px |
| `catalog_shop_generic_bg2_psd.vtex_c` | All Items / Generic Tab | Bottom-Right `(50, 210)` | $180 \times 180$ px |
| `catalog_shop_filter_bg_psd.vtex_c` | Filter Drawer Panel | Bottom-Right `(50, 210)` | $180 \times 180$ px |

> [!TIP]
> **Margin Rationale:** The Popular, Generic, and Filter textures require a bottom margin of `210 px` (instead of `60 px`) to avoid overlapping the bottom build action buttons and gold cost status bars in the Panorama UI layout.
> **Reference Script:** `d:\Claude\Modding\Deadlock\build_and_pack_shop_logo.py`

---

### 2.8 Headless Modding CLI Tooling & Common Agent Traps Almanac

| Trap / Issue | Symptom | Root Cause | Deterministic Fix |
| :--- | :--- | :--- | :--- |
| **S2V GUI Freeze** | Background task runs forever; agent hangs for 1+ hours. | Calling `tools\Source2Viewer.exe` in headless scripts. It's a GUI app that expects user interaction. | **Always use:** `d:\Claude\Modding\Deadlock\tools\cli\Source2Viewer-CLI.exe`. |
| **ResourceCompiler Schema Crash** | `ParticleFloatType_t Mismatch` abortion. | Using `Reduced_CSDK_12\game\bin\win64\resourcecompiler.exe` directly on Citadel. | **Always use:** `Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe` with `-game "...\game\citadel"`. |
| **Phantom `unknown/` Paths** | `Could not find file at ... in pack file!` | Custom scripts parsing `vpkeditcli --file-tree` branch indentations incorrectly. | Use `Source2Viewer-CLI.exe -i <VPK> -l` to obtain verified, exact internal paths. |
| **Locked `pak82_dir.vpk`** | `PermissionError: [WinError 32]` when overwriting custom VPK. | Deadlock is actively running and has an open handle on the `.vpk`. | Deploy files as **loose files** in `citadel\custom\...`. The engine reads loose files first. Repack VPK after game closes. |
| **Upside-Down / Sideways Decals** | Decal on wall renders 90° sideways in-game. | UV projection on wall meshes rotates slices relative to the canvas. | Check UV rotation using thumbnail crops and compensate with reverse rotation before compilation. |

---

### 2.9 Panorama UI Localization & RTL/BiDi Architecture (Persian/Arabic)

Source 2 Panorama UI natively renders fonts for complex scripts, but lacks native bidirectional (BiDi) paragraph formatting when English game terms, numbers, `<span ...>` tags, and engine tokens are mixed inside Right-to-Left (Persian/Arabic) sentences. Without strict Unicode control markers, text renders scrambled, parentheses invert, and tier upgrades flip backwards.

#### A. The 44-Hero Roster & Ground Truth vs. LLM Hallucinations
1. **Engine Hero Manifest:**
   - Deadlock's internal engine files (`heroes.vdata` and `citadel_heroes_english.txt`) define **44 heroes** (IDs 1 through 44, including experimental and hero-labs heroes like Apollo, Paige, Frank, Cadence, etc.), not merely the 25 core roster heroes present in the main pick menu.
2. **The Ground Truth Extraction Law (Non-Negotiable):**
   - **NEVER** translate hero abilities from memory or LLM training recall. Language models consistently hallucinate outdated or incorrect ability stats, scaling rates, damage types, and tier mechanics (e.g. Holliday T3, Abrams, Vindicta).
   - Ground-truth strings must strictly be parsed directly from vanilla `citadel_heroes_english.txt` and `heroes.vdata` inside `game\citadel\pak01_dir.vpk`.
3. **Gaming Convention & Token Preservation:**
   - Ability titles remain in English (standard esports/gaming convention).
   - Only ability descriptions, quips, tooltips, and tier upgrades are translated.
   - All engine placeholders must remain strictly unmodified:
     - Stat substitutions: `{s:AbilityCooldown}`, `{s:Damage}`, `{s:Radius}`, etc.
     - Inline attribute pills: `{g:citadel_inline_attribute:...}`
     - Keybind mappings: `{g:citadel_binding:...}`, `{k:citadel_innate_1}`

#### B. The 8 Non-Negotiable Panorama BiDi Formatting Rules (`hero_bidi_helper.py`)

| # | Rule Name | Engine Defect Prevented | Implementation Specification |
| :--- | :--- | :--- | :--- |
| **1** | **Tier Upgrade LTR Exemption** | Prepending `\u200F` (RLM) flips tier cards backwards: numbers jump to the right side and stats scramble. | **NEVER apply leading `\u200F` to tier upgrades (`_t[123]_desc`).** Tier upgrades MUST remain LTR so that `+25% Weapon Damage` displays with numbers anchored on the left. |
| **2** | **Parentheses Inversion Fix** | Standalone `(` and `)` invert in RTL context (`(Damage)` renders as `)Damage(`). | Wrap English or numeric content inside parentheses with Left-to-Right Embedding: `\u202A({content})\u202C`. |
| **3** | **Technical Term Clumping (NBSP)** | Multi-word English gaming terms break backwards across line wraps when surrounded by Persian words. | Replace spaces inside all known gaming terms with Non-Breaking Space (`\u00A0`): e.g. `Bonus\u00A0Spirit\u00A0Damage`, `Heavy\u00A0Melee`, `Bullet\u00A0Resist`. |
| **4** | **Inline Attribute & Keybind Isolation** | `{g:citadel_inline_attribute:...}` and `{g:citadel_binding:...}` break bidirectional flow and invert adjacent values. | Pad and isolate with: `\u00A0\u00A0\u202A{tag}\u202C\u200F` (Double NBSP + LRE + tag + PDF + RLM). |
| **5** | **English Span Direction Isolation** | English-only highlight spans `<span class=\"highlight\">` confuse the paragraph directionality. | Wrap English highlight spans in: `\u202A<span class=\"...\">...</span>\u202C\u200F` (narrative text only). |
| **6** | **Newline & Diminish Direction Reset** | Panorama resets paragraph direction back to LTR after every `<br>` or `<span class=\"diminish\">`. | Append `\u200F` (RLM) immediately following every `<br>` and `<span class=\"diminish\">`. |
| **7** | **Corrupting `<Panel>` Tag Strip** | Text tokens embedding `<Panel class="AbilityPropertyIcon ..."></Panel>` crash Panorama layouts. | Regex strip all `<Panel ...>` and `</Panel>` tags cleanly before processing. |
| **8** | **Leading RLM on Narrative Tokens** | General Persian sentences without leading RLM render punctuation on the wrong edge. | Prepend `\u200F` (RLM) to all narrative tokens containing Persian characters (excluding tier upgrades). |

#### C. Master Localization Pipeline & Repository Structure
- **Core Formatter Engine:** `d:\Claude\Modding\Deadlock\hero_bidi_helper.py`
- **Master Automated Builder:** `d:\Claude\Modding\Deadlock\build_all44_perfect_localization.py`
  - Merges verified translation batches, applies the 8 BiDi rules, updates vanilla strings in-place, appends extra hero-labs tokens, and deploys.
- **Pre-Flight Syntax & BiDi Validator:** `d:\Claude\Modding\Deadlock\validate_final_mod.py`
  - Validates all 3,700+ tokens, checks double-quote escaping, verifies BiDi markers, and asserts 0 syntax errors.
- **Ground-Truth Batch Repository:** `d:\Claude\Modding\Deadlock\localization_batches/`
  - `accurate_batch1.json` through `accurate_batch5_extra.json` (868 audited, ground-truth Persian tokens covering all 44 heroes).
- **Target Deployment Files:**
  - `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_heroes\citadel_heroes_english.txt`
  - `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_mods\citadel_mods_english.txt`

---

#### B. Audio Replacement & Sound Loop Compilation (`.vsnd_c`)

1. **Locate Target Soundevent:**
   - Abilities/Heroes: Inspect `game/citadel/pak01_dir.vpk` -> `heroes.vdata` -> locate target hero -> search `soundevent:` property. Soundevents resolve in `soundevents/hero/<heroname>.vsndevts_c`.
   - Voice Lines: Inspect `scripts/talker/*.vrr` (Response Rules).
2. **File Placement:** Raw `.wav` files must be placed in `content/citadel_addons/<addon>/sounds/...` matching the exact relative path of the original audio.
3. **Loop Configuration & MP3 Compression (`encoding.txt`):**  
   Place an `encoding.txt` file adjacent to the `.wav` files in your content folder:

```kv3
<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->
{
    compress = 
    {
        format = "mp3"
        minbitrate = 128
        maxbitrate = 320
        vbr = 1
    }
    files = 
    [
        {
            fileName = "ability_loop.wav"
            loop = 
            {
                loop_start_time = 0.0
                loop_end_time = 11.428526
            }
        },
        {
            fileName = "weapon_fire_loop.wav"
            loop = 
            {
                loop_start_sample = 44100
                loop_end_sample = 3810374
            }
        }
    ]
}
```

*Diagnostic Console Commands:*
- `soundinfo`: Lists all currently playing sounds and channels.
- `stopsound`: Immediately silences all playing audio.
- `snd_showstart true`: Logs the exact file path and soundevent when any sound begins.
- `play <path/to/sound.vsnd>`: Tests direct sound playback.
- `snd_sos_start_soundevent <soundevent_name>`: Tests soundevent playback through DSP stack.

---

#### C. 3D Model Import & Blender Setup

1. **Units & Scale Transformation:**
   - Source 2 uses imperial inches as engine units: **1 meter = 39.37 Source 2 units**.
   - When importing GLTF/FBX into Blender: In Object Mode, select all (`A`), use Scale tool, enter **`39.37`** uniformly across X, Y, and Z.
   - Facing Orientation: Ensure the model faces **`X+`** (Source 2 forward vector).
   - Apply Transformations: Execute **`Object -> Apply -> All Transforms`** (`Ctrl + A`).
2. **Export Configuration:**
   - Format: **DMX** (using `BlenderSource2Tools` plugin).
   - DMX Version: **Binary 9 / Model 22** (ModelDoc compatible).

---

#### D. Custom Animations & Animgraph2 (`vnmclip`)

Deadlock uses Valve's **Animgraph2 (AG2)** animation system.

1. **Decompilation & Extraction:**  
   Use Source 2 Viewer (latest dev build) to decompile the target `.vnmclip_c` to `.dmx` and export the corresponding `.vnmskel_c`.
2. **Blender Animation Setup:**
   - Import DMX using `PulseSrcOps` (Blender 4.5+).
   - **Strict Frame Matching:** Match the exact `FPS / Duration / Frame Count` of the replaced stock clip. If an 85-frame clip is swapped into a 15-frame walk cycle, the client plays normally, but the authoritative server clamps duration, forcing the model to play at 5.5x hyper-speed for all other players.
   - **IK Bone Attachment:** Bones outside the `Pelvis` hierarchy (e.g., `ik_target_l`, `ik_target_r`, `weapon_hand`) must have `Copy Location` and `Copy Rotation` constraints applied to their corresponding joint (Hand/Ankle).
   - Props/Weapons: Attach via `Child Of` constraint on Frame 1, click `Set Inverse`.
   - **Baking:** Always bake animations and clear active constraints before DMX export.
3. **ModelDoc Compilation:**
   - In ModelDoc, import DMX via **Add -> Add Simple Animations**.
   - Clear existing `NMSkeletonList` or `AnimGraph2List` nodes to prevent conflict.
   - Run **Tools -> Make Default Animgraph2** -> Select `.vnmskel`, check **Convert Anim Sequences to Clips**.
   - **Aim Matrices:** Additive aim clips (e.g., `aim_idle.vnmclip`) are authored by subtracting the midpoint frame:
     ```kv3
     m_additiveType = "RelativeToFrame"
     m_additiveBaseFilename = ""
     m_additiveBaseFrame = "UserSpecifiedFrame"
     m_nAdditiveBaseFrameIdx = 31 // (For 61-frame aim matrix)
     ```
   - **IK Chain Configuration in ModelDoc:**
     Add an `IKChain` node for every limb to prevent joint flipping:
     - `Chain Name`: Name matching `IKChains` from S2V data.
     - `End Effector Bone`: Terminal bone (e.g., `Hand_R` or `Ankle_L`).
     - `Number of Bones`: Set to `2` (counts up hierarchy: Hand -> Lower Arm -> Upper Arm).
     - `Target Bone`: Associated IK target attachment.
   - **Packing Caution:** Pack **only** the compiled `vnmclip_c` into your addon VPK. **Never pack `vnmskel_c`** unless bonemasks have been modified; packing custom skeletons overrides character rigs globally and breaks other skins.

---

#### E. S2FM Stretched Limb Bug Fix

In Source 2 Filmmaker (S2FM), Deadlock characters situated far from the world origin (`[0, 0, 0]`) experience severe procedural bone stretching and limb warping due to floating-point drift in CS2 constraint solvers.
- **Fix:** In S2FM Clip Editor, Right-click Model -> **Utilities -> Bake Procedural Bones**.
- Animate and pose normally.
- On completion: **Enable Procedural Bones -> Bake Procedural Bones** to recapture secondary clothing/cloth motion.

---

## 3. Dedicated Server & Multiplayer Hosting

Custom maps and mods altering `.vdata` files **cannot be played on official Valve matchmaking servers**. To test or play custom content with others, a local dedicated or listen server is required.

### 3.1 Local Dedicated Server Configuration

1. **Patch `game/citadel/gameinfo.gi`:**
   ```kv3
   NetworkSystem
   {
       CreateListenSocketP2P    2
       BetaUniverse
       {
           // ...
       }
   }
   ConVars
   {
       "net_p2p_listen_dedicated"  "1"
       "rate"
       {
           "min"        "98304"
           "default"    "786432"
           "max"        "1000000"
       }
   }
   ```
2. **Launch Script (`launch_dedicated.bat`):**
   ```bat
   start .\game\bin\win64\deadlock.exe -dedicated -insecure -condebug -allow_no_lobby_connect +tv_citadel_auto_record 0 +map dl_midtown
   ```
3. **Connection Routine:**
   - In the dedicated server console, execute `status`.
   - Copy the SteamID3 socket address: `[A:1:XXXXXXXXXX:XXXXX]`.
   - Connecting clients open Developer Console (`F7`) and run:
     ```
     connect [A:1:XXXXXXXXXX:XXXXX]
     ```
   - Change heroes or teams via console: `changeteam 0`.

### 3.2 SourceTV Demo Recording

To record matches on custom servers:
- Start recording: `tv_record_immediate 1; tv_record <demoname>`
- Stop recording: `tv_stoprecord`
- Output: `game/citadel/<demoname>.dem`
- Playback: `playdemo <demoname>`

---

## 4. Tier 2: Deadworks Server Plugin Framework (.NET 10)

**Deadworks** (`docs.deadworks.net`) is a high-performance C# managed server framework for Deadlock dedicated servers running under `.NET 10.0`. It injects a managed runtime into `server.dll` via `DeadworksManaged.Api.dll`.

### 4.1 Project Configuration (`.csproj`)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <Reference Include="DeadworksManaged.Api">
      <HintPath>C:\Program Files (x86)\Steam\steamapps\common\Deadlock\game\bin\win64\managed\DeadworksManaged.Api.dll</HintPath>
      <Private>false</Private>
    </Reference>
    <Reference Include="Google.Protobuf">
      <HintPath>C:\Program Files (x86)\Steam\steamapps\common\Deadlock\game\bin\win64\managed\Google.Protobuf.dll</HintPath>
      <Private>false</Private>
    </Reference>
  </ItemGroup>

  <Target Name="DeployToGame" AfterTargets="Build">
    <Copy SourceFiles="$(OutputPath)$(AssemblyName).dll;$(OutputPath)$(AssemblyName).pdb" 
          DestinationFolder="C:\Program Files (x86)\Steam\steamapps\common\Deadlock\game\bin\win64\managed\plugins\$(AssemblyName)\" />
  </Target>
</Project>
```

### 4.2 Lifecycle & Core Architecture

Plugins inherit from `DeadworksPluginBase`:

```csharp
using DeadworksManaged.Api;

namespace CoreAdminPlugin;

public class CoreAdminPlugin : DeadworksPluginBase
{
    public override string Name => "Core Admin Engine";
    public override string Description => "Authoritative server administration & mechanics";
    public override string Author => "AI Agent";
    public override string Version => "1.0.0";

    public override void OnLoad(bool isReload)
    {
        Console.WriteLine($"[CoreAdmin] Plugin initialized. Hot-reload: {isReload}");
    }

    public override void OnUnload()
    {
        Console.WriteLine("[CoreAdmin] Plugin unloading, clearing active hooks.");
    }

    public override void OnPrecacheResources()
    {
        // Precache models and particles by source extension (.vmdl, not .vmdl_c)
        Precache.AddResource("models/hideout/hideout_sandbox_ball.vmdl");
        Precache.AddResource("particles/generic_fx/gold_pickup.vpcf");
    }
}
```

### 4.3 Command System

Commands use the `[Command]` attribute and receive a `Caller` context:

```csharp
[Command("teleport", Description = "Teleports player to coordinates")]
public void CmdTeleport(Caller caller, float x, float y, float z)
{
    var pawn = caller.Player?.GetHeroPawn();
    if (pawn == null)
        throw new CommandException("Requires an active hero pawn in the world.");

    pawn.TeleportWithView(new Vector3(x, y, z), pawn.CameraAngles);
    caller.Reply($"Teleported to {x}, {y}, {z}");
}
```

### 4.4 Game Events & Interception

Game events are subscribed via `[GameEventHandler]` and return `HookResult`:

```csharp
[GameEventHandler("player_death")]
public HookResult OnPlayerDeath(PlayerDeathEvent ev)
{
    var victim = ev.UseridController;
    var killer = ev.AttackerController;

    if (victim != null && killer != null)
    {
        Console.WriteLine($"[KillFeed] {killer.PlayerName} eliminated {victim.PlayerName} (Headshot: {ev.Headshot})");
    }

    return HookResult.Continue; // HookResult.Handled or HookResult.Stop to swallow
}
```

### 4.5 The `CCitadelPlayerPawn` API

`CCitadelPlayerPawn` represents the physical hero entity in the server world.

```csharp
// Currency Modification
pawn.ModifyCurrency(
    ECurrencyType.Gold,
    amount: 500,
    source: ECurrencySource.Bounty,
    silent: false,
    forceGain: true
);

// Reset Hero Loadout to VData Defaults
pawn.ResetHero();

// Inventory & Ability Injection
pawn.AddItem("upgrade_sprint_booster", enhanced: true);
pawn.AddItem("upgrade_echo_shard", EAbilitySlot.Signature1);
pawn.RemoveItem("upgrade_sprint_booster");

// Buffs & Modifiers
using var kv = new KeyValues3();
kv.SetFloat("duration", 3.5f);
pawn.AddModifier("modifier_citadel_knockdown", kv);

// Health & Damage
pawn.Heal(150.0f);
pawn.Hurt(50.0f, attacker: killerPawn);
```

### 4.6 Declarative In-Engine HUD Panels (`DeadworksManaged.Api.UI`)

Deadworks includes a declarative UI tree for displaying custom HUD elements to clients running the Deadworks launcher:

```csharp
using DeadworksManaged.Api.UI;

static UINode BuildMatchHud() =>
    UI.Vertical()
        .Add(
            UI.Label("timer_label", "Match Time: 00:00"),
            UI.Horizontal()
                .Add(
                    UI.Label("team_amber", "Amber: 0"),
                    UI.Label("team_sapphire", "Sapphire: 0")
                )
        );

public override void OnClientFullConnect(ClientFullConnectEvent ev)
{
    if (ev.Controller is { } controller)
    {
        UI.Panel("match_hud").BuildLayout(controller.Recipients, BuildMatchHud());
    }
}

// Differential updates
UI.Panel("match_hud").Set(RecipientFilter.All, "timer_label", "Match Time: 05:23");
```

### 4.7 Server-Driven UI via Subtitle System Hijacking

A fundamental limitation of vanilla Source 2 dedicated servers is the absence of arbitrary client RPC channels for custom UI without client-side executable modification. Deadworks bypassed this limitation in **v0.4.14 (August 17, 2026)** by engineering a transport layer on top of the engine's closed-caption subtitle subsystem (`https://deadworks.net/blog/we-ship-our-ui-through-a-subtitle-system`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEADWORKS UI PIPELINE                           │
│                                                                        │
│  [Deadworks Plugin]                                                    │
│         │ (Builds declarative tree: UI.Vertical(), UI.Button(), etc.)  │
│         ▼                                                              │
│  [Deadworks Managed API]                                               │
│         │ Encodes UI diffs / DOM updates into binary subtitle payload  │
│         ▼                                                              │
│  [Source 2 Engine server.dll]                                          │
│         │ Fires CUserMessage_CloseCaption / Subtitle Voice Channel     │
│         ▼                                                              │
│  ═══════════════════════ NETWORK STREAM ══════════════════════════════ │
│         ▼                                                              │
│  [Deadlock Client with Deadworks Launcher Hook]                        │
│         │ Subtitle listener intercepts magic-header packets            │
│         │ Suppresses text render in vanilla subtitle bar               │
│         ▼                                                              │
│  [Client Panorama DOM Engine]                                          │
│         └── Injects / updates live Panorama panels in the HUD viewport │
└────────────────────────────────────────────────────────────────────────┘
```

#### Key Capabilities & API Methods (v0.4.15+)
- **Declarative Node Construction:** `UI.Vertical()`, `UI.Horizontal()`, `UI.Label()`, `UI.Button()`, `UI.Input()`.
- **Dynamic CSS & Transitions:** `UIPanel.SetStyle("background-color", "#ff0000")`, `UINode.WithTransition("opacity 0.2s ease-in-out")`.
- **Hover & Interaction States:** Direct mapping of `:hover` and `:active` styling in C#.
- **Cursor Focus Management:**
  ```csharp
  // Capture mouse cursor for interactive server menus (inventories, scoreboards)
  UIPanel.RequestCursor(controller);
  // Release cursor back to gameplay aim
  UIPanel.ReleaseCursor(controller);
  ```
- **Client Bootstrap Detection:**
  ```csharp
  if (UI.HasClientBootstrap(controller))
  {
      // Client has the Deadworks launcher listener active; safe to stream complex UI
      UI.Panel("custom_shop").BuildLayout(controller.Recipients, BuildShopLayout());
  }
  else
  {
      // Fallback to chat messaging or console notifications for vanilla clients
      caller.Reply("Connect with Deadworks Launcher to access the graphic shop.");
  }
  ```

---

### 4.8 Framework Compilation, Build Architecture & Server Hosting

The official Deadworks source repository is located at `github.com/Deadworks-net/deadworks`.

#### Directory Layout
```
deadworks/
├── src/
│   ├── native/                # C++23 native host; hooks server.dll via nethost
│   │   ├── local.props        # Local developer MSBuild path configuration
│   │   ├── server_hooks.cpp   # Inline detours and VTable dispatch hooks
│   │   └── protobuf/          # Protobuf 3.21.8 definitions & serializers
│   └── managed/               # .NET 10 solution (Deadworks.sln)
│       ├── Deadworks.Core/    # Low-level memory marshaling & engine types
│       ├── Deadworks.Api/     # Public plugin SDK (Entities, Events, UI, Commands)
│       └── Deadworks.Runtime/ # Plugin loader, DI container, Hot-reload watcher
├── examples/plugins/          # Reference implementations
│   ├── SetModelPlugin/        # Demonstrates dynamic model replacement
│   ├── DeathmatchPlugin/      # FFA gameplay loop with custom scoreboards
│   ├── TagPlugin/             # Spatial infection gamemode using Zone triggers
│   ├── TicTacToePlugin/       # Interactive multiplayer UI over subtitle stream
│   ├── ItemRotationPlugin/    # Dynamic VData item shop modifier
│   └── AutoRestartPlugin/     # Memory leak mitigation & automated map cycling
└── docker/                    # Linux / Wine dedicated server deployment container
```

#### Compilation Workflow
1. **Prerequisites:**
   - Visual Studio 2026 (v17.12+) or Rider with C++ and .NET 10 SDK installed.
   - Google Protobuf compiler `protoc` (v3.21.8).
2. **Configuration (`local.props`):**
   Create `src/native/local.props` to inform MSBuild where your local Deadlock installation resides:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <Project ToolsVersion="Current" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
     <PropertyGroup>
       <CitadelPath>D:\SteamLibrary\steamapps\common\Deadlock</CitadelPath>
     </PropertyGroup>
   </Project>
   ```
3. **Build Execution:**
   ```bash
   dotnet build src/managed/Deadworks.sln -c Release
   msbuild src/native/DeadworksNative.vcxproj /p:Configuration=Release /p:Platform=x64
   ```
4. **Binary Target Structure:**
   Binaries deploy to:
   ```
   [Deadlock]/game/citadel/addons/deadworks/
   ├── deadworks.dll          # Native bootstrap loader
   └── managed/
       ├── DeadworksManaged.dll
       ├── System.*.dll
       └── plugins/           # Place compiled plugin DLLs here
   ```
5. **Server Launch Parameters:**
   - Dedicated servers must run with default port `27067` to prevent client collisions:
     ```bash
     citadel.exe -dedicated -port 27067 +map street_test +sv_lan 0
     ```
   - **Linux Deployment:** Deadworks distributes an official Docker image (`deadworks/server:latest`) utilizing Wine with built-in master server heartbeat registration and automated map rotation.

---

### 4.9 Unified Permissions & Administration (RBAC) System

Introduced in **v0.5.4 (October 6, 2026)**, Deadworks features a built-in Role-Based Access Control (RBAC) subsystem (`docs.deadworks.net/guides/admins-and-permissions`):

#### Configuration (`addons/deadworks/configs/admins.json`)
```json
{
  "roles": {
    "superadmin": {
      "permissions": ["*"]
    },
    "moderator": {
      "permissions": [
        "admin.kick",
        "admin.mute",
        "admin.teleport",
        "game.pause"
      ]
    }
  },
  "users": {
    "76561198000000000": {
      "role": "superadmin",
      "flags": ["immunity.high"]
    }
  }
}
```

#### Code Enforcement
```csharp
[Command("slay", Description = "Eliminate a target player pawn.")]
[RequiresPermission("admin.slay")]
public void SlayCommand(ICommandContext caller, CCitadelPlayerController target)
{
    var pawn = target.GetHeroPawn();
    if (pawn != null)
    {
        pawn.Kill(respawnImmediately: false);
        Server.Broadcast($"[Admin] {target.PlayerName} was slain by {caller.Player?.PlayerName ?? "Console"}.");
    }
}
```

---

### 4.10 Cinematic Camera, Spatial Zones & World Entity APIs

Starting in **v0.4.17 (September 25, 2026)**, Deadworks exposed deep engine camera manipulation and spatial trigger geometries:

#### Cinematic Camera Lerping
```csharp
// Smoothly transition player camera to an aerial cinematic view
var camera = controller.Camera;
camera.LerpTarget(new Vector3(100.0f, 250.0f, 800.0f), durationSeconds: 2.5f);
camera.LerpDistance(450.0f, durationSeconds: 2.5f);
camera.LerpFov(90.0f, durationSeconds: 1.5f);

// Return camera control to third-person hero tracking
camera.Clear(durationSeconds: 1.0f);
```

#### Spatial Zone Trigger Volumes
```csharp
// Create an authoritative AABB bounding box in world space
var captureZone = Zone.Create(
    min: new Vector3(-500.0f, -500.0f, 0.0f),
    max: new Vector3(500.0f, 500.0f, 300.0f)
);

captureZone.Entered += (sender, entity) =>
{
    if (entity is CCitadelPlayerPawn pawn)
    {
        pawn.Controller?.SendChat("[Zone] You have entered Sector Alpha!");
        // Render boundary visualization beam
        CBeam.CreateBox(captureZone.Bounds, color: Color.Green, duration: 5.0f);
    }
};

captureZone.Left += (sender, entity) =>
{
    if (entity is CCitadelPlayerPawn pawn)
    {
        pawn.Controller?.SendChat("[Zone] You left Sector Alpha.");
    }
};
```

#### Hero Freezing & Body Swapping
```csharp
// Freeze player inputs and physics simulation
pawn.Freeze();
// Unfreeze
pawn.Unfreeze();

// Temporarily hijack another player's or bot's hero pawn
controller.TakeOverHero(targetBotPawn);
```

---

### 4.11 Production Plugin Patterns & Verified Code Implementations

Extracted directly from official Deadworks production plugins (`Deadworks-net/deadworks/examples/plugins/`):

#### A. Resource Precaching, Dynamic Models & Sound Announcements
```csharp
public class SetModelPlugin : DeadworksPluginBase
{
    public override string Name => "SetModel Example";
    private const string TargetModel = "models/heroes_wip/werewolf/werewolf.vmdl";

    public override void OnPrecacheResources()
    {
        // Mandatory: precache before pawn assignment to prevent client crashes
        Precache.AddResource(TargetModel);
    }

    [Command("werewolf", Description = "Turn yourself into a werewolf")]
    public void CmdWerewolf(CCitadelPlayerController caller)
    {
        var pawn = caller.GetHeroPawn();
        if (pawn == null) return;

        pawn.SetModel(TargetModel);

        var msg = new CCitadelUserMsg_HudGameAnnouncement
        {
            TitleLocstring = "MODEL SWAP",
            DescriptionLocstring = "You are now a werewolf!"
        };
        NetMessages.Send(msg, RecipientFilter.Single(caller.EntityIndex - 1));
    }
}
```

#### B. Gamemode ConVar Overrides & Team/Hero Assignment
```csharp
public override void OnStartupServer()
{
    // Clean server state for deathmatch / tag / arena modes
    ConVar.Find("citadel_trooper_spawn_enabled")?.SetInt(0);
    ConVar.Find("citadel_npc_spawn_enabled")?.SetInt(0);
    ConVar.Find("citadel_start_players_on_zipline")?.SetInt(0);
    ConVar.Find("citadel_allow_duplicate_heroes")?.SetInt(1);
    ConVar.Find("citadel_voice_all_talk")?.SetInt(1);
    ConVar.Find("citadel_player_starting_gold")?.SetInt(0);
    ConVar.Find("citadel_player_spawn_time_max_respawn_time")?.SetInt(3);
    ConVar.Find("citadel_active_lane")?.SetInt(255); // Disables lane requirements
    ConVar.Find("citadel_rapid_stamina_regen")?.SetInt(1);
}

public override void OnClientFullConnect(ClientFullConnectEvent args)
{
    var controller = args.Controller;
    if (controller == null) return;

    // Direct team change: 2 = Amber, 3 = Sapphire
    controller.ChangeTeam(2);

    // Direct hero assignment via enum
    controller.SelectHero(Heroes.Warden);
}
```

#### C. Comprehensive Timer API & Entity Lifecycle Data (`EntityData<T>`)
```csharp
// 1. One-shot timer
Timer.Once(3.Seconds(), () => Console.WriteLine("Fired after 3s"));

// 2. Ticking loop (every N ticks)
var heartbeat = Timer.Every(64.Ticks(), () => Console.WriteLine("64-tick tick"));

// 3. Stateful sequence
Timer.Sequence(step =>
{
    Console.WriteLine($"Step {step.Run}/5 (elapsed: {step.ElapsedTicks} ticks)");
    return step.Run < 5 ? step.Wait(500.Milliseconds()) : step.Done();
});

// 4. Deferred to next frame
Timer.NextTick(() => Console.WriteLine("Next frame execution"));

// 5. Entity-bound data storage (auto-cleaned upon entity deletion)
private readonly EntityData<IHandle?> _playerBuffTimers = new();
_playerBuffTimers[pawn] = heartbeat;
```

#### D. Stamina, Modifiers, Particle Systems & Sound FX
```csharp
// Infinite stamina & air mobility
var stamina = pawn.AbilityComponent.ResourceStamina;
stamina.LatchValue = stamina.MaxValue;
stamina.CurrentValue = stamina.MaxValue;

var mp = pawn.ModifierProp;
if (mp != null)
{
    mp.SetModifierState(EModifierState.UnlimitedAirJumps, true);
    mp.SetModifierState(EModifierState.UnlimitedAirDashes, true);
}

// Particle system spawning in world coordinates
var particle = CParticleSystem.Create("particles/upgrades/mystical_piano_hit.vpcf")
    .AtPosition(pawn.Position + Vector3.UnitZ * 100)
    .StartActive(true)
    .Spawn();

pawn.EmitSound("Mystical.Piano.AOE.Explode");
Timer.Once(5.Seconds(), () => particle?.Destroy());
```

#### E. Item Imbuing & Shop Mutation
```csharp
// Add item and imbue into ability slot (Signature1 = Slot 0, Ultimate = Slot 3)
var result = pawn.TryAddItem("upgrade_warp_stone", EAbilitySlot.Signature1, out var item, enhanced: true);

// Imbue an already owned item
pawn.ImbueItem("upgrade_echo_shard", EAbilitySlot.Signature2);

// Check if item exists and supports imbuing
if (ItemInfo.Exists("upgrade_tech_purge"))
{
    var effects = ItemInfo.GetImbueEffects("upgrade_tech_purge");
    bool canImbue = effects != ImbueEffects.None;
}
```

---

### 4.12 Subtitle Transport Protocol Internals (`dw_bootstrap.js`)

The Deadworks launcher hooks the Panorama subtitle DOM to stream server UI. Autonomous agents implementing or debugging UI streaming must observe these engine wire invariants:

1. **Engine ConVar Priming:**
   ```javascript
   $.DispatchEvent("CitadelConCommand", "closecaption 1");
   $.DispatchEvent("CitadelConCommand", "cc_linger_time 0.1");
   ```
2. **Payload Delimiters:**
   - User message prefix: `u~`
   - Frame and argument separator: ASCII `0x1f` (`\x1f`, Unit Separator).
3. **Cursor Ownership Arbitration:**
   - Calls to `UIPanel.RequestCursor(controller)` trigger client-side Panorama cursor claims reasserted every 4 ticks (`CURSOR_REASSERT_TICKS = 4`) to override gameplay mouse capture.

---

## 5. Tier 3: Modlock In-Engine WASM Gamemode Engine

**Modlock** (`github.com/paralin/modlock`) is an advanced, high-performance custom game mode runtime. It embeds a sandboxed **Wasmtime (WASI reactor)** runtime directly into Deadlock's dedicated server using native C++ detours via **SafetyHook** and **Zydis**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DEADLOCK SERVER PROCESS                           │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │   Source 2 Engine     │              │     Modlock Native Host   │  │
│  │     (server.dll)      │◄────────────►│       (C++23 Host)        │  │
│  │                       │  SafetyHook  │ • Game Signatures Scan    │  │
│  │ • CBaseEntity VTable  │  Detours &   │ • VtableSlotHook          │  │
│  │ • Schema Offsets      │  VTable Patches • ThunkOwner RAII        │  │
│  │ • Match Clock         │              │ • Protobuf Serializer     │  │
│  └───────────────────────┘              └─────────────┬─────────────┘  │
│                                                       │                │
│                                         Protobuf Host │ Calls          │
│                                         (host_call,   │ host_read,     │
│                                          modlock_event)                │
│                                                       ▼                │
│                                         ┌───────────────────────────┐  │
│                                         │      Wasmtime Sandbox     │  │
│                                         │   (WASI Preview 1 Reactor)│  │
│                                         │ • CPU Budget per Frame    │  │
│                                         │ • Isolated Memory Space   │  │
│                                         │ • TypeScript / Luau / Go  │  │
│                                         │ • React TSX Declarative HUD│ │
│                                         └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Host Architecture & Native Detours

Modlock inspects engine memory via `data/game_signatures.txtpb`:
- **SafetyHook Detours:** Performs inline byte-level hooking on non-virtual calls.
- **`VtableSlotHook` & `ThunkOwner`:** Patches original dispatch tables without altering the object's table pointer. Cleanups occur in reverse order of installation upon unload.
- **Engine Sigcheck:** `modlock-sigcheck <deadlock-dir> --signatures data/game_signatures.txtpb` runs automated pattern validation against updated `server.dll` binaries.

### 5.2 The Entity Reflection System (`modlock --dump`)

Modlock dumps Source 2 reflection registries on demand (`modlock-host --dump data/dump`):
- `schemas.json`: 5,796 classes and 829 enums with offsets and base classes.
- `entities.json`: 1,183 designer names, 1,070 inputs, 433 outputs.
- `survey.json`: Automated 12-server headless creation audit recording which designer names live alone vs crash the engine.

#### Entity Naming Taxonomy

1. **Designer Name:** Map placement identifier (e.g., `npc_trooper_boss`). Used by `createEntity`, `create`.
2. **Schema Class:** Underlying C++ class (e.g., `CNPC_TrooperBoss`). Used for typed field access (`readField`, `writeField`).
3. **Subclass:** Game data VData definition (e.g., `npc_boss_tier1`). Defines weapon, health, and model parameters.

> [!CAUTION]
> **Fatal Server Crash Guard:** Standalone instantiation of any class deriving from `CCitadelBaseAbility` (abilities, weapons, items) will crash the server immediately upon thinking or deletion. Modlock hard-refuses standalone creation of abilities; they must be attached via `giveItem` or `replaceAbility`. Entities requiring maps or heroes (e.g., `citadel_bounce_pad`) are similarly blocked.

### 5.3 The `mod.json` Manifest Specification

```json
{
  "slug": "ffa-arena",
  "name": "Free-For-All Arena",
  "version": "1.0.0",
  "language": "LANGUAGE_TYPESCRIPT",
  "map": "dl_midtown",
  "movement": {
    "model": "MODEL_QUAKEWORLD",
    "scale": 1.25,
    "unpredictedButtons": "8753143351297"
  },
  "abilities": [
    {
      "ability": "gunslinger_rocket_launcher",
      "properties": {
        "AbilityCooldown": 0.8,
        "Damage": 120
      },
      "fields": {
        "CitadelAbilityVData.m_projectileInfo/ProjectileInfo_t.m_flSpeed": 1500.0
      },
      "copyFields": {
        "CAbilityRocketLauncherVData.m_ExplosionParticle": "CitadelAbilityVData.m_skillshotMissParticle"
      }
    }
  ],
  "settings": [
    {
      "key": "scoreboard",
      "label": "Scoreboard Size",
      "kind": "KIND_CHOICE",
      "choices": [
        { "value": "full", "label": "Full" },
        { "value": "top", "label": "Top 3" }
      ],
      "default": "full"
    }
  ]
}
```

### 5.4 TypeScript Custom Game Mode Authoring

Modlock gamemodes are authored in standard TypeScript (`main.ts`).

#### Core Match Implementation Example

```typescript
import {
  command,
  onStart,
  onFrame,
  onDamage,
  onDamaged,
  onWorld,
  players,
  serverCommand,
  holdModifierState,
  addBot,
  show,
  toast,
  type Player,
  type DamageEvent
} from 'modlock';
import { CCitadelPlayerPawn } from 'modlock/entities';

// Server Configuration: Disable Minions & Matchmaking Systems
onStart(() => {
  serverCommand('sv_hibernate_when_empty 0');
  serverCommand('citadel_trooper_spawn_enabled 0');
  serverCommand('citadel_neutral_spawn_enabled 0');
  serverCommand('citadel_spawn_practice_bots 0');
});

// Enable Global Friendly Fire
onWorld(() => {
  holdModifierState('MODIFIER_STATE_FRIENDLY_FIRE_ENABLED');
});

// Command Routing
command('ready', (player) => {
  player.respawn();
  player.teleport([0, 0, 500], [0, 0, 0]);
  toast(player, 'You entered the arena!');
});

command('bot', (player) => {
  addBot({ hero: 'hero_wraith' });
  toast(player, 'Bot spawned.');
});

// Damage Interception & Reflection
onDamage((hit: DamageEvent) => {
  if (hit.attacker === hit.victim) {
    hit.damage = 0; // Cancel self-damage
    return;
  }
  // Double headshot damage
  if (hit.crit) {
    hit.damage *= 2.0;
  }
});

// Reactive TSX Declarative HUD
onFrame((frame) => {
  for (const p of players()) {
    show(
      p,
      <panel
        style={{
          flow: 'down',
          horizontalAlign: 'right',
          verticalAlign: 'top',
          margin: [80, 24, 0, 0],
          padding: 16,
          background: '#0a0f14d0',
          borderRadius: 8
        }}
      >
        <label style={{ fontSize: 20, bold: true, color: '#f5c542' }}>
          ARENA FFA
        </label>
        <label style={{ color: '#ffffff', margin: [4, 0, 0, 0] }}>
          Match Time: {Math.floor(frame.timeSeconds)}s
        </label>
      </panel>
    );
  }
});
```

---

### 5.5 In-Engine 3D World Objects & Floating Billboards (`createText`)

Modlock enables instantiating 3D text billboards directly inside the Source 2 world space, dynamically floating above hero heads or objective spots:

```typescript
import { createText, type WorldObject } from 'modlock';

// Create a camera-facing 3D billboard in world coordinates
const marker: WorldObject = createText({
  text: "BOUNTY TARGET\nPlayer 1",
  position: { x: 150.0, y: -300.0, z: 250.0 },
  fontSize: 70,
  color: 0xffd34dff, // RGBA hex format
  faceCamera: true   // Billboard rotation automatically tracks player eye angles
});

// Dynamically update position along with moving hero pawn
marker.move({ x: newX, y: newY, z: newZ + 120.0 });

// Remove from world
marker.remove();
```

---

### 5.6 In-Game Building & Placement Engine (`Dropper`)

Hyperline Freestyle's `/build` command is powered by Modlock's `Dropper` engine (`repos/modlock/js/src/dropper.ts`).

> [!CRITICAL]
> **Source 2 Static vs Physics Prop Constraint:** The Deadlock engine automatically deletes solid models that carry active physics prop data when spawned as static map instances. To prevent spawned geometry from vanishing, dynamic catalogs must use pure environment props:
> - Catwalk ramps: `models/props_catwalks/catwalk_ramp_256_128_01.vmdl`
> - Catwalk straights: `models/props_catwalks/catwalk_straight_256_01.vmdl`
> - Crates: `models/props_industrial/wood_crate_64.vmdl`
> - Pallets: `models/props_city/wood_pallet_01a.vmdl`
> - Concrete barriers: `models/props_city/concrete_barrier_01a.vmdl`
> - Bounce pads: `models/props_gameplay/cube_100_preview.vmdl` with metadata `{ bounce: 900 }`

#### Building Setup
```typescript
import {
  command,
  Dropper,
  dropperButtons,
  loadSpot,
  onFrame,
  onInput,
  precache,
  watchInput
} from 'modlock';

const catalog = [
  { name: 'Crate', category: 'Crates', model: 'models/props_industrial/wood_crate_64.vmdl' },
  { name: 'Ramp', category: 'Catwalks', model: 'models/props_catwalks/catwalk_ramp_256_128_01.vmdl' },
  { name: 'Bounce pad', category: 'Fun', model: 'models/props_gameplay/cube_100_preview.vmdl', scale: 0.5, bounce: 900 }
];

const dropper = new Dropper(catalog, loadSpot({ map: 'dl_midtown', objects: [] }));

onStart(() => {
  precache({ resources: catalog.map(e => e.model) });
  watchInput(dropperButtons); // Capture movement buttons for building adjustments
});

onFrame((frame) => {
  for (const connection of players()) {
    connection.player.watchMovement(true);
  }
  dropper.frame(frame.movement);
});

onInput((player, pressed) => dropper.input(player, pressed));
command('build', (player) => dropper.toggle(player));
```

---

### 5.7 Polyglot Gamemode SDKs & Multi-Language Bindings

Modlock compiles polyglot runtimes into the dedicated server's WASM reactor:

#### A. Luau (`main.luau`)
```luau
--!strict
local modlock = require("@modlock")

modlock.command("hello", function(player)
    player:chat("Hello from Luau!")
    player:sound("Damage.Send.Crit")
end)

modlock.onFrame(function(frame)
    -- Frame tick processing
end)
```

#### B. Python (`main.py`)
```python
import modlock

@modlock.command("hello")
def hello(player: modlock.Player, args: str) -> None:
    player.chat("Hello from Python!")

@modlock.on_frame
def on_frame(frame: modlock.FrameEvent) -> None:
    pass
```

#### C. Go (`main.go`)
```go
package main

import "github.com/paralin/modlock/mod"

func init() {
    mod.Command("hello", func(p mod.Player, args string) {
        _ = p.Chat("Hello from Go!")
    })
    mod.OnFrame(func(f *mod.FrameEvent) {
        // High-performance tick logic
    })
}

func main() {} // Required by Go compiler; runtime driven by server events
```

---

## 6. Synthesized Decision Matrix for Autonomous AI Agents

Before an agent executes any file creation or script execution, consult this operational decision tree:

```
                                  [USER GOAL]
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
Visual/Cosmetic/Audio?        Dedicated Server Mod?       Custom Game Mode/Physics?
         │                             │                             │
         ▼                             ▼                             ▼
   [USE TIER 1: VPK]         [USE TIER 2: DEADWORKS]       [USE TIER 3: MODLOCK]
 • CSDK 12 toolchain         • .NET 10 Class Library       • TypeScript / Luau / Go
 • SearchPaths gameinfo.gi   • DeadworksManaged.Api.dll    • WASM sandbox compile
 • Asset Browser compile     • CBaseEntity / Pawn hooks    • SafetyHook detours
 • Output: pak##_dir.vpk     • Output: Managed .dll        • Output: mod.json + .wasm
```

### 6.1 Agent Execution Checklist & Safety Invariants

1. **SearchPaths File Mutation Safety:**  
   Always verify `gameinfo.gi` contains `Game citadel/addons` placed strictly before `Game citadel`. Never truncate existing `SearchPaths` entries.
2. **Animation Duration Clamping:**  
   When replacing a `vnmclip`, never export an animation with an arbitrary duration. The frame count must match the target stock clip to avoid client-server rate desynchronization.
3. **Blender Model Units Conversion:**  
   Never export a raw model from Blender without the `39.37` scale multiplier. Forgetting this results in microscopic in-game character models.
4. **VData Modification Multiplayer Constraint:**  
   Never promise that custom hero stats or new abilities will work in official Valve matchmaking. VData mods exclusively function on local listen or dedicated servers with `-insecure`.
5. **Entity Instantiation Crash Protection:**  
   In both Deadworks and Modlock, never create abilities (`CCitadelBaseAbility`) as standalone world entities. Always use `AddItem` or `giveItem` on an active hero pawn.
6. **UI Visibility Invariants:**  
   Neither Deadworks HUD panels nor Modlock JSX panels will render on a vanilla Deadlock client connected over standard matchmaking. Deadworks requires the Deadworks launcher; Modlock requires its custom client bridge or hyperline connection.

---

## 7. Live Community Intelligence, Breaking Engine Changes & Undocumented Solutions

This section captures critical, undocumented discoveries, breaking Source 2 engine patches, and community-engineered workarounds extracted directly from the official Deadlock Modding Discord engineering channels (`#announcements`, `#modding-guides`, `#tools-discussion`, `#custom-maps`, `#models`, `#animations`, `#particles`, `#audio`, `#entities`).

### 7.1 The AnimGraph2 (AG2) Engine Migration & ModelDoc Incompatibilities

During recent engine updates, Valve migrated Deadlock's hero skeletal animation runtime from legacy animation definitions (`CitadelHeroModelGameData_t`) to **AnimGraph2 (AG2)**, introducing `AnimGraph2List` and `NmSkeletonList` nodes.

#### The Problem
When decompiling hero models (`.vmdl_c`) from current game builds using Source 2 Viewer and opening them in CSDK 12's ModelDoc, the compiler fails immediately with:
```
Failed to unserialize document data from kv3 data:
rootNode.children: Failed to allocate an instance of class 'NmSkeletonList'
rootNode.children: Failed to allocate an instance of class 'AnimGraph2List'
```
CSDK 12 is a kitbashed toolchain based on an earlier CS2 build that lacks class definitions for `NmSkeletonList` and `AnimGraph2List`.

#### The Solution (Dual Workflow)

Agents must choose between two workflows depending on the modding objective:

1. **Workflow A: The CSDK 12 Compatibility Route (Using AG2 Cleaner)**
   - **Target:** Visual mesh swaps, texture replacements, weapon models.
   - **Procedure:** Run the community utility **`AG2 Cleaner`** (or execute a regex/KV3 script) over the decompiled `.vmdl` text file.
   - **Strip Specification:** Remove all `NmSkeletonList` and `AnimGraph2List` child blocks from the root node.
   - The model can now be opened, textured, and compiled cleanly in CSDK 12 ModelDoc without crashing.

2. **Workflow B: Modern Native AG2 Compilation (Using CSwin64 / CS2 Tools)**
   - **Target:** Custom skeletal animations, new hero rigs, complex movement blends.
   - **Environment:** Requires **`CSwin64`** (the 5.0GB stripped Counter-Strike 2 tools distribution) or full **Counter-Strike 2 Workshop Tools** (`csgocfg.exe`).
   - **Procedure:**
     1. In Source 2 Viewer, extract the target hero's compiled skeletal asset (`.vnmskel_c`) and decompile it to raw `.vnmskel`.
     2. Inspect the hero model's `Data` block in S2V to record the exact stock AnimGraph2 node names and paths.
     3. In CS2 ModelDoc, explicitly add the `AnimGraph2List` and `NmSkeletonList` nodes referencing the `.vnmskel` and `.vnmgraph` files.
     4. Compile using CS2 binaries (`CompileModel`). The output `.vmdl_c` is 100% compliant with Deadlock's modern AG2 runtime.

---

### 7.2 Movement Sound Schema Breaking Change (`TaggedSoundSettings_t`)

In late 2026, Valve refactored the internal C++ sound tagging schema across all character models.

#### The Breaking Change
Valve renamed the internal prefab type from:
```
CitadelTaggedSoundSettings_t  ───►  TaggedSoundSettings_t
```
Existing and legacy character replacement mods utilizing prefabs mapped to `CitadelTaggedSoundSettings_t` fail to bind audio events at runtime, causing **complete muting of hero footstep, jumping, mantle, and slide sounds**.

#### Remediation Protocol
In any custom hero model or prefab located under `content/citadel_addons/<addon>/models/prefabs/`:
1. Open the `.vmdl` or `.vmdl_prefab` in a text editor.
2. Locate any occurrence of `CitadelTaggedSoundSettings_t`.
3. Replace with `TaggedSoundSettings_t`.
4. Alternatively, deploy the community template prefab: `models/prefabs/taggedsound_t.vmdl_prefab`.

---

### 7.3 FeModel Cloth Physics Decompilation & Simulation

Deadlock characters make extensive use of Valve's proprietary GPU/CPU cloth solver, **FeModel** (`.cloth` / embedded binary cloth buffers).

1. **Extraction:** Modern nightly builds of Source 2 Viewer (PR #1317+) feature full support for decompiling `FeModel` structures into readable `.cloth` definitions and proxy meshes.
2. **Blender Simulation Workflow:**
   - Use the community fork **`BlenderSource2Tools`**.
   - Import the character along with its procedural proxy cloth meshes.
   - Author vertex groups corresponding to collision envelopes and pin constraints (e.g., cape anchors, belt loops).
   - Export via DMX (`Model 22`).
   - ModelDoc automatically links the cloth physics parameters into the compiled `.vmdl_c`.

---

### 7.4 Modern Arc-Track Camera FOV System vs Legacy `CitadelCameraSettings_t`

Deadlock's third-person perspective and dynamic aim zoom were historically controlled by a single block in ModelDoc: `CitadelCameraSettings_t`.

#### Engine Evolution
- **Legacy FOV:** `CitadelCameraSettings_t` is retained **only** as a fallback when the user selects the "Legacy FOV" slider in game options.
- **Modern Dynamic FOV:** Modern Deadlock uses an **arc-shaped sequence of skeletal attachment points** mapped around the character's upper body and pelvis (`camera_arc_*`).
  - As the player aims, slides, or enters tight spaces, the camera interpolates along this curved track rather than performing linear ray casts.
- **Compiler Invariant:** ModelDoc in CSDK 12 **cannot** compile these modern camera arc attachment trees. Any hero mod authoring modern camera behavior **must be compiled using CS2 Workshop Tools**. Compiling in CSDK 12 will discard the arc metadata.

---

### 7.5 Custom Map Creation & Hammer Source 2 Discoveries

Creating custom maps (`.vmap`) for Deadlock involves specific level-design constraints and compiler pipelines.

#### A. GPU Lightmap Baking via `GUIMapCompiler`
Standard Hammer in CSDK 12 cannot bake lightmaps natively without crashing.
- **Workflow:** Launch `Reduced_CSDK_12/GUIMapCompiler/CS2MapCompiler.exe`.
- **Binaries:** Requires the `bin_cs2` binary set.
- **Hardware Requirement:** GPU ray tracing (Hardware DXR / Vulkan Ray Tracing) is strictly required. If baking fails, ensure modern GPU drivers are installed.
- **Fatal Asset Blacklist:** Certain base game environmental models contain corrupted geometric structures that cause the lightmap compiler to crash instantly during the BVH building phase:
  - `models/environment/nature/trees/tree_spruce_01.vmdl_c`
  - `models/environment/nature/trees/caldera_shrine_tree.vmdl_c`
  *Rule:* Autonomous agents generating map assets or decompiling map prefabs must substitute or delete these tree models before initiating a lightmap compile.

#### B. Engine Playable Area Coordinates & Out-of-Bounds Kills
Deadlock's engine enforces hard coordinate bounding limits on all maps:
- If a player pawn traverses outside the engine's hard bounding envelope, the server executes an immediate hard kill or enters an infinite teleportation loop back to world origin `[0, 0, 0]`.
- **Level Design Rule:** Level designers must establish large invisible collision barriers (`tools/toolsclip` or `trigger_multiple`) well within the coordinate boundaries to prevent pawns from reaching the engine edge.

#### C. Custom Minimap / Radar Texture Fallback Bug
- In recent game patches, custom map radar textures authored at `materials/panoramic/radar/<mapname>_radar.vmat_c` are frequently disregarded by the Panorama UI, which silently falls back to displaying the `dl_midtown` radar texture.
- **Workaround:** Ensure the map definition in `maps/<mapname>.vdata_c` explicitly declares the radar bounds, scale, and material path, matching the internal name of the `.vmap`.

#### D. Bot Navigation (`navhulls.vdata_c`)
To enable bot movement and pathfinding on custom maps:
- Install the community `navhulls.vdata_c` package into `[CSDK]/game/citadel/scripts/`. Without this file, Hammer's navigation compiler will fail to generate valid nav meshes (`.nav`).

#### E. Extended Community FGD Entities (`citadel.fgd`)
The latest community FGD updates include vital entity definitions previously missing:
- `citadel_item_pickup_rejuv_herotest_infospawn`: Entity responsible for spawning the Mid-Boss Rejuvenator crystal.
- `trigger_tier3phase2_shield`: Defines invulnerability shields around Tier 3 Patron structures.
- Lane Nomenclature: All internal references to the legacy "Orange Lane" have been updated to "Green Lane" (`citadel_lane_green`).

---

### 7.6 Hitsounds & Audio Randomization Subsystem

Hitsounds in Deadlock are not stored as a single audio file. The engine resolves hit confirmation audio across **six randomized sound files**:

```
sounds/hit_indicators/
├── damage_send_default_01.vsnd_c
├── damage_send_default_02.vsnd_c
├── damage_send_default_03.vsnd_c
├── damage_send_default_04.vsnd_c
├── damage_send_default_05.vsnd_c
└── damage_send_default_06.vsnd_c
```

#### Replacement Procedure
To completely replace hitsounds without audio stutter:
1. Prepare six variations of the replacement hit audio (or replicate a single `.wav` six times).
2. Use **Deadlock Forge** (`deadlockforge.net`) for one-click compilation, or author an `encoding.txt` file and compile via CS2 Workshop Tools.
3. Pack all six compiled `.vsnd_c` files into `pak##_dir.vpk` under `sounds/hit_indicators/`.

---

### 7.7 VPulse Visual Scripting to Hammer I/O Translation

Deadlock utilizes Source 2 **VPulse** (`.vpulse` / `.vpulse_c`) for visual event graphing and logic sequencing. To wire VPulse graphs to Hammer map entities, use this exact conceptual translation:

| Hammer Entity I/O Field | VPulse Node Property | Agent Authoring Rule |
| :--- | :--- | :--- |
| **`My Output Named`** | **`Add Output`** | Whatever identifier is created in VPulse can be hooked in Hammer's entity output dropdown. |
| **`Target Entities Named`** | Target Entity | Specifies the target entity receiving the event. |
| **`Via This Input`** | **`Public Method Name`** | Must exactly match the Public Method name declared in VPulse (case-sensitive; ignore red warning text in Hammer). |
| **`With a parameter Override`**| **`Argument1`** | Carries the payload/data passed into the VPulse method node. |

---

### 7.8 Runtime DLL Patches & OS Security Mitigations

1. **CSDK 12 `meshsystem.dll` Fatal Crash (`0xc0e90002`):**
   - **Symptom:** CSDK 12 fails to launch with an error dialog stating `Bad Image` or `Error 0xc0e90002` referencing `meshsystem.dll`.
   - **Root Cause:** Windows 11 Smart App Control flags the kitbashed Source 2 binaries as unsigned/unverified.
   - **Remediation:** Navigate to `Windows Security -> App & Browser Control -> Smart App Control` and set to **Off**.
2. **Panorama Live Runtime XML Editing (`panorama.dll` mod):**
   - The community has released a modified `panorama.dll` (pinned in `#tools-discussion`).
   - Dropping this DLL into the CSDK or local game installation allows editing raw `.xml` and `.css` files at runtime without requiring compilation to `.vxml_c` / `.vcss_c`.
3. **Source 2 Viewer Nightly Builds:**
   - Deadlock's resource headers change frequently during the closed alpha.
   - Always utilize the latest master build from `nightly.link` (`https://nightly.link/ValveResourceFormat/ValveResourceFormat/workflows/build/master/Source2Viewer.zip`) rather than static releases.

---

## 8. Ecosystem Tool Matrix & Direct Repository Directory

| Tool Name | Type | Repository / Access Point | Primary Agent Use Case |
| :--- | :--- | :--- | :--- |
| **CSDK 12** | Local Suite | `deadlockmodding.pages.dev/modding-tools/csdk-12` | ModelDoc, Material Editor, VData compilation, Asset Browser. |
| **CSDK 10 Remastered** | Local Suite | `deadlockmodding.pages.dev/modding-tools/csdk-10` | Lightweight, stable compilation without particle preview crashes. |
| **CSwin64** | Engine Tools | Google Drive (5.0GB CS2 stripped runtime) | Compiling modern VCS70 shaders and AnimGraph2 hero models. |
| **Source 2 Viewer (S2V)** | Standalone GUI/CLI | `valveresourceformat.github.io` / `s2v.app/dev` | Decompiling VPKs, VData, `.cloth` FeModel, models, and audio. |
| **Deadlock Forge** | Web Application | `https://deadlockforge.net/` | One-click audio replacement, voiceline batching, VPK creation. |
| **DeadlockModBuilder** | CLI Automation | `github.com/Yelafree/DeadlockModBuilder` | Auto-compiles Blender DMX to VMDL with jiggle bones & ragdolls. |
| **Deadlock Mod Compiler** | PowerShell CLI | `github.com/Predi-i/Deadlock-Mod-Compiler` | Automated file hashing and multi-resource VPK generation. |
| **VPCF Color Editor** | Python GUI | `github.com/the-mrsir/VPCF-color-editor` | Batch tinting and gradient modification of `.vpcf` particle systems. |
| **BlenderSource2Tools** | Blender Addon | `github.com/FellOffFuji/BlenderSource2Tools` | DMX Model 22 export, cloth proxy mesh authoring, bone renaming. |
| **AG2 Cleaner** | WinForms CLI | Discord `#modding-guides` (Hoxdolum) | Stripping `NmSkeletonList`/`AnimGraph2List` from VMDL files. |
| **Deadworks Framework** | C# .NET 10 | `docs.deadworks.net` / `github.com/Deadworks-net/deadworks` | Authoritative dedicated server plugins, events, commands, HUD. |
| **Modlock Runtime** | WASM / C++23 | `github.com/paralin/modlock` | Sandboxed WASM game modes, Quake physics, React TSX HUD. |
| **Hyperline Client** | Desktop / Network | `hyperline.gg` / Discord `1546253926792429700` | Turnkey launcher, in-place map swaps, live cloud servers. |
| **Input Replay Lab** | Executable CLI | `input_replay_lab.exe` (Glutensnake community) | Automated Sandbox input recording and pre-moved game playback. |
| **Deadblock VPK Pack** | Game Overhaul | `youtu.be/h8TPtIaho9s` (@Wormy) | Complete voxel Minecraft world ported onto Source 2 Deadlock. |
| **Chesslock** | Custom Gamemode | `pak93_dir.vpk` (Glutensnake community) | Fully synchronized chess mechanics and boards inside Midtown. |
| **Remlock ("City Always Sleeps")** | Visual Overhaul | `r/DeadlockTheGame` community | Pervasive nighttime atmospheric, lighting, and texture overhaul. |
| **Deadlock Mod Manager** | Tauri v2 Desktop | `github.com/deadlock-mod-manager/deadlock-mod-manager` | Local client VPK installation, conflict resolution, load orders. |

---

## 9. The Hyperline Ecosystem & Production Modlock Deployment

**Hyperline** (`https://hyperline.gg`) is the premier production custom game platform and launcher for Deadlock, founded by **quantum** (Paralin, author of `modlock`) and **ddk**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HYPERLINE ECOSYSTEM                             │
│                                                                        │
│  [Hyperline Desktop Client] (Windows & Linux / Hyprland)               │
│         │ • Multi-Steam Library Discovery                              │
│         │ • Zero-Restart Clean Detach / Unhook                         │
│         │ • Live Server Browser & Ping Matrix                          │
│         │ • Real-time Web & Game Chat Bridge                           │
│         ▼                                                              │
│  [Deadlock Game Client] ◄────────────────────────────────────────────┐ │
│         │ (In-place map switches without engine reload)              │ │
│         ▼                                                            │ │
│  [Hyperline Cloud / Self-Hosted Servers]                             │ │
│         │                                                            │ │
│         ├── [Modlock Host Engine] (C++23 & SafetyHook)               │ │
│         │         │                                                  │ │
│         │         ▼                                                  │ │
│         ├── [WASM Reactor Sandbox] (Wasmtime)                        │ │
│         │         │                                                  │ │
│         │         ├── TypeScript SDK (Strictly typed game logic)     │ │
│         │         ├── Luau / Lua / Python / Go / Rust Bindings       │ │
│         │         ├── React Panorama HUD (JSX/TSX live UI)           │ │
│         │         └── holdReload() (Zero-downtime hot reloading)     │ │
│         │                                                            │ │
│         └── [Game Mode Suite]                                        │ │
│                   ├── Freestyle v0.2.52 (Ghost routes, /build)       │ │
│                   ├── Lane Practice (2v2 lane duel)                  │ │
│                   ├── Aim Range / Aimtrack v0.2.16 (Target bots)     │ │
│                   └── Cursed Arena / Haze Knives / Hero Roulette     │ │
└────────────────────────────────────────────────────────────────────────┘
```

### 9.1 Desktop Launcher & Client Lifecycle Architecture

1. **Operating System Compatibility:**
   - Native builds for Windows 10/11 and Linux (verified natively under Wayland and **Hyprland** compositors).
   - Dynamic Steam Library discovery automatically parses `libraryfolders.vdf` to resolve the active Deadlock directory, supporting custom path overrides.
2. **Clean Engine Detach (Zero-Restart Unhooking):**
   - Traditional Source 2 mods require restarting the game to unmount custom assets from `gameinfo.gi`.
   - Exiting the Hyperline desktop app issues an instant memory and filesystem unhook, completely returning Deadlock to a 100% vanilla state without restarting the game process.
3. **In-Place Map Swapping (Release 97, October 10, 2026):**
   - Changing game modes or maps in a Hyperline lobby swaps the level **in-place** inside the running Deadlock client.
   - The HUD remains connected and renders loading screens, playlist data, and tips while the Source 2 world transitions.
4. **Zero-Downtime Hot-Reloading (`holdReload()`):**
   - Production servers run Modlock's `holdReload()` protocol.
   - Developers can push code updates to active public servers; the WASM runtime hot-swaps logic immediately between ticks without kicking connected players or invalidating ongoing parkour runs.

### 9.2 Polyglot Modding Engine & React Panorama HUD

Hyperline transformed `modlock` from an experimental C++ sandbox into an open-source, multi-language custom game framework:

| Language SDK | Runtime Environment | Status | Recommended Agent Use Case |
| :--- | :--- | :--- | :--- |
| **TypeScript** | WASM / JS Host | **First-Class** (Oct 6, 2026) | Primary recommendation. Full IDE autocompletion, type safety, entity schemas. |
| **Luau / Lua** | Sandboxed Bytecode | Production | Lightweight scripting, rapid iteration, legacy Garry's Mod/Roblox porting. |
| **Python** | WASM CPython runtime | Production | Rapid prototyping, data logging, mathematical trajectory calculations. |
| **Go** | TinyGo / WASM | Production | Concurrent state processing, high-performance tick algorithms. |
| **Rust** | WASM target | Production | Maximum execution speed, zero-overhead mathematical simulations. |
| **React TSX** | Panorama Virtual DOM | Production | Modern UI development; builds HUD panels using React JSX/TSX components. |

### 9.3 Production Game Mode Suite & Mechanics

#### A. Freestyle (v0.2.52) — Movement & Parkour Engine
- **Ghost Playback System (`L` Hotkey):** Records and plays back player runs with an interactive Ghost Follow Cam.
- **Air Strafe HUD Compass:** Renders real-time airstrafe efficiency, speed vectors, and turn angles directly below the crosshair.
- **In-Engine Level Authoring (`/build`):**
  - Allows players to dynamically spawn props into the live world: ramps, ziplines, rails, bounce pads, and crates.
  - `/spawn`: Spawns Urns or golden movement speed buffs.
  - `/cancel`: Reverts the last placed object.
- **Checkpoint Bookmarking:** Press `[` to save world coordinates and velocity; press `]` to instantly restore.
- **Speedrun Playlist Integration:** Embedded YouTube video playlists displayed directly in the Panorama menu for route tutorials and world-record runs.

#### B. Additional Game Modes
- **Lane Practice:** 2v2 competitive lane drill terminating automatically when the first Guardian falls.
- **Aim Range / Aimtrack (v0.2.16):** Target bots weaving dynamically along complex bezier curves toward and away from the player.
- **Cursed Arena:** 2 to 12 player Team Skirmish and Chaos Free-For-All deathmatch.
- **Haze Knives:** 6v6 mirror match where all weapons and abilities are disabled except Sleep Daggers.
- **Hero Roulette, Headshots, Wraith Orbit, Endif, and Parry Ball.**
- **Diagnostic Commands:** Integrated `/bug`, `/feedback`, and `/report` directly bridging player telemetry to the development team.

---

## 10. Master Chronological Timeline & Breaking Version History (2024 – Late 2026)

This master chronological timeline documents every breakthrough, framework version, breaking engine update, and community release with exact timestamps. Autonomous agents must use this chronology to evaluate whether documentation or code is active or deprecated.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CHRONOLOGICAL MODDING EVOLUTION                                 │
│                                                                                        │
│  2024: Alpha Discovery  ──►  2025: Tooling & CSDK  ──►  Mid 2026: AG2 & Subtitle UI   │
│  • S2V Extraction            • Glutensnake Community    • Valve AnimGraph2 Rollout     │
│  • gameinfo.gi SearchPaths   • CSDK 10 & 12 Release     • Deadworks v0.4.14 Subtitle UI│
│                                                         • CSwin64 & AG2 Cleaner        │
│                                                                                        │
│  Late Sept 2026: Open Beta Explosion       ──►  October 2026: Production & Solomon     │
│  • Wormy "Deadblock" (Minecraft)                • Deadworks v0.5.4 RBAC & v0.5.6       │
│  • Hyperline Releases 66–88                     • Hyperline TypeScript / Open Source   │
│  • Deadworks v0.4.17 (Camera/Docker)            • Hero Solomon Engine Update (Crashes) │
│  • Sept 29-30 Massive Beta Update (v0.5.0)      • Hyperline Release 97 In-Place Swaps  │
│                                                 • 700k Breakable Destructible Midtown  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Closed Alpha Genesis & Asset Exploration (May 2024 – December 2024)
- **May – August 2024:** Discovery of Project Citadel binaries in Valve test branches.
- **August 2024:** Source 2 Viewer (S2V) updates support for Deadlock resource formats (`vpk`, `vdata_c`, `vmat_c`, `vsnd_c`).
- **September 2024:** Discovery of the `gameinfo.gi` SearchPaths injection vector. Establishing `citadel/addons` mounts allows loose VPK loading without replacing Valve's core `pak01_dir.vpk`.
- **November 2024:** Early client skin swaps successfully inject unskinned mesh overrides into local matches.

### Phase 2: Community Emergence & Tooling Standardization (Early 2025 – Mid 2025)
- **June 27, 2025 (18:00:00 UTC):** Glutensnake community server established; inception of custom mini-game design and mechanics testing.
- **July 2025:** Community releases kitbashed **CSDK 10** (Counter-Strike 2 Workshop Tools binary kit adapted for Citadel).
- **August 2025:** First voice line audio overhauls created using manual FFmpeg scripts and `vpk.exe`.

### Phase 3: The Framework Renaissance (Early 2026 – August 2026)
- **January 14, 2026:** "Magic Rabbits Mod" posted on Reddit (`r/DeadlockTheGame`), triggering interest in client-side visual scripting.
- **April 19, 2026:** **Deadworks Launcher Beta** launched, allowing dedicated servers to push custom addon VPKs to clients on-demand without manual installation.
- **April 22, 2026 (08:22:40 UTC) — Deadworks v0.4.5:**
  - Dedicated server master port standardized to `27067` to eliminate client port collisions.
  - Replaced legacy `[ChatCommand]` and `[ConCommand]` with unified `[Command("cmd")]` attribute.
  - Added enhanced item parameter `CCitadelPlayerPawn.AddItem(name, enhanced: true)`.
  - Exposed `CCitadelPlayerPawn.HeroID` and `CBasePlayerController.Slot`.
- **April 24, 2026 (08:12:25 UTC) — Deadworks v0.4.6:**
  - Disabled global hero precaching by default, cutting server RAM consumption by ~65% and drastically improving client join speeds.
  - Added `FindAbilityByName`, `RemoveAbility`, `Entities.ByName<T>`, and stamina mutation APIs.
- **May 2, 2026 (07:07:41 UTC) — Deadworks v0.4.7:**
  - Excluded bots from server player counts.
  - Added `CBaseEntity.SetScale`, `ModelName`, `OnceHeroInitialized`, and `SwapOrReset`.
  - Added full spectator API (`ObserverServices`: `MakeObserver`, `ObserverMode`, `ObserverTarget`).
- **May 13, 2026 (02:18:03 UTC) — Deadworks v0.4.8:**
  - Added slot reservation bypass hook to prevent "server full" reservation deadlocks.
  - Exposed `Friction`, `Collision`, `CCollisionProperty`, and `RespawnTime`.
- **June 6, 2026 (03:20:27 UTC) — Deadworks v0.4.10:**
  - Added Entity I/O hooks; fixed `OnAbilityAttempt`; updated Protobuf definitions.
- **June 17 – July 31, 2026 — Deadworks v0.4.11 to v0.4.13:**
  - Engine signature scans and memory offset updates following weekly Valve client patches; fixed `abilityValues` in `CBaseModifier`.
- **July 2026 — The AnimGraph2 (AG2) Disruption:**
  - Valve migrated primary hero animation controllers to **AnimGraph2** (`.vagrp2_c`).
  - Models compiled with legacy CSDK 10/12 immediately crash the game on spawn due to missing `AnimGraph2List`.
  - Community responds with **AG2 Cleaner** (stripping AG2 dependencies to force legacy AnimGraph1 fallback) and **CSwin64** (5.0GB stripped CS2 compiler runtime).
- **August 17, 2026 (05:39:05 UTC) — Deadworks v0.4.14:**
  - **Major Architectural Breakthrough:** Shipped server-driven Panorama UI across the engine's closed-caption subtitle system (`deadworks.net/blog/we-ship-our-ui-through-a-subtitle-system`), bypassing the need for client-side VPK modifications to draw UI panels.
- **August 18, 2026 (06:07:55 UTC) — Deadworks v0.4.15:**
  - Added rich declarative UI styling: `UIPanel.SetStyle`, `SetStyles`, `Animate`, `UINode.WithTransition`, hover/press state styling, and cursor capture (`RequestCursor`).

### Phase 4: Open Beta Explosion & Mass Custom Games (September 2026)
- **September 6, 2026 (03:53:30 UTC) — Deadworks v0.4.16:**
  - Made `CBaseEntity.MaxHealth` read-only.
  - Added modifier hook `IDeadworksPlugin.OnModifierEvent(ModifierEvent args)`.
  - Added game state lifecycle hooks `OnGameStateChanged` and `OnGameStateChanging`, plus `GameRules.ChangeGameState`.
  - Added full Item Imbuing API (`AddItem` with `imbueSlot`, `ImbueItem`, `CanImbue`, `ItemInfo.GetImbueEffects`).
  - Added `IDeadworksPlugin.ContentAddons` declaration.
- **September 19–20, 2026:** Glutensnake community releases Hitman pak and playtest packs.
- **September 21, 2026:** Discovery of custom cosmetic action triggers (`bind E "+in_cosmetic1"`).
- **September 24–27, 2026:** **Deadblock (Minecraft in Deadlock)** developed by `@Wormy`. Public release on YouTube September 27, 2026 (`youtu.be/h8TPtIaho9s`).
- **September 25, 2026 (05:27:22 UTC) — Hyperline Releases 66 → 88:**
  - Deployed clean app unhooking, multi-Steam library auto-detection, web lobby chat synchronization, Freestyle movement mode, Lane Practice, Aim Range, and Cursed Arena.
- **September 25, 2026 (20:34:25 UTC) — Deadworks v0.4.17:**
  - Integrated in-game server browser with launcher integration; Linux Docker hosting image.
  - Fixed "clamping offset" prediction error (players spawned at 0 HP with no hero).
  - **Breaking API Change:** `ClientDisconnectedEvent.Reason` changed from `int` to `ENetworkDisconnectionReason`.
  - Cinematic Camera API: `CCitadelPlayerController.Camera` (Lerp, LerpTarget, LerpDistance, LerpFov, Maintain, Clear).
  - Added `Zone` trigger bounding box volume with `Entered`/`Left` events; added `CBeam` lines and boxes.
  - Added `Freeze`, `Unfreeze`, `Kill(respawnImmediately)`.
  - Added `GameRules.WinningTeam` and `GameRules.MatchStartOnAnyMap` (enables Midtown zipline countdown on custom maps).
  - Settable `PlayerSteamId` on `OnClientConnect` to hot-swap disconnected player slots.
  - Added `TakeOverHero`, `CreateFakeClient`, `Server.Kick`, `UIPanel.RequestCursor` / `ReleaseCursor`, and `UI.HasClientBootstrap`.
- **September 27, 2026 (07:07:36 UTC) — Deadworks v0.4.18:**
  - Added `Server.ChangeLevel(map)`, `Server.IsChangingLevel`, and `IsMapChangeReconnect`.
- **September 29, 2026 (16:10:58 UTC):** Glutensnake 1.5-year anniversary manifesto reflecting on alpha to Open Beta evolution.
- **September 29–30, 2026 — Massive Deadlock Open Beta Engine Update:**
  - Valve deployed widespread entity schema changes.
  - Deadworks releases **v0.5.0** and hotfix **v0.5.1** within hours to restore server stability.

### Phase 5: Production Maturity & Current State (October 2026)
- **October 1–4, 2026:** Glutensnake community releases "Recruiting the Jungle" and "Conquering Territory" spatial gamemodes.
- **October 3, 2026 (00:42:22 UTC) — Deadworks v0.5.2 & v0.5.3:**
  - Patch compatibility update; fixed `UpgradeBits` network serialization.
- **October 5, 2026 (09:28:49 UTC):** Hyperline deploys in-game `/bug`, `/feedback`, and `/report` telemetry.
- **October 6, 2026 (22:57:51 UTC) — Deadworks v0.5.4:**
  - Released unified built-in Role-Based Access Control (RBAC) Admin & Permission system (`docs.deadworks.net/guides/admins-and-permissions`).
- **October 6–7, 2026 — Hyperline Architectural Milestone:**
  - Migrated `modlock` to first-class TypeScript SDK, Luau, Python, Go, and Rust.
  - Released open-source core on GitHub and announced React-based Panorama HUD framework.
- **October 8, 2026 (01:58:14 UTC) — Deadworks v0.5.5:**
  - **Breaking Hero Schema Update:** Added `CitadelHeroData.DevelopmentState` and `EHeroDevelopmentState`; deprecated and removed `PlayerSelectable`, `PrereleaseOnly`, and `AssignedPlayersOnly`.
  - Added `CCitadelZiplinePath.Lane`.
- **October 8, 2026 (04:13:33 UTC) — Deadworks v0.5.6:**
  - Critical hotfix for dedicated server crash on `CCitadelPlayerPawn.RemoveAbility`.
- **October 8–10, 2026 — Hero Solomon Update & Community Crash Wave:**
  - Valve deployed new hero **Solomon** (chess-piece mechanics).
  - Update wiped `gameinfo.gi` SearchPaths across client installations and crashed models lacking `TaggedSoundSettings_t` or using uncompiled VCS70 shaders.
  - Community releases **Remlock** ("City Always Sleeps") major aesthetic overhaul.
- **October 9, 2026:** Glutensnake releases `input_replay_lab.exe` for automated Sandbox input playback.
- **October 10, 2026 (16:06:54 UTC) — Hyperline Release 97:**
  - Added seamless in-place map changing without restarting Deadlock; dedicated server region picker; YouTube playlist integration; native Linux Hyprland support; Freestyle v0.2.52.
- **October 10, 2026:** **Chesslock** (`pak93_dir.vpk`) released to community playtesters.
- **October 9–11, 2026:** **700k Breakable Entity Destructible Midtown** experiment by `Jonas12294` and `Lucky👑` (4 VPK files totaling 8 GB loaded directly into memory).
- **November 7, 2026 (Upcoming):** Official **Modded Deadlock Day** organized with Death Slam Events (DSE) Content Creator Cup.

---
**End of Directive. Ground all coding actions in the above architecture.**

