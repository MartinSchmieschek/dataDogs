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
  //  PUBLIC API
  // =========================================================

  public static buildWavesHtml(waves: Waves): string {
    const safeJson = JSON.stringify(waves).replace(/<\/script>/g, "<\\/script>");
    return this.buildPage(safeJson);
  }

  // =========================================================
  //  MAIN PAGE
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
<div style="
    display: flex;
    justify-content: flex-start;
    flex-direction: row;
    flex-wrap: nowrap;
">
<div>
  ${this.buildAsciiBoat()}
  ${this.buildWavesContainer()}
  <canvas id="lines"></canvas>
</div>
<div>
${this.buildViewer()}
</div>
</div>




${this.buildScripts(wavesJson)}

</body>
</html>
`;
  }

  // =========================================================
  //  HEAD
  // =========================================================

  private static buildHead(): string {
    return `
<meta charset="UTF-8" />
<title>Node Waves</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0">

<!-- CodeMirror (JSON) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js"></script>

<!-- Monaco Editor -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs/loader.min.js"></script>
`;
  }

  // =========================================================
  //  STYLES
  // =========================================================

  private static buildStyles(): string {
    return `
<style>

body {
  margin: 0;
  font-family: monospace;
  background: #0d0d11;
  color: #eee;
  overflow-x: hidden;
}

/* Boat & waves */
#boat {
  width: 100%;
  height: 160px;
  background: linear-gradient(#112244, #000);
  display: flex;
  justify-content: center;
  align-items: center;

  animation: boatFloat 4s ease-in-out infinite;
}

@keyframes boatFloat {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
}

#boat pre {
  font-size: 20px;
  color: #9cf;
}

/* Waves container */
#waves {
  width: 60%;
  margin: auto;
  position: relative;
}

.wave {
  display: flex;
  justify-content: center;
  gap: 50px;
  margin: 60px 0;
}

.node {
  background: #1b1b1f;
  padding: 18px 24px;
  border-radius: 10px;
  text-align: center;
  min-width: 140px;
  cursor: pointer;
  position: relative;
  transition: transform .2s;
  box-shadow: 0 0 10px rgba(255,255,255,0.15);
}

.node:hover {
  transform: translateY(-5px);
}

.node::after {
  content: attr(data-id);
  font-size: 10px;
  opacity: 0.5;
  position: absolute;
  top: -14px;
  width: 100%;
  left: 0;
}

#viewer {
  //position: fixed;
  top: 0;
  right: 0;
  width: 40vw;
  height: 100vh;
  background: #181818;
  border-left: 1px solid #333;
  padding: 20px;
  overflow-y: auto;
}

#json { background:#000; padding:10px; white-space:pre; max-height:200px; overflow:auto; }

#ts-editor {
  width: 100%;
  height: 400px;
  border: 1px solid #333;
  margin-top: 10px;
}

#context { background:#001; padding:10px; }

canvas {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

</style>`;
  }

  // =========================================================
  //  HTML SECTIONS
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
  <h2>Node Viewer</h2>
  <div id="meta"></div>

  <h3>JSON</h3>
  <pre id="json"></pre>

  <h3>TypeScript</h3>
  <div id="ts-editor"></div>

  <h3>VM Context</h3>
  <pre id="context"></pre>
</div>`;
  }

  private static buildWavesContainer(): string {
    return `<div id="waves"></div>`;
  }

  // =========================================================
  //  SCRIPTS
  // =========================================================

  private static buildScripts(wavesJson: string): string {
    return `
<script>
const waves = ${wavesJson};

// DOM references
const wavesEl = document.getElementById("waves");
const viewerMeta = document.getElementById("meta");
const viewerJson = document.getElementById("json");
const viewerCtx = document.getElementById("context");

let cmJson = null;
let monacoEditor = null;

// --------------------------------------------
// Render waves
// --------------------------------------------
function renderWaves() {
  waves.forEach(wave => {
    const waveEl = document.createElement("div");
    waveEl.className = "wave";

    wave.forEach(node => {
      const el = document.createElement("div");
      el.className = "node";
      el.dataset.id = node.id;
      el.textContent = node.name;

      el._json = node.result;
      el._ts = node.codeTs || "// no code";
      el._ctx = node.vmContext || {};
      el._req = node.parentsRequired || [];
      el._opt = node.parentsOptional || [];

      el.onclick = () => selectNode(el);

      waveEl.appendChild(el);
    });

    wavesEl.appendChild(waveEl);
  });
}

// --------------------------------------------
// Node Viewer
// --------------------------------------------
function selectNode(n) {
  viewerMeta.textContent = "ID: " + n.dataset.id;

  // JSON viewer
  viewerJson.textContent = JSON.stringify(n._json, null, 2);

  // Context viewer
  viewerCtx.textContent = JSON.stringify(n._ctx, null, 2);

  // Monaco
  if (monacoEditor) {
    monacoEditor.setValue(n._ts);
  }
}

// --------------------------------------------
// Monaco Loader
// --------------------------------------------
require.config({
  paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs" }
});

require(["vs/editor/editor.main"], function () {
  monacoEditor = monaco.editor.create(
    document.getElementById("ts-editor"),
    {
      value: "// Select a node",
      language: "typescript",
      automaticLayout: true,
      theme: "vs-dark"
    }
  );
});

// --------------------------------------------
// Canvas Line Drawing
// --------------------------------------------
function drawLines() {
  const canvas = document.getElementById("lines");
  const ctx = canvas.getContext("2d");

  canvas.width = document.body.clientWidth;
  canvas.height = document.body.scrollHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const nodes = [...document.querySelectorAll(".node")];
  const map = new Map();

  // get positions
  nodes.forEach(el => {
    const r = el.getBoundingClientRect();
    map.set(el.dataset.id, {
      x: r.left + r.width/2,
      y: r.top + window.scrollY + r.height/2
    });
  });

  nodes.forEach(el => {
    const from = map.get(el.dataset.id);
    if (!from) return;

    // required (red)
    el._req.forEach(id => {
      const to = map.get(id);
      if (!to) return;
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    });

    // optional (blue)
    el._opt.forEach(id => {
      const to = map.get(id);
      if (!to) return;
      ctx.strokeStyle = "#44aaff";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    });
  });

  requestAnimationFrame(drawLines);
}

// --------------------------------------------
// Init
// --------------------------------------------
window.onload = () => {
  renderWaves();
  requestAnimationFrame(drawLines);
};

window.addEventListener("resize", () => requestAnimationFrame(drawLines));
window.addEventListener("scroll", () => requestAnimationFrame(drawLines));

</script>
`;
  }
}
