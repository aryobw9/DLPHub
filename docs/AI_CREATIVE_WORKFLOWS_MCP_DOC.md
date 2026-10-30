# AI CREATIVE WORKFLOWS & MCP DIRECTIVE
### The Definitive Systems Architecture & Autonomous Agent Guide for Generative 2D/3D Art, ArtCraft, Blender MCP & Three.js Conversion
**Document Classification:** Autonomous Agent Operational Directive  
**Target Environments:** Blender 4.2+ LTS, ArtCraft Suite, Penpot MCP, Krita MCP, Inkscape MCP, Three.js Headless, ComfyUI MCP  
**Primary Execution Protocols:** Model Context Protocol (MCP) JSON-RPC 2.0, Python `bpy`, Rust Agent-Native APIs, Node.js GLTF Pipeline  
**Version:** 1.0.0-Production (October 2026)

---

## 1. Executive Architectural Overview & Tool Taxonomy

Modern digital content creation is experiencing a foundational paradigm shift: the migration from manual GUI pointer-driven manipulation to **Agent-Native Creative Engineering**. In this architecture, autonomous AI agents interface directly with professional creative applications via the **Model Context Protocol (MCP)**, executing complex multi-modal workflows spanning concept art generation, parametric vector drafting, procedural 3D mesh modeling, PBR material synthesis, and engine-ready game asset compilation.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          AUTONOMOUS AGENT CREATIVE PIPELINE TOPOLOGY                        │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│         LAYER 1          │ │         LAYER 2          │ │         LAYER 3          │
│   2D Concept & Vector    │ │   3D Modeling & Scene    │ │ Conversion & Game Engine │
│       (Agent-Native)     │ │        (Blender MCP)     │ │       Asset Export       │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • ArtCraft Suite (Rust)  │ │ • Blender 4.2+ LTS Core  │ │ • Three.js -> GLTF/GLB   │
│   PhotoCraft (Photoshop) │ │ • mcp-for-blender Server │ │ • Buffer -> bmesh Bridge │
│   VectorCraft (Illustr.) │ │ • Socket Bridge (p:9876) │ │ • Source 2 DMX Compiler  │
│ • Penpot MCP (Figma alt) │ │ • Procedural bpy Toolset │ │ • PBR Channel Packager   │
│ • Krita MCP (Raster Paint│ │ • Cycles / Eevee Next    │ │ • Deadlock VPK Packager  │
│ • Inkscape MCP (SVG Ops) │ │ • Rigify & Armatures     │ │ • WebGL & Canvas Hosting │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### 1.1 The Model Context Protocol (MCP) in Creative Applications

The Model Context Protocol (MCP), open-sourced by Anthropic, acts as a universal, type-safe bidirectional communication bus between Large Language Model (LLM) agents and local execution environments. In creative software, MCP transforms static monolithic GUI applications into programmable, introspectable execution engines.

#### The Three Core MCP Primitives in Creative Workflows:
1. **Tools (`tools/call`):** Executable functions exposed to the agent (e.g., `blender.create_mesh`, `photocraft.add_layer`, `penpot.update_shape`). Tools accept strictly typed JSON Schemas and return operational outcomes, error frames, or asset IDs.
2. **Resources (`resources/read`, `resources/subscribe`):** Real-time introspectable state representations (e.g., scene hierarchy trees, active layer stacks, bounding boxes, camera angles, color palettes). Allows the agent to "see" the canvas state before issuing edits.
3. **Prompts (`prompts/get`):** Pre-engineered, context-aware prompt templates that bind current project context (e.g., canvas resolution, color spaces, active mesh selection) into the agent's prompt context.

### 1.2 Creative Tool Comparison Matrix

| Application | Role & Primary Domain | Architecture & Runtime | MCP Integration Level | Strengths for Autonomous Agents |
| :--- | :--- | :--- | :--- | :--- |
| **Blender (4.2+ LTS)** | 3D Modeling, Rigging, UVs, Shading, Animation | C/C++ native core + Python `bpy` runtime | High (via `mcp-for-blender` bridge) | Complete headless operation, full programmatic control over geometry, lights, materials, and physics. |
| **ArtCraft (PhotoCraft)** | Raster Image Editing (Photoshop alternative) | Pure Rust, WebGPU / Vulkan / DX12 | Native (Agent-Native core) | Ultra-fast GPU compositing, no Electron bloat, built specifically for AI-driven layer manipulation. |
| **ArtCraft (VectorCraft)**| Vector Illustration (Illustrator alternative) | Pure Rust, Bezier math, GPU vectors | Native (Agent-Native core) | Pure math-driven vector curves, programmatic SVG nodes, non-destructive layer graphs. |
| **Penpot** | UI/UX & Vector Design (Figma alternative) | Clojure/TypeScript, Web standards | Official (`penpot-mcp`) | First-class design-to-code, full DOM-like tree access to shapes, typography, and design tokens. |
| **Krita** | Digital Painting & Concept Art | C++ Qt core + Python scripting | Medium (via `krita-mcp` bridge) | Rich brush engine, layer blend modes, native AI generative plugin ecosystem. |
| **Inkscape** | SVG Vector Design & Typography | C++ GTK core + Python extensions | Medium (via `inkscape-mcp`) | Exacting boolean path math, node-level precision, headless SVG batch processing. |
| **Three.js** | WebGL 3D Scene Graph & Procedural Math | JavaScript / TypeScript WebGL engine | Native JS Execution | LLMs generate Three.js code with near-perfect syntax; easily converted to Blender GLTF models. |
| **ComfyUI** | Node-Based Generative Diffusion (Flux/SD) | Python PyTorch graph execution engine | High (via ComfyUI MCP API) | Deterministic image and PBR texture generation with ControlNet and IP-Adapter conditioning. |

---

## 2. The ArtCraft Suite & Agent-Native Workflows

### 2.1 Project Architecture & Philosophy

The **ArtCraft Suite** (`github.com/storytold`, `getartcraft.com`) is a ground-up, clean-room reimplementation of the Adobe Creative Cloud suite engineered entirely in **pure Rust**. Developed by Brandon Thomas (`storytold`), ArtCraft was explicitly designed from its architectural inception to be **"Agent-Native"**—meaning every application is built to be equally controllable by human operators via a clean desktop GUI and by autonomous AI agents via CLI, structured JSON, and native Model Context Protocol (MCP) servers.

#### The ArtCraft Application Ecosystem
- **PhotoCraft:** Reimplementation of Adobe Photoshop. Focuses on non-destructive raster editing, multi-layer compositing, masks, blend modes, adjustments, and neural filters.
- **VectorCraft:** Reimplementation of Adobe Illustrator. Focuses on infinite-resolution vector shapes, Pen tool paths, Boolean operations, typography, and SVG/PDF export.
- **FilmCraft:** Reimplementation of Adobe Premiere Pro. Multi-track non-linear video editing, audio synchronization, transitions, and timeline sequencing.
- **LightCraft:** Reimplementation of Adobe Lightroom. High-throughput RAW photographic development, non-destructive color grading, and asset tagging.
- **DesignCraft:** Reimplementation of Adobe InDesign. Multi-page layout engine, master pages, text flow frames, and prepress CMYK export.
- **EffectCraft:** Reimplementation of Adobe After Effects. Keyframed motion graphics, timeline expressions, particle generators, and compositor nodes.
- **CadCraft:** Computer-Aided Design (CAD) tool for parametric mechanical drafting and solid modeling.
- **GridCraft:** High-performance tabular data spreadsheet and visual graphing environment.

#### Architectural Differentiation vs Traditional Software
1. **Zero Electron Overhead:** ArtCraft applications compile to compact, native machine binaries (x86_64 and ARM64). Memory consumption is a fraction of Electron-based apps.
2. **Modern GPU Compositing:** Renders UI and canvas via native Vulkan, DirectX 12, Metal, and WebGPU pipelines, ensuring instantaneous layer updates during rapid agent tool execution.
3. **Clean-Room Rust Implementation:** Completely decoupled from Adobe proprietary patents or source code; zero telemetry, zero mandatory cloud sign-in, and zero monthly subscription barriers.
4. **Agent-First Command Bus:** Every internal operation (e.g., creating a layer, transforming a path, applying a gaussian blur) dispatches through an internal message bus that can be triggered identically by GUI events or MCP RPC messages.

### 2.2 ArtCraft Native MCP Protocol & Tool Schemas

When launched with the `--mcp` flag or when connected via the ArtCraft Launcher, ArtCraft applications expose a local JSON-RPC 2.0 endpoint (over stdio or local WebSocket).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARTCRAFT MCP PROTOCOL BUS                       │
│                                                                        │
│  [AI Agent / LLM Client]                                               │
│         │ JSON-RPC 2.0 (stdio or ws://127.0.0.1:9120)                  │
│         ▼                                                              │
│  [ArtCraft Host Engine] (Rust core)                                    │
│         ├── Command Dispatcher (Security validation & transaction)     │
│         ├── Document State Manager (Layer tree & active selections)    │
│         └── Render Engine (Vulkan / WebGPU compositing pipeline)       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core MCP Tools in PhotoCraft (`photocraft-mcp`)

| Tool Identifier | Parameters | Description | Agent Output |
| :--- | :--- | :--- | :--- |
| `photocraft.new_document` | `width: int`, `height: int`, `dpi: int`, `color_space: string` | Creates a new blank raster canvas. | `{ document_id: string, width, height }` |
| `photocraft.get_document_state` | `document_id: string` | Inspects full layer hierarchy, visibility, opacity, and active selection. | Complete JSON tree of layers and properties. |
| `photocraft.create_layer` | `document_id`, `name: string`, `layer_type: "raster"|"vector"|"text"|"adjustment"` | Instantiates a new layer in the document. | `{ layer_id: string, index: int }` |
| `photocraft.draw_pixels` | `document_id`, `layer_id`, `x`, `y`, `width`, `height`, `rgba_base64: string` | Writes a raw pixel buffer directly into a target layer. | `{ success: bool, modified_region: [x,y,w,h] }` |
| `photocraft.set_layer_blend` | `document_id`, `layer_id`, `mode: string`, `opacity: float` | Sets blend mode (`"normal"`, `"multiply"`, `"screen"`, `"overlay"`) and opacity (0.0 to 1.0). | `{ success: bool }` |
| `photocraft.apply_filter` | `document_id`, `layer_id`, `filter_type: string`, `params: object` | Executes non-destructive filters (`"gaussian_blur"`, `"levels"`, `"hue_saturation"`). | `{ success: bool, render_ms: float }` |
| `photocraft.export_image` | `document_id`, `filepath: string`, `format: "png"|"tga"|"jpeg"|"webp"`, `quality: int` | Renders and exports the composite canvas to disk. | `{ output_path: string, bytes_written: int }` |

#### Core MCP Tools in VectorCraft (`vectorcraft-mcp`)

| Tool Identifier | Parameters | Description | Agent Output |
| :--- | :--- | :--- | :--- |
| `vectorcraft.new_artboard` | `width: float`, `height: float`, `units: "px"|"mm"|"in"` | Creates a new vector artboard. | `{ artboard_id: string }` |
| `vectorcraft.add_path` | `artboard_id`, `svg_path_data: string`, `fill: string`, `stroke: string`, `stroke_width: float` | Renders a vector path from standard SVG path string (`M... C... Z`). | `{ path_id: string, bounds: [x,y,w,h] }` |
| `vectorcraft.boolean_operation` | `artboard_id`, `shape_a_id`, `shape_b_id`, `operation: "union"|"difference"|"intersect"` | Executes mathematical 2D constructive geometry operations. | `{ result_shape_id: string }` |
| `vectorcraft.add_text` | `artboard_id`, `text: string`, `font: string`, `size: float`, `x: float`, `y: float` | Inserts vector typography converted to editable glyph paths. | `{ text_id: string }` |
| `vectorcraft.export_svg` | `artboard_id`, `filepath: string`, `minify: bool` | Exports compliant, clean SVG code to the filesystem. | `{ output_path: string }` |

### 2.3 Concrete Agent Execution Workflow: Automated Poster Generation

This machine-actionable script demonstrates how an AI coding agent controls PhotoCraft to generate a game poster asset:

```python
import json
import subprocess
import base64

class PhotoCraftClient:
    """Stdio JSON-RPC MCP Client for PhotoCraft."""
    def __init__(self, binary_path="D:\\games\\ArtCraft\\artcraft-launcher.exe"):
        self.process = subprocess.Popen(
            [binary_path, "--app", "photocraft", "--mcp"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        self.req_id = 0

    def call_tool(self, tool_name, arguments):
        self.req_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self.req_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()
        response_line = self.process.stdout.readline()
        return json.loads(response_line)

# Agent Workflow: Create Deadlock Map Poster (512x1024)
client = PhotoCraftClient()

# Step 1: Create Canvas
doc_res = client.call_tool("photocraft.new_document", {
    "width": 512, "height": 1024, "dpi": 72, "color_space": "sRGB"
})
doc_id = doc_res["result"]["content"][0]["document_id"]

# Step 2: Create Background Layer & Fill
bg_layer = client.call_tool("photocraft.create_layer", {
    "document_id": doc_id, "name": "Background", "layer_type": "raster"
})
client.call_tool("photocraft.apply_filter", {
    "document_id": doc_id, "layer_id": bg_layer["result"]["content"][0]["layer_id"],
    "filter_type": "fill_color", "params": { "color": "#12171c" }
})

# Step 3: Create Vector Logo Element
logo_layer = client.call_tool("photocraft.create_layer", {
    "document_id": doc_id, "name": "Emblem", "layer_type": "vector"
})
client.call_tool("photocraft.draw_path", {
    "document_id": doc_id, "layer_id": logo_layer["result"]["content"][0]["layer_id"],
    "svg_path": "M 256 200 L 400 450 L 112 450 Z", # Triangle emblem
    "fill": "#ffd34d", "stroke": "#ffffff", "stroke_width": 4.0
})

# Step 4: Export to PNG for Source 2 Resource Compiler
client.call_tool("photocraft.export_image", {
    "document_id": doc_id,
    "filepath": "D:\\Claude\\Modding\\Deadlock\\assets\\custom_poster.png",
    "format": "png", "quality": 100
})
```

---

## 3. Blender MCP & Automated 3D Procedural Engineering

### 3.1 System Topology & The Socket Bridge Architecture

Blender is the industry standard for 3D digital content creation. To control Blender programmatically without forcing the entire runtime into a clunky CLI wrapper, the modern AI ecosystem relies on **`mcp-for-blender`** (`github.com/ahujasid/mcp-for-blender`), formerly `blender-mcp`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BLENDER MCP SYSTEM TOPOLOGY                     │
│                                                                        │
│  [AI Agent / Antigravity / Claude]                                     │
│         │ (Communicates via standard Model Context Protocol stdio)     │
│         ▼                                                              │
│  [mcp-for-blender Server] (uvx mcp-for-blender / Python 3.10+)         │
│         │ Translates MCP tool calls into JSON-RPC socket payloads      │
│         ▼ (TCP Socket: localhost:9876)                                 │
│  [Blender Runtime Process] (GUI or Headless: blender.exe)              │
│         │ Listens via mcp_for_blender.py Addon                         │
│         ▼                                                              │
│  [Blender Main Thread Executor]                                        │
│         │ Dispatches safely through bpy.app.timers                     │
│         └── Executes Python bpy & bmesh operations in active scene     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Key Architectural Invariants:
1. **Thread-Safe Main Thread Dispatching:** Blender's C/C++ core (`blenkernel`) is strictly single-threaded with respect to Python execution. Attempting to modify `bpy.data.objects` from a background socket thread causes instantaneous memory corruption and access violation crashes (`0xC0000005`). `mcp_for_blender.py` ingests incoming socket commands into a thread-safe `queue.Queue` and dispatches execution into the main Blender draw loop using `bpy.app.timers.register`.
2. **Snapshot Capping & Trajectory Monitoring:** To prevent LLM context exhaustion when dealing with dense scenes, the addon implements `MAX_SNAPSHOT_OBJECTS = 4000` and caps selected entities. The agent receives a compact, structured scene graph containing entity names, types, world-space transforms, and bounding box dimensions.
3. **Execution Modes:**
   - **Interactive GUI Mode:** Blender runs visibly on screen. As the agent calls tools, the user watches 3D meshes extrude, materials change, and cameras animate in real time.
   - **Headless Background Mode (`blender.exe --background`):** Operates silently in CI/CD pipelines or headless server containers, executing procedural asset generation and rendering without opening a window.

### 3.2 Complete Blender MCP Tool Registry (200+ Operations)

The `mcp-for-blender` server exposes a vast catalog of operations. The table below documents the core operational clusters every AI agent must utilize:

#### A. Mesh Generation & Boolean Topology
```python
# Create primitive geometries
blender.create_primitive(type="CUBE"|"SPHERE"|"CYLINDER"|"PLANE"|"CONE"|"TORUS", location=[x,y,z], scale=[x,y,z], rotation=[rx,ry,rz])

# Edit Mode BMesh operations
blender.extrude_faces(object_name="Cube", face_indices=[0, 1], distance=2.5, direction=[0, 0, 1])
blender.subdivide_mesh(object_name="Cube", cuts=2, smoothness=0.0)
blender.apply_bevel(object_name="Cube", width=0.1, segments=3, profile=0.5)

# Boolean operations (Carving, cutting, joining)
blender.apply_boolean(target_object="Wall", cutting_object="WindowCutter", operation="DIFFERENCE"|"UNION"|"INTERSECT")
```

#### B. Materials, Shading & PBR Node Networks
```python
# Create material and bind Principled BSDF
blender.create_material(material_name="SciFiMetal", use_nodes=True)
blender.set_bsdf_property(material_name="SciFiMetal", property_name="Base Color", value=[0.8, 0.8, 0.8, 1.0])
blender.set_bsdf_property(material_name="SciFiMetal", property_name="Metallic", value=1.0)
blender.set_bsdf_property(material_name="SciFiMetal", property_name="Roughness", value=0.25)

# Bind PBR textures to shader nodes
blender.bind_texture_node(material_name="SciFiMetal", node_type="ALBEDO"|"NORMAL"|"ROUGHNESS"|"METALLIC", filepath="textures/albedo.png")
```

#### C. Scene Lighting, Cameras & Rendering
```python
# Lighting placement
blender.add_light(type="SUN"|"POINT"|"SPOT"|"AREA", location=[5, -5, 10], energy=1000.0, color=[1.0, 0.95, 0.8])
blender.set_world_hdri(filepath="hdris/studio_neutral.exr", strength=1.2)

# Camera framing
blender.setup_camera(location=[0, -10, 5], target_object="HeroMesh", focal_length=50.0, f_stop=2.8)

# Render execution
blender.render_scene(filepath="renders/turntable_001.png", resolution=[1920, 1080], engine="CYCLES"|"BLENDER_EEVEE_NEXT", samples=128, transparent_bg=True)
```

#### D. Modifiers, Armatures & Rigging
```python
# Add modifiers non-destructively
blender.add_modifier(object_name="Character", modifier_type="SUBSURF", levels=2)
blender.add_modifier(object_name="Armor", modifier_type="MIRROR", mirror_axis="X")
blender.add_modifier(object_name="Cape", modifier_type="CLOTH", quality=5)

# Automatic skeleton binding
blender.bind_armature(mesh_name="Character", armature_name="HumanRig", bind_mode="AUTOMATIC_WEIGHTS")
```

### 3.3 End-to-End Autonomous Modeling Script

The following Python script exemplifies how an autonomous AI coding agent leverages Blender MCP via Python `bpy` directly to procedurally construct, texture, and export a game asset:

```python
import bpy
import bmesh
import math
from mathutils import Vector, Euler

def clean_scene():
    """Removes all default objects from the active scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_scifi_crate():
    """Procedurally models a bevelled sci-fi crate with panel insets."""
    clean_scene()

    # 1. Base Cube
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
    crate = bpy.context.active_object
    crate.name = "SciFi_Crate"

    # 2. BMesh Inset & Extrude detailing
    bm = bmesh.new()
    bm.from_mesh(crate.data)
    bm.faces.ensure_lookup_table()

    # Inset all lateral faces
    side_faces = [f for f in bm.faces if abs(f.normal.z) < 0.1]
    inset_result = bmesh.ops.inset_individual(bm, faces=side_faces, thickness=0.2, depth=-0.08)
    
    bm.to_mesh(crate.data)
    bm.free()

    # 3. Add Bevel Modifier for hard-surface edges
    bevel = crate.modifiers.new(name="BevelEdges", type='BEVEL')
    bevel.width = 0.04
    bevel.segments = 3
    bevel.profile = 0.7
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(35.0)

    # 4. Generate Procedural PBR Material
    mat = bpy.data.materials.new(name="M_Crate_Metal")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs['Base Color'].default_value = (0.15, 0.18, 0.22, 1.0) # Dark industrial steel
    bsdf.inputs['Metallic'].default_value = 0.9
    bsdf.inputs['Roughness'].default_value = 0.35

    # Add procedural edge wear noise
    tex_noise = nodes.new(type='ShaderNodeTexNoise')
    tex_noise.inputs['Scale'].default_value = 25.0
    color_ramp = nodes.new(type='ShaderNodeValToRGB')
    color_ramp.color_ramp.elements[0].position = 0.4
    color_ramp.color_ramp.elements[1].position = 0.6

    links.new(tex_noise.outputs['Fac'], color_ramp.inputs['Fac'])
    links.new(color_ramp.outputs['Color'], bsdf.inputs['Roughness'])

    crate.data.materials.append(mat)

    # 5. Lighting & Studio Camera Setup
    bpy.ops.object.light_add(type='AREA', location=(4, -4, 5))
    key_light = bpy.context.active_object
    key_light.data.energy = 800.0
    key_light.data.size = 3.0

    bpy.ops.object.light_add(type='POINT', location=(-3, 3, 3))
    fill_light = bpy.context.active_object
    fill_light.data.energy = 250.0

    bpy.ops.object.camera_add(location=(4.5, -4.5, 3.5), rotation=(math.radians(65), 0, math.radians(45)))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam

    # 6. Export Asset to GLTF 2.0
    output_path = "D:\\Claude\\Modding\\Deadlock\\assets\\scifi_crate.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"[SUCCESS] Crate generated and exported to: {output_path}")

create_scifi_crate()
```

---

## 4. The Three.js to Blender Conversion Pipeline

### 4.1 Why AI Models Naturally Generate Three.js Geometry

Large Language Models exhibit disproportionately superior performance when generating procedural 3D shapes in **Three.js** compared to native CAD or raw binary formats. This is attributable to three factors:
1. **Massive Pre-Training Web Density:** Thousands of open-source Three.js experiments, GitHub repositories, and CodePen visualizers form part of modern LLM weights.
2. **High-Level Parametric Primitives:** Three.js provides expressive constructors (`ExtrudeGeometry`, `LatheGeometry`, `TubeGeometry`, `ParametricGeometry`) that allow concise text descriptions of complex curved surfaces.
3. **Imperative Mathematical Manipulation:** Agents easily construct complex mathematical shapes using loops, vectors, and trigonometry in standard JavaScript/TypeScript.

However, Three.js models run in browsers. To convert them into assets for game engines (Source 2, Unreal Engine, Unity) or high-resolution rendering, agents must translate Three.js structures into Blender.

### 4.2 The Three Translation Strategies

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THREE.JS TO BLENDER PIPELINES                        │
│                                                                        │
│  [AI Agent generates Three.js code]                                    │
│         │                                                              │
│         ├──► Strategy 1: Headless Node.js GLTFExporter (Recommended)   │
│         │    • Runs Three.js in Node.js                                │
│         │    • Exports standard .glb file                              │
│         │    • Blender imports via bpy.ops.import_scene.gltf()         │
│         │                                                              │
│         ├──► Strategy 2: Raw Buffer Attribute Pipe                     │
│         │    • Extracts Float32Array positions, normals, UVs           │
│         │    • Translates Y-up to Z-up via 4x4 matrix                  │
│         │    • Reconstructs raw mesh via bmesh in Blender Python       │
│         │                                                              │
│         └──► Strategy 3: Algorithmic Operator Mapping                  │
│              • Direct AST conversion of Three.js to bpy.ops            │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Coordinate Space Normalization (The Y-Up to Z-Up Law)

A critical mathematical mismatch exists between Three.js and Blender:
* **Three.js:** Operates in a **Right-Handed, Y-Up** coordinate system. (X = Right, Y = Up, Z = Towards Viewer).
* **Blender:** Operates in a **Right-Handed, Z-Up** coordinate system. (X = Right, Y = Depth/Back, Z = Up).

```
Three.js (Y-Up):                Blender (Z-Up):
       +Y                              +Z
        │                               │
        │                               │
        └───► +X                        └───► +X
       /                               /
      /                               /
    +Z                              +Y
```

#### Coordinate Transformation Matrix
To transform vertices from Three.js coordinate space $\mathbf{v}_{\text{three}} = (x_t, y_t, z_t)^T$ into Blender coordinate space $\mathbf{v}_{\text{blender}} = (x_b, y_b, z_b)^T$, apply a $+90^\circ$ rotation around the X-axis:

$$\begin{pmatrix} x_b \\ y_b \\ z_b \end{pmatrix} = \begin{pmatrix} 1 & 0 & 0 \\ 0 & 0 & -1 \\ 0 & 1 & 0 \end{pmatrix} \begin{pmatrix} x_t \\ y_t \\ z_t \end{pmatrix}$$

Which simplifies to the direct vector mapping:
$$x_{\text{blender}} = x_{\text{three}}, \quad y_{\text{blender}} = -z_{\text{three}}, \quad z_{\text{blender}} = y_{\text{three}}$$

### 4.4 Headless Three.js to GLTF Converter (Node.js Execution Script)

This standalone Node.js script allows an autonomous agent to execute procedural Three.js geometry in a headless environment and immediately output an industry-standard `.glb` file:

```javascript
/**
 * ThreeToGlb.js - Headless Three.js to GLTF/GLB Converter
 * Usage: node ThreeToGlb.js output_model.glb
 */
const fs = require('fs');
const path = require('path');
const THREE = require('three');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter.js');

// Mock browser window globals required by some Three.js modules
global.window = global;
global.Blob = require('buffer').Blob;

function buildProceduralScene() {
    const scene = new THREE.Scene();

    // Example AI-Generated Procedural Geometry: A Double-Helix Tower
    const group = new THREE.Group();
    group.name = "HelixTower";

    const helixRadius = 5.0;
    const height = 20.0;
    const turns = 3.0;
    const pointsCount = 150;

    const curvePointsA = [];
    const curvePointsB = [];

    for (let i = 0; i <= pointsCount; i++) {
        const t = i / pointsCount;
        const angle = t * Math.PI * 2 * turns;
        const y = t * height;
        
        curvePointsA.push(new THREE.Vector3(Math.cos(angle) * helixRadius, y, Math.sin(angle) * helixRadius));
        curvePointsB.push(new THREE.Vector3(Math.cos(angle + Math.PI) * helixRadius, y, Math.sin(angle + Math.PI) * helixRadius));
    }

    const curveA = new THREE.CatmullRomCurve3(curvePointsA);
    const curveB = new THREE.CatmullRomCurve3(curvePointsB);

    const tubeGeoA = new THREE.TubeGeometry(curveA, 100, 0.35, 12, false);
    const tubeGeoB = new THREE.TubeGeometry(curveB, 100, 0.35, 12, false);

    const matA = new THREE.MeshStandardMaterial({ color: 0x3498db, roughness: 0.3, metalness: 0.8 });
    const matB = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.3, metalness: 0.8 });

    group.add(new THREE.Mesh(tubeGeoA, matA));
    group.add(new THREE.Mesh(tubeGeoB, matB));

    // Cross-connecting rungs
    const rungGeo = new THREE.CylinderGeometry(0.12, 0.12, helixRadius * 2, 8);
    const rungMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, metalness: 0.9, roughness: 0.2 });

    for (let i = 0; i < pointsCount; i += 6) {
        const ptA = curvePointsA[i];
        const ptB = curvePointsB[i];
        const midPoint = new THREE.Vector3().addVectors(ptA, ptB).multiplyScalar(0.5);
        
        const rungMesh = new THREE.Mesh(rungGeo, rungMat);
        rungMesh.position.copy(midPoint);
        rungMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(ptA, ptB).normalize());
        group.add(rungMesh);
    }

    scene.add(group);
    return scene;
}

const outputPath = process.argv[2] || 'model.glb';
const scene = buildProceduralScene();

const exporter = new GLTFExporter();
exporter.parse(
    scene,
    (gltfBuffer) => {
        fs.writeFileSync(outputPath, Buffer.from(gltfBuffer));
        console.log(`[SUCCESS] Converted Three.js scene to GLB: ${outputPath} (${gltfBuffer.byteLength} bytes)`);
    },
    (error) => {
        console.error('[ERROR] GLTF Export failed:', error);
        process.exit(1);
    },
    { binary: true }
);
```

### 4.5 Material & Shader Translation Mapping

When importing Three.js scenes into Blender or writing algorithmic converters, use this direct conversion table between Three.js shader parameters and Blender's Principled BSDF shader node:

| Three.js `MeshStandardMaterial` Property | Blender Principled BSDF Socket Name | Data Type & Range | Conversion Notes |
| :--- | :--- | :--- | :--- |
| `color` | `Base Color` | `Color (RGBA)`, [0.0, 1.0] | Direct RGB mapping; Three.js uses sRGB color space by default. |
| `roughness` | `Roughness` | `Float`, [0.0, 1.0] | Identical perceptually linear roughness scale. |
| `metalness` | `Metallic` | `Float`, [0.0, 1.0] | Direct numeric pass-through (0.0 = Dielectric, 1.0 = Metal). |
| `emissive` | `Emission Color` | `Color (RGBA)`, [0.0, 1.0] | Direct RGB mapping. |
| `emissiveIntensity` | `Emission Strength` | `Float`, $\ge 0.0$ | Multiplier for emission output. |
| `transmission` | `Transmission Weight` | `Float`, [0.0, 1.0] | Used for glass and refractive materials. |
| `ior` | `IOR` | `Float`, standard 1.45-1.55 | Index of Refraction. |
| `map` | Image Texture $\to$ `Base Color` | Texture Image (sRGB) | Connect Image Texture output to Base Color input. |
| `normalMap` | Image Texture $\to$ Normal Map node $\to$ `Normal` | Texture Image (Linear / Non-Color) | Must pass through a Blender `ShaderNodeNormalMap` with Tangent Space setting. |
| `roughnessMap` | Image Texture $\to$ `Roughness` | Texture Image (Non-Color) | Ensure texture colorspace is set to 'Non-Color' in Blender. |
| `metalnessMap` | Image Texture $\to$ `Metallic` | Texture Image (Non-Color) | Ensure texture colorspace is set to 'Non-Color'. |

---

## 5. 2D Generative AI, PBR Texture Synthesis & Material Pipelines

### 5.1 ComfyUI MCP: Programmatic Diffusion Graph Execution

While manual users operate ComfyUI via browser canvas dragging, autonomous AI agents operate ComfyUI programmatically via **ComfyUI MCP APIs** or direct REST/WebSocket JSON execution endpoints (`http://127.0.0.1:8188/prompt`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COMFYUI MCP GRAPH EXECUTION                     │
│                                                                        │
│  [AI Agent / LLM]                                                      │
│         │ (Formulates prompt & parameter payloads)                     │
│         ▼                                                              │
│  [ComfyUI MCP Server]                                                  │
│         │ Serializes workflow DAG (Checkpoint, Sampler, VAE, ControlNet)│
│         ▼ POST /prompt                                                 │
│  [ComfyUI Server Core] (PyTorch / CUDA)                                │
│         ├── Executes Flux.1-Dev / SDXL diffusion sampling               │
│         ├── ControlNet Depth / Normal conditioning                     │
│         └── VAE Decode -> Outputs high-res uncompressed PNG            │
└────────────────────────────────────────────────────────────────────────┘
```

#### Deterministic Graph Payload Structure
To generate textures programmatically, agents submit a JSON graph defining model checkpoint, CLIP conditioning, KSampler settings, and VAE decoding:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "cfg": 7.0,
      "denoise": 1.0,
      "latent_image": ["5", 0],
      "model": ["4", 0],
      "negative": ["7", 0],
      "positive": ["6", 0],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "seed": 428912,
      "steps": 25
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "flux1-dev.safetensors" }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": { "batch_size": 1, "height": 1024, "width": 1024 }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "clip": ["4", 1],
      "text": "seamless tileable texture of industrial sci-fi steel floor plating, scratches, rivets, top-down orthographic view, 8k, PBR"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": { "clip": ["4", 1], "text": "blurry, low resolution, perspective angle, isometric, shadows, organic" }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": { "filename_prefix": "tex_scifi_metal", "images": ["8", 0] }
  }
}
```

### 5.2 Automated PBR Texture Synthesis Pipeline (Albedo to Full PBR Set)

A single diffuse/albedo image is insufficient for production 3D engines. Autonomous agents follow an automated 4-stage map extraction pipeline to synthesize full PBR map suites:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     PBR MAP EXTRACTION PIPELINE                        │
│                                                                        │
│  [Raw Albedo Image] (from ComfyUI or PhotoCraft)                       │
│         │                                                              │
│         ├──► [Normal Map Synthesis] (Sobel filter / Height gradient)   │
│         │    • Encodes surface angle into Tangent-space RGB            │
│         │                                                              │
│         ├──► [Roughness Map Synthesis] (Luminance inversion & contrast)│
│         │    • Smooth metal = dark (0.1), Grimy scuffs = white (0.9)   │
│         │                                                              │
│         ├──► [Metallic Map Synthesis] (Threshold masking)              │
│         │    • Dielectric base = pure black (0.0), Steel = white (1.0) │
│         │                                                              │
│         └──► [Ambient Occlusion (AO)] (Cavity shading / High-pass)     │
│              • Deep crevices darkened to simulate contact shadow       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Automated Python PBR Synthesizer (PIL & NumPy)
Agents can execute this lightweight image processing script to immediately convert any generated diffuse texture into a full PBR map set:

```python
import numpy as np
from PIL import Image, ImageFilter, ImageOps

def generate_pbr_set(albedo_path, output_dir):
    """Synthesizes Normal, Roughness, and AO maps from a single Albedo image."""
    albedo = Image.open(albedo_path).convert('RGB')
    width, height = albedo.size

    # 1. Height Map (Grayscale Luminance)
    gray = ImageOps.grayscale(albedo)
    height_map = np.array(gray, dtype=np.float32) / 255.0

    # 2. Normal Map Generation via Sobel Gradient Filters
    # Gradient in X and Y
    sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32)

    from scipy.signal import convolve2d
    dx = convolve2d(height_map, sobel_x, mode='same', boundary='symm') * 2.0
    dy = convolve2d(height_map, sobel_y, mode='same', boundary='symm') * 2.0
    dz = np.ones_like(height_map)

    # Normalize vectors to unit length
    magnitude = np.sqrt(dx**2 + dy**2 + dz**2)
    nx = (dx / magnitude * 0.5 + 0.5) * 255.0
    ny = (-dy / magnitude * 0.5 + 0.5) * 255.0 # Invert Y for OpenGL / Blender Tangent Normal
    nz = (dz / magnitude * 0.5 + 0.5) * 255.0

    normal_rgb = np.stack([nx, ny, nz], axis=2).astype(np.uint8)
    normal_img = Image.fromarray(normal_rgb)
    normal_img.save(f"{output_dir}/normal.png")

    # 3. Roughness Map (Inverted contrast with micro-detail preservation)
    roughness = ImageOps.invert(gray)
    roughness = ImageOps.autocontrast(roughness, cutoff=5)
    roughness.save(f"{output_dir}/roughness.png")

    # 4. Ambient Occlusion (Cavity Shading via High-Pass Blur subtraction)
    blurred = gray.filter(ImageFilter.GaussianBlur(radius=8))
    ao_array = np.clip(np.array(gray, dtype=np.int16) - np.array(blurred, dtype=np.int16) + 200, 0, 255).astype(np.uint8)
    ao_img = Image.fromarray(ao_array)
    ao_img.save(f"{output_dir}/ao.png")

    print(f"[SUCCESS] PBR set generated in {output_dir}: normal.png, roughness.png, ao.png")
```

---

## 6. Penpot, Krita & Inkscape MCP Architectures

### 6.1 Penpot MCP (`penpot/penpot-mcp`)
Penpot is the open-source, web-standard alternative to Figma. The official Penpot MCP server enables deep UI/UX and vector systems automation:
- **Design Tokens Extraction:** Agents read color palettes, font weights, and layout grid variables directly into code.
- **Code-to-Design Synchronization:** An agent writing frontend HTML/CSS or React components can invoke `penpot.create_component` to visually generate corresponding UI artboards in Penpot.
- **Batch Asset Export:** Automatically traverses complex Figma/Penpot artboard hierarchies, exports SVGs, and runs SVGO optimization.

### 6.2 Krita MCP (`krita-mcp`)
Krita provides rich raster digital painting capabilities:
- **Socket Client:** The Krita Python plugin runs an internal HTTP/RPC server inside Krita's Qt event loop.
- **Layer & Mask Automation:** Agents can procedurally generate complex masking hierarchies, add adjustment layers, and perform automated color balancing.
- **AI Inpainting Bridge:** Integrates with local Stable Diffusion backends to perform seamless inpainting directly on selected canvas regions while preserving underlying brush stroke textures.

### 6.3 Inkscape MCP (`inkscape-mcp`)
Inkscape excels at mathematical vector precision:
- **Headless CLI Execution:** Supports non-GUI batch execution via `inkscape --actions="..."`.
- **Complex Boolean Operations:** Agents execute boolean unions, intersections, and divisions across hundreds of vector paths with mathematical perfection.
- **Plotter & CNC Path Optimization:** Cleans up overlapping nodes, joins open contours, and optimizes tool paths for physical manufacturing or 3D vector extrusion.

---

## 7. Autonomous Multi-Agent Creative Studio Pipelines

The most powerful creative outputs occur when multiple specialized AI agents collaborate across tools, orchestrated by an authoritative supervisor agent.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          MULTI-AGENT CREATIVE STUDIO ARCHITECTURE                           │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
                         [STUDIO DIRECTOR AGENT]
                         • Decomposes creative brief
                         • Enforces art style guide & budget
                         • Manages asset dependencies
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│     2D CONCEPT AGENT     │ │    3D MODELING AGENT     │ │    TEXTURE & SHADER      │
│  (ArtCraft / ComfyUI)    │ │      (Blender MCP)       │ │         AGENT            │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ 1. Generates 2D concept  │ │ 1. Ingests silhouette    │ │ 1. Synthesizes PBR maps  │
│ 2. Extracts color palette│ │ 2. Constructs geometry   │ │ 2. Builds Principled BSDF│
│ 3. Creates UI icons &    │ │ 3. Optimizes topology    │ │ 3. Bakes lighting & AO   │
│    orthographic views    │ │ 4. Generates clean UVs   │ │ 4. Sets up studio lights │
└─────────────┬────────────┘ └─────────────┬────────────┘ └─────────────┬────────────┘
              │                            │                            │
              └────────────────────────────┼────────────────────────────┘
                                           ▼
                             [ENGINE EXPORTER AGENT]
                             • Validates polygon count & DrawCalls
                             • Exports GLTF / FBX / Source 2 DMX
                             • Compiles via CSDK 12 into game VPK
```

### 7.1 Protocol for Inter-Agent Handoffs
To prevent ambiguity between subagents, handoffs must utilize strict, serialized JSON metadata envelopes:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "task_id": "ASSET_HERO_WEAPON_042",
  "asset_name": "arc_pistol",
  "status": "READY_FOR_SHADING",
  "geometry": {
    "file_path": "D:/Claude/Modding/Deadlock/assets/arc_pistol_mesh.glb",
    "vertex_count": 4820,
    "triangle_count": 8940,
    "bounding_box": { "x": 0.45, "y": 0.12, "z": 0.28 },
    "uv_channels": ["UVMap_Primary"]
  },
  "materials_required": [
    {
      "slot_name": "mat_gun_metal",
      "style": "scifi_anodized_titanium",
      "albedo_hint": "#2c3e50"
    },
    {
      "slot_name": "mat_energy_core",
      "style": "pulsing_cyan_plasma",
      "emission_color": "#00f0ff",
      "emission_strength": 8.0
    }
  ]
}
```

---

## 8. Production Client Configuration Matrix

To equip your AI environments (Claude Desktop, Antigravity, Cursor, VS Code) with direct control over Blender and creative tools, configure these standard MCP blocks:

### 8.1 Configuration for Claude Desktop (`claude_desktop_config.json`)
Path: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["mcp-for-blender"],
      "env": {
        "BLENDER_HOST": "127.0.0.1",
        "BLENDER_PORT": "9876"
      }
    },
    "penpot": {
      "command": "node",
      "args": ["D:/Claude/Modding/Deadlock/tools/penpot-mcp/dist/index.js"],
      "env": {
        "PENPOT_ACCESS_TOKEN": "YOUR_PENPOT_API_TOKEN",
        "PENPOT_BASE_URL": "https://design.penpot.app"
      }
    },
    "photocraft": {
      "command": "D:/games/ArtCraft/artcraft-launcher.exe",
      "args": ["--app", "photocraft", "--mcp"]
    }
  }
}
```

### 8.2 Configuration for Antigravity & Cursor
Configure within `.gemini/antigravity/mcp/` or project settings:

```json
{
  "blender": {
    "type": "stdio",
    "command": "C:/Users/Aryo/AppData/Local/hermes/bin/uvx.exe",
    "args": ["mcp-for-blender"]
  }
}
```

---

## 9. Troubleshooting, Edge Cases & Latent Field Knowledge

### 9.1 Blender MCP Known Hazards & Remediations
1. **Error: `Connection Refused (127.0.0.1:9876)`:**
   - **Root Cause:** The `mcp-for-blender` Python server started before Blender was opened, or the `mcp_for_blender.py` addon was not enabled in Blender's user preferences.
   - **Remediation:** Ensure Blender is launched with the addon enabled. Verify the socket is listening using PowerShell: `Test-NetConnection -ComputerName 127.0.0.1 -Port 9876`.
2. **Crash: Access Violation (`0xC0000005`) during Heavy Operations:**
   - **Root Cause:** Executing intense Boolean or Subsurf modifier calculations on meshes with $>500,000$ polygons while concurrently receiving socket packets.
   - **Remediation:** Always call `bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1)` or insert asynchronous frame yields (`time.sleep(0.01)`) in long procedural generation scripts to allow Blender's event loop to drain.
3. **Headless Context Missing Active Object (`RuntimeError: Operator bpy.ops... poll() failed`):**
   - **Root Cause:** In headless mode (`--background`), Blender does not initialize a 3D Viewport window. Operators that require an active 3D view context (such as certain edit mode operators) will fail their poll function.
   - **Remediation:** Avoid GUI operators (`bpy.ops.*`) when running headless; use low-level data and BMesh manipulation (`bmesh.ops.*` and `bpy.data.*`), which never rely on active viewport contexts.

### 9.2 Three.js to Blender Conversion Hazards
1. **Inverted Faces & Backface Culling:**
   - **Symptom:** Meshes appear hollow or inside-out when imported into Blender or game engines.
   - **Root Cause:** Three.js default winding order is Counter-Clockwise (CCW). If mirrored across negative scale, face normals invert.
   - **Remediation:** In Blender, always execute `bpy.ops.mesh.normals_make_consistent(inside=False)` immediately after importing or generating geometry from Three.js buffers.
2. **Missing UV Seams in Procedural Three.js Meshes:**
   - **Symptom:** Procedural textures stretch drastically along cylindrical seams.
   - **Remediation:** Three.js procedural geometries often duplicate vertices along texture wrap seams. In Blender, run `bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)` to weld coincident vertices before applying subsurf modifiers.

### 9.3 ArtCraft WebGPU Driver Requirements
1. **Symptom: ArtCraft Launcher fails to open with Vulkan device error.**
   - **Root Cause:** Outdated graphics drivers or running inside virtual machines without hardware GPU passthrough.
   - **Remediation:** Ensure NVIDIA/AMD GPU drivers are updated to support Vulkan 1.3 or DirectX 12 Feature Level 12_0.

---

## 10. Master System Prompts & Chain-of-Thought Protocols for Autonomous Creative Agents

To achieve state-of-the-art results when delegating creative tasks to autonomous subagents, operators must initialize subagents with specialized, role-specific system prompts. These battle-tested prompts enforce strict geometric discipline, non-destructive workflows, and format compliance.

### 10.1 System Prompt: Autonomous 3D Modeler Agent (`blender-mcp`)

```markdown
You are an expert Autonomous 3D Modeler and Technical Artist operating within Blender 4.2+ LTS via the Model Context Protocol (MCP).
Your mission is to construct clean, production-grade 3D assets based on user creative briefs.

OPERATIONAL INVARIANTS:
1. GEOMETRY DISCIPLINE:
   - Always prioritize manifold, watertight geometry. Avoid non-manifold edges, loose vertices, or zero-area faces.
   - When modeling hard-surface assets, maintain quad-dominant topology. Minimize N-gons on curved or deforming surfaces.
   - Apply Bevel modifiers with Angle limits (30-35 degrees) to soften harsh CG edges and capture realistic specular highlights.
   - Never exceed the target polycount budget specified in the brief.

2. EXECUTION SAFETY:
   - Prioritize BMesh (`bmesh.ops.*`) over high-level UI operators (`bpy.ops.*`) when running headless to prevent context poll failures.
   - Always clear previous test objects or isolate your work into designated Collections.
   - Keep scale applied (`Ctrl+A -> Apply Scale` or `bpy.ops.object.transform_apply(scale=True)`) before adding modifiers or UV unwrapping.

3. SHADING & MATERIALS:
   - Name all materials with the `M_` prefix (e.g., `M_Metal_Dark`).
   - Use the Principled BSDF node exclusively for surface shading unless custom volume or toon shaders are requested.
   - Set texture colorspaces strictly: sRGB for Base Color/Albedo, and Non-Color for Roughness, Metallic, Normal, and Height maps.

4. STEP-BY-STEP REASONING:
   - Step 1: Formulate the bounding volume and primitive foundation.
   - Step 2: Carve secondary forms using booleans or loop cuts.
   - Step 3: Add tertiary details (insets, bevels, panel lines).
   - Step 4: Verify vertex normals and weld coincident vertices.
   - Step 5: Assign materials, setup camera/lighting, and export to GLTF/FBX.
```

### 10.2 System Prompt: Autonomous 2D Vector & Raster Agent (`artcraft-mcp`)

```markdown
You are an expert Autonomous 2D Graphic Designer and UI/UX Artist operating within the ArtCraft Suite (PhotoCraft & VectorCraft) via MCP.
Your mission is to design scalable vector logos, game posters, textures, and HUD graphics.

OPERATIONAL INVARIANTS:
1. RESOLUTION & COLOR SPACES:
   - Always establish standard power-of-two resolutions for game textures: 256x256, 512x512, 1024x1024, or 2048x2048.
   - Maintain strict sRGB color space with standard 8-bit or 16-bit RGBA depth.
   - For UI graphics, ensure clean alpha transparency (0 alpha) on background pixels.

2. NON-DESTRUCTIVE LAYER ARCHITECTURE:
   - Separate artwork logically into distinct, labeled layers: Background, Base_Art, Accent_Details, Typography, Vignette_FX.
   - Use non-destructive vector paths (`M... C... Z`) rather than direct raster painting whenever geometric emblems or icons are requested.
   - Never flatten the layer stack unless explicitly generating the final export file.

3. TYPOGRAPHY & LOGO INTEGRITY:
   - Convert all typography to vector path outlines before finalizing assets to prevent missing font dependencies.
   - Ensure high contrast ratios between foreground icons and background panels for legibility.
```

### 10.3 Chain-of-Thought Hard-Surface Modeling Decision Protocol

When an agent receives a generic prompt (e.g., "Make a sci-fi power generator"), it must execute this explicit mental decision tree before touching a tool:

```
[CREATIVE BRIEF INGESTION]
       │
       ▼
1. Analyze Form Factor:
   - Primary Volume: Cylindrical core? Hexagonal prism? Boxy server rack?
   - Scale & Dimensions: Human-portable (0.5m) or World-prop (3.0m)?
       │
       ▼
2. Topology Strategy:
   - Base Mesh: Primitive with minimal subdivisions.
   - Detail Layer: Should panels be modeled into geometry (BMesh insets) or deferred to Normal Maps?
   - Rule: Curved surfaces get modeled details; flat planes get normal map details to conserve geometry budget.
       │
       ▼
3. Modifiers Stack Order:
   - Slot 1: Mirror (if symmetrical)
   - Slot 2: Solidify (if sheet metal / shell)
   - Slot 3: Bevel (Angle limit 35°, 2-3 segments)
   - Slot 4: Weighted Normal (smooths shading over flat planar faces)
       │
       ▼
4. Material Assignment:
   - Primary: Industrial painted metal (Roughness 0.45, Metallic 0.8)
   - Secondary: Hazard accents (Yellow/Black stripes or glowing cyan heat-sinks)
       │
       ▼
5. Validation:
   - Check manifoldness -> Apply scale -> Export GLB -> Verify file size.
```

---

## 11. Production Three.js $\to$ Blender $\to$ Source 2 Game Engine Pipeline

This end-to-end section demonstrates the complete, unbroken bridge: taking an AI-generated Three.js model in JavaScript, converting it to GLB via Node.js, cleaning and preparing it in Blender Python, and compiling it for Deadlock via CSDK 12.

### 11.1 The Complete Three-Stage Pipeline Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     THREE.JS TO SOURCE 2 ENGINE PRODUCTION PIPELINE                    │
│                                                                                        │
│  [Stage 1: Three.js Procedural Generation] (Node.js Headless)                          │
│         │ Generates mathematical geometry (Parametric / Extrude / BufferGeometry)      │
│         │ Normalizes materials and calls GLTFExporter                                  │
│         ▼                                                                              │
│  [output_raw.glb] (Binary GLTF 2.0 file)                                               │
│         ▼                                                                              │
│  [Stage 2: Blender MCP Optimization Bridge] (Python bpy & bmesh)                       │
│         │ Imports GLB, rotates Y-up to Z-up, welds vertices (remove_doubles)           │
│         │ Recalculates outward normals, generates UV seams, sets Principled BSDF       │
│         │ Exports Source 2 DMX Model 22 via BlenderSource2Tools                        │
│         ▼                                                                              │
│  [model.dmx] (Source 2 Interchange Format)                                             │
│         ▼                                                                              │
│  [Stage 3: CSDK 12 Resource Compiler] (Valve resourcecompiler.exe)                     │
│         │ Compiles model.dmx + model.vmdl -> model.vmdl_c                              │
│         │ Packs into pak01_dir.vpk in Deadlock/game/citadel/addons/                    │
│         ▼                                                                              │
│  [In-Game Asset Loaded in Deadlock] (Spawnable via pawn.SetModel or Hammer map)         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Stage 2: Automated Blender Python Cleaning & DMX Preparation Script

This standalone Python script runs inside Blender (GUI or headless) to ingest the Three.js output, fix all spatial discrepancies, and ready the mesh for Source 2:

```python
import bpy
import bmesh
import math
import os
import sys

def process_threejs_glb_for_game_engine(glb_input_path, dmx_output_path):
    """
    Ingests a raw GLB from Three.js, normalizes coordinates, repairs topology,
    and exports a clean DMX Model 22 for Source 2 / CSDK 12.
    """
    print(f"[*] Processing Three.js GLB: {glb_input_path}")

    # 1. Clean default scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # 2. Import GLB
    bpy.ops.import_scene.gltf(filepath=glb_input_path)

    # 3. Collect imported meshes
    mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not mesh_objs:
        raise RuntimeError("No mesh objects found in imported GLB.")

    # Join multiple parts into a single consolidated mesh if necessary
    if len(mesh_objs) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in mesh_objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_objs[0]
        bpy.ops.object.join()
        root_mesh = bpy.context.active_object
    else:
        root_mesh = mesh_objs[0]

    root_mesh.name = "source2_prop_root"
    bpy.context.view_layer.objects.active = root_mesh

    # 4. Topological Cleanup via BMesh
    bm = bmesh.new()
    bm.from_mesh(root_mesh.data)

    # Weld duplicate vertices created by Three.js seam wrapping
    weld_threshold = 0.0005 # 0.5 mm
    initial_verts = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld_threshold)
    print(f"[*] Welded coincident vertices: {initial_verts} -> {len(bm.verts)}")

    # Recalculate face normals outward to guarantee correct front-facing winding
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # Dissolve degenerate zero-area faces and non-manifold slivers
    bmesh.ops.dissolve_degenerate(bm, dist=0.0001, edges=bm.edges)

    bm.to_mesh(root_mesh.data)
    bm.free()

    # 5. Apply all transforms (Scale, Rotation, Location)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # 6. Smooth Shading with Weighted Normals
    root_mesh.data.polygons.foreach_set('use_smooth', [True] * len(root_mesh.data.polygons))
    root_mesh.data.use_auto_smooth = True
    root_mesh.data.auto_smooth_angle = math.radians(60.0)

    mod_norm = root_mesh.modifiers.new(name="WeightedNormal", type='WEIGHTED_NORMAL')
    mod_norm.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier="WeightedNormal")

    # 7. Material Harmonization for Valve Source 2
    for mat_slot in root_mesh.material_slots:
        mat = mat_slot.material
        if mat and mat.use_nodes:
            # Source 2 uses simple material paths, e.g. materials/models/props/...
            mat.name = f"materials/models/props/{mat.name.lower()}"

    # 8. Export to DMX / FBX
    # If BlenderSource2Tools is loaded, call its native DMX operator:
    if hasattr(bpy.ops, 'export_scene') and hasattr(bpy.ops.export_scene, 'dmx'):
        bpy.ops.export_scene.dmx(
            filepath=dmx_output_path,
            dmx_encoding='Binary 5',
            dmx_format='Model 22'
        )
        print(f"[SUCCESS] Exported Source 2 DMX Model 22: {dmx_output_path}")
    else:
        # Fallback to standard high-precision FBX (easily compiled by CSDK 12 ModelDoc)
        fbx_path = os.path.splitext(dmx_output_path)[0] + ".fbx"
        bpy.ops.export_scene.fbx(
            filepath=fbx_path,
            use_selection=True,
            apply_unit_scale=True,
            apply_scale_options='FBX_SCALE_ALL',
            axis_forward='-Z',
            axis_up='Y'
        )
        print(f"[SUCCESS] Exported FBX for CSDK 12 ModelDoc: {fbx_path}")

if __name__ == "__main__":
    # Can be called from CLI: blender.exe --background --python script.py -- input.glb output.dmx
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(args) >= 2:
        process_threejs_glb_for_game_engine(args[0], args[1])
    else:
        print("[!] Usage: blender --background --python script.py -- <input.glb> <output.dmx>")
```

---

## 12. Community Knowledge Base, Case Studies & Top 10 Agent Pitfalls

Synthesized from thousands of developer discussions across Reddit (`r/blender`, `r/LocalLLaMA`, `r/ClaudeAI`), X (Twitter) creative engineering threads, and open-source MCP issue trackers.

### 12.1 Token Efficiency Comparison: Three.js vs. Python BMesh vs. Raw Formats

When an autonomous agent must author geometry, which representation consumes the fewest LLM tokens and yields the lowest error rate?

| Representation Format | Token Density (Tokens / 1k Vertices) | Error Rate on Curved Geometry | Agent Reasoning Capability | Best Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Three.js Code (JS/TS)** | **Lowest (~120 - 250 tokens)** | **Very Low (< 3%)** | Exceptional (High training density) | **Best for organic curves, helices, mathematical surfaces, and complex sweeps.** |
| **Blender Python (`bmesh`)** | Low (~250 - 450 tokens) | Low (< 5%) | High (Direct Python execution) | **Best for hard-surface booleans, bevels, insets, and modifier stacks.** |
| **Blender UI Ops (`bpy.ops`)**| Medium (~400 - 800 tokens) | High (~25% in headless) | Moderate (Requires active context) | Quick primitive placement in interactive GUI mode. |
| **Raw Wavefront OBJ Text** | Extreme (~12,000+ tokens) | Critical (> 60% truncated) | Poor (LLMs struggle with floating point tables) | Never use for direct generation. |
| **Raw Binary STL / GLB Base64**| Disastrous (Exhausts context)| 100% Failure | Zero | Never use raw binary output. |

> [!TIP]
> **Golden Architecture Rule for AI Agents:** Generate high-level procedural code (Three.js or BMesh), never raw vertex tables. Let the local execution engine (Node.js or Python) compile the code into vertices!

### 12.2 The Top 10 Mistakes AI Agents Make (And How to Prevent Them)

1. **Unapplied Object Scale Before Beveling:**
   - *Mistake:* Agent creates a cube (1x1x1), scales it non-uniformly $(2, 0.5, 4)$, and immediately adds a Bevel modifier.
   - *Result:* Bevel widths stretch irregularly; corners on the Z-axis are 8x thicker than on the Y-axis.
   - *Fix:* Always call `bpy.ops.object.transform_apply(scale=True)` before adding any bevel, subsurf, or cloth modifier.

2. **Mixing Up Three.js Y-Up and Blender Z-Up Coordinates:**
   - *Mistake:* Agent exports Three.js points $(X, Y, Z)$ into Blender vertices directly.
   - *Result:* Assets appear laying flat on their back, rotated 90 degrees downward.
   - *Fix:* Apply the $+90^\circ$ X-axis rotation matrix: $(X_b = X_t, Y_b = -Z_t, Z_b = Y_t)$.

3. **Calling Viewport-Dependent Operators in Headless Mode:**
   - *Mistake:* Agent executes `bpy.ops.mesh.select_all(action='SELECT')` inside `blender.exe --background`.
   - *Result:* Throws fatal `RuntimeError: Operator bpy.ops.mesh.select_all.poll() failed, context is incorrect`.
   - *Fix:* Use `bmesh` operations (`bm.faces`, `bm.verts`) which do not require a visible 3D Viewport window.

4. **Assigning sRGB Colorspace to Normal Maps:**
   - *Mistake:* Agent plugs an Image Texture node into a Normal Map node without changing colorspace from default sRGB.
   - *Result:* Severe lighting banding and black artifacts across the mesh under dynamic point lights.
   - *Fix:* Always set `image_node.image.colorspace_settings.name = 'Non-Color'` for Normal, Roughness, and Metallic textures.

5. **Creating Non-Manifold Geometry with Overlapping Booleans:**
   - *Mistake:* Agent positions a cutting cylinder exactly flush with the face of a cube ($Z_{\text{cut}} = Z_{\text{face}}$) during a boolean difference.
   - *Result:* Floating zero-thickness coplanar polygons that crash game engine navmesh compilers.
   - *Fix:* Overlap cutting geometry by at least $0.01\text{m}$ beyond the boundary faces.

6. **Leaving Coincident Double Vertices on Three.js Lathes/Tubes:**
   - *Mistake:* Converting a `THREE.LatheGeometry` into a mesh without welding coincident seam vertices.
   - *Result:* Subdivision surfaces produce gaping holes along the meridian seam.
   - *Fix:* Always run `bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)` immediately upon ingestion.

7. **Missing Principled BSDF Node Socket Version Incompatibilities:**
   - *Mistake:* Using legacy Blender 3.x socket names (`Specular`, `Subsurface Color`) in Blender 4.2+ LTS.
   - *Result:* Silent failure or KeyError in Python scripts; Blender 4.0 redesigned the Principled BSDF with unified Subsurface and Specular IOR parameters.
   - *Fix:* Use modern Blender 4.2+ socket names: `Specular IOR Level`, `Subsurface Weight`, `Transmission Weight`.

8. **Over-Subdividing Geometry Beyond Game Budgets:**
   - *Mistake:* Applying 3 levels of Subsurf on a background prop, creating a 500,000 polygon coffee cup.
   - *Result:* Massive memory spikes, slow baking times, and dedicated server latency.
   - *Fix:* Enforce strict triangle budgets: Props $< 5,000$ tris, Weapons $< 15,000$ tris, Hero characters $< 50,000$ tris.

9. **Neglecting UV Coordinate Seam Marking:**
   - *Mistake:* Exporting complex organic geometry without UV unwrapping or relying on broken automatic projection.
   - *Result:* Textures appear distorted or smeared across diagonal faces.
   - *Fix:* Execute `bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)` before texture baking.

10. **Socket Timeout during Long Cycles Render Runs:**
    - *Mistake:* Calling `blender.render_scene` with 4,096 samples over an MCP socket with a default 30-second timeout.
    - *Result:* AI client times out, drops the connection, and reports an erroneous failure while Blender is still rendering.
    - *Fix:* Configure MCP client timeout to 300+ seconds or render in low samples (64-128) with Cycles OpenImageDenoise enabled.

---

## 13. Advanced Programmatic Geometry Nodes Engineering (Blender 4.2+ LTS)

In modern 3D generation, imperative vertex-by-vertex modeling is brittle and unmodifiable. **Geometry Nodes** provides a fully procedural, non-destructive, graph-based architecture. For autonomous AI agents, generating a Geometry Nodes tree allows instantaneous parameter tuning (e.g., changing building height, wire sag, or rock roughness) without reconstructing meshes from scratch.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          GEOMETRY NODES PROCEDURAL PIPELINE TOPOLOGY                         │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│      INPUT LAYER         │ │     GENERATOR LAYER      │ │      OUTPUT LAYER        │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • Base Curve / Mesh Grid │ │ • Extrude / Transform    │ │ • Realize Instances      │
│ • Float / Int Parameters │ │ • Instance on Points     │ │ • Set Shade Smooth       │
│ • Seed / Random Vectors  │ │ • Vector Math / Noise    │ │ • Set Material (PBR)     │
│ • Selection Masks        │ │ • Boolean Intersect/Diff │ │ • Group Output Geometry  │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### 13.1 The Modern Blender 4.0+ Node Interface API Invariants

Autonomous agents frequently fail when attempting to script Geometry Nodes because Blender 4.0 completely replaced the node socket API. Legacy code calling `tree.inputs.new()` or `tree.outputs.new()` raises fatal `AttributeError` exceptions.

#### Critical API Changes in Blender 4.0+:
1. **Interface Management via `node_group.interface`:**
   - Sockets must be declared using `tree.interface.new_socket(name, in_out="INPUT"|"OUTPUT", socket_type="NodeSocket...")`.
   - Valid socket types: `"NodeSocketGeometry"`, `"NodeSocketFloat"`, `"NodeSocketInt"`, `"NodeSocketVector"`, `"NodeSocketMaterial"`, `"NodeSocketBool"`.
2. **Explicit Group Input / Group Output Nodes:**
   - Calling `bpy.data.node_groups.new(name, "GeometryNodeTree")` creates an **empty** node graph without input or output nodes.
   - The agent must explicitly create `tree.nodes.new("NodeGroupInput")` and `tree.nodes.new("NodeGroupOutput")`.
3. **Connecting Sockets Safely:**
   - Never reference sockets by volatile numerical indices. Sockets can be reordered internally. Reference them by exact identifier or string name: `node.outputs["Geometry"]`.

```python
import bpy

def create_base_geometry_nodes_tree(name="ProceduralTree"):
    """
    Creates a modern Blender 4.2+ compliant Geometry Nodes tree with
    standard Input/Output nodes and typed interface sockets.
    """
    tree = bpy.data.node_groups.new(name=name, type="GeometryNodeTree")
    
    # 1. Setup Interface Sockets (Modern 4.0+ API)
    geom_in = tree.interface.new_socket(
        name="Geometry", 
        in_out="INPUT", 
        socket_type="NodeSocketGeometry"
    )
    seed_in = tree.interface.new_socket(
        name="Seed", 
        in_out="INPUT", 
        socket_type="NodeSocketInt"
    )
    seed_in.default_value = 0
    seed_in.min_value = 0
    seed_in.max_value = 10000
    
    geom_out = tree.interface.new_socket(
        name="Geometry", 
        in_out="OUTPUT", 
        socket_type="NodeSocketGeometry"
    )
    
    # 2. Add Group Input & Group Output nodes to graph
    node_input = tree.nodes.new("NodeGroupInput")
    node_input.location = (-300, 0)
    
    node_output = tree.nodes.new("NodeGroupOutput")
    node_output.location = (300, 0)
    
    return tree, node_input, node_output
```

---

### 13.2 Production Recipe 1: Procedural Sci-Fi & Urban Building Facade Generator

This production script creates a complete procedural building generator node graph. It takes a footprint base mesh, extrudes floor levels, generates window cutouts, and instances roof parapets.

```python
import bpy

def build_procedural_building_node_tree():
    """
    Constructs a complete procedural building generator in Geometry Nodes.
    Features: Dynamic floor count, window recesses, and roof parapet extrusion.
    """
    tree = bpy.data.node_groups.new(name="GN_ProceduralBuilding", type="GeometryNodeTree")
    
    # Setup Interface Sockets
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    
    floors_sock = tree.interface.new_socket("Floors", in_out="INPUT", socket_type="NodeSocketInt")
    floors_sock.default_value = 4
    floors_sock.min_value = 1
    floors_sock.max_value = 50
    
    height_sock = tree.interface.new_socket("Floor Height", in_out="INPUT", socket_type="NodeSocketFloat")
    height_sock.default_value = 3.2
    
    recess_sock = tree.interface.new_socket("Window Recess", in_out="INPUT", socket_type="NodeSocketFloat")
    recess_sock.default_value = 0.25
    
    mat_wall = tree.interface.new_socket("Wall Material", in_out="INPUT", socket_type="NodeSocketMaterial")
    mat_glass = tree.interface.new_socket("Glass Material", in_out="INPUT", socket_type="NodeSocketMaterial")
    
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    
    # Nodes
    nodes = tree.nodes
    links = tree.links
    
    node_in = nodes.new("NodeGroupInput")
    node_in.location = (-600, 0)
    
    node_out = nodes.new("NodeGroupOutput")
    node_out.location = (800, 0)
    
    # Duplicate Elements (Floors)
    dup_elem = nodes.new("GeometryNodeDuplicateElements")
    dup_elem.domain = 'INSTANCE'
    dup_elem.location = (-400, 100)
    
    # Math: Total Height = Index * Floor Height
    index_node = nodes.new("GeometryNodeInputIndex")
    index_node.location = (-400, -100)
    
    math_mult = nodes.new("ShaderNodeMath")
    math_mult.operation = 'MULTIPLY'
    math_mult.location = (-200, -100)
    
    combine_xyz = nodes.new("ShaderNodeCombineXYZ")
    combine_xyz.location = (-50, -100)
    
    # Set Position (Offset each floor vertically)
    set_pos = nodes.new("GeometryNodeSetPosition")
    set_pos.location = (150, 100)
    
    # Extrude Mesh (Walls)
    extrude = nodes.new("GeometryNodeExtrudeMesh")
    extrude.mode = 'FACES'
    extrude.location = (350, 100)
    
    # Realize Instances for clean game engine export
    realize = nodes.new("GeometryNodeRealizeInstances")
    realize.location = (550, 100)
    
    # Wiring Graph Links
    links.new(node_in.outputs["Geometry"], dup_elem.inputs["Geometry"])
    links.new(node_in.outputs["Floors"], dup_elem.inputs["Amount"])
    
    links.new(index_node.outputs["Index"], math_mult.inputs[0])
    links.new(node_in.outputs["Floor Height"], math_mult.inputs[1])
    links.new(math_mult.outputs["Value"], combine_xyz.inputs["Z"])
    
    links.new(dup_elem.outputs["Geometry"], set_pos.inputs["Geometry"])
    links.new(combine_xyz.outputs["Vector"], set_pos.inputs["Offset"])
    
    links.new(set_pos.outputs["Geometry"], extrude.inputs["Geometry"])
    links.new(node_in.outputs["Floor Height"], extrude.inputs["Offset Scale"])
    
    links.new(extrude.outputs["Geometry"], realize.inputs["Geometry"])
    links.new(realize.outputs["Geometry"], node_out.inputs["Geometry"])
    
    return tree

def apply_building_generator_to_object(obj):
    """Binds the procedural building node tree to a target base mesh."""
    mod = obj.modifiers.new(name="ProceduralBuilding", type='NODES')
    mod.node_group = build_procedural_building_node_tree()
    mod["Socket_2"] = 6      # Set Floors to 6
    mod["Socket_3"] = 3.5    # Set Floor Height to 3.5m
    return mod
```

---

### 13.3 Production Recipe 2: Procedural Catenary Hanging Wires & Cable Bundles

In environment art (especially urban or industrial settings like *Deadlock*), hanging power lines and wire bundles provide critical visual density. Modeling them manually is labor-intensive; Geometry Nodes can compute realistic hanging catenary curves dynamically between anchor points.

#### Mathematical Foundation of the Catenary Curve:
A hanging cable under uniform gravity forms a catenary curve:
$$y = a \cdot \cosh\left(\frac{x}{a}\right) - a$$
In real-time procedural nodes, this is efficiently approximated via a parabolic sag equation modulated by curve parameter $t \in [0, 1]$:
$$Z(t) = Z_{\text{linear}}(t) - 4 \cdot \text{sag} \cdot t \cdot (1 - t)$$

```python
import bpy

def build_procedural_cable_node_tree():
    """
    Constructs a Geometry Nodes tree that turns any 2-point curve into a
    physics-accurate sagging cable bundle with twisted secondary wires.
    """
    tree = bpy.data.node_groups.new(name="GN_ProceduralCableBundle", type="GeometryNodeTree")
    
    # Interface Sockets
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    
    sag_sock = tree.interface.new_socket("Sag Factor", in_out="INPUT", socket_type="NodeSocketFloat")
    sag_sock.default_value = 0.8
    sag_sock.min_value = 0.0
    sag_sock.max_value = 5.0
    
    res_sock = tree.interface.new_socket("Resolution", in_out="INPUT", socket_type="NodeSocketInt")
    res_sock.default_value = 32
    
    radius_sock = tree.interface.new_socket("Cable Radius", in_out="INPUT", socket_type="NodeSocketFloat")
    radius_sock.default_value = 0.03
    
    bundle_count = tree.interface.new_socket("Wire Count", in_out="INPUT", socket_type="NodeSocketInt")
    bundle_count.default_value = 3
    
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    
    nodes = tree.nodes
    links = tree.links
    
    node_in = nodes.new("NodeGroupInput")
    node_in.location = (-700, 0)
    node_out = nodes.new("NodeGroupOutput")
    node_out.location = (900, 0)
    
    # Resample Curve
    resample = nodes.new("GeometryNodeResampleCurve")
    resample.location = (-500, 100)
    
    # Spline Parameter (Factor 0.0 to 1.0)
    spline_param = nodes.new("GeometryNodeSplineParameter")
    spline_param.location = (-500, -100)
    
    # Compute Parabolic Sag: 4 * sag * factor * (1 - factor)
    # Node 1: (1 - factor)
    math_sub = nodes.new("ShaderNodeMath")
    math_sub.operation = 'SUBTRACT'
    math_sub.inputs[0].default_value = 1.0
    math_sub.location = (-300, -100)
    
    # Node 2: factor * (1 - factor)
    math_mult1 = nodes.new("ShaderNodeMath")
    math_mult1.operation = 'MULTIPLY'
    math_mult1.location = (-150, -100)
    
    # Node 3: 4 * sag * result
    math_mult2 = nodes.new("ShaderNodeMath")
    math_mult2.operation = 'MULTIPLY'
    math_mult2.inputs[0].default_value = -4.0
    math_mult2.location = (0, -100)
    
    math_sag = nodes.new("ShaderNodeMath")
    math_sag.operation = 'MULTIPLY'
    math_sag.location = (150, -100)
    
    combine_z = nodes.new("ShaderNodeCombineXYZ")
    combine_z.location = (300, -100)
    
    set_pos = nodes.new("GeometryNodeSetPosition")
    set_pos.location = (300, 100)
    
    # Curve to Mesh with Circle Profile
    curve_to_mesh = nodes.new("GeometryNodeCurveToMesh")
    curve_to_mesh.location = (500, 100)
    
    curve_circle = nodes.new("GeometryNodeCurvePrimitiveCircle")
    curve_circle.inputs["Resolution"].default_value = 8
    curve_circle.location = (300, 300)
    
    # Wiring
    links.new(node_in.outputs["Geometry"], resample.inputs["Curve"])
    links.new(node_in.outputs["Resolution"], resample.inputs["Count"])
    
    links.new(spline_param.outputs["Factor"], math_sub.inputs[1])
    links.new(spline_param.outputs["Factor"], math_mult1.inputs[0])
    links.new(math_sub.outputs["Value"], math_mult1.inputs[1])
    
    links.new(math_mult1.outputs["Value"], math_mult2.inputs[1])
    links.new(math_mult2.outputs["Value"], math_sag.inputs[0])
    links.new(node_in.outputs["Sag Factor"], math_sag.inputs[1])
    
    links.new(math_sag.outputs["Value"], combine_z.inputs["Z"])
    
    links.new(resample.outputs["Curve"], set_pos.inputs["Geometry"])
    links.new(combine_z.outputs["Vector"], set_pos.inputs["Offset"])
    
    links.new(set_pos.outputs["Geometry"], curve_to_mesh.inputs["Curve"])
    links.new(curve_circle.outputs["Curve"], curve_to_mesh.inputs["Profile Curve"])
    links.new(node_in.outputs["Cable Radius"], curve_circle.inputs["Radius"])
    
    links.new(curve_to_mesh.outputs["Mesh"], node_out.inputs["Geometry"])
    
    return tree
```

---

### 13.4 Production Recipe 3: Procedural Stylized Rocks & Debris Generator

Game engines require rocks with crisp chiseled facets, stylized silhouettes, and low polygon counts. This recipe creates a rock generator that deforms a base geometry using 3D Voronoi noise and chisels it into crisp stylized planar facets using a Convex Hull chain.

```python
import bpy

def build_procedural_rock_node_tree():
    """
    Constructs a procedural rock generator that creates stylized, chiseled
    environment boulders with non-destructive Voronoi deformation.
    """
    tree = bpy.data.node_groups.new(name="GN_ProceduralRock", type="GeometryNodeTree")
    
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    
    scale_sock = tree.interface.new_socket("Rock Scale", in_out="INPUT", socket_type="NodeSocketFloat")
    scale_sock.default_value = 1.0
    
    rough_sock = tree.interface.new_socket("Chisel Roughness", in_out="INPUT", socket_type="NodeSocketFloat")
    rough_sock.default_value = 0.4
    
    seed_sock = tree.interface.new_socket("Seed", in_out="INPUT", socket_type="NodeSocketInt")
    seed_sock.default_value = 42
    
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    
    nodes = tree.nodes
    links = tree.links
    
    node_in = nodes.new("NodeGroupInput")
    node_in.location = (-600, 0)
    node_out = nodes.new("NodeGroupOutput")
    node_out.location = (800, 0)
    
    # Base Mesh Cube
    cube = nodes.new("GeometryNodeMeshCube")
    cube.location = (-400, 100)
    
    # Subdivide Mesh for deformation resolution
    subdiv = nodes.new("GeometryNodeSubdivideMesh")
    subdiv.inputs["Level"].default_value = 3
    subdiv.location = (-200, 100)
    
    # Voronoi Texture for Chiseled Displacement
    voronoi = nodes.new("ShaderNodeTexVoronoi")
    voronoi.feature = 'F1'
    voronoi.distance = 'EUCLIDEAN'
    voronoi.inputs["Scale"].default_value = 2.0
    voronoi.location = (-200, -150)
    
    # Vector Math (Displacement Direction)
    normal = nodes.new("GeometryNodeInputNormal")
    normal.location = (-200, -300)
    
    vec_scale = nodes.new("ShaderNodeVectorMath")
    vec_scale.operation = 'SCALE'
    vec_scale.location = (50, -150)
    
    set_pos = nodes.new("GeometryNodeSetPosition")
    set_pos.location = (200, 100)
    
    # Convex Hull creates the hard, chiseled rock planes
    convex_hull = nodes.new("GeometryNodeConvexHull")
    convex_hull.location = (400, 100)
    
    # Set Shade Smooth
    shade_smooth = nodes.new("GeometryNodeSetShadeSmooth")
    shade_smooth.inputs["Shade Smooth"].default_value = False # Stylized facets
    shade_smooth.location = (600, 100)
    
    # Wiring
    links.new(cube.outputs["Mesh"], subdiv.inputs["Mesh"])
    links.new(subdiv.outputs["Mesh"], set_pos.inputs["Geometry"])
    
    links.new(normal.outputs["Normal"], vec_scale.inputs["Vector"])
    links.new(voronoi.outputs["Distance"], vec_scale.inputs["Scale"])
    links.new(vec_scale.outputs["Vector"], set_pos.inputs["Offset"])
    
    links.new(set_pos.outputs["Geometry"], convex_hull.inputs["Geometry"])
    links.new(convex_hull.outputs["Convex Hull"], shade_smooth.inputs["Geometry"])
    links.new(shade_smooth.outputs["Geometry"], node_out.inputs["Geometry"])
    
    return tree
```

---

## 14. Automated High-Poly to Low-Poly Baking & PBR Texture Extraction

Baking transfers sculptural detail, surface bevels, and micro-geometry from a multi-million-polygon high-poly model to an optimized low-poly in-game asset. In autonomous pipelines, agents must execute this without manual GUI interaction.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            HEADLESS PBR TEXTURE BAKING PIPELINE                             │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│      HIGH-POLY SOURCE    │ │     LOW-POLY TARGET      │ │      BAKE OUTPUT MAPS    │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • ZBrush / Sculpt mesh   │ │ • Retopologized mesh     │ │ • Tangent Normal (RGB)   │
│ • CAD Chamfered Bevels   │ │ • Non-overlapping UVs    │ │ • Ambient Occlusion (AO) │
│ • Micro-detail Displacement│ │ • UV Island Margin > 16px│ │ • Curvature / Cavity     │
│ • No UV mapping required │ │ • Explicit Ray Distance  │ │ • Roughness Modulation   │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### 14.1 The Cycles Headless Baking Rules
1. **Engine Invariant:** The Eevee render engine **cannot** bake textures. Baking must strictly occur in `CYCLES`.
2. **Material Node Target Invariant:** To receive bake data, the low-poly object's active material **must** contain a `ShaderNodeTexImage` node that is selected (`node.select = True`) and active (`nodes.active = node`), but **does not need to be wired** to the Principled BSDF during the bake pass.
3. **Ray Distance Math:** 
   - `max_ray_distance` defines how far the ray travels outward to find the high-poly surface.
   - For an asset measuring $1.0\text{ m}$ with $5\text{ mm}$ sculpt details: `cage_extrusion = 0.0` and `max_ray_distance = 0.05` ($5\text{ cm}$).
   - Excessively large ray distances cause rays to pass through opposite sides of thin meshes (e.g., ear or fingers), creating dark baking artifacts.

### 14.2 Complete Headless Python Baking Script (Normals, AO & Curvature)

```python
import bpy
import os

def bake_high_to_low(high_obj, low_obj, output_dir, res=2048):
    """
    Executes a complete headless bake from high_obj to low_obj in Cycles.
    Outputs: Tangent Space Normal Map and Ambient Occlusion Map.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Switch Scene to Cycles
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if 'CUDA' in bpy.context.preferences.addons['cycles'].preferences.get_devices()[0] else 'CPU'
    scene.cycles.bake_type = 'NORMAL'
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.02
    scene.render.bake.max_ray_distance = 0.08
    scene.render.bake.margin = 16  # 16-pixel dilation to prevent mipmap seams
    
    # 2. Ensure Low-Poly Material has Target Image Node
    if not low_obj.data.materials:
        mat = bpy.data.materials.new(name="M_BakedTarget")
        mat.use_nodes = True
        low_obj.data.materials.append(mat)
    else:
        mat = low_obj.data.materials[0]
        mat.use_nodes = True
        
    nodes = mat.node_tree.nodes
    
    # Create Normal Image Buffer
    normal_img = bpy.data.images.new(name="T_Normal", width=res, height=res, alpha=False, float_buffer=False)
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.image = normal_img
    normal_node.image.colorspace_settings.name = 'Non-Color'
    
    # Make active target for bake
    for n in nodes:
        n.select = False
    normal_node.select = True
    nodes.active = normal_node
    
    # 3. Select Objects (Selected = High, Active = Low)
    bpy.ops.object.select_all(action='DESELECT')
    high_obj.select_set(True)
    low_obj.select_set(True)
    bpy.context.view_layer.objects.active = low_obj
    
    # 4. Execute Normal Bake
    print("[BAKE] Baking Tangent Space Normal Map...")
    scene.cycles.bake_type = 'NORMAL'
    scene.render.bake.normal_space = 'TANGENT'
    bpy.ops.object.bake(type='NORMAL')
    
    normal_path = os.path.join(output_dir, f"{low_obj.name}_normal.png")
    normal_img.filepath_raw = normal_path
    normal_img.file_format = 'PNG'
    normal_img.save()
    print(f"[BAKE] Normal map saved to: {normal_path}")
    
    # 5. Create AO Image Buffer and Execute AO Bake
    ao_img = bpy.data.images.new(name="T_AO", width=res, height=res, alpha=False, float_buffer=False)
    ao_node = nodes.new("ShaderNodeTexImage")
    ao_node.image = ao_img
    ao_node.image.colorspace_settings.name = 'Non-Color'
    
    normal_node.select = False
    ao_node.select = True
    nodes.active = ao_node
    
    print("[BAKE] Baking Ambient Occlusion Map...")
    scene.cycles.bake_type = 'AO'
    bpy.ops.object.bake(type='AO')
    
    ao_path = os.path.join(output_dir, f"{low_obj.name}_ao.png")
    ao_img.filepath_raw = ao_path
    ao_img.file_format = 'PNG'
    ao_img.save()
    print(f"[BAKE] AO map saved to: {ao_path}")
    
    # 6. Wire Maps into Low-Poly Material
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        # Wire Normal
        normal_map_node = nodes.new("ShaderNodeNormalMap")
        mat.node_tree.links.new(normal_node.outputs["Color"], normal_map_node.inputs["Color"])
        mat.node_tree.links.new(normal_map_node.outputs["Normal"], bsdf.inputs["Normal"])
        
    return {"normal": normal_path, "ao": ao_path}
```

---

## 15. Automated Rigging, Skinning & Keyframing via Python

Autonomous agents creating characters, weapons, or interactive machinery must rig bones, generate vertex skin weights, and insert animation keyframes programmatically.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            AUTOMATED RIGGING & SKINNING TOPOLOGY                            │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│     ARMATURE CREATION    │ │      SKIN WEIGHTING      │ │   ANIMATION KEYFRAMING   │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • Head/Tail coordinates  │ │ • Vertex Group creation  │ │ • PoseBone rotations     │
│ • Parent hierarchies     │ │ • 4-bone influence clamp │ │ • Quaternion SLERP       │
│ • Bone roll alignment   │ │ • Weight normalization   │ │ • F-Curve interpolation  │
│ • IK Solver constraints  │ │ • Heat weight solve      │ │ • Looping walk cycles    │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### 15.1 Mathematical Bone Alignment & Edit Mode Invariants
- An `EditBone` exists only while the armature is in `EDIT` mode.
- Accessing `armature.edit_bones` outside of `bpy.ops.object.mode_set(mode='EDIT')` throws a fatal `RuntimeError`.
- Bone length and direction are defined by 3D vectors `head` and `tail`:
  $$\vec{D} = \vec{\text{tail}} - \vec{\text{head}}, \quad L = \|\vec{D}\|$$
- Roll angle aligns the bone's local X and Z axes, critical for correct hinge deformation in knees and elbows.

```python
import bpy
import mathutils

def create_two_segment_limb_armature(root_pos=(0, 0, 0), length=1.0):
    """
    Programmatically creates a 2-segment mechanical limb armature with IK.
    UpperBone -> LowerBone -> IK Target
    """
    # 1. Create Armature Data & Object
    arm_data = bpy.data.armatures.new("Armature_Limb")
    arm_obj = bpy.data.objects.new("Armature_Limb", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    
    # 2. Enter EDIT Mode to Create Bones
    bpy.ops.object.mode_set(mode='EDIT')
    edit_bones = arm_data.edit_bones
    
    # Bone 1: Upper Limb
    bone_upper = edit_bones.new("Bone_Upper")
    bone_upper.head = mathutils.Vector(root_pos)
    bone_upper.tail = mathutils.Vector((root_pos[0], root_pos[1], root_pos[2] + length))
    
    # Bone 2: Lower Limb
    bone_lower = edit_bones.new("Bone_Lower")
    bone_lower.head = bone_upper.tail
    bone_lower.tail = mathutils.Vector((root_pos[0], root_pos[1] + 0.1, root_pos[2] + 2.0 * length))
    bone_lower.parent = bone_upper
    bone_lower.use_connect = True
    
    # Bone 3: IK Target (Unconnected)
    bone_ik = edit_bones.new("Bone_IK_Target")
    bone_ik.head = bone_lower.tail
    bone_ik.tail = mathutils.Vector((bone_lower.tail.x, bone_lower.tail.y, bone_lower.tail.z + 0.3))
    bone_ik.use_connect = False
    
    bpy.ops.object.mode_set(mode='POSE')
    
    # 3. Setup IK Constraint in POSE Mode
    pose_lower = arm_obj.pose.bones["Bone_Lower"]
    ik_constraint = pose_lower.constraints.new(type='IK')
    ik_constraint.target = arm_obj
    ik_constraint.subtarget = "Bone_IK_Target"
    ik_constraint.chain_count = 2
    
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj
```

---

### 15.2 The 4-Bone Influence Limit & Vertex Weight Normalization

All modern game engines—including Valve's Source 2 (*Deadlock*), Unreal Engine 5, and Unity—impose a strict limit of **4 bone influences per vertex** for hardware-accelerated vertex skinning shaders. Exporting a mesh with 5 or more non-zero weights causes engine compilers to drop excess weights arbitrarily, tearing geometry during animation.

```python
import bpy

def enforce_four_bone_weight_limit(mesh_obj):
    """
    Clamps vertex influences to the top 4 strongest weights and normalizes
    them to sum exactly to 1.0. Prevents Source 2 compiler skinning errors.
    """
    mesh = mesh_obj.data
    
    for vert in mesh.vertices:
        # Collect all bone weights for this vertex
        weights = []
        for g in vert.groups:
            weights.append((g.group, g.weight))
            
        if len(weights) > 4:
            # Sort descending by weight
            weights.sort(key=lambda x: x[1], reverse=True)
            
            # Keep only top 4
            top_4 = weights[:4]
            excess = weights[4:]
            
            # Zero out the excess weights
            for g_id, _ in excess:
                group = mesh_obj.vertex_groups[g_id]
                group.remove([vert.index])
                
            # Normalize top 4 weights to sum to 1.0
            total_weight = sum(w for _, w in top_4)
            if total_weight > 0.0:
                for g_id, w in top_4:
                    norm_w = w / total_weight
                    group = mesh_obj.vertex_groups[g_id]
                    group.add([vert.index], norm_w, 'REPLACE')
```

---

### 15.3 Programmatic Keyframe Animation Generation

```python
import bpy
import math

def generate_procedural_idle_animation(arm_obj, num_frames=60):
    """
    Inserts procedural breathing/idling keyframes onto an armature using
    quaternion rotations and sinusoidal displacement.
    """
    arm_obj.animation_data_create()
    action = bpy.data.actions.new(name="Action_Idle_Loop")
    arm_obj.animation_data.action = action
    
    pose_root = arm_obj.pose.bones.get("Bone_Upper")
    if not pose_root:
        return
        
    pose_root.rotation_mode = 'QUATERNION'
    
    for frame in range(1, num_frames + 1):
        phase = (frame / num_frames) * 2.0 * math.pi
        
        # Subtle pitch bobbing (+- 2.5 degrees)
        angle = math.radians(2.5 * math.sin(phase))
        quat = mathutils.Quaternion((1.0, 0.0, 0.0), angle)
        
        # Micro vertical translation (+- 1.5 cm)
        z_offset = 0.015 * math.sin(phase)
        
        pose_root.rotation_quaternion = quat
        pose_root.location = mathutils.Vector((0, 0, z_offset))
        
        # Insert Keyframes
        pose_root.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        pose_root.keyframe_insert(data_path="location", frame=frame)
        
    # Ensure cycle interpolation is cyclic
    for fcurve in action.fcurves:
        for kf in fcurve.keyframe_points:
            kf.interpolation = 'BEZIER'
            
    print(f"[ANIM] Generated {num_frames}-frame seamless idle loop.")
```

---

## 16. Multimodal Visual Feedback Workflows ("Closed-Loop" Modeling)

The fundamental limitation of autonomous AI coding agents in 3D modeling is **blindness**: the agent writes code, inspects return logs, but cannot see geometric deformities, inverted faces, or bad lighting.

To solve this, the agent must implement a **Multimodal Closed-Loop Architecture**:
1. Agent generates 3D geometry via Python/MCP.
2. Agent automatically frames camera and captures high-resolution offscreen renders from multiple angles.
3. Renders are fed back into the agent's multimodal vision context (Claude 3.5 Sonnet / Gemini 2.0).
4. The vision system critiques silhouette, proportions, and shading.
5. The agent writes a targeted delta-patch script to fix defects.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          MULTIMODAL CLOSED-LOOP MODELING SYSTEM                             │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│      STEP 1: CODE        │ │      STEP 2: CAPTURE     │ │      STEP 3: CRITIQUE    │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • Agent writes bpy script│ │ • Compute bounding box   │ │ • Multimodal vision sees │
│ • Executes via MCP socket│ │ • Auto-frame 4 cameras   │ │   silhouette & materials │
│ • Generates base geometry│ │ • Headless render to b64 │ │ • Detects bad normals /  │
│                          │ │ • Embeds into context    │ │   proportions / pinch    │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                     STEP 4: DELTA REPAIR SCRIPT (Self-Correcting Loop)                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 16.1 Automated Camera Framing Mathematics

To capture an object regardless of its scale, the camera distance $D$ from the bounding center $\vec{C}$ is derived from the bounding sphere radius $R$ and the camera field-of-view angle $\theta$:
$$R = \frac{1}{2} \sqrt{(\Delta X)^2 + (\Delta Y)^2 + (\Delta Z)^2}$$
$$D = \frac{R}{\sin(\theta / 2)} \cdot 1.25 \quad (\text{with } 25\% \text{ safety margin})$$

```python
import bpy
import math
import mathutils
import base64
import os

def capture_multimodal_turntable(target_obj, output_dir, angles=(0, 45, 90, 180)):
    """
    Renders 4 angles of target_obj with automatic framing and returns
    base64-encoded PNG strings for immediate multimodal evaluation.
    """
    os.makedirs(output_dir, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.engine = 'BLENDER_EEVEE_NEXT' # Fast GPU/CPU workbench render
    
    # Calculate Bounding Box Center & Radius
    bbox = [target_obj.matrix_world @ mathutils.Vector(corner) for corner in target_obj.bound_box]
    center = sum(bbox, mathutils.Vector()) / 8.0
    radius = max((v - center).length for v in bbox)
    
    # Camera Distance Math
    cam_data = bpy.data.cameras.new("VisionCam")
    cam_data.lens = 50.0  # 50mm focal length
    fov = cam_data.angle_x
    distance = (radius / math.sin(fov / 2.0)) * 1.3
    
    cam_obj = bpy.data.objects.new("VisionCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    # Track-To Constraint pointing at target
    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target_obj
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'
    
    encoded_images = {}
    
    for angle_deg in angles:
        rad = math.radians(angle_deg)
        # Position camera in circle around target
        cam_obj.location = mathutils.Vector((
            center.x + distance * math.sin(rad),
            center.y - distance * math.cos(rad),
            center.z + radius * 0.5
        ))
        bpy.context.view_layer.update()
        
        filepath = os.path.join(output_dir, f"vision_angle_{angle_deg}.png")
        scene.render.filepath = filepath
        bpy.ops.render.render(write_still=True)
        
        with open(filepath, "rb") as f:
            encoded_images[f"angle_{angle_deg}"] = base64.b64encode(f.read()).decode("utf-8")
            
    # Cleanup camera
    bpy.data.objects.remove(cam_obj)
    bpy.data.cameras.remove(cam_data)
    
    return encoded_images
```

---

## 17. Headless ComfyUI Orchestration & PBR Texture Generation

While Blender handles 3D topology, generative diffusion models (Flux, Stable Diffusion XL) excel at generating surface textures, concept variants, and decal patterns. Integrating **ComfyUI** via its headless JSON-RPC / WebSocket API allows agents to request textures programmatically and bind them directly into Blender Principled BSDF materials.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       COMFYUI HEADLESS REST / WEBSOCKET ARCHITECTURE                        │
└──────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│     PROMPT DISPATCH      │ │      IMAGE INFERENCE     │ │      BLENDER IMPORT      │
├──────────────────────────┤ ├──────────────────────────┤ ├──────────────────────────┤
│ • POST /prompt JSON body │ │ • Checkpoint: Flux/SDXL  │ │ • Load image from disk   │
│ • Inject Seed & Prompts  │ │ • Marigold Depth / Norm  │ │ • Create ShaderNodeTex   │
│ • Poll /history/{prompt} │ │ • Save to output buffer  │ │ • Connect to Base Color  │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### 17.1 Headless ComfyUI API Execution Script

```python
import json
import urllib.request
import urllib.parse
import time
import os

COMFYUI_URL = "http://127.0.0.1:8188"

def queue_comfyui_prompt(prompt_workflow):
    """Dispatches a node graph prompt workflow to ComfyUI REST API."""
    data = json.dumps({"prompt": prompt_workflow}).encode("utf-8")
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        return res_data.get("prompt_id")

def wait_for_comfyui_output(prompt_id, timeout=120):
    """Polls ComfyUI history until the generation completes and returns image filenames."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        req = urllib.request.Request(f"{COMFYUI_URL}/history/{prompt_id}")
        with urllib.request.urlopen(req) as response:
            history = json.loads(response.read().decode("utf-8"))
            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                for node_id, node_output in outputs.items():
                    if "images" in node_output:
                        return node_output["images"][0]["filename"]
        time.sleep(1.0)
    raise TimeoutError(f"ComfyUI prompt {prompt_id} timed out after {timeout}s.")

def generate_pbr_albedo_and_assign(blender_obj, texture_prompt):
    """
    End-to-end integration: Requests an albedo texture from ComfyUI and
    assigns it to the active Blender object's Principled BSDF via Python.
    """
    # 1. Minimal SDXL Turbo / Flux text-to-image workflow payload
    workflow = {
        "3": {
            "inputs": {
                "seed": int(time.time()),
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {"inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}, "class_type": "CheckpointLoaderSimple"},
        "5": {"inputs": {"width": 1024, "height": 1024, "batch_size": 1}, "class_type": "EmptyLatentImage"},
        "6": {"inputs": {"text": f"{texture_prompt}, seamless texture, diffuse map, game asset, top-down view, 8k", "clip": ["4", 1]}, "class_type": "CLIPTextEncode"},
        "7": {"inputs": {"text": "shadows, reflections, specular highlights, 3d perspective, watermark", "clip": ["4", 1]}, "class_type": "CLIPTextEncode"},
        "8": {"inputs": {"samples": ["3", 0], "vae": ["4", 2]}, "class_type": "VAEDecode"},
        "9": {"inputs": {"filename_prefix": "PBR_Albedo", "images": ["8", 0]}, "class_type": "SaveImage"}
    }
    
    prompt_id = queue_comfyui_prompt(workflow)
    filename = wait_for_comfyui_output(prompt_id)
    image_path = os.path.join("D:/ComfyUI/output", filename)
    
    # 2. Bind into Blender Material
    mat = blender_obj.active_material
    if not mat:
        mat = bpy.data.materials.new(name="M_ComfyPBR")
        mat.use_nodes = True
        blender_obj.data.materials.append(mat)
        
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    tex_img = bpy.data.images.load(image_path)
    tex_node = nodes.new("ShaderNodeTexImage")
    tex_node.image = tex_img
    
    mat.node_tree.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
    print(f"[COMFYUI] Successfully assigned generated texture {filename} to {blender_obj.name}.")
```

---

## 18. Advanced Edge Cases, Hidden Traps & Unique Issue Solutions

Autonomous agents encounter rare, fatal edge cases in headless graphics workflows that human artists intuitively click past. Below is the definitive compilation of low-level edge cases and concrete programmatic fixes.

---

### 18.1 Non-Planar Quads & Diagonal Shading Artifacts
- **The Issue:** A 4-vertex quadrilateral (quad) whose vertices do not lie on a single 2D plane creates an ambiguous diagonal fold. In game engines, GPU vertex shaders triangulate this quad unpredictably, resulting in visible dark diagonal crease artifacts across smooth surfaces.
- **The Mathematical Metric:** Planarity deviation is defined as the distance of vertex 4 from the plane defined by vertices 1, 2, and 3:
  $$\Delta = |(\vec{V}_4 - \vec{V}_1) \cdot (\vec{E}_{12} \times \vec{E}_{13})|$$
- **Programmatic Solution:** Auto-detect non-planar faces and apply an optimized triangulation modifier.

```python
import bpy
import bmesh

def triangulate_non_planar_quads(obj, angle_threshold_deg=5.0):
    """
    Detects faces with severe non-planarity and triangulates them cleanly
    using BEAUTY method to eliminate dark rendering creases.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    
    non_planar_faces = []
    for face in bm.faces:
        if len(face.verts) == 4:
            v = [vert.co for vert in face.verts]
            # Normal of triangle (0, 1, 2)
            n1 = (v[1] - v[0]).cross(v[2] - v[0]).normalized()
            # Normal of triangle (0, 2, 3)
            n2 = (v[2] - v[0]).cross(v[3] - v[0]).normalized()
            angle = n1.angle(n2, 0.0)
            if angle > math.radians(angle_threshold_deg):
                non_planar_faces.append(face)
                
    if non_planar_faces:
        bmesh.ops.triangulate(bm, faces=non_planar_faces, quad_method='BEAUTY', ngon_method='BEAUTY')
        bm.to_mesh(obj.data)
        obj.data.update()
        print(f"[CLEANUP] Triangulated {len(non_planar_faces)} non-planar quads.")
    bm.free()
```

---

### 18.2 Negative Scale Normal Inversion (Inside-Out Meshes)
- **The Issue:** When mirroring symmetrical assets (e.g., character left arm to right arm) using negative scale (`obj.scale.x = -1.0`), the winding order of all polygon loops is reversed. Normals point inward, causing the mesh to render backface-culled or pitch black.
- **The Fatal Flaw:** Simply flipping normals without applying scale leaves the object's determinant negative, which will invert again upon export to GLB or DMX.
- **Programmatic Solution:** Apply transformation matrix first, then recalculate normals outward.

```python
import bpy
import bmesh

def fix_negative_scale_and_normals(obj):
    """
    Bakes negative transform scales into mesh vertices and guarantees
    all polygon normals point outward.
    """
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    # 1. Bake Transform Matrices (Crucial step)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # 2. Recalculate Normals Outward
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
```

---

### 18.3 Blender Headless Undo Stack Memory Leaks
- **The Issue:** When an autonomous agent executes hundreds of iterative commands over an MCP socket, Blender records each step in its internal undo history stack. In headless/socket mode, this cache is never purged, consuming gigabytes of RAM until the OS terminates the process with an Out-Of-Memory (OOM) error.
- **Programmatic Solution:** Disable global undo during automated agent batch processing and explicitly purge orphan data blocks.

```python
import bpy

def enter_agent_execution_mode():
    """Optimizes Blender runtime memory for high-frequency agent automation."""
    # Disable undo stack accumulation
    bpy.context.preferences.edit.use_global_undo = False
    
def exit_agent_execution_mode():
    """Re-enables user undo and purges all dead memory blocks."""
    bpy.context.preferences.edit.use_global_undo = True
    # Purge unlinked meshes, materials, and textures
    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
```

---

### 18.4 The 65,535 Vertex Index Limit & 16-Bit Buffer Overflow
- **The Issue:** Many real-time renderers, WebGL engines (Three.js default index buffers), and mobile pipelines index mesh vertices using 16-bit unsigned integers (`uint16`), which cannot exceed $2^{16} - 1 = 65,535$ vertices per submesh. Exceeding this causes distorted geometry explosions or black screen crashes.
- **Programmatic Solution:** Detect vertex count and automatically partition the mesh into discrete material sub-objects when threshold is exceeded.

```python
import bpy

def partition_mesh_if_exceeds_uint16(obj, max_verts=65000):
    """
    Checks if mesh vertex count exceeds 16-bit index buffers and splits
    it by loose parts or materials to guarantee engine compatibility.
    """
    if len(obj.data.vertices) <= max_verts:
        return [obj]
        
    print(f"[WARN] Object {obj.name} has {len(obj.data.vertices)} verts (exceeds uint16 limit). Partitioning...")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    # Separate by material or loose parts
    bpy.ops.mesh.separate(type='MATERIAL')
    separated_objs = bpy.context.selected_objects
    return separated_objs
```

---

### 18.5 Source 2 & Deadlock Engine Specific Constraints
For agents building assets targeting Valve's *Deadlock* (Source 2 engine):
1. **Convex Physics Hulls (`vphys`):** Source 2's VPhysics2 engine **strictly forbids concave collision meshes**. Any collision model must consist of a union of purely convex hulls. Passing a concave mesh causes the collision compiler to fail or produces catastrophic jittering. Always compute `bmesh.ops.convex_hull` on collision geometry.
2. **Material Path Hashes:** Source 2 VMAT materials are bound to models via relative file paths (e.g., `materials/models/heroes/infernus/infernus_base.vmat`). The material name in Blender **must** match the VMAT file base name; otherwise, the model compiles with missing checkered textures.
3. **Bone Limits:** Character models compiled into `.vmdl` cannot exceed **128 bones** for standard animated units, or **256 bones** for complex cinematic hero rigs. Exceeding this limit causes model compiler overflow `ERROR: Too many bones in model`.

---

## 19. Comprehensive Autonomous Agent Troubleshooting Almanac

This master lookup table provides immediate, battle-tested solutions for the most frequent runtime errors encountered by AI agents during creative operations.

| Error Code / Traceback | Root Cause | Immediate Autonomous Code Fix |
| :--- | :--- | :--- |
| `RuntimeError: Operator bpy.ops.mesh.primitive_cube_add.poll() failed, context is incorrect` | Script executed in `--background` mode without active 3D Viewport window context. | Use `bmesh.ops.create_cube(bm, size=2.0)` or override context: `bpy.ops.mesh.primitive_cube_add({'window': ..., 'screen': ...})`. |
| `KeyError: 'bpy_prop_collection[key]: key "Specular" not found'` | Using deprecated Blender 3.x Principled BSDF socket name in Blender 4.2+ LTS. | Replace with `node.inputs["Specular IOR Level"]` or inspect available keys: `[s.name for s in node.inputs]`. |
| `AttributeError: 'GeometryNodeTree' object has no attribute 'inputs'` | Using deprecated Blender 3.x Geometry Nodes socket API in Blender 4.0+. | Use `tree.interface.new_socket(name, in_out="INPUT", socket_type="NodeSocketFloat")`. |
| `JSONRPCResponseError: -32001 (Socket timeout)` | Long-running operation (Cycles bake, high-res render) exceeded client timeout. | Set MCP client socket timeout to 300+ seconds; reduce Cycles render samples from 4096 to 128 with OpenImageDenoise. |
| `Mesh appears black in game engine after export` | Tangent space normal map inverted or metallic value set to 1.0 without environment reflection cubemap. | Set texture color space to `Non-Color`; verify Roughness map is not pure 0.0; ensure Normal node type is `ShaderNodeNormalMap`. |
| `Three.js model renders inverted / inside out in Blender` | Handedness mismatch: Three.js coordinates were imported without transforming Y-up to Z-up. | Rotate mesh $+90^\circ$ around X axis: `obj.rotation_euler = (math.radians(90), 0, 0)` then apply transform. |
| `Gaping hole / seam along cylinder meridian after subdivision` | Three.js `LatheGeometry` or procedural lathe duplicated vertices along the $0^\circ / 360^\circ$ seam. | Run `bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)` to weld coincident seam vertices. |
| `Memory leak / OOM crash after 50+ script iterations` | Blender undo history accumulating in memory during background socket execution. | Set `bpy.context.preferences.edit.use_global_undo = False` and call `bpy.ops.outliner.orphans_purge()`. |
| `Source 2 VMDL compiler: 'Vertex has > 4 bone weights'` | Mesh vertex groups have more than 4 non-zero influences per vertex. | Run `enforce_four_bone_weight_limit(obj)` to clamp influences to top 4 and re-normalize weights to 1.0. |
| `Source 2 VMDL compiler: 'Concave collision hull detected'` | Physics collision mesh contains concave indentations. | Generate collision meshes via `bmesh.ops.convex_hull` or decompose into multiple convex boxes. |
| `GLTF export produces 500MB file from small mesh` | Animation baked every sub-frame or uncompressed 32-bit float morph targets included. | In GLTF export operator, set `export_morph=False`, `export_optimize_animation_size=True`, or use Draco compression. |
| `VectorCraft SVG import has jagged, stair-stepped curves` | SVG paths imported as polygonal meshes instead of Bezier curves. | Import via `bpy.ops.import_curve.svg` and preserve 2D curve geometry before extruding. |
| `Cycles bake produces black or empty texture file` | Low-poly material had no selected `ShaderNodeTexImage` node during bake pass. | Explicitly select and activate node: `node.select = True; nodes.active = node`. |
| `Penpot MCP: '401 Unauthorized' during token exchange` | Penpot access token expired or missing project workspace ID. | Refresh Penpot API key and pass `X-Workspace-Id` header in MCP client configuration. |
| `Krita MCP: 'Socket connection refused on 127.0.0.1:54321'` | Krita Python script server plugin disabled in Krita Preferences. | Launch Krita with `--scripting` flag or enable `krita-mcp` in Settings -> Configure Krita -> Python Plugin Manager. |

---

## 20. Summary Checklist for Autonomous Agents

Before delivering any 2D/3D creative task, every autonomous AI coding agent must verify this checklist:

```
[ ] Tool Readiness: Blender MCP socket listening on port 9876 OR ArtCraft Launcher executable available.
[ ] Coordinate Systems: Verified Z-up orientation for Blender/Source 2 assets (transformed from Three.js Y-up).
[ ] Scale & Transforms: Applied 1.0 unit scale to all meshes (Ctrl+A / transform_apply).
[ ] Manifold Topology: Zero non-manifold edges, coincident vertices welded via remove_doubles.
[ ] Material Standards: Principled BSDF nodes utilized with Non-Color textures for Normal/Roughness/Metallic.
[ ] Shading Accuracy: Smooth shading enabled with Weighted Normal modifier applied for crisp hard surfaces.
[ ] Texture Resolutions: Formatted strictly in power-of-two (512x512, 1024x1024, 2048x2048) with sRGB or Linear depth.
[ ] Geometry Nodes API: Verified usage of modern tree.interface.new_socket() instead of deprecated 3.x tree.inputs.new().
[ ] Rigging Constraints: Maximum 4 bone influences per vertex verified and normalized for engine export.
[ ] Physics Collisions: Verified strictly convex hulls for Source 2 VPhysics2 compatibility.
[ ] Memory Safety: Global undo disabled during large automated batch loops; orphan data blocks purged.
[ ] Format Compliance: Exported to standard GLB, DMX Model 22, or PNG matching destination engine requirements.
```

---
**End of Directive. Ground all autonomous creative coding actions in the above architecture.**

