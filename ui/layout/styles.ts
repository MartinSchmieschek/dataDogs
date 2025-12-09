// ./results/layout/styles.ts
export function buildStyles(): string {
  return `
<style>
:root{--bg:#071029;--panel:#0f1726;--accent:#0ea5a4}
html,body{height:100%;margin:0;font-family:Inter,Arial,monospace;background:linear-gradient(180deg,var(--bg) 0%, #041023 100%);color:#e6eef6}
/* layout: two columns */
.layout-root{display:flex;height:100vh;overflow:hidden}
/* left: nodes + svg overlay */
.left-pane{flex:1;position:relative;overflow:auto;padding:20px;box-sizing:border-box;background:linear-gradient(180deg,#052238 0%, #021422 100%)}
/* svg overlay sits inside left-pane and behind nodes */
#svgConnections{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1}
/* waves container where nodes are rendered */
#wavesContainer{position:relative;z-index:2}
/* one row of nodes */
.wave{display:flex;justify-content:center;gap:18px;margin:30px 0;align-items:flex-start}
/* node card */
.node{background:rgba(255,255,255,0.03);padding:12px;border-radius:10px;min-width:140px;max-width:280px;cursor:pointer;box-shadow:0 8px 30px rgba(2,6,23,0.6);transition:transform .18s;position:relative;z-index:3}
.node:hover{transform:translateY(-6px)}
.node .title{font-weight:700;margin-bottom:8px}
.node .preview{font-size:12px;color:rgba(230,238,246,0.8)}
/* boat at top */
.boatWrap{position:fixed;left:0;right:0;top:0;height:120px;pointer-events:none;display:flex;justify-content:center;align-items:flex-start;z-index:6}
.boat{font-family:monospace;color:#ffd966;line-height:0.9;transform-origin:center;animation:boatFloat 6s ease-in-out infinite}
@keyframes boatFloat{0%{transform:translateY(0)}50%{transform:translateY(6px)}100%{transform:translateY(0)}}
.wavesBg{position:absolute;left:0;right:0;bottom:0;height:48px;pointer-events:none;z-index:2}
.waveStripe{position:absolute;left:0;right:0;bottom:0;height:40px;background:repeating-linear-gradient(-45deg, rgba(255,255,255,0.02) 0 6px, transparent 6px 12px);opacity:0.18;animation:waveMove 6s linear infinite}
@keyframes waveMove{from{transform:translateX(0)}to{transform:translateX(-120px)}}

/* right: viewer/editor */
.panel{width:420px;min-width:320px;background:var(--panel);border-left:1px solid rgba(255,255,255,0.03);padding:12px;box-sizing:border-box;overflow:auto;z-index:7}
.panel h3{margin:6px 0 10px 0}
.tabs{display:flex;gap:8px;margin-bottom:6px}
.tab{padding:6px 8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.04);cursor:pointer}
.tab.active{background:rgba(255,255,255,0.03)}
#jsonEditorWrap{height:220px;border-radius:6px;overflow:hidden;margin-bottom:8px}
#monacoEditor{height:320px;border-radius:6px;overflow:hidden}
.editor-actions{display:flex;gap:8px;margin-top:8px}
.btn{padding:8px 10px;border-radius:8px;border:none;background:var(--accent);color:#012;cursor:pointer}
.infoSmall{font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px}

/* line styles (applied to svg lines) */
.line-required{stroke:#ff4444;stroke-width:2;stroke-linecap:round}
.line-optional{stroke:#44aaff;stroke-width:1.8;stroke-linecap:round;stroke-dasharray:6 6}

@media (max-width:900px){ .panel{display:none} }
</style>
`;
}
