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
  public static buildWavesHtml(waves: Waves, kennelConfig?: any): string {
    const encoded = waves.map(wave =>
      wave.map(node => ({
        ...node,
        codeTs: node.codeTs
          ? Buffer.from(node.codeTs, "utf8").toString("base64")
          : undefined
      }))
    );

    const json = JSON.stringify(encoded);
    return this.buildPage(json, kennelConfig);
  }

  // =========================================================
  // PAGE
  // =========================================================
  private static buildPage(wavesJson: string, kennelConfig?: any): string {
    const kennelConfigJson = kennelConfig ? JSON.stringify(kennelConfig).replace(/<\/script>/gi, "<\\/script>") : 'null';
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
    <div id="add-dogs-panel" style="padding: 10px; border-bottom: 1px solid #333;">
      <button id="add-dog-to-kennel-btn" style="background: #0066cc; color: #fff; border: none; padding: 6px 12px; cursor: pointer; margin-bottom: 10px;">+ Dog zur KennelConfig hinzufügen</button>
      <div id="add-dog-selector" style="display: none;">
        <select id="available-dogs-select" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333; margin-bottom: 10px;">
          <option value="">Lade verfügbare SerializedDogs...</option>
        </select>
        <div style="display: flex; gap: 10px;">
          <button id="add-selected-dog-btn" style="background: #00cc00; color: #fff; border: none; padding: 6px 12px; cursor: pointer;">Hinzufügen</button>
          <button id="cancel-add-dog-btn" style="background: #666; color: #fff; border: none; padding: 6px 12px; cursor: pointer;">Abbrechen</button>
        </div>
      </div>
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

<script id="kennel-config-data" type="application/json">
${kennelConfigJson}
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

#boat { 
  width:100%; 
  height:120px; 
  display:flex; 
  justify-content:center; 
  align-items:center; 
}
#boat pre {
  font-size: 10px;
  line-height: 1.2;
  transform: scale(0.7);
  transform-origin: center;
  margin: 0;
  padding: 0;
  animation: fisherFloat 4s ease-in-out infinite;
}
@keyframes fisherFloat {
  0%, 100% {
    transform: scale(0.7) translateY(0px);
  }
  50% {
    transform: scale(0.7) translateY(-8px);
  }
}
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
                                                                                                        
                                                                     t8.SXX% ;@@;                       
                                                                  .. %;8XX8888X8:                       
                                                                     X8X88888S8;..                      
                                                                       8888S@88 X                       
                                                                     .t X88@8X88@                       
                                                                     ...8S88t@88 ..                     
                                                                        8@888888S..                     
                                                                     :8S8@8X8@                          
                                                                  t@88%        %888;888@..              
                                                               .%. %8tt8:.      8@8Xt8888..             
                                                               %. .. .%88:      88888@8 ;.               
                                                               %.  .  .tS.%t.  ..%888@;888               
                                                               %.    . . .tS%8:.  8XS8888.8t            
                                                               t.  .       .;.8;..  .;88@;X8X88:.       
                                                               %.    .  .   .;8 :t.   @88888t888..      
                                                               %.  .      .  .:.t;:t.  tX88@88:. S88@%X8Xt%            
                                                               %.     .  .       .tS8 S..  .88@8@Xt .%88888t8@.        
                                                               %. .  .     .  .   : S@8%8%8S8SX88@8@8 888@tS8X8@t       
                                                               %.      .    .   . ..:;8@t8SS@88X88X8%X888888t88 :.      
                                                               %.  .    . .   .   ...8;888888@%t@88;88X8@8X8X8 t.     
                                                               %.   . .          . .. :888@8888888X8X8888;8888:.      
                                                               %. .      .  .  .      t88@; 8@88888t@8@888Xt t.       
                                                               %.    .     . .  . . .  %8@X888888@;%88:X;S @:         
                                                               %. .    . .   :8X     ; 88X8SX8@;@8@88;S88@..          
                                                               t.   .       . ;8SX%@S8X888@8@8888;@8@8S8S.            
                                                               %.     .  .    .:..8 S88@%@88%@tS88 8X;::              
                                                               %.  .   .   .   .. :. 8S888 :88S ::;t.                
                                                               %.   .    .   .  . .. .88X%.:;:                       
                                                               %. .   .    .   .  ..8X8:                             
                                                               %.       .    .   . 88@  ..                           
                                                               %.  . .    .   . X:8@88...                            
                                                                     .    .  ..88.;:                                 
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
    <button id="delete-from-kennel" style="display: none; background: #ff4444; color: #fff; border: none; padding: 6px 12px; cursor: pointer;">Delete</button>
  </div>

  <div id="serialized-dog-version" style="display: none; margin: 10px 0; padding: 10px; border: 1px solid #333; background: #1a1a1a;">
    <label style="display: block; margin-bottom: 5px;"><strong>Version:</strong></label>
    <div style="display: flex; gap: 10px; align-items: center;">
      <select id="version-select" style="flex: 1; padding: 6px; background: #000; color: #fff; border: 1px solid #333;">
        <option value="">Lade Versionen...</option>
      </select>
      <button id="update-version-btn" style="padding: 6px 12px; background: #0066cc; color: #fff; border: none; cursor: pointer;">Aktualisieren</button>
    </div>
    <div style="margin-top: 5px; font-size: 12px; color: #888;">
      <span id="version-info">-</span>
    </div>
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
      
      // Add Dog zur KennelConfig
      const addDogBtn = document.getElementById('add-dog-to-kennel-btn');
      const addDogSelector = document.getElementById('add-dog-selector');
      const availableDogsSelect = document.getElementById('available-dogs-select');
      const addSelectedDogBtn = document.getElementById('add-selected-dog-btn');
      const cancelAddDogBtn = document.getElementById('cancel-add-dog-btn');
      
      // Lade KennelConfig aus eingebettetem JSON
      let currentKennelConfig = null;
      let currentKennelId = null;
      try {
        const kennelConfigScript = document.getElementById('kennel-config-data');
        if (kennelConfigScript && kennelConfigScript.textContent) {
          currentKennelConfig = JSON.parse(kennelConfigScript.textContent);
          currentKennelId = currentKennelConfig?.id || null;
          console.log('[AddDog] Geladene KennelConfig aus HTML:', currentKennelConfig);
        }
      } catch (e) {
        console.warn('[AddDog] Fehler beim Laden der KennelConfig aus HTML:', e);
      }
      
      // Fallback: Versuche Kennel-ID aus URL zu extrahieren
      if (!currentKennelId) {
        const pathParts = window.location.pathname.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
          currentKennelId = pathParts[0];
        }
      }
      
      if (addDogBtn && addDogSelector && availableDogsSelect) {
        addDogBtn.addEventListener('click', async () => {
          if (!currentKennelId) {
            alert('Keine KennelConfig gefunden. Bitte eine KennelConfig auswählen.');
            return;
          }
          
          addDogSelector.style.display = 'block';
          
          // Lade verfügbare SerializedDogs und BaseDogs
          try {
            availableDogsSelect.innerHTML = '<option value="">Lade verfügbare Dogs...</option>';
            
            // Lade SerializedDogs (alle Versionen)
            let nodesResult = null;
            try {
              const nodesResponse = await fetch('/api/nodes');
              if (!nodesResponse.ok) {
                throw new Error(\`Nodes API: HTTP \${nodesResponse.status} - \${nodesResponse.statusText}\`);
              }
              nodesResult = await nodesResponse.json();
              if (!nodesResult.ok) {
                throw new Error(\`Nodes API Fehler: \${nodesResult.error || 'Unbekannter Fehler'}\`);
              }
            } catch (err) {
              console.error('[AddDog] Fehler beim Laden von SerializedDogs:', err);
              throw new Error(\`SerializedDogs laden fehlgeschlagen: \${err.message}\`);
            }
            
            // Lade BaseDogs
            let baseDogsResult = null;
            try {
              const baseDogsResponse = await fetch('/api/basedogs');
              if (!baseDogsResponse.ok) {
                throw new Error(\`BaseDogs API: HTTP \${baseDogsResponse.status} - \${baseDogsResponse.statusText}\`);
              }
              baseDogsResult = await baseDogsResponse.json();
              if (!baseDogsResult.ok) {
                throw new Error(\`BaseDogs API Fehler: \${baseDogsResult.error || 'Unbekannter Fehler'}\`);
              }
            } catch (err) {
              console.error('[AddDog] Fehler beim Laden von BaseDogs:', err);
              throw new Error(\`BaseDogs laden fehlgeschlagen: \${err.message}\`);
            }
            
            availableDogsSelect.innerHTML = '<option value="">Dog auswählen...</option>';
            
            let addedCount = 0;
            
            // Füge alle Versionen von SerializedDogs hinzu
            if (nodesResult && nodesResult.data && Array.isArray(nodesResult.data)) {
              // Sortiere nach Basis-ID und dann nach Version (neueste zuerst)
              const sortedDogs = [...nodesResult.data].sort((a, b) => {
                const aBaseId = a.id ? a.id.replace(/-v\\d+$/, '') : '';
                const bBaseId = b.id ? b.id.replace(/-v\\d+$/, '') : '';
                if (aBaseId !== bBaseId) {
                  return aBaseId.localeCompare(bBaseId);
                }
                return (b.version || 0) - (a.version || 0);
              });
              
              sortedDogs.forEach(dog => {
                if (dog.id) {
                  try {
                    const option = document.createElement('option');
                    option.value = dog.id;  // Vollständige ID mit Version
                    const baseId = dog.id.replace(/-v\\d+$/, '');
                    const versionMatch = dog.id.match(/-v(\\d+)$/);
                    const version = dog.version || (versionMatch ? versionMatch[1] : '?');
                    option.textContent = \`\${baseId} (v\${version}) [SerializedDog]\`;
                    availableDogsSelect.appendChild(option);
                    addedCount++;
                  } catch (e) {
                    console.warn('[AddDog] Fehler beim Hinzufügen von SerializedDog:', dog, e);
                  }
                }
              });
            } else {
              console.warn('[AddDog] NodesResult hat kein data-Array:', nodesResult);
            }
            
            // Füge BaseDogs hinzu
            if (baseDogsResult && baseDogsResult.data && Array.isArray(baseDogsResult.data)) {
              baseDogsResult.data.forEach(baseDog => {
                try {
                  if (!baseDog.id || !baseDog.name) {
                    console.warn('[AddDog] BaseDog hat keine id oder name:', baseDog);
                    return;
                  }
                  const option = document.createElement('option');
                  option.value = baseDog.id;  // base:Name
                  option.textContent = \`\${baseDog.name} [BaseDog]\`;
                  availableDogsSelect.appendChild(option);
                  addedCount++;
                } catch (e) {
                  console.warn('[AddDog] Fehler beim Hinzufügen von BaseDog:', baseDog, e);
                }
              });
            } else {
              console.warn('[AddDog] BaseDogsResult hat kein data-Array:', baseDogsResult);
            }
            
            if (addedCount === 0) {
              availableDogsSelect.innerHTML = '<option value="">Keine Dogs verfügbar</option>';
            }
          } catch (err) {
            console.error('[AddDog] Fehler beim Laden:', err);
            const errorMsg = err.message || String(err);
            availableDogsSelect.innerHTML = \`<option value="">Fehler: \${errorMsg}</option>\`;
          }
        });
      }
      
      if (cancelAddDogBtn && addDogSelector) {
        cancelAddDogBtn.addEventListener('click', () => {
          addDogSelector.style.display = 'none';
        });
      }
      
      if (addSelectedDogBtn && availableDogsSelect) {
        addSelectedDogBtn.addEventListener('click', async () => {
          // Versuche Kennel-ID nochmal aus URL zu extrahieren (falls sich geändert hat)
          let kennelId = currentKennelId;
          if (!kennelId) {
            const pathParts = window.location.pathname.split('/').filter(p => p);
            if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
              kennelId = pathParts[0];
            }
          }
          
          if (!kennelId) {
            alert('Keine KennelConfig gefunden. Bitte eine KennelConfig auswählen.');
            return;
          }
          
          const selectedDogId = availableDogsSelect.value;
          if (!selectedDogId) {
            alert('Bitte einen Dog auswählen');
            return;
          }
          
          try {
            console.log('[AddDog] Kennel-ID:', kennelId);
            console.log('[AddDog] Selected Dog ID:', selectedDogId);
            
            // Verwende eingebettete KennelConfig oder lade sie
            let kennelConfig = currentKennelConfig;
            
            // Prüfe ob KennelConfig geladen wurde und ob ID übereinstimmt (berücksichtige Versionierung)
            const configBaseId = kennelConfig?.id ? kennelConfig.id.replace(/-v\\d+$/, '') : null;
            const kennelBaseId = kennelId ? kennelId.replace(/-v\\d+$/, '') : null;
            
            if (!kennelConfig || (configBaseId !== kennelBaseId && kennelBaseId)) {
              console.log('[AddDog] Lade KennelConfig von API, weil:', {
                hasConfig: !!kennelConfig,
                configBaseId,
                kennelBaseId,
                match: configBaseId === kennelBaseId
              });
              
              // Lade aktuelle KennelConfig (verwende Basis-ID für API-Call)
              const apiId = kennelBaseId || kennelId;
              const getResponse = await fetch(\`/api/kennels/\${apiId}\`);
              if (!getResponse.ok) throw new Error('HTTP ' + getResponse.status);
              
              const getResult = await getResponse.json();
              if (!getResult.ok || !getResult.data) {
                throw new Error(getResult.error || 'KennelConfig nicht gefunden');
              }
              
              kennelConfig = getResult.data;
              console.log('[AddDog] KennelConfig von API geladen:', kennelConfig);
            } else {
              console.log('[AddDog] Verwende eingebettete KennelConfig:', kennelConfig);
            }
            
            console.log('[AddDog] Geladene KennelConfig:', JSON.stringify(kennelConfig, null, 2));
            console.log('[AddDog] Aktuelle dogIds:', kennelConfig.dogIds);
            
            const dogIds = kennelConfig.dogIds || [];
            
            // Prüfe ob bereits vorhanden
            const isBaseDog = selectedDogId.startsWith('base:');
            let isAlreadyAdded = false;
            
            if (isBaseDog) {
              // Für BaseDogs: Prüfe auf exakte ID
              isAlreadyAdded = dogIds.includes(selectedDogId);
            } else {
              // Für SerializedDogs: Prüfe ob bereits eine Version dieser Basis-ID vorhanden ist
              const selectedBaseId = selectedDogId.replace(/-v\\d+$/, '');
              isAlreadyAdded = dogIds.some(id => {
                // Prüfe auf BaseDog mit gleichem Namen (sollte nicht vorkommen, aber sicherheitshalber)
                if (id.startsWith('base:')) return false;
                const idBaseId = id.replace(/-v\\d+$/, '');
                return idBaseId === selectedBaseId;
              });
            }
            
            if (isAlreadyAdded) {
              alert(isBaseDog ? 'Dieser BaseDog ist bereits in der KennelConfig' : 'Eine Version dieses SerializedDogs ist bereits in der KennelConfig');
              return;
            }
            
            // Füge hinzu: Vollständige ID (mit Version für SerializedDogs, base:Name für BaseDogs)
            dogIds.push(selectedDogId);
            console.log('[AddDog] Neue dogIds:', dogIds);
            
            // Extrahiere Basis-ID (ohne Version) für Versionsverwaltung
            const baseId = kennelConfig.id ? kennelConfig.id.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
            console.log('[AddDog] Extrahierte Basis-ID:', baseId);
            console.log('[AddDog] Original KennelConfig ID:', kennelConfig.id);
            console.log('[AddDog] Original kennelId:', kennelId);
            
            // Speichere aktualisierte KennelConfig (verwende Basis-ID, damit neue Version erstellt wird)
            const updateData = {
              id: baseId,  // Basis-ID verwenden, damit Versionsverwaltung funktioniert
              name: kennelConfig.name,
              description: kennelConfig.description,
              dogIds: dogIds,
            };
            console.log('[AddDog] Speichere mit Daten:', JSON.stringify(updateData, null, 2));
            console.log('[AddDog] PUT URL:', \`/api/kennels/\${baseId}\`);
            
            const putResponse = await fetch(\`/api/kennels/\${baseId}\`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updateData)
            });
            
            console.log('[AddDog] PUT Response Status:', putResponse.status);
            console.log('[AddDog] PUT Response OK:', putResponse.ok);
            
            if (!putResponse.ok) {
              const errorText = await putResponse.text();
              console.error('[AddDog] PUT Response Error:', errorText);
              throw new Error('HTTP ' + putResponse.status + ': ' + errorText);
            }
            
            const putResult = await putResponse.json();
            console.log('[AddDog] PUT Result:', JSON.stringify(putResult, null, 2));
            
            if (putResult.ok) {
              // Extrahiere Basis-ID aus der gespeicherten ID (kann versioniert sein)
              const savedId = putResult.id || putResult.data?.id;
              const finalBaseId = savedId ? savedId.replace(/-v\\d+$/, '') : baseId;
              console.log('[AddDog] Gespeicherte ID:', savedId);
              console.log('[AddDog] Finale Basis-ID:', finalBaseId);
              
              alert('SerializedDog zur KennelConfig hinzugefügt!');
              addDogSelector.style.display = 'none';
              
              // Lade neueste Version der KennelConfig und lade Seite neu
              window.location.href = \`/\${finalBaseId}\`;
            } else {
              throw new Error(putResult.error || 'Fehler beim Speichern');
            }
          } catch (err) {
            console.error('[AddDog] Fehler:', err);
            alert('Fehler: ' + err.message);
          }
        });
      }
      
      const newBtn = document.getElementById("new");
      if (newBtn) {
        newBtn.addEventListener("click", createNode);
      }
      
      const deleteBtn = document.getElementById("delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", deleteNode);
      }
      
      // Delete Button im Edit-Panel
      const deleteFromKennelBtn = document.getElementById("delete-from-kennel");
      if (deleteFromKennelBtn) {
        deleteFromKennelBtn.addEventListener("click", deleteNode);
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
