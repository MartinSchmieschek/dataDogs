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
  
  // Entferne export {} am Ende
  const exportPattern = new RegExp(String.fromCharCode(10) + String.fromCharCode(10) + "export \\{\\};?\\s*$");
  tsCode = tsCode.replace(exportPattern, "");

  try {
    const response = await fetch("/save?id=" + encodeURIComponent(nodeId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nodeId, tsCode })
    });

    if (!response.ok) {
      throw new Error("Save fehlgeschlagen: " + response.status);
    }

    const result = await response.json();
    if (result.ok) {
      alert("Gespeichert!");
    } else {
      throw new Error(result.error || "Unbekannter Fehler");
    }
  } catch (e) {
    console.error("Save error:", e);
    alert("Fehler beim Speichern: " + (e.message || e));
  }
}`;
}

