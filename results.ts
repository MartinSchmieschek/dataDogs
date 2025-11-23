export class Results{
    public static createWaveHTML(waves: Array<Array<{ name: string; result: any }>>) {
  // Seralize data safe-ish for embedding in a <script> tag.
  // Replace closing script tag to prevent breaking out of script context.
  const raw = JSON.stringify(waves);
  const safeJson = raw.replace(/<\/script>/gi, '<\\/script>');

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Waves — Nodes</title>

  <!-- CodeMirror 5 (CDN) -->
  <link rel="stylesheet" href="https://unpkg.com/codemirror@5.65.13/lib/codemirror.css">
  <style>
    :root{--bg1:#071029;--bg2:#081024;--panel:#021124;--card:#0f1726}
    html,body{height:100%;margin:0;background:linear-gradient(180deg,var(--bg1) 0%, var(--bg2) 100%);font-family:Inter,system-ui,Arial;color:#e6eef6}
    #app{display:flex;height:100vh;width:100vw;overflow:hidden}
    /* left: stage (waves) */
    #stage{flex:1;overflow:auto;padding:28px 40px;box-sizing:border-box}
    .wave{display:flex;justify-content:center;gap:18px;margin-bottom:48px;align-items:flex-start}
    .node{display:flex;flex-direction:column;align-items:flex-start;min-width:160px;max-width:280px;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.03);box-shadow:0 10px 30px rgba(2,6,23,0.6);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
    .node:hover{transform:translateY(-6px);box-shadow:0 20px 50px rgba(2,6,23,0.8)}
    .node .title{font-weight:700;margin-bottom:8px}
    .node .preview{font-size:12px;color:rgba(230,238,246,0.8);opacity:0.9;max-height:4.6em;overflow:hidden}
    /* right: json viewer */
    #viewer{width:40vw;min-width:320px;border-left:1px solid rgba(255,255,255,0.03);background:var(--panel);padding:18px;box-sizing:border-box;display:flex;flex-direction:column}
    #viewer h3{margin:0 0 8px 0;color:#d9f7ff}
    #editor{flex:1;border-radius:8px;height:100%}
    /* responsive */
    @media (max-width:1000px){ #viewer{display:none} .node{min-width:140px} }
  </style>
</head>
<body>
  <div id="app">
    <div id="stage" aria-live="polite"></div>

    <div id="viewer" aria-hidden="false">
      <h3 id="viewerTitle">JSON Viewer</h3>
      <textarea id="editor" style="width:100%;height:100%;border-radius:8px"></textarea>
    </div>
  </div>

  <!-- CodeMirror -->
  <script src="https://unpkg.com/codemirror@5.65.13/lib/codemirror.js"></script>
  <script src="https://unpkg.com/codemirror@5.65.13/mode/javascript/javascript.js"></script>

  <!-- Embedded data (Waves) -->
  <script>window.__WAVES__ = ${safeJson};</script>

  <script>
    (function(){
      const waves = window.__WAVES__ || [];
      const stage = document.getElementById('stage');
      // Create nodes per wave
      waves.forEach((wave, waveIndex) => {
        const waveEl = document.createElement('div');
        waveEl.className = 'wave';
        waveEl.dataset.wave = String(waveIndex);

        wave.forEach((node, idx) => {
          const nodeEl = document.createElement('article');
          nodeEl.className = 'node';
          nodeEl.tabIndex = 0;
          nodeEl.dataset.wave = String(waveIndex);
          nodeEl.dataset.index = String(idx);

          const title = document.createElement('div');
          title.className = 'title';
          title.textContent = node.name || ('Node ' + (idx+1));

          // optional small preview (first keys)
          const preview = document.createElement('div');
          preview.className = 'preview';
          try {
            const keys = Object.keys(node.result || {}).slice(0,3);
            const kv = keys.map(k => k + ':' + (typeof node.result[k] === 'object' ? '{...}' : String(node.result[k]))).join('  •  ');
            preview.textContent = kv;
          } catch(e){
            preview.textContent = '';
          }

          nodeEl.appendChild(title);
          nodeEl.appendChild(preview);

          // store full json on element for quick access (safe because data came from server)
          nodeEl._json = node.result;

          // click/keyboard to open in the right viewer
          const openInViewer = () => {
            if(window.__CM__){ window.__CM__.setValue(JSON.stringify(nodeEl._json, null, 2)); }
            const viewerTitle = document.getElementById('viewerTitle');
            viewerTitle.textContent = 'Node: ' + (node.name || ('Wave ' + (waveIndex+1) + ' / ' + (idx+1)));
          };
          nodeEl.addEventListener('click', openInViewer);
          nodeEl.addEventListener('keydown', (ev) => { if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openInViewer(); } });

          waveEl.appendChild(nodeEl);
        });

        stage.appendChild(waveEl);
      });

      // Init CodeMirror on the textarea
      const textarea = document.getElementById('editor');
      // eslint-disable-next-line no-undef
      const cm = CodeMirror.fromTextArea(textarea, {
        lineNumbers: true,
        mode: 'application/json',
        readOnly: true,
        viewportMargin: Infinity
      });
      // expose for node click handler
      window.__CM__ = cm;

      // optionally select first node automatically
      (function selectFirst(){
        const first = document.querySelector('.node');
        if(first){
          first.click();
        }
      })();

      // Accessibility: focus handling when viewer hidden on small screens
      window.addEventListener('resize', () => {
        const viewer = document.getElementById('viewer');
        if(window.innerWidth < 1000){
          viewer.setAttribute('aria-hidden','true');
        } else {
          viewer.setAttribute('aria-hidden','false');
        }
      });
    })();
  </script>
</body>
</html>`;

  return html;
}

}