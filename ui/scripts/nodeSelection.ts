export function buildNodeSelection(): string {
  // @ts-ignore - JavaScript code as string
  return `function selectNode(n) {
  // Entferne vorherige Selektion
  document.querySelectorAll(".node").forEach(el => el.classList.remove("selected"));
  n.classList.add("selected");
  selectedNodeElement = n;

  // --- Viewer aktualisieren ---
  viewerMeta.textContent = "ID: " + n.dataset.id;
  viewerJson.textContent = JSON.stringify(n._json, null, 2);
  viewerCtx.textContent = JSON.stringify(n._ctx, null, 2);
  
  // Config anzeigen
  const viewerConfig = document.getElementById("config");
  if (viewerConfig) {
    if (n._config) {
      viewerConfig.textContent = JSON.stringify(n._config, null, 2);
    } else {
      viewerConfig.textContent = "// Keine Config verfügbar (nur für SerializedDogs)";
    }
  }

  // --- Parents-Auswahl aktualisieren ---
  updateParentsSelection(n);

  if (monacoEditor) {
    let code = n._ts || "// no code";
    // Entferne alle vorhandenen Wrapper zuerst
    function removeWrappers(code) {
      const trimmed = code.trim();
      // Prüfe ob Code mit "async function run() {" beginnt und mit "}" endet
      if (!trimmed.startsWith("async function run() {")) {
        return trimmed;
      }
      
      // Finde das passende schließende "}" durch Zählen der Klammern
      let depth = 0;
      let startPos = trimmed.indexOf("{");
      if (startPos === -1) return trimmed;
      
      for (let i = startPos; i < trimmed.length; i++) {
        if (trimmed[i] === "{") depth++;
        if (trimmed[i] === "}") {
          depth--;
          if (depth === 0) {
            // Gefunden: Extrahiere Inhalt zwischen den Klammern
            const inner = trimmed.substring(startPos + 1, i).trim();
            // Rekursiv weitere Wrapper entfernen
            return removeWrappers(inner);
          }
        }
      }
      
      return trimmed;
    }
    
    code = removeWrappers(code);
    
    // Wrappe Code einmal in async Funktion für Monaco (verhindert await-Fehler)
    const newline = String.fromCharCode(10);
    const wrappedCode = "async function run() {" + newline + code + newline + "}";
    monacoEditor.setValue(wrappedCode);
    
    // Entferne vorherige Type Definitions
    if (activeTypeDefDispose) {
      activeTypeDefDispose();
      activeTypeDefDispose = null;
    }
    
    // Füge neue Type Definitions hinzu
    if (n._ctxTypeDef) {
      activeTypeDefDispose = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        n._ctxTypeDef, 
        "ts:node-" + n.dataset.id + "-context.d.ts"
      );
    } else if (n._ctx) {
      activeTypeDefDispose = monaco.languages.typescript.typescriptDefaults.addExtraLib(
        JSON.stringify(n._ctx, null, 2), 
        "ts:node-" + n.dataset.id + "-context.d.ts"
      );
    }
  }
}

function updateParentsSelection(selectedNode) {
  // Sammle alle verfügbaren Nodes
  const allNodes = Array.from(document.querySelectorAll(".node"));
  const currentNodeId = selectedNode._nodeId || selectedNode.dataset.id;
  // Nutze Config falls verfügbar, sonst fallback auf _req/_opt
  const config = selectedNode._config || {};
  const currentRequired = config.parentsRequired || selectedNode._req || [];
  const currentOptional = config.parentsOptional || selectedNode._opt || [];
  
  // Erstelle Required-Parents Liste
  const requiredContainer = document.getElementById("parents-required");
  requiredContainer.innerHTML = "";
  allNodes.forEach(node => {
    const nodeId = node._nodeId || node.dataset.id;
    if (nodeId === currentNodeId) return; // Überspringe aktuelle Node
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = nodeId;
    checkbox.checked = currentRequired.includes(nodeId);
    checkbox.id = "req-" + nodeId;
    
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = node.textContent || nodeId;
    label.style.display = "block";
    label.style.marginBottom = "5px";
    label.style.cursor = "pointer";
    
    label.insertBefore(checkbox, label.firstChild);
    requiredContainer.appendChild(label);
  });
  
  // Erstelle Optional-Parents Liste
  const optionalContainer = document.getElementById("parents-optional");
  optionalContainer.innerHTML = "";
  allNodes.forEach(node => {
    const nodeId = node._nodeId || node.dataset.id;
    if (nodeId === currentNodeId) return; // Überspringe aktuelle Node
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = nodeId;
    checkbox.checked = currentOptional.includes(nodeId);
    checkbox.id = "opt-" + nodeId;
    
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = node.textContent || nodeId;
    label.style.display = "block";
    label.style.marginBottom = "5px";
    label.style.cursor = "pointer";
    
    label.insertBefore(checkbox, label.firstChild);
    optionalContainer.appendChild(label);
  });
}`;
}

