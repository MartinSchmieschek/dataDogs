import { Buffer } from "buffer";

export type NodeEntry = {
  id: string;
  name: string;
  result: any;
  codeTs?: string;
  vmContext?: Record<string, any>;
  parentsRequired?: string[];
  parentsOptional?: string[];
};

export type Waves = NodeEntry[][];

export class Results {
  // =========================================================
  // PUBLIC
  // =========================================================
  public static buildWavesHtml(waves: Waves): string {
    const encodedWaves = waves.map(wave =>
      wave.map(node => ({
        ...node,
        codeTs: node.codeTs
          ? Buffer.from(node.codeTs, "utf8").toString("base64")
          : undefined
      }))
    );

    const safeJson = JSON.stringify(encodedWaves).replace(/<\/script>/g, "<\\/script>");
    return this.buildPage(safeJson);
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
  
  <div id="left">
    ${this.buildAsciiBoat()}
    ${this.buildWavesContainer()}
    <canvas id="lines"></canvas>
  </div>

  <div id="right">
    ${this.buildViewer()}
  </div>

</div>

<script id="waves-json" type="application/json">${wavesJson}</script>

${this.buildScripts()}

</body>
</html>
`;
  }

  // =========================================================
  // HEAD
  // =========================================================
  private static buildHead(): string {
    return `
<meta charset="UTF-8">
<title>Node Waves</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs/loader.min.js"></script>
`;
  }

  // =========================================================
  // STYLES
  // =========================================================
  private static buildStyles(): string {
    return `
<style>

body {
  margin: 0;
  background: #0d0d11;
  font-family: monospace;
  color: #eee;
  overflow-x: hidden;
}

/* Layout: perfekt stabil, 2-geteilt */
#layout {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100vh;
}

/* --- LEFT SIDE --- */
#left {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 200px;
}

/* --- RIGHT SIDE --- */
#right {
  width: 45vw;
  background: #181818;
  border-left: 1px solid #333;
  overflow-y: auto;
  padding: 20px;
}

/* ASCII BOAT (wie Bild) */
#boat {
  width: 100%;
  padding: 25px 0;
  background: linear-gradient(#112244, #000);
  display: flex;
  justify-content: center;
}

#boat pre {
  font-size: 20px;
  line-height: 22px;
  color: #9cf;
  margin: 0;
}

/* Waves */
#waves {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  gap: 50px;
}

.wave {
  display: flex;
  justify-content: center;
  gap: 40px;
}

/* Nodes */
.node {
  background: #1b1b1f;
  padding: 16px 20px;
  border-radius: 10px;
  color: #eee;
  cursor: pointer;
  min-width: 140px;
  text-align: center;
  box-shadow: 0 0 10px rgba(255,255,255,0.2);
  position: relative;
  transition: transform 0.2s;
  z-index: 10; /* important: ABOVE lines */
}
.node:hover { transform: translateY(-4px); }

.node::after {
  content: attr(data-id);
  position: absolute;
  top: -14px;
  width: 100%;
  text-align: center;
  opacity: .5;
  font-size: 10px;
}

/* Canvas behind nodes */
#lines {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;  /* behind nodes */
  pointer-events: none;
}

/* Viewer */
#meta { margin-bottom: 10px; }
#json, #context {
  background: #000;
  padding: 10px;
  border-radius: 6px;
  white-space: pre;
  margin-bottom: 15px;
  max-height: 250px;
  overflow: auto;
}

#ts-editor {
  width: 100%;
  height: 450px;
  border: 1px solid #444;
  margin-bottom: 20px;
}

</style>
`;
  }

  // =========================================================
  // HTML SECTIONS
  // =========================================================
  private static buildAsciiBoat(): string {
    return `
<div id="boat">
<pre>
        ~~~~~~~~
          __/___
         /_____/
     ⚓   /_____/
</pre>
</div>`;
  }

  private static buildWavesContainer(): string {
    return `<div id="waves"></div>`;
  }

  private static buildViewer(): string {
    return `
<h2>Node Viewer</h2>
<div id="meta"></div>

<h3>JSON</h3>
<pre id="json"></pre>

<h3>TypeScript</h3>
<div id="ts-editor"></div>

<h3>VM Context</h3>
<pre id="context"></pre>
`;
  }

  // =========================================================
  // SCRIPTS
  // =========================================================
  private static buildScripts(): string {
    return `
<script>

const waves = JSON.parse(document.getElementById("waves-json").textContent);

const wavesEl = document.getElementById("waves");
const viewerMeta = document.getElementById("meta");
const viewerJson = document.getElementById("json");
const viewerCtx  = document.getElementById("context");
let monacoEditor = null;

function decodeBase64(b64){
  if(!b64) return "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* ----------------------------------------------------------
   Render waves & nodes
---------------------------------------------------------- */
function renderWaves(){
  waves.forEach(wave=>{
    const waveEl = document.createElement("div");
    waveEl.className = "wave";

    wave.forEach(node=>{
      const el = document.createElement("div");
      el.className = "node";
      el.dataset.id = node.id;
      el.textContent = node.name;

      el._json = node.result;
      el._ts   = decodeBase64(node.codeTs);
      el._ctx  = node.vmContext || {};
      el._req  = node.parentsRequired || [];
      el._opt  = node.parentsOptional || [];

      el.onclick = ()=>selectNode(el);

      waveEl.appendChild(el);
    });

    wavesEl.appendChild(waveEl);
  });
}

/* ----------------------------------------------------------
   Node viewer
---------------------------------------------------------- */
function selectNode(el){
  viewerMeta.textContent = "ID: " + el.dataset.id;
  viewerJson.textContent = JSON.stringify(el._json, null, 2);
  viewerCtx.textContent  = JSON.stringify(el._ctx, null, 2);
  if(monacoEditor) monacoEditor.setValue(el._ts || "// no code");
}

/* ----------------------------------------------------------
   Monaco Editor init
---------------------------------------------------------- */
require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs" } });

require(["vs/editor/editor.main"], function(){
  monacoEditor = monaco.editor.create(document.getElementById("ts-editor"), {
    value: "// Select a node",
    language: "typescript",
    theme: "vs-dark",
    automaticLayout: true
  });
});

/* ----------------------------------------------------------
   LINE DRAWING — FIXED VERSION
---------------------------------------------------------- */
function drawLines(){
  const canvas = document.getElementById("lines");
  const ctx = canvas.getContext("2d");

  const rect = document.body.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = document.body.scrollHeight;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const nodes = [...document.querySelectorAll(".node")];
  const pos = new Map();

  nodes.forEach(el=>{
    const r = el.getBoundingClientRect();
    pos.set(el.dataset.id, {
      x: r.left + r.width/2,
      y: r.top  + window.scrollY + r.height/2
    });
  });

  ctx.lineCap = "round";

  nodes.forEach(el=>{
    const from = pos.get(el.dataset.id);
    if(!from) return;

    // REQUIRED PARENTS (red)
    el._req.forEach(id=>{
      const to = pos.get(id);
      if(!to) return;
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    // OPTIONAL PARENTS (blue)
    el._opt.forEach(id=>{
      const to = pos.get(id);
      if(!to) return;
      ctx.strokeStyle = "#44aaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  });

  requestAnimationFrame(drawLines);
}

/* ----------------------------------------------------------
   INIT
---------------------------------------------------------- */
window.onload = ()=>{
  renderWaves();
  requestAnimationFrame(drawLines);
};

window.addEventListener("resize", ()=>requestAnimationFrame(drawLines));
window.addEventListener("scroll", ()=>requestAnimationFrame(drawLines));

</script>
`;
  }
}

