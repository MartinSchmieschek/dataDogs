export function buildNodeSelection(): string {
  // @ts-ignore - JavaScript code as string
  return `function selectNode(n) {
  // Entferne vorherige Selektion (nur für DOM-Elemente)
  document.querySelectorAll(".node").forEach(el => {
    if (el && el.classList) {
      el.classList.remove("selected");
    }
  });
  
  // Füge Selektion hinzu (nur wenn n ein DOM-Element ist)
  if (n && n.classList && typeof n.classList.add === 'function') {
    n.classList.add("selected");
  }
  
  selectedNodeElement = n;

  // Prüfe ob SerializedDog (hat _config)
  const isSerializedDog = !!n._config;
  
  // Prüfe ob Output HTML ist
  const result = n._json;
  const isHtml = typeof result === 'string' && result.trim() && (
    result.trim().startsWith('<html') || 
    result.trim().startsWith('<!DOCTYPE') ||
    (result.trim().startsWith('<') && result.includes('</'))
  );

  // --- Viewer aktualisieren ---
  const nodeId = n.dataset ? n.dataset.id : (n._nodeId || n.id || "unknown");
  viewerMeta.textContent = "ID: " + nodeId;
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

  // Öffne Side Panel
  const sidePanel = document.getElementById("side-panel");
  if (sidePanel) {
    sidePanel.classList.add("side-panel-open");
  }
  
  // Nur für SerializedDogs: Monaco Editor verwenden
  if (isSerializedDog) {
    // Zerstöre alten Editor
    if (monacoEditor) {
      try {
        monacoEditor.dispose();
      } catch (e) {
        console.warn("Fehler beim Zerstören des Editors:", e);
      }
      monacoEditor = null;
    }
    
    // Entferne alle vorherigen ExtraLib dispose-Funktionen
    if (typeof extraLibDisposes !== 'undefined' && Array.isArray(extraLibDisposes)) {
      extraLibDisposes.forEach(dispose => {
        if (dispose && typeof dispose === 'function') {
          try {
            dispose();
          } catch (e) {
            // Ignoriere Fehler
          }
        }
      });
      extraLibDisposes = [];
    }
    
    // Entferne alte Type Definitions
    if (activeTypeDefDispose && typeof activeTypeDefDispose === 'function') {
      try {
        activeTypeDefDispose();
      } catch (e) {
        // Ignoriere Fehler
      }
      activeTypeDefDispose = null;
    }
    
    // Erstelle neuen Editor
    if (typeof monaco !== 'undefined' && monaco && monaco.editor) {
      const editorEl = document.getElementById("ts-editor");
      if (editorEl) {
        // Lade Code von Node - bevorzuge _config.theRun falls verfügbar
        let code = (n._config && n._config.theRun) ? n._config.theRun : (n._ts || "// no code");
        
        // Entferne alle vorhandenen Wrapper
        function removeWrappers(code) {
          const trimmed = code.trim();
          if (!trimmed.startsWith("async function run() {")) {
            return trimmed;
          }
          let depth = 0;
          let startPos = trimmed.indexOf("{");
          if (startPos === -1) return trimmed;
          for (let i = startPos; i < trimmed.length; i++) {
            if (trimmed[i] === "{") depth++;
            if (trimmed[i] === "}") {
              depth--;
              if (depth === 0) {
                const inner = trimmed.substring(startPos + 1, i).trim();
                return removeWrappers(inner);
              }
            }
          }
          return trimmed;
        }
        
        code = removeWrappers(code);
        const newline = String.fromCharCode(10);
        const wrappedCode = "async function run() {" + newline + code + newline + "}";
        
        // Erstelle neuen Editor
        monacoEditor = monaco.editor.create(editorEl, {
          value: wrappedCode,
          language: "typescript",
          theme: "vs-dark",
          automaticLayout: true,
        });
        
        // Füge Type Definitions hinzu
        const nodeIdForTypes = n.dataset ? n.dataset.id : (n._nodeId || n.id || "unknown");
        if (n._ctxTypeDef) {
          const dispose = monaco.languages.typescript.typescriptDefaults.addExtraLib(
            n._ctxTypeDef, 
            "ts:node-" + nodeIdForTypes + "-context.d.ts"
          );
          if (dispose && typeof dispose === 'function') {
            if (typeof extraLibDisposes === 'undefined') {
              extraLibDisposes = [];
            }
            extraLibDisposes.push(dispose);
            activeTypeDefDispose = dispose;
          }
        } else if (n._ctx) {
          const dispose = monaco.languages.typescript.typescriptDefaults.addExtraLib(
            JSON.stringify(n._ctx, null, 2), 
            "ts:node-" + nodeIdForTypes + "-context.d.ts"
          );
          if (dispose && typeof dispose === 'function') {
            if (typeof extraLibDisposes === 'undefined') {
              extraLibDisposes = [];
            }
            extraLibDisposes.push(dispose);
            activeTypeDefDispose = dispose;
          }
        }
      }
    }
  } else {
    // Für nicht-SerializedDogs: Zerstöre Editor
    if (monacoEditor) {
      try {
        monacoEditor.dispose();
      } catch (e) {
        console.warn("Fehler beim Zerstören des Editors:", e);
      }
      monacoEditor = null;
    }
  }
}

function updateParentsSelection(selectedNode) {
  // Sammle alle verfügbaren Nodes aus nodeDataMap (vis.js) oder DOM
  let allNodesData = [];
  const currentNodeId = selectedNode._nodeId || (selectedNode.dataset ? selectedNode.dataset.id : null);
  
  // Versuche nodeDataMap zu verwenden (vis.js)
  if (typeof window !== 'undefined' && window.nodeDataMap && window.nodeDataMap instanceof Map) {
    window.nodeDataMap.forEach((nodeData, nodeId) => {
      allNodesData.push({
        id: nodeId,
        name: nodeData.name || nodeId
      });
    });
  } else {
    // Fallback: DOM-Elemente
    const allNodes = Array.from(document.querySelectorAll(".node"));
    allNodes.forEach(node => {
      const nodeId = node._nodeId || (node.dataset ? node.dataset.id : null);
      if (nodeId) {
        allNodesData.push({
          id: nodeId,
          name: node.textContent || nodeId
        });
      }
    });
  }
  
  // Nutze Config falls verfügbar, sonst fallback auf _req/_opt
  const config = selectedNode._config || {};
  const currentRequired = config.parentsRequired || selectedNode._req || [];
  const currentOptional = config.parentsOptional || selectedNode._opt || [];
  
  // Erstelle Required-Parents Liste
  const requiredContainer = document.getElementById("parents-required");
  if (requiredContainer) {
    requiredContainer.innerHTML = "";
    allNodesData.forEach(nodeData => {
      if (nodeData.id === currentNodeId) return; // Überspringe aktuelle Node
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = nodeData.id;
      checkbox.checked = currentRequired.includes(nodeData.id);
      checkbox.id = "req-" + nodeData.id;
      
      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = nodeData.name || nodeData.id;
      label.style.display = "block";
      label.style.marginBottom = "5px";
      label.style.cursor = "pointer";
      
      label.insertBefore(checkbox, label.firstChild);
      requiredContainer.appendChild(label);
    });
  }
  
  // Erstelle Optional-Parents Liste
  const optionalContainer = document.getElementById("parents-optional");
  if (optionalContainer) {
    optionalContainer.innerHTML = "";
    allNodesData.forEach(nodeData => {
      if (nodeData.id === currentNodeId) return; // Überspringe aktuelle Node
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = nodeData.id;
      checkbox.checked = currentOptional.includes(nodeData.id);
      checkbox.id = "opt-" + nodeData.id;
      
      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = nodeData.name || nodeData.id;
      label.style.display = "block";
      label.style.marginBottom = "5px";
      label.style.cursor = "pointer";
      
      label.insertBefore(checkbox, label.firstChild);
      optionalContainer.appendChild(label);
    });
  }
}`;
}

