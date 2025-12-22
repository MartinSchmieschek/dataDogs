export function buildWavesRenderer(): string {
  // @ts-ignore - JavaScript code as string
  return `function base64ToUtf8(b64){
  if (!b64) return "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function renderWaves(){
  waves.forEach(wave=>{
    const waveEl=document.createElement("div");
    waveEl.className="wave";

    wave.forEach(node=>{
      const el=document.createElement("div");
      el.className="node";
      el.dataset.id=node.id;
      el.textContent = node.name || "";

      el._json=node.result;
      el._ctx=node.vmContext || {};
      el._ctxTypeDef=node.vmContextTypeDef || undefined;
      el._ts=node.codeTs ? base64ToUtf8(node.codeTs) : "// no code";
      // Nutze Config-Werte falls verfügbar, sonst fallback auf node.parentsRequired/Optional
      const config = node.serializedDogConfig || null;
      el._req = config ? (config.parentsRequired || []) : (node.parentsRequired || []);
      el._opt = config ? (config.parentsOptional || []) : (node.parentsOptional || []);
      el._nodeId=node.id;
      el._config=config;

      el.onclick=()=>selectNode(el);

      waveEl.appendChild(el);
    });

    wavesEl.appendChild(waveEl);
  });
}`;
}

