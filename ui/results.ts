import { Buffer } from "buffer";
import * as visNetworkRenderer from "./scripts/visNetworkRenderer";
import * as nodeSelection from "./scripts/nodeSelection";
import * as monacoInit from "./scripts/monacoInit";
import * as saveHandler from "./scripts/saveHandler";
import * as nodeCrud from "./scripts/nodeCrud";

export type NodeEntry = {
  id: string;
  name: string;
  result: any;
  codeTs?: string;
  vmContext?: Record<string, any>; // Geändert von string zu Record<string, any>
  vmContextTypeDef?: string;
  parentsRequired?: string[];
  parentsOptional?: string[];
  serializedDogConfig?: {
    theRun: string;
    version?: number;
    parentsRequired?: string[];
    parentsOptional?: string[];
  };
};

export type Waves = NodeEntry[][];

export class Results {

  // =========================================================
  // PUBLIC
  // =========================================================
  public static buildWavesHtml(waves: Waves): string {
    const encoded = waves.map(wave =>
      wave.map(node => ({
        ...node,
        codeTs: node.codeTs
          ? Buffer.from(node.codeTs, "utf8").toString("base64")
          : undefined
      }))
    );

    const json = JSON.stringify(encoded);
    return this.buildPage(json);
  }

  // =========================================================
  // PAGE
  // =========================================================
  private static buildPage(wavesJson: string): string {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
${this.buildHead()}
${this.buildStyles()}
</head>

<body>
<div id="layout">
  <div id="left-col">
    ${this.buildAsciiBoat()}
    <div style="padding: 10px; border-bottom: 1px solid #333; display: flex; gap: 10px;">
      <button id="new">New</button>
      <button id="delete">Delete</button>
    </div>
    <div id="network-container"></div>
  </div>

  <div id="side-panel" class="side-panel-closed">
    <div id="side-panel-resizer"></div>
    <div id="side-panel-header">
      <span id="side-panel-title">Node Editor</span>
      <button id="side-panel-close">×</button>
    </div>
    <div id="side-panel-content">
      ${this.buildViewer()}
    </div>
  </div>
</div>

<script id="waves-data" type="application/json">
${wavesJson.replace(/<\/script>/gi, "<\\/script>")}
</script>

${this.buildScripts()}
</body>
</html>`;
  }

  // =========================================================
  // HEAD / STYLE
  // =========================================================
  private static buildHead(): string {
    return `
<meta charset="UTF-8">
<title>Node Waves</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs/loader.min.js"></script>
`;
  }

  private static buildStyles(): string {
    return `
<style>
body { margin:0; background:#0d0d11; color:#eee; font-family:monospace; }
#layout { display:flex; height:100vh; position:relative; }

#left-col { flex:1; min-width:300px; position:relative; padding-bottom:40px; overflow-y:auto; transition:width 0.2s; }

#side-panel {
  width:0;
  height:100vh;
  background:#0d0d11;
  border-left:1px solid #333;
  transition:width 0.3s ease;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  flex-shrink:0;
}
#side-panel.side-panel-open {
  width:50%;
  min-width:400px;
  max-width:80%;
}

#side-panel-resizer {
  width:4px;
  background:#333;
  cursor:col-resize;
  position:absolute;
  top:0;
  left:0;
  bottom:0;
  z-index:10;
  transition:background 0.2s;
}
#side-panel-resizer:hover {
  background:#4a9eff;
}
#side-panel-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:15px 20px;
  border-bottom:1px solid #333;
  background:#1b1b1f;
}
#side-panel-title {
  font-size:18px;
  font-weight:bold;
}
#side-panel-close {
  background:transparent;
  border:none;
  color:#eee;
  font-size:28px;
  cursor:pointer;
  padding:0;
  width:30px;
  height:30px;
  line-height:30px;
  transition:color 0.2s;
}
#side-panel-close:hover {
  color:#4a9eff;
}
#side-panel-content {
  flex:1;
  overflow-y:auto;
  padding:20px;
}

#boat { width:100%; height:120px; display:flex; justify-content:center; align-items:center; }
#network-container { 
  width:100%; 
  height:calc(100vh - 120px); 
  min-height:calc(100vh - 120px);
  position:relative;
  background:#0d0d11;
}
#waves { margin-top:20px; display:flex; flex-direction:column; gap:40px; }

.wave { display:flex; gap:20px; justify-content:center; flex-wrap:wrap; }

.node {
  background:#1b1b1f; padding:16px 20px; border-radius:10px;
  min-width:140px; max-width:300px; cursor:pointer; position:relative;
  box-shadow:0 0 8px rgba(255,255,255,0.15);
  transition:transform 0.2s;
}
.node:hover { transform:translateY(-5px); }
.node.selected { 
  background:#2b2b3f; 
  box-shadow:0 0 12px rgba(100,150,255,0.4);
  border:2px solid #4a9eff;
}
.node::after {
  content:attr(data-id); position:absolute; top:-14px;
  width:100%; text-align:center; opacity:0.5; font-size:10px;
}

#viewer-title { font-size:22px; margin-bottom:10px; }
#meta, #json, #context {
  background:#000; padding:10px; margin-bottom:10px;
  white-space:pre; overflow:auto;
}
#ts-editor { width:100%; height:400px; border:1px solid #333; }

#lines {
  position:absolute; top:0; left:0;
  pointer-events:none;
}

@media (max-width: 768px) {
  #layout { flex-direction: column; height: auto; }
  #left-col { flex: none; height: 50vh; border-bottom: 1px solid #333; }
  #right-col { flex: none; height: 50vh; border-left: none; padding: 15px; }
  .node { min-width: 120px; max-width: 200px; padding: 12px 16px; }
  #ts-editor { height: 300px; }
  #viewer > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
  button { padding: 8px 12px; font-size: 14px; }
}

@media (max-width: 480px) {
  .node { min-width: 100px; max-width: 150px; padding: 10px 12px; font-size: 12px; }
  #ts-editor { height: 250px; }
  #viewer-title { font-size: 18px; }
  #right-col { padding: 10px; }
  button { padding: 6px 10px; font-size: 12px; }
  h3 { font-size: 14px; }
}
</style>
`;
  }

  // =========================================================
  // COMPONENTS
  // =========================================================
  private static buildAsciiBoat(): string {
    return `
<div id="boat">
<pre>
      ~~~~~~~~ 
        __/___
       /_____/
   ⚓  /_____/
</pre>
</div>`;
  }

  private static buildViewer(): string {
    return `
<div id="viewer">
  <div id="viewer-title">Node Viewer</div>

  <h3>Meta</h3>
  <pre id="meta"></pre>

  <h3>JSON</h3>
  <pre id="json"></pre>

  <div id="serialized-dog-ts" style="display: none;">
    <h3>TypeScript</h3>
    <div id="ts-editor"></div>
  </div>

  <div id="html-output" style="display: none;">
    <h3>HTML Output</h3>
    <div id="html-render" style="border: 1px solid #333; padding: 10px; background: #fff; color: #000; min-height: 200px;"></div>
  </div>

  <div id="serialized-dog-controls" style="margin: 10px 0; display: none; gap: 10px; flex-wrap: wrap;">
    <button id="save">Save</button>
  </div>

  <div id="serialized-dog-parents" style="display: none;">
    <h3>Parents</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 10px;">
      <div>
        <label><strong>Required:</strong></label>
        <div id="parents-required" style="max-height: 150px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #000;"></div>
      </div>
      <div>
        <label><strong>Optional:</strong></label>
        <div id="parents-optional" style="max-height: 150px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #000;"></div>
      </div>
    </div>
  </div>

  <div id="serialized-dog-context" style="display: none;">
    <h3>VM Context</h3>
    <pre id="context"></pre>
  </div>

  <div id="serialized-dog-config" style="display: none;">
    <h3>Config</h3>
    <pre id="config" style="background:#000; padding:10px; margin-bottom:10px; white-space:pre; overflow:auto;"></pre>
  </div>
</div>
`;
  }

  // =========================================================
  // SCRIPTS
  // =========================================================
  private static buildScripts(): string {
    return `
<script>
const waves = JSON.parse(document.getElementById("waves-data").textContent);

// --- Element-Refs ---
const wavesEl = document.getElementById("waves");
const viewerMeta = document.getElementById("meta");
const viewerJson = document.getElementById("json");
const viewerCtx = document.getElementById("context");
let monacoEditor = null;
let activeTypeDefDispose = null;
let selectedNodeElement = null;
let extraLibDisposes = []; // Liste aller dispose-Funktionen für ExtraLibs
if (typeof extraLibDisposes === 'undefined') {
  extraLibDisposes = [];
}

${visNetworkRenderer.buildVisNetworkRenderer()}

${nodeSelection.buildNodeSelection()}

${monacoInit.buildMonacoInit()}

${saveHandler.buildSaveHandler()}

${nodeCrud.buildNodeCrud()}

// ------------------------------------------------
// Init
// ------------------------------------------------
window.onload = ()=>{
  // Warte bis vis.js geladen ist
  function waitForVis() {
    if (typeof vis !== 'undefined' && vis.Network) {
      renderWaves();
      
      // Resize-Handler für vis.js Network
      window.addEventListener("resize", () => {
        const container = document.getElementById("network-container");
        if (container && typeof network !== 'undefined' && network && typeof network.setSize === 'function') {
          network.setSize(container.offsetWidth, container.offsetHeight);
        }
      });
      
      const saveBtn = document.getElementById("save");
      if (saveBtn) {
        saveBtn.addEventListener("click", saveNode);
      }
      
      const newBtn = document.getElementById("new");
      if (newBtn) {
        newBtn.addEventListener("click", createNode);
      }
      
      const deleteBtn = document.getElementById("delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", deleteNode);
      }
      
      // Side Panel Close Button
      const sidePanelClose = document.getElementById("side-panel-close");
      if (sidePanelClose) {
        sidePanelClose.addEventListener("click", () => {
          const sidePanel = document.getElementById("side-panel");
          if (sidePanel) {
            sidePanel.classList.remove("side-panel-open");
          }
          // Zerstöre Editor beim Schließen
          if (monacoEditor) {
            try {
              monacoEditor.dispose();
            } catch (e) {
              console.warn("Fehler beim Zerstören des Editors:", e);
            }
            monacoEditor = null;
          }
        });
      }
      
      // Side Panel Resizer
      const sidePanelResizer = document.getElementById("side-panel-resizer");
      const sidePanel = document.getElementById("side-panel");
      const leftCol = document.getElementById("left-col");
      const layout = document.getElementById("layout");
      
      if (sidePanelResizer && sidePanel && leftCol && layout) {
        let isResizing = false;
        let startX = 0;
        let startPanelWidth = 0;
        let startLeftWidth = 0;
        
        sidePanelResizer.addEventListener("mousedown", (e) => {
          isResizing = true;
          startX = e.clientX;
          startPanelWidth = sidePanel.offsetWidth;
          startLeftWidth = leftCol.offsetWidth;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          e.preventDefault();
          e.stopPropagation();
        });
        
        document.addEventListener("mousemove", (e) => {
          if (!isResizing) return;
          
          const diff = startX - e.clientX; // Umgekehrt, da Panel rechts ist
          const layoutWidth = layout.offsetWidth;
          
          let newPanelWidth = startPanelWidth + diff;
          let newLeftWidth = startLeftWidth - diff;
          
          // Min/Max Constraints
          const minPanelWidth = 400;
          const minLeftWidth = 300;
          const maxPanelWidth = layoutWidth * 0.8;
          
          if (newPanelWidth < minPanelWidth) {
            newPanelWidth = minPanelWidth;
            newLeftWidth = layoutWidth - minPanelWidth;
          } else if (newLeftWidth < minLeftWidth) {
            newLeftWidth = minLeftWidth;
            newPanelWidth = layoutWidth - minLeftWidth;
          } else if (newPanelWidth > maxPanelWidth) {
            newPanelWidth = maxPanelWidth;
            newLeftWidth = layoutWidth - maxPanelWidth;
          }
          
          // Setze neue Breiten
          sidePanel.style.width = newPanelWidth + "px";
          sidePanel.style.flex = "none";
          leftCol.style.width = newLeftWidth + "px";
          leftCol.style.flex = "none";
          
          // Aktualisiere vis.js Network Größe
          if (typeof network !== 'undefined' && network && typeof network.setSize === 'function') {
            const container = document.getElementById("network-container");
            if (container) {
              network.setSize(container.offsetWidth, container.offsetHeight);
            }
          }
        });
        
        document.addEventListener("mouseup", () => {
          if (isResizing) {
            isResizing = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          }
        });
      }
    } else {
      setTimeout(waitForVis, 50);
    }
  }
  waitForVis();
};
</script>
`;
  }
}
