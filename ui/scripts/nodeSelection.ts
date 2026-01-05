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

  // Prüfe ob SerializedDog (hat _config) oder BaseDog
  const isSerializedDog = !!n._config;
  const possibleBaseDogTypes = ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'];
  const nodeName = n._json?.name || (n.dataset ? n.dataset.id : (n._nodeId || n.id || "unknown"));
  const isBaseDog = !isSerializedDog && possibleBaseDogTypes.includes(nodeName);
  const canDelete = isSerializedDog || isBaseDog;
  
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
  
  // Update result editor (immer sichtbar)
  updateResultEditor(JSON.stringify(n._json, null, 2));
  
  // Zeige/Verstecke SerializedDog-spezifische UI-Elemente
  const controlsDiv = document.getElementById("serialized-dog-controls");
  const baseControlsDiv = document.getElementById("base-dog-controls");
  const versionDiv = document.getElementById("serialized-dog-version");
  const parentsDiv = document.getElementById("serialized-dog-parents");
  const configDiv = document.getElementById("serialized-dog-config");
  const contextDiv = document.getElementById("serialized-dog-context");
  const tsDiv = document.getElementById("serialized-dog-ts");
  const htmlDiv = document.getElementById("html-output");
  const htmlRender = document.getElementById("html-render");
  
  if (isSerializedDog) {
    // Zeige Controls, Parents, Config, Context und TypeScript Editor
    if (controlsDiv) controlsDiv.style.display = "flex";
    if (baseControlsDiv) baseControlsDiv.style.display = "none";
    if (versionDiv) versionDiv.style.display = "block";
    if (parentsDiv) parentsDiv.style.display = "block";
    if (configDiv) configDiv.style.display = "block";
    if (contextDiv) {
      contextDiv.style.display = "block";
      updateContextEditor(JSON.stringify(n._ctx, null, 2));
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
    if (n._config) {
      updateConfigEditor(JSON.stringify(n._config, null, 2));
    }
    
    // Versionsauswahl aktualisieren
    updateVersionSelection(n);
    
    // Parents-Auswahl aktualisieren
    updateParentsSelection(n);
  } else if (isBaseDog) {
    // Für BaseDogs: Zeige BaseDog-Controls, verstecke SerializedDog-spezifische Controls
    if (controlsDiv) controlsDiv.style.display = "none";
    if (baseControlsDiv) baseControlsDiv.style.display = "flex";
    if (versionDiv) versionDiv.style.display = "none";
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
  } else {
    // Verstecke Controls, Parents, Config, Context und TypeScript Editor
    if (controlsDiv) controlsDiv.style.display = "none";
    if (baseControlsDiv) baseControlsDiv.style.display = "none";
    if (versionDiv) versionDiv.style.display = "none";
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

// Helper-Funktionen für Monaco Editor
function updateResultEditor(jsonString) {
  const editorEl = document.getElementById("result-editor");
  if (!editorEl) return;
  
  if (!resultEditor && typeof monaco !== 'undefined' && monaco && monaco.editor) {
    resultEditor = monaco.editor.create(editorEl, {
      value: jsonString,
      language: "json",
      theme: "vs-dark",
      automaticLayout: true,
      readOnly: true
    });
  } else if (resultEditor) {
    resultEditor.setValue(jsonString);
  }
}

function updateContextEditor(jsonString) {
  const editorEl = document.getElementById("context-editor");
  if (!editorEl) return;
  
  if (!contextEditor && typeof monaco !== 'undefined' && monaco && monaco.editor) {
    contextEditor = monaco.editor.create(editorEl, {
      value: jsonString,
      language: "json",
      theme: "vs-dark",
      automaticLayout: true,
      readOnly: true
    });
  } else if (contextEditor) {
    contextEditor.setValue(jsonString);
  }
}

function updateConfigEditor(jsonString) {
  const editorEl = document.getElementById("config-editor");
  if (!editorEl) return;
  
  if (!configEditor && typeof monaco !== 'undefined' && monaco && monaco.editor) {
    configEditor = monaco.editor.create(editorEl, {
      value: jsonString,
      language: "json",
      theme: "vs-dark",
      automaticLayout: true,
      readOnly: true
    });
  } else if (configEditor) {
    configEditor.setValue(jsonString);
  }
}

async function updateVersionSelection(selectedNode) {
  const versionSelect = document.getElementById("version-select");
  const versionInfo = document.getElementById("version-info");
  
  if (!versionSelect || !versionInfo) return;
  
  const nodeId = selectedNode._nodeId || (selectedNode.dataset ? selectedNode.dataset.id : null);
  if (!nodeId) {
    versionSelect.innerHTML = '<option value="">Keine Node-ID gefunden</option>';
    versionInfo.textContent = "Keine Node-ID gefunden";
    return;
  }
  
  // Extrahiere Basis-ID
  const baseId = nodeId.replace(/-v\\d+$/, '');
  
  // Lade KennelConfig um aktuelle Version zu finden
  let currentKennelConfig = null;
  try {
    const kennelConfigScript = document.getElementById('kennel-config-data');
    if (kennelConfigScript && kennelConfigScript.textContent) {
      currentKennelConfig = JSON.parse(kennelConfigScript.textContent);
    }
  } catch (e) {
    console.warn('[updateVersionSelection] Fehler beim Laden der KennelConfig:', e);
  }
  
  // Finde aktuelle Version in KennelConfig
  const dogIds = currentKennelConfig?.dogIds || [];
  let selectedVersionId = null;
  let isBaseIdBinding = false;
  
  // Suche nach der Version in der KennelConfig
  for (const id of dogIds) {
    const idBaseId = id.replace(/-v\\d+$/, '');
    if (idBaseId === baseId) {
      if (id === baseId || !id.match(/-v\\d+$/)) {
        // Basis-ID ohne Version = neueste Version
        isBaseIdBinding = true;
        selectedVersionId = baseId;
      } else {
        // Spezifische Version
        selectedVersionId = id;
      }
      break; // Nimm die erste gefundene Version
    }
  }
  
  console.log('[updateVersionSelection] Node-ID:', nodeId);
  console.log('[updateVersionSelection] Basis-ID:', baseId);
  console.log('[updateVersionSelection] KennelConfig dogIds:', dogIds);
  console.log('[updateVersionSelection] Gefundene Version in Config:', selectedVersionId);
  console.log('[updateVersionSelection] Ist Basis-ID Binding:', isBaseIdBinding);
  
  // Lade verfügbare Versionen
  try {
    const response = await fetch('/api/nodes');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    
    const result = await response.json();
    if (result.ok && result.data) {
      // Filtere BaseDogs raus (haben type: 'BaseDog' oder id.startsWith('base:'))
      const serializedDogs = result.data.filter(dog => {
        return !dog.type || dog.type !== 'BaseDog';
      });
      
      // Filtere alle Versionen dieser Basis-ID
      const versions = serializedDogs.filter(dog => {
        if (!dog.id) return false;
        const dogBaseId = dog.id.replace(/-v\\d+$/, '');
        return dogBaseId === baseId;
      });
      
      // Sortiere nach Version (neueste zuerst)
      versions.sort((a, b) => (b.version || 0) - (a.version || 0));
      
      console.log('[updateVersionSelection] Verfügbare Versionen:', versions.map(v => v.id));
      
      // Erstelle Optionen
      versionSelect.innerHTML = '';
      
      // Option 1: Basis-ID (neueste Version, keine Versionsbindung)
      const baseOption = document.createElement('option');
      baseOption.value = baseId;
      baseOption.textContent = \`\${baseId} (neueste Version - keine Versionsbindung)\`;
      versionSelect.appendChild(baseOption);
      
      // Option 2: Alle spezifischen Versionen
      versions.forEach(dog => {
        const option = document.createElement('option');
        option.value = dog.id;
        option.textContent = \`\${dog.id} (v\${dog.version || '?'})\`;
        versionSelect.appendChild(option);
      });
      
      // Aktualisiere Info-Text
      if (isBaseIdBinding) {
        const latestVersion = versions[0];
        versionInfo.textContent = \`Aktuell: Basis-ID (neueste Version: v\${latestVersion?.version || '?'})\`;
      } else if (selectedVersionId) {
        const currentVersion = versions.find(v => v.id === selectedVersionId);
        versionInfo.textContent = \`Aktuell: \${selectedVersionId} (v\${currentVersion?.version || '?'})\`;
      } else {
        versionInfo.textContent = "Nicht in KennelConfig gefunden";
      }
    } else {
      throw new Error(result.error || 'Fehler beim Laden');
    }
  } catch (err) {
    console.error('[updateVersionSelection] Fehler:', err);
    versionSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
    versionInfo.textContent = "Fehler beim Laden der Versionen";
  }
  
  // Event-Handler für automatischen Version-Wechsel nach Auswahl
  // Entferne alte Handler
  const newSelect = versionSelect.cloneNode(true);
  versionSelect.parentNode.replaceChild(newSelect, versionSelect);
  
  // WICHTIG: Wähle die Version aus, die in der KennelConfig steht - NACH cloneNode!
  if (selectedVersionId) {
    console.log('[updateVersionSelection] Versuche Version auszuwählen:', selectedVersionId);
    const optionToSelect = Array.from(newSelect.options).find(opt => opt.value === selectedVersionId);
    if (optionToSelect) {
      optionToSelect.selected = true;
      newSelect.value = selectedVersionId; // Setze auch direkt den value
      console.log('[updateVersionSelection] Version ausgewählt:', selectedVersionId);
    } else {
      console.warn('[updateVersionSelection] Version nicht im Dropdown gefunden:', selectedVersionId, 'Verfügbare Optionen:', Array.from(newSelect.options).map(o => o.value));
    }
  }
  
  newSelect.addEventListener('change', async () => {
    const selectedVersionId = newSelect.value;
    if (!selectedVersionId) {
      return;
    }
    
    await updateVersionInKennelConfig(baseId, selectedVersionId);
  });
}

async function updateVersionInKennelConfig(baseId, newVersionId) {
  try {
    // Lade KennelConfig
    let kennelConfig = null;
    let kennelId = null;
    
    try {
      const kennelConfigScript = document.getElementById('kennel-config-data');
      if (kennelConfigScript && kennelConfigScript.textContent) {
        kennelConfig = JSON.parse(kennelConfigScript.textContent);
        kennelId = kennelConfig?.id || null;
      }
    } catch (e) {
      console.warn('[updateVersionInKennelConfig] Fehler beim Laden der KennelConfig:', e);
    }
    
    // Fallback: Versuche Kennel-ID aus URL zu extrahieren
    if (!kennelId) {
      const pathParts = window.location.pathname.split('/').filter(p => p);
      if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'kennel') {
        kennelId = pathParts[0];
      }
    }
    
    if (!kennelId) {
      alert('KennelConfig nicht gefunden');
      return;
    }
    
    // Lade KennelConfig falls nicht eingebettet
    if (!kennelConfig || kennelConfig.id !== kennelId) {
      const getResponse = await fetch(\`/api/kennels/\${kennelId}\`);
      if (!getResponse.ok) throw new Error('HTTP ' + getResponse.status);
      
      const getResult = await getResponse.json();
      if (!getResult.ok || !getResult.data) {
        throw new Error(getResult.error || 'KennelConfig nicht gefunden');
      }
      
      kennelConfig = getResult.data;
    }
    
    let dogIds = kennelConfig.dogIds || [];
    
    // Entferne alle Versionen dieser Basis-ID
    dogIds = dogIds.filter(id => {
      const idBaseId = id.replace(/-v\\d+$/, '');
      return idBaseId !== baseId;
    });
    
    // Füge neue Version hinzu
    dogIds.push(newVersionId);
    
    // Extrahiere Basis-ID (ohne Version) für Versionsverwaltung
    const kennelBaseId = kennelConfig.id ? kennelConfig.id.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
    
    // Speichere aktualisierte KennelConfig
    const updateData = {
      id: kennelBaseId,
      name: kennelConfig.name,
      description: kennelConfig.description,
      dogIds: dogIds,
    };
    
    const putResponse = await fetch(\`/api/kennels/\${kennelBaseId}\`, {
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
      const finalBaseId = savedId ? savedId.replace(/-v\\d+$/, '') : kennelId.replace(/-v\\d+$/, '');
      
      alert('Version aktualisiert!');
      
      // Lade neueste Version der KennelConfig und lade Seite neu
      window.location.href = \`/\${finalBaseId}\`;
    } else {
      throw new Error(putResult.error || 'Fehler beim Speichern');
    }
  } catch (err) {
    console.error('[updateVersionInKennelConfig] Fehler:', err);
    alert('Fehler: ' + err.message);
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

