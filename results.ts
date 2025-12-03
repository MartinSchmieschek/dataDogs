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
    // Base64 encode TS code
    const encodedWaves = waves.map(wave =>
      wave.map(node => ({
        ...node,
        codeTs: node.codeTs ? Buffer.from(node.codeTs, "utf8").toString("base64") : undefined
      }))
    );
    const json = JSON.stringify(encodedWaves);
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
<div style="display:flex; flex-wrap:nowrap; gap:10px;">
  <div style="flex:1;">
    ${this.buildAsciiBoat()}
    ${this.buildWavesContainer()}
    <canvas id="lines" style="position:absolute; left:0; top:0;"></canvas>
  </div>
  <div style="flex:1;">
    ${this.buildViewer()}
  </div>
</div>

<script id="waves-data" type="application/json">
${wavesJson.replace(/<\/script>/gi, "<\\/script>")}
</script>

${this.buildScripts()}
</body>
</html>
`;
  }

  // =========================================================
  // HEAD / STYLES / SECTIONS
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
body { margin:0; font-family:monospace; background:#0d0d11; color:#eee; }
#boat { width:100%; height:120px; display:flex; justify-content:center; align-items:center; background:linear-gradient(#112244,#000); }
#boat pre { font-size:20px; color:#9cf; }
#waves { margin:20px auto; display:flex; flex-direction:column; gap:40px; }
.wave { display:flex; gap:20px; justify-content:center; }
.node { background:#1b1b1f; padding:16px 20px; border-radius:10px; min-width:140px; cursor:pointer; box-shadow:0 0 8px rgba(255,255,255,0.15); transition: transform 0.2s; position:relative; }
.node:hover { transform: translateY(-5px); }
.node::after { content: attr(data-id); font-size:10px; opacity:0.5; position:absolute; top:-14px; left:0; width:100%; text-align:center; }
#viewer { padding:20px; background:#181818; border-left:1px solid #333; height:100vh; overflow-y:auto; }
#json, #context { background:#000; padding:10px; white-space:pre; max-height:200px; overflow:auto; margin-bottom:10px; }
#ts-editor { width:100%; height:400px; border:1px solid #333; margin-top:10px; }
canvas { pointer-events:none; }
</style>
`;
  }

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
  <h3>JSON</h3><pre id="json"></pre>
  <h3>TypeScript</h3><div id="ts-editor"></div>
  <h3>VM Context</h3><pre id="context"></pre>
</div>`;
  }

  private static buildWavesContainer(): string {
    return `<div id="waves"></div>`;
  }

  // =========================================================
  // SCRIPTS
  // =========================================================
  private static buildScripts(): string {
    return `
<script>
const waves = JSON.parse(document.getElementById("waves-data").textContent);

const wavesEl = document.getElementById("waves");
const viewerMeta = document.getElementById("meta");
const viewerJson = document.getElementById("json");
const viewerCtx = document.getElementById("context");
let monacoEditor = null;

function base64ToUtf8(b64) {
  if(!b64) return "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function renderWaves() {
  waves.forEach(wave=>{
    const waveEl=document.createElement("div");
    waveEl.className="wave";
    wave.forEach(node=>{
      const el=document.createElement("div");
      el.className="node";
      el.dataset.id=node.id;
      el.textContent=node.name;
      el._json=node.result;
      el._ts=node.codeTs ? base64ToUtf8(node.codeTs) : "// no code";
      el._ctx=node.vmContext||{};
      el._req=node.parentsRequired||[];
      el._opt=node.parentsOptional||[];
      el.onclick=()=>selectNode(el);
      waveEl.appendChild(el);
    });
    wavesEl.appendChild(waveEl);
  });
}

function selectNode(n){
  viewerMeta.textContent="ID: "+n.dataset.id;
  viewerJson.textContent=JSON.stringify(n._json,null,2);
  viewerCtx.textContent=JSON.stringify(n._ctx,null,2);
  if(monacoEditor) monacoEditor.setValue(n._ts);
}

require.config({ paths: { vs:"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs" } });
require(["vs/editor/editor.main"], function(){
  monacoEditor=monaco.editor.create(document.getElementById("ts-editor"),{
    value:"// Select a node",
    language:"typescript",
    automaticLayout:true,
    theme:"vs-dark"
  });
});

function drawLines(){
  const canvas=document.getElementById("lines");
  const ctx=canvas.getContext("2d");
  canvas.width=document.body.clientWidth;
  canvas.height=document.body.scrollHeight;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const nodes=[...document.querySelectorAll(".node")];
  const map=new Map();
  nodes.forEach(el=>{
    const r=el.getBoundingClientRect();
    map.set(el.dataset.id,{x:r.left+r.width/2, y:r.top+window.scrollY+r.height/2});
  });

  nodes.forEach(el=>{
    const from=map.get(el.dataset.id);
    if(!from) return;
    el._req.forEach(id=>{
      const to=map.get(id);
      if(!to) return;
      ctx.strokeStyle="#ff4444"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(to.x,to.y); ctx.stroke();
    });
    el._opt.forEach(id=>{
      const to=map.get(id);
      if(!to) return;
      ctx.strokeStyle="#44aaff"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(from.x,from.y); ctx.lineTo(to.x,to.y); ctx.stroke();
    });
  });
  requestAnimationFrame(drawLines);
}

window.onload=()=>{ renderWaves(); requestAnimationFrame(drawLines); };
window.addEventListener("resize",()=>requestAnimationFrame(drawLines));
window.addEventListener("scroll",()=>requestAnimationFrame(drawLines));
</script>
`;
  }
}
