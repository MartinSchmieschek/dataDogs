export function buildNodeSelection(): string {
  // @ts-ignore - JavaScript code as string
  return `function selectNode(n) {
  // Entferne vorherige Selektion
  document.querySelectorAll(".node").forEach(el => el.classList.remove("selected"));
  n.classList.add("selected");
  selectedNodeElement = n;

  // Prüfe ob SerializedDog (hat _config)
  const isSerializedDog = !!n._config;
  
  // Prüfe ob Output HTML ist
  const result = n._json;
  const isHtml = typeof result === 'string' && (
    result.trim().startsWith('<html') || 
    result.trim().startsWith('<!DOCTYPE') ||
    result.trim().startsWith('<') && result.includes('</')
  );

  // --- Viewer aktualisieren ---
  viewerMeta.textContent = "ID: " + n.dataset.id;
  viewerJson.textContent = JSON.stringify(n._json, null, 2);
  
  // Zeige/Verstecke SerializedDog-spezifische UI-Elemente
  const controlsDiv = document.getElementById("serialized-dog-controls");
  const parentsDiv = document.getElementById("serialized-dog-parents");
  const configDiv = document.getElementById("serialized-dog-config");
  const contextDiv = document.getElementById("serialized-dog-context");
  const tsDiv = document.getElementById("serialized-dog-ts");
  const htmlDiv = document.getElementById("html-output");
  const htmlRender = document.getElementById("html-render");
  
  if (isSerializedDog) {
    // Zeige Controls, Parents, Config, Context und TypeScript Editor
    if (controlsDiv) controlsDiv.style.display = "flex";
    if (parentsDiv) parentsDiv.style.display = "block";
    if (configDiv) configDiv.style.display = "block";
    if (contextDiv) {
      contextDiv.style.display = "block";
      viewerCtx.textContent = JSON.stringify(n._ctx, null, 2);
    }
    if (tsDiv) tsDiv.style.display = "block";
    
    // Für SerializedDogs: Zeige HTML Output falls vorhanden (zusätzlich zum Editor)
    if (isHtml && htmlDiv && htmlRender) {
      htmlDiv.style.display = "block";
      htmlRender.innerHTML = result;
    } else if (htmlDiv) {
      htmlDiv.style.display = "none";
    }
    
    // Config anzeigen
    const viewerConfig = document.getElementById("config");
    if (viewerConfig && n._config) {
      viewerConfig.textContent = JSON.stringify(n._config, null, 2);
    }
    
    // Parents-Auswahl aktualisieren
    updateParentsSelection(n);
  } else {
    // Verstecke Controls, Parents, Config, Context und TypeScript Editor
    if (controlsDiv) controlsDiv.style.display = "none";
    if (parentsDiv) parentsDiv.style.display = "none";
    if (configDiv) configDiv.style.display = "none";
    if (contextDiv) contextDiv.style.display = "none";
    if (tsDiv) tsDiv.style.display = "none";
    
    // Zeige HTML Output falls vorhanden
    if (isHtml && htmlDiv && htmlRender) {
      htmlDiv.style.display = "block";
      htmlRender.innerHTML = result;
    } else if (htmlDiv) {
      htmlDiv.style.display = "none";
    }
  }

  // Nur für SerializedDogs: Monaco Editor verwenden
  if (monacoEditor && isSerializedDog) {
    // RESET: Entferne ALLE vorherigen Type Definitions (auch von anderen Nodes)
    if (activeTypeDefDispose && typeof activeTypeDefDispose === 'function') {
      try {
        activeTypeDefDispose();
      } catch (e) {
        console.warn("Fehler beim Aufrufen von activeTypeDefDispose:", e);
      }
      activeTypeDefDispose = null;
    }
    
    // Entferne alle ExtraLibs die mit "ts:node-" beginnen (von vorherigen Nodes)
    try {
      const extraLibs = monaco.languages.typescript.typescriptDefaults.getExtraLibs();
      if (extraLibs) {
        Object.keys(extraLibs).forEach(uri => {
          if (uri.startsWith("ts:node-")) {
            monaco.languages.typescript.typescriptDefaults.removeExtraLib(uri);
          }
        });
      }
    } catch (e) {
      console.warn("Fehler beim Entfernen von ExtraLibs:", e);
    }
    
    // Lade Code von Node
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
    
    // Setze Code IMMER neu (auch wenn gleich)
    monacoEditor.setValue(wrappedCode);
    monacoEditor.updateOptions({ readOnly: false });
    
    // Füge neue Type Definitions für diese Node hinzu (NACH dem Setzen des Codes)
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
  } else if (monacoEditor && !isSerializedDog) {
    // Für nicht-SerializedDogs: Editor leeren und read-only
    monacoEditor.setValue("// Diese Node kann nicht bearbeitet werden");
    monacoEditor.updateOptions({ readOnly: true });
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

