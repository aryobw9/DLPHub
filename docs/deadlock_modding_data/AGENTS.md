# AGENTS.md - Deadlock Modding Project Directive

> **ATTENTION AGENT:** This is the operational directive for all AI agents operating within `d:\Claude\Modding\Deadlock`.
> For the complete table of paths, CLI commands, workflow recipes, and engine constraints, read [**`README.md`**](file:///d:/Claude/Modding/Deadlock/README.md).

## Critical Context Summary:
1. **Target Mod Staging Directory:**  
   `D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\`  
   All mods (loose files or `.vpk`) MUST be placed here. Never alter vanilla files.
2. **Key Compilers & Utilities:**
   - Source 2 Viewer CLI: `d:\Claude\Modding\Deadlock\tools\cli\Source2Viewer-CLI.exe` (**DO NOT run GUI `tools\Source2Viewer.exe` in CLI; it hangs indefinitely**).
   - Valve Resource Compiler: `d:\Claude\Modding\Deadlock\tools\Reduced_CSDK_12\game\bin_cs2\win64\resourcecompiler.exe` (Always use `bin_cs2` with `-game "...\game\citadel"` to avoid particleslib schema crash).
   - VPK Packer: `d:\Claude\Modding\Deadlock\tools\vpkedit\vpkeditcli.exe`
   - Blender: `D:\games\Blender\blender.exe` (MCP socket on `127.0.0.1:9876`)
   - ArtCraft: `D:\games\ArtCraft\artcraft-launcher.exe`
3. **Automated Modding Scripts:**
   - 44-Hero Localization & BiDi Engine: `python d:\Claude\Modding\Deadlock\build_all44_perfect_localization.py` (Helper: `hero_bidi_helper.py`, Batches: `localization_batches/`)
   - Localization Pre-Flight Validator: `python d:\Claude\Modding\Deadlock\validate_final_mod.py`
   - Map Signs & 3D Billboards: `python d:\Claude\Modding\Deadlock\build_and_deploy_map_logos.py`
   - Shop Backgrounds: `python d:\Claude\Modding\Deadlock\build_and_pack_shop_logo.py --auto`
4. **Deep Technical Guides:**
   - [**`README.md`**](file:///d:/Claude/Modding/Deadlock/README.md): Quick reference, workflows, and engine constraints.
   - [**`DEADLOCK_MODDING_INTELLIGENCE_DOC.md`**](file:///d:/Claude/Modding/Deadlock/DEADLOCK_MODDING_INTELLIGENCE_DOC.md): VPK, sounds, maps, searchpaths, Sections 2.5-2.9 (Texture compilation, Map Signage coordinates, Shop catalog architecture, CLI Traps Almanac, and Panorama RTL/BiDi Engine).
   - [**`AI_CREATIVE_WORKFLOWS_MCP_DOC.md`**](file:///d:/Claude/Modding/Deadlock/AI_CREATIVE_WORKFLOWS_MCP_DOC.md): 2,250+ lines on Geometry Nodes, PBR baking, 4-bone rigging limits, Three.js conversion, multimodal visual verification, troubleshooting almanac.
   - [**`DEADLOCK_LAN_LAUNCHER_ARCHITECTURE_DOC.md`**](file:///d:/Claude/Modding/Deadlock/DEADLOCK_LAN_LAUNCHER_ARCHITECTURE_DOC.md): Complete architecture for Deadlock LAN Launchers, native Go UDP loopback proxies, A2S query engine, and DLP Hub integration.

## 5. DLP Hub UI Standards:
- **Tab Switching Animation**: Use the unified lightweight overall panel blur transition (0.22s fade + 5px blur on \.panel.panel-revealing\). Never use bloated staggered nth-child card delays.
- **In-Place Setting Updates**: Changing settings or ConVars must update DOM nodes in-place (no innerHTML wipes, no layout jumping).
- **Custom Cursor Scale**: 51px x 51px (20% smaller than original 64px, busy at 70px x 70px, dot at 5px x 5px).
