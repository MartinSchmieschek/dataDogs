import { Buffer } from "buffer";
import * as visNetworkRenderer from "./scripts/visNetworkRenderer";
import * as nodeSelection from "./scripts/nodeSelection";
import * as monacoInit from "./scripts/monacoInit";
import * as saveHandler from "./scripts/saveHandler";
import * as nodeCrud from "./scripts/nodeCrud";
import { JsStringBuilder } from "./utils/jsStringBuilder";

export type ReadTrackingEntry = {
  waveIndex: number;
  readerInstanceName: string;
  sourceInstanceName: string;
  propertyPath: string;
};

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
  // Tracking: Welche Properties von welchen anderen Instances gelesen wurden
  readFrom?: ReadTrackingEntry[];
  // Tracking: Welche Properties von dieser Instance von anderen Instances gelesen wurden
  readBy?: ReadTrackingEntry[];
};

export type Waves = NodeEntry[][];

export class Results {

  // =========================================================
  // HELPER: Sichere JavaScript-String-Generierung
  // =========================================================
  /**
   * Erstellt einen JavaScript-String sicher mit String-Konkatenation
   * Verhindert Escaping-Probleme bei verschachtelten Template-Strings
   */
  private static jsString(parts: string[], ...values: any[]): string {
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      // Escape String-Literal
      const escaped = parts[i]
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      result += "'" + escaped + "'";
      
      if (i < values.length) {
        const val = values[i];
        if (typeof val === 'string') {
          // Variable name, nicht escaped
          result += ' + ' + val;
        } else if (typeof val === 'number') {
          result += ' + ' + val;
        } else {
          result += ' + ' + JSON.stringify(val);
        }
      }
      if (i < parts.length - 1) {
        result += ' + ';
      }
    }
    return result;
  }

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

  public static buildEmptyKennelHtml(runError: any, kennelConfig?: any): string {
    const errorMessage = runError?.message || String(runError);
    const errorJson = JSON.stringify({ error: errorMessage, kennelConfig });
    return this.buildEmptyPage(errorJson, kennelConfig);
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
    <div id="add-dogs-panel" style="padding: 10px; border-bottom: 1px solid #333;">
      <select id="available-dogs-select" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333;">
        <option value="">Dog hinzufügen...</option>
      </select>
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

  private static buildEmptyPage(errorJson: string, kennelConfig?: any): string {
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
    <div style="padding: 20px; text-align: center;">
      <h2 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ Leerer Kennel</h2>
      <div style="background: #1b1b1f; padding: 20px; border-radius: 10px; border: 2px solid #ff6b6b; margin-bottom: 20px;">
        <p style="color: #eee; font-size: 16px; margin: 0;">
          Dieser Kennel enthält keine Dogs zum Ausführen.
        </p>
      </div>
      <div style="background: #000; padding: 15px; border-radius: 5px; text-align: left; margin-bottom: 20px;">
        <pre style="color: #ff6b6b; margin: 0; white-space: pre-wrap; word-wrap: break-word;">${errorJson.replace(/<\/script>/gi, "<\\/script>")}</pre>
      </div>
      <div style="padding: 10px; border-bottom: 1px solid #333;">
        <select id="available-dogs-select" style="width: 100%; padding: 8px; background: #000; color: #fff; border: 1px solid #333;">
          <option value="">Dog hinzufügen...</option>
        </select>
      </div>
    </div>
  </div>
</div>

<script id="error-data" type="application/json">
${errorJson.replace(/<\/script>/gi, "<\\/script>")}
</script>

<script id="kennel-config-data" type="application/json">
${kennelConfigJson}
</script>

${this.buildEmptyScripts()}
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
  <h3>Meta</h3>
  <pre id="meta"></pre>

  <div id="serialized-dog-version" style="display: none; margin: 10px 0; padding: 10px; border: 1px solid #333; background: #1a1a1a;">
    <label style="display: block; margin-bottom: 5px;"><strong>Version:</strong></label>
    <select id="version-select" style="width: 100%; padding: 6px; background: #000; color: #fff; border: 1px solid #333;">
      <option value="">Lade Versionen...</option>
    </select>
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

  <div id="serialized-dog-ts" style="display: none;">
    <h3>TypeScript</h3>
    <div id="ts-editor"></div>
  </div>

  <div id="serialized-dog-controls" style="margin: 10px 0; display: none; gap: 10px; flex-wrap: wrap;">
    <button id="save">Save</button>
    <button id="move-to-first">⭐ An erste Stelle</button>
    <button id="delete-from-kennel">Aus Kennel entfernen</button>
  </div>

  <div id="base-dog-controls" style="margin: 10px 0; display: none; gap: 10px; flex-wrap: wrap;">
    <button id="move-to-first-base">⭐ An erste Stelle</button>
    <button id="delete-from-kennel-base">Aus Kennel entfernen</button>
  </div>

  <div id="query-retriever-config" style="display: none; margin: 20px 0; padding: 15px; background: #1a1a1a; border: 1px solid #333; border-radius: 5px;">
    <h3>Query Parameters</h3>
    <p style="color: #999; font-size: 11px; margin-bottom: 10px;">Key-Value-Paare für Query-Parameter</p>
    <div id="query-retriever-chips" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding: 10px; border: 1px solid #333; background: #000; min-height: 40px;">
      <div style="color: #666; text-align: center; width: 100%;">Keine Query-Parameter</div>
    </div>
    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
      <input type="text" id="query-retriever-key" placeholder="Key" style="flex: 1; padding: 6px; background: #000; color: #fff; border: 1px solid #333;">
      <input type="text" id="query-retriever-value" placeholder="Value" style="flex: 1; padding: 6px; background: #000; color: #fff; border: 1px solid #333;">
      <button id="query-retriever-add" style="padding: 6px 12px; background: #0066cc; color: #fff; border: none; cursor: pointer;">Hinzufügen</button>
    </div>
    <button id="query-retriever-save" style="padding: 8px 16px; background: #00cc00; color: #fff; border: none; cursor: pointer; font-weight: bold;">Speichern</button>
  </div>

  <div id="body-retriever-config" style="display: none; margin: 20px 0; padding: 15px; background: #1a1a1a; border: 1px solid #333; border-radius: 5px;">
    <h3>Body Data (JSON)</h3>
    <p style="color: #999; font-size: 11px; margin-bottom: 10px;">JSON-Daten für Body</p>
    <div id="body-retriever-editor" style="height: 200px; border: 1px solid #333; background: #000; margin-bottom: 10px;"></div>
    <button id="body-retriever-save" style="padding: 8px 16px; background: #00cc00; color: #fff; border: none; cursor: pointer; font-weight: bold;">Speichern</button>
  </div>

  <div id="html-output" style="display: none;">
    <h3>HTML Output</h3>
    <div id="html-render" style="border: 1px solid #333; padding: 10px; background: #fff; color: #000; min-height: 200px;"></div>
  </div>

  <div id="serialized-dog-config" style="display: none;">
    <h3>SerializedDog Data</h3>
    <div id="config-editor" style="height: 300px; border: 1px solid #333;"></div>
  </div>

  <hr style="margin: 20px 0; border: none; border-top: 2px solid #333;">

  <div id="serialized-dog-context" style="display: none;">
    <h3>VM Context</h3>
    <div id="context-editor" style="height: 300px; border: 1px solid #333;"></div>
  </div>

  <div id="read-tracking" style="display: none; margin: 20px 0;">
    <h3>Property-Zugriffe</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 10px;">
      <div>
        <label><strong>Liest von:</strong></label>
        <div id="read-from" style="max-height: 200px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #000; font-size: 12px;"></div>
      </div>
      <div>
        <label><strong>Wird gelesen von:</strong></label>
        <div id="read-by" style="max-height: 200px; overflow-y: auto; border: 1px solid #333; padding: 10px; background: #000; font-size: 12px;"></div>
      </div>
    </div>
  </div>

  <div id="result-viewer" style="display: block;">
    <h3>result</h3>
    <div id="result-editor" style="height: 300px; border: 1px solid #333;"></div>
  </div>
</div>
`;
  }

  // =========================================================
  // SCRIPTS
  // =========================================================
  private static buildEmptyScripts(): string {
    return `
<script>
// Lade KennelConfig aus eingebettetem JSON
let currentKennelConfig = null;
let currentKennelId = null;
try {
  const kennelConfigScript = document.getElementById('kennel-config-data');
  if (kennelConfigScript && kennelConfigScript.textContent) {
    currentKennelConfig = JSON.parse(kennelConfigScript.textContent);
    currentKennelId = currentKennelConfig?.id || null;
  }
} catch (e) {
  console.warn('[EmptyKennel] Fehler beim Laden der KennelConfig:', e);
}

// Fallback: Versuche Kennel-ID aus URL zu extrahieren
if (!currentKennelId) {
  const pathParts = window.location.pathname.split('/').filter(p => p);
  if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
    currentKennelId = pathParts[0];
  }
}

// Lade Dropdown beim Seitenaufruf
async function loadDropdown() {
  const availableDogsSelect = document.getElementById('available-dogs-select');
  if (!availableDogsSelect) return;
  
  try {
    availableDogsSelect.innerHTML = '<option value="">Dog hinzufügen...</option>';
    
    // Option für neue SerializedDog
    const newOption = document.createElement('option');
    newOption.value = '__NEW__';
    newOption.textContent = '➕ Neue SerializedDog erstellen';
    availableDogsSelect.appendChild(newOption);
    
    // Lade alle Dogs (BaseDogs + SerializedDogs) von /api/nodes
    const response = await fetch('/api/nodes');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    
    const result = await response.json();
    
    if (result.ok && result.data) {
      // Trenne BaseDogs und SerializedDogs
      const baseDogs = [];
      const serializedDogs = [];
      
      result.data.forEach((dog) => {
        if (dog.type === 'BaseDog' || (dog.id && dog.id.startsWith('base:'))) {
          baseDogs.push(dog);
        } else {
          serializedDogs.push(dog);
        }
      });
      
      // Füge BaseDogs hinzu
      baseDogs.forEach((baseDog) => {
        const option = document.createElement('option');
        option.value = baseDog.id; // z.B. "base:RandomRecipesRetriever"
        option.textContent = '🐕 ' + baseDog.name; // z.B. "RandomRecipesRetriever"
        availableDogsSelect.appendChild(option);
      });
      
      // Gruppiere SerializedDogs nach Basis-ID
      const dogsByBaseId = new Map();
      serializedDogs.forEach((dog) => {
        if (dog.id) {
          const baseId = dog.id.replace(/-v\\d+$/, '');
          if (!dogsByBaseId.has(baseId)) {
            dogsByBaseId.set(baseId, []);
          }
          dogsByBaseId.get(baseId).push(dog);
        }
      });
      
      // Sortiere Versionen innerhalb jeder Basis-ID (neueste zuerst)
      dogsByBaseId.forEach((versions, baseId) => {
        versions.sort((a, b) => (b.version || 0) - (a.version || 0));
      });
      
      // Erstelle Optionen: Nur Basis-IDs
      dogsByBaseId.forEach((versions, baseId) => {
        const latestVersion = versions[0];
        const option = document.createElement('option');
        option.value = baseId;
        option.textContent = '🐕 ' + baseId + ' (v' + (latestVersion.version || '?') + ')';
        availableDogsSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Fehler beim Laden:', err);
    availableDogsSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
  }
}

// Auto-Hinzufügen beim Auswählen
async function handleDogSelection(selectedValue) {
  if (!selectedValue || selectedValue === '') return;
  
  let kennelId = currentKennelId;
  if (!kennelId) {
    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
      kennelId = pathParts[0];
    }
  }
  
  if (!kennelId) {
    alert('Keine KennelConfig gefunden.');
    return;
  }
  
  // Neue SerializedDog erstellen
  if (selectedValue === '__NEW__') {
    const baseId = prompt('Basis-ID für neue SerializedDog (z.B. my-dog):');
    if (!baseId) {
      document.getElementById('available-dogs-select').value = '';
      return;
    }
    
    const defaultCode = '// Neue SerializedDog\\nconst result = { message: "Hello from new dog" };\\nreturn result;';
    
    try {
      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          baseId: baseId,
          tsCode: defaultCode,
          parentsRequired: [],
          parentsOptional: []
        })
      });
      
      if (!response.ok) throw new Error("Create fehlgeschlagen: " + response.status);
      
      const result = await response.json();
      if (result.ok) {
        // Füge die neue Node zur KennelConfig hinzu
        selectedValue = baseId;
      } else {
        throw new Error(result.error || "Unbekannter Fehler");
      }
    } catch (e) {
      console.error("Create error:", e);
      alert("Fehler beim Erstellen: " + e.message);
      document.getElementById('available-dogs-select').value = '';
      return;
    }
  }
  
  // Füge Dog zur KennelConfig hinzu
  try {
    let kennelConfig = currentKennelConfig;
    if (!kennelConfig || kennelConfig.id !== kennelId) {
      const getResponse = await fetch('/api/kennels/' + kennelId);
      if (!getResponse.ok) throw new Error('HTTP ' + getResponse.status);
      
      const getResult = await getResponse.json();
      if (!getResult.ok || !getResult.data) {
        throw new Error(getResult.error || 'KennelConfig nicht gefunden');
      }
      
      kennelConfig = getResult.data;
    }
    
        const dogIds = kennelConfig.dogIds || [];
        
        // Prüfe ob Dog bereits hinzugefügt wurde
        // Für BaseDogs: direkter Vergleich (z.B. "base:RandomRecipesRetriever")
        // Für SerializedDogs: Vergleich der Basis-ID (ohne Version)
        const isAlreadyAdded = dogIds.some(id => {
          if (selectedValue.startsWith('base:')) {
            // BaseDog: direkter Vergleich
            return id === selectedValue;
          } else {
            // SerializedDog: Vergleich der Basis-ID
            const idBaseId = id.replace(/-v\\d+$/, '');
            return idBaseId === selectedValue;
          }
        });
        
        if (isAlreadyAdded) {
          alert('Dieser Dog ist bereits in der KennelConfig');
          document.getElementById('available-dogs-select').value = '';
          return;
        }
        
        dogIds.push(selectedValue);
    
    const baseId = kennelConfig.id ? kennelConfig.id.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
    
    const updateData = {
      id: baseId,
      name: kennelConfig.name,
      description: kennelConfig.description,
      dogIds: dogIds,
    };
    
    const putResponse = await fetch('/api/kennels/' + baseId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      throw new Error('HTTP ' + putResponse.status + ': ' + errorText);
    }
    
    const putResult = await putResponse.json();
    
    if (putResult.ok) {
      const savedId = putResult.id || putResult.data?.id;
      const finalBaseId = savedId ? savedId.replace(/-v\\d+$/, '') : baseId;
      window.location.href = '/edit/' + finalBaseId;
    } else {
      throw new Error(putResult.error || 'Fehler beim Speichern');
    }
  } catch (err) {
    console.error('[EmptyKennel] Fehler:', err);
    alert('Fehler: ' + err.message);
    document.getElementById('available-dogs-select').value = '';
  }
}

// Event-Listener
window.onload = () => {
  loadDropdown();
  
  const availableDogsSelect = document.getElementById('available-dogs-select');
  if (availableDogsSelect) {
    availableDogsSelect.addEventListener('change', (e) => {
      handleDogSelection(e.target.value);
    });
  }
};
</script>
`;
  }

  private static buildScripts(): string {
    return `
<script>
const waves = JSON.parse(document.getElementById("waves-data").textContent);

// --- Element-Refs ---
const wavesEl = document.getElementById("waves");
const viewerMeta = document.getElementById("meta");
let resultEditor = null;
let contextEditor = null;
let configEditor = null;
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
  // Initialisiere QueryRetriever/BodyRetriever Event Listeners
  if (typeof window.initQueryRetrieverListeners === 'function') {
    window.initQueryRetrieverListeners();
  }
  
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
      
      // Lade KennelConfig aus eingebettetem JSON
      let currentKennelConfig = null;
      let currentKennelId = null;
      try {
        const kennelConfigScript = document.getElementById('kennel-config-data');
        if (kennelConfigScript && kennelConfigScript.textContent) {
          currentKennelConfig = JSON.parse(kennelConfigScript.textContent);
          currentKennelId = currentKennelConfig?.id || null;
        }
      } catch (e) {
        console.warn('[AddDog] Fehler beim Laden der KennelConfig:', e);
      }
      
      // Fallback: Versuche Kennel-ID aus URL zu extrahieren
      if (!currentKennelId) {
        const pathParts = window.location.pathname.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
          currentKennelId = pathParts[0];
        }
      }
      
      // Lade Dropdown beim Seitenaufruf
      async function loadDropdown() {
        const availableDogsSelect = document.getElementById('available-dogs-select');
        if (!availableDogsSelect) return;
        
        try {
          availableDogsSelect.innerHTML = '<option value="">Dog hinzufügen...</option>';
          
          // Option für neue SerializedDog
          const newOption = document.createElement('option');
          newOption.value = '__NEW__';
          newOption.textContent = '➕ Neue SerializedDog erstellen';
          availableDogsSelect.appendChild(newOption);
          
          // Lade alle Dogs (BaseDogs + SerializedDogs) von /api/nodes
          const response = await fetch('/api/nodes');
          if (!response.ok) throw new Error('HTTP ' + response.status);
          
          const result = await response.json();
          
          if (result.ok && result.data) {
            // Trenne BaseDogs und SerializedDogs
            const baseDogs = [];
            const serializedDogs = [];
            
            result.data.forEach((dog) => {
              if (dog.type === 'BaseDog' || (dog.id && dog.id.startsWith('base:'))) {
                baseDogs.push(dog);
              } else {
                serializedDogs.push(dog);
              }
            });
            
            // Füge BaseDogs hinzu
            baseDogs.forEach((baseDog) => {
              const option = document.createElement('option');
              option.value = baseDog.id; // z.B. "base:RandomRecipesRetriever"
              option.textContent = '🐕 ' + baseDog.name; // z.B. "RandomRecipesRetriever"
              availableDogsSelect.appendChild(option);
            });
            
            // Gruppiere SerializedDogs nach Basis-ID
            const dogsByBaseId = new Map();
            serializedDogs.forEach((dog) => {
              if (dog.id) {
                const baseId = dog.id.replace(/-v\\d+$/, '');
                if (!dogsByBaseId.has(baseId)) {
                  dogsByBaseId.set(baseId, []);
                }
                dogsByBaseId.get(baseId).push(dog);
              }
            });
            
            // Sortiere Versionen innerhalb jeder Basis-ID (neueste zuerst)
            dogsByBaseId.forEach((versions, baseId) => {
              versions.sort((a, b) => (b.version || 0) - (a.version || 0));
            });
            
            // Erstelle Optionen: Nur Basis-IDs
            dogsByBaseId.forEach((versions, baseId) => {
              const latestVersion = versions[0];
              const option = document.createElement('option');
              option.value = baseId;
              option.textContent = '🐕 ' + baseId + ' (v' + (latestVersion.version || '?') + ')';
              availableDogsSelect.appendChild(option);
            });
          }
        } catch (err) {
          console.error('Fehler beim Laden:', err);
          availableDogsSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
        }
      }
      
      // Auto-Hinzufügen beim Auswählen
      async function handleDogSelection(selectedValue) {
        if (!selectedValue || selectedValue === '') return;
        
        let kennelId = currentKennelId;
        if (!kennelId) {
          const pathParts = window.location.pathname.split('/').filter(p => p);
          if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
            kennelId = pathParts[0];
          }
        }
        
        if (!kennelId) {
          alert('Keine KennelConfig gefunden.');
          return;
        }
        
        // Neue SerializedDog erstellen
        if (selectedValue === '__NEW__') {
          const baseId = prompt('Basis-ID für neue SerializedDog (z.B. my-dog):');
          if (!baseId) {
            document.getElementById('available-dogs-select').value = '';
            return;
          }
          
          const defaultCode = '// Neue SerializedDog\\nconst result = { message: "Hello from new dog" };\\nreturn result;';
          
          try {
            const response = await fetch('/api/nodes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                baseId: baseId,
                tsCode: defaultCode,
                parentsRequired: [],
                parentsOptional: []
              })
            });
            
            if (!response.ok) throw new Error("Create fehlgeschlagen: " + response.status);
            
            const result = await response.json();
            if (result.ok) {
              selectedValue = baseId;
            } else {
              throw new Error(result.error || "Unbekannter Fehler");
            }
          } catch (e) {
            console.error("Create error:", e);
            alert("Fehler beim Erstellen: " + e.message);
            document.getElementById('available-dogs-select').value = '';
            return;
          }
        }
        
        // Füge Dog zur KennelConfig hinzu
        try {
          let kennelConfig = currentKennelConfig;
          if (!kennelConfig || kennelConfig.id !== kennelId) {
            const getResponse = await fetch('/api/kennels/' + kennelId);
            if (!getResponse.ok) throw new Error('HTTP ' + getResponse.status);
            
            const getResult = await getResponse.json();
            if (!getResult.ok || !getResult.data) {
              throw new Error(getResult.error || 'KennelConfig nicht gefunden');
            }
            
            kennelConfig = getResult.data;
          }
          
          const dogIds = kennelConfig.dogIds || [];
          
          // Prüfe ob Dog bereits hinzugefügt wurde
          // Für BaseDogs: direkter Vergleich (z.B. "base:RandomRecipesRetriever")
          // Für SerializedDogs: Vergleich der Basis-ID (ohne Version)
          const isAlreadyAdded = dogIds.some(id => {
            if (selectedValue.startsWith('base:')) {
              // BaseDog: direkter Vergleich
              return id === selectedValue;
            } else {
              // SerializedDog: Vergleich der Basis-ID
              const idBaseId = id.replace(/-v\\d+$/, '');
              return idBaseId === selectedValue;
            }
          });
          
          if (isAlreadyAdded) {
            alert('Dieser Dog ist bereits in der KennelConfig');
            document.getElementById('available-dogs-select').value = '';
            return;
          }
          
          dogIds.push(selectedValue);
          
          const baseId = kennelConfig.id ? kennelConfig.id.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
          
          const updateData = {
            id: baseId,
            name: kennelConfig.name,
            description: kennelConfig.description,
            dogIds: dogIds,
          };
          
          const putResponse = await fetch('/api/kennels/' + baseId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          
          if (!putResponse.ok) {
            const errorText = await putResponse.text();
            throw new Error('HTTP ' + putResponse.status + ': ' + errorText);
          }
          
          const putResult = await putResponse.json();
          
          if (putResult.ok) {
            const savedId = putResult.id || putResult.data?.id;
            const finalBaseId = savedId ? savedId.replace(/-v\\d+$/, '') : baseId;
            window.location.href = '/edit/' + finalBaseId;
          } else {
            throw new Error(putResult.error || 'Fehler beim Speichern');
          }
        } catch (err) {
          console.error('[AddDog] Fehler:', err);
          alert('Fehler: ' + err.message);
          document.getElementById('available-dogs-select').value = '';
        }
      }
      
      // Lade Dropdown und setze Event-Listener
      loadDropdown();
      const availableDogsSelect = document.getElementById('available-dogs-select');
      if (availableDogsSelect) {
        availableDogsSelect.addEventListener('change', (e) => {
          handleDogSelection(e.target.value);
        });
      }
      
      // Move to first Button (SerializedDog)
      const moveToFirstBtn = document.getElementById("move-to-first");
      if (moveToFirstBtn) {
        moveToFirstBtn.addEventListener("click", moveNodeToFirst);
      }
      
      // Move to first Button (BaseDog)
      const moveToFirstBaseBtn = document.getElementById("move-to-first-base");
      if (moveToFirstBaseBtn) {
        moveToFirstBaseBtn.addEventListener("click", moveNodeToFirst);
      }
      
      // Delete Button im Edit-Panel (SerializedDog)
      const deleteFromKennelBtn = document.getElementById("delete-from-kennel");
      if (deleteFromKennelBtn) {
        deleteFromKennelBtn.addEventListener("click", deleteNode);
      }
      
      // Delete Button im Edit-Panel (BaseDog)
      const deleteFromKennelBaseBtn = document.getElementById("delete-from-kennel-base");
      if (deleteFromKennelBaseBtn) {
        deleteFromKennelBaseBtn.addEventListener("click", deleteNode);
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
