export function buildSaveHandler(): string {
  // @ts-ignore - JavaScript code as string
  return `async function saveNode() {
  if (!monacoEditor) {
    alert("Editor nicht initialisiert");
    return;
  }

  const activeNode = document.querySelector(".node.selected");
  if (!activeNode) {
    alert("Keine Node ausgewählt");
    return;
  }

  const nodeId = activeNode._nodeId || activeNode.dataset.id;
  let tsCode = monacoEditor.getValue();
  
  // Entferne alle verschachtelten async function run() { ... } Wrapper rekursiv
  // Pattern matcht von Anfang bis Ende, mit verschachtelten geschweiften Klammern
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
  
  tsCode = removeWrappers(tsCode);

  // Sammle ausgewählte Parents
  const parentsRequired = [];
  const parentsOptional = [];
  
  const requiredCheckboxes = document.querySelectorAll("#parents-required input[type='checkbox']:checked");
  requiredCheckboxes.forEach(cb => {
    if (cb.value && cb.value !== nodeId) {
      parentsRequired.push(cb.value);
    }
  });
  
  const optionalCheckboxes = document.querySelectorAll("#parents-optional input[type='checkbox']:checked");
  optionalCheckboxes.forEach(cb => {
    if (cb.value && cb.value !== nodeId) {
      parentsOptional.push(cb.value);
    }
  });

  // Lade aktuelle Config falls vorhanden
  const currentConfig = activeNode._config || null;
  const configToSave = currentConfig ? {
    ...currentConfig,
    theRun: tsCode,
    parentsRequired: parentsRequired,
    parentsOptional: parentsOptional
  } : null;

  try {
    const response = await fetch("/save?id=" + encodeURIComponent(nodeId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: nodeId, 
        tsCode,
        parentsRequired,
        parentsOptional,
        serializedDogConfig: configToSave
      })
    });

    if (!response.ok) {
      throw new Error("Save fehlgeschlagen: " + response.status);
    }

    const result = await response.json();
    if (result.ok) {
      alert("Gespeichert!");
      location.reload(); // Seite neu laden um Änderungen zu sehen
    } else {
      throw new Error(result.error || "Unbekannter Fehler");
    }
  } catch (e) {
    console.error("Save error:", e);
    alert("Fehler beim Speichern");
  }
}`;
}

