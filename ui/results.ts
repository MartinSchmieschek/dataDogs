import { Buffer } from "buffer";
import * as wavesRenderer from "./scripts/wavesRenderer";
import * as nodeSelection from "./scripts/nodeSelection";
import * as monacoInit from "./scripts/monacoInit";
import * as linesDrawer from "./scripts/linesDrawer";
import * as saveHandler from "./scripts/saveHandler";
import * as nodeCrud from "./scripts/nodeCrud";

export type NodeEntry = {
  id: string;
  name: string;
  result: any;
  codeTs?: string;
  vmContext?: string;
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
    <div id="waves"></div>
    <canvas id="lines"></canvas>
  </div>

  <div id="right-col">
    ${this.buildViewer()}
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs/loader.min.js"></script>
`;
  }

  private static buildStyles(): string {
    return `
<style>
body { margin:0; background:#0d0d11; color:#eee; font-family:monospace; }
#layout { display:flex; height:100vh; }

#left-col { flex:1; min-width:0; position:relative; padding-bottom:40px; overflow-y:auto; }
#right-col { flex:1; min-width:0; border-left:1px solid #333; overflow-y:auto; padding:20px; }

#boat { width:100%; height:120px; display:flex; justify-content:center; align-items:center; }
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

  <h3>TypeScript</h3>
  <div id="ts-editor"></div>

  <div style="margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap;">
    <button id="save">Save</button>
    <button id="new">New</button>
    <button id="delete">Delete</button>
  </div>

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

  <h3>VM Context</h3>
  <pre id="context"></pre>

  <h3>Config</h3>
  <pre id="config" style="background:#000; padding:10px; margin-bottom:10px; white-space:pre; overflow:auto;"></pre>
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

${wavesRenderer.buildWavesRenderer()}

${nodeSelection.buildNodeSelection()}

${monacoInit.buildMonacoInit()}

${linesDrawer.buildLinesDrawer()}

${saveHandler.buildSaveHandler()}

${nodeCrud.buildNodeCrud()}

// ------------------------------------------------
// Init
// ------------------------------------------------
window.onload = ()=>{
  renderWaves();
  requestAnimationFrame(drawLines);
  
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
};
window.addEventListener("resize", ()=>requestAnimationFrame(drawLines));
window.addEventListener("scroll", ()=>requestAnimationFrame(drawLines));
</script>
`;
  }
}
