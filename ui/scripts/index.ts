// ./results/scripts/index.ts
// This module returns a single <script>...</script> string to be inlined in the HTML.
// It wires: rendering, Monaco loader, drawing SVG lines (relative to left pane), and save POST.

export function buildClientScript(): string {
  // Note: uses only browser-runtime APIs; safe to inline.
  return `<script>
(function(){
  // parse injected JSON
  const WAVES = JSON.parse(document.getElementById('__WAVES__').textContent || '[]');
  const CONTEXT = JSON.parse(document.getElementById('__CONTEXT__').textContent || '{}');

  // small helpers
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function decodeBase64(b64){ if(!b64) return ''; try{ return decodeURIComponent(escape(atob(b64).split('').map(function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''))); }catch(e){ return atob(b64||''); } }

  // render waves into left pane
  function renderWaves(){
    const container = document.getElementById('wavesContainer');
    container.innerHTML = '';
    WAVES.forEach((wave, wi)=>{
      const row = document.createElement('div');
      row.className = 'wave';
      wave.forEach(node=>{
        const preview = (function(){
          try{ return Object.keys(node.result||{}).slice(0,3).map(k => k + ':' + (typeof node.result[k] === 'object' ? '{...}' : String(node.result[k]))).join(' • '); }catch(e){ return ''; }
        })();
        const el = document.createElement('div');
        el.className = 'node';
        el.dataset.nodeId = node.id;
        el.innerHTML = '<div class=\"title\">' + escapeHtml(node.name || node.id) + '</div><div class=\"preview\">' + escapeHtml(preview) + '</div>';
        // attach data
        el._node = node;
        el._node._decodedTs = node.codeTs ? decodeBase64(node.codeTs) : '';
        el.addEventListener('click', function(){ selectNode(el); });
        row.appendChild(el);
      });
      container.appendChild(row);
    });
  }

  // SVG line drawing relative to left pane
  function updateSvgAndDraw(){
    const left = document.querySelector('.left-pane');
    const svg = document.getElementById('svgConnections');
    if(!left || !svg) return;
    const leftRect = left.getBoundingClientRect();
    const width = Math.max(left.scrollWidth, leftRect.width);
    const height = Math.max(left.scrollHeight, leftRect.height);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    // clear
    while(svg.firstChild) svg.removeChild(svg.firstChild);

    const nodes = Array.from(left.querySelectorAll('.node'));
    const map = new Map(nodes.map(n => [n.dataset.nodeId, n]));

    nodes.forEach(n=>{
      const data = n._node;
      const from = centerInLeft(n, leftRect);
      (data.parentsRequired || []).forEach(pid => {
        const target = map.get(pid);
        if(!target) return;
        const to = centerInLeft(target, leftRect);
        createSvgLine(svg, from, to, 'line-required', false);
      });
      (data.parentsOptional || []).forEach(pid => {
        const target = map.get(pid);
        if(!target) return;
        const to = centerInLeft(target, leftRect);
        createSvgLine(svg, from, to, 'line-optional', true);
      });
    });
  }

  function centerInLeft(el, leftRect){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2 + window.scrollX;
    const cy = r.top + r.height/2 + window.scrollY;
    const leftTopX = leftRect.left + window.scrollX;
    const leftTopY = leftRect.top + window.scrollY;
    return { x: cx - leftTopX, y: cy - leftTopY };
  }

  function createSvgLine(svg, a, b, cls, dashed){
    const xmlns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(xmlns, 'line');
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(b.x));
    line.setAttribute('y2', String(b.y));
    line.setAttribute('class', cls);
    if(dashed) line.setAttribute('stroke-dasharray', '6 6');
    svg.appendChild(line);
    return line;
  }

  // editors + selection
  let __cm = null;
  let __monaco = null;
  let __currentNodeEl = null;
  let currentMode = 'json';

  function initEditors(){
    // CodeMirror for JSON view
    const ta = document.getElementById('jsonEditor');
    if(ta && window.CodeMirror){
      __cm = CodeMirror.fromTextArea(ta, { mode:'application/json', lineNumbers:true, viewportMargin:Infinity });
      __cm.setSize('100%', '220px');
    }

    // Monaco: use AMD loader that was included in head; configure & create editor
    if(window.require && typeof window.require === 'function'){
      try {
        window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs' }});
        window.require(['vs/editor/editor.main'], function(){
          __monaco = monaco.editor.create(document.getElementById('monacoEditor'), {
            value: "// select a node to edit TypeScript",
            language: 'typescript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
          });
          // expose to window
          window.__monaco = __monaco;
        });
      } catch(e) {
        console.error('Monaco init failed', e);
      }
    }
  }

  function selectNode(el){
    __currentNodeEl = el;
    const node = el._node;
    document.getElementById('meta').textContent = 'ID: ' + node.id;
    // JSON editor update
    if(__cm) __cm.setValue(JSON.stringify(node.result || {}, null, 2));
    else document.getElementById('jsonEditor').value = JSON.stringify(node.result || {}, null, 2);
    // context
    document.getElementById('contextList').textContent = JSON.stringify(node.vmContext || {}, null, 2);
    // monaco
    setTimeout(()=>{ if(__monaco) __monaco.setValue(node._decodedTs || ''); }, 120);

    // draw lines (fishing) after short delay
    setTimeout(()=>{ updateSvgAndDraw(); }, 60);
  }

  // SAVE: POST save via query param ?id=<id>
  async function saveNodeToServer(){
    if(!__currentNodeEl) return alert('Keine Node ausgewählt');
    const id = __currentNodeEl.dataset.nodeId;
    const tsCode = (__monaco && typeof __monaco.getValue === 'function') ? __monaco.getValue() : (__currentNodeEl._node._decodedTs || '');
    const payload = { id, tsCode };
    try {
      const resp = await fetch('/save?id=' + encodeURIComponent(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(!resp.ok) throw new Error('' + resp.status);
      alert('Saved');
    } catch(e) {
      console.error('save failed', e);
      alert('Save failed: ' + (e && e.message || e));
    }
  }

  // save local function
  function saveNodeLocal(){
    if(!__currentNodeEl) return alert('Keine Node ausgewählt');
    const id = __currentNodeEl.dataset.nodeId;
    const ts = (__monaco && typeof __monaco.getValue === 'function') ? __monaco.getValue() : (__currentNodeEl._node._decodedTs || '');
    const blob = new Blob([ts], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = id + '.ts'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // wire UI actions
  function wireActions(){
    document.getElementById('saveServer').addEventListener('click', saveNodeToServer);
    document.getElementById('saveLocal').addEventListener('click', saveNodeLocal);
    document.getElementById('tabJson').addEventListener('click', ()=>{ currentMode='json'; document.getElementById('jsonEditorWrap').style.display='block'; document.getElementById('monacoEditor').style.display='none'; });
    document.getElementById('tabTs').addEventListener('click', ()=>{ currentMode='ts'; document.getElementById('jsonEditorWrap').style.display='none'; document.getElementById('monacoEditor').style.display='block'; });
  }

  // initial boot
  function boot(){
    renderWaves();
    initEditors();
    wireActions();
    // draw after layout settled
    setTimeout(()=>{ updateSvgAndDraw(); }, 160);
    // keep svg in sync on resize/scroll
    window.addEventListener('resize', ()=>requestAnimationFrame(updateSvgAndDraw));
    const leftPane = document.querySelector('.left-pane');
    if(leftPane) leftPane.addEventListener('scroll', ()=>requestAnimationFrame(updateSvgAndDraw));
    window.addEventListener('scroll', ()=>requestAnimationFrame(updateSvgAndDraw));
  }

  // run
  boot();

  // expose debug
  window.__updateSvgAndDraw = updateSvgAndDraw;
  window.__selectNode = function(id){ const el = document.querySelector('.node[data-node-id=\"' + id + '\"]'); if(el) selectNode(el); };

})();
</script>`;
}
