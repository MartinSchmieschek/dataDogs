export function buildNodeCrud(): string {
  // @ts-ignore - JavaScript code as string
  return `async function createNode() {
  const baseId = prompt("Basis-ID für neue Node (z.B. 'my-node'):");
  if (!baseId) return;
  
  const defaultCode = "// Neue Node\\nconst result = {};\\nreturn result;";
  
  try {
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        baseId: baseId,
        tsCode: defaultCode,
        parentsRequired: [],
        parentsOptional: []
      })
    });

    if (!response.ok) {
      throw new Error("Create fehlgeschlagen: " + response.status);
    }

    const result = await response.json();
    if (result.ok) {
      alert("Node erstellt!");
      location.reload(); // Seite neu laden um neue Node zu sehen
    } else {
      throw new Error(result.error || "Unbekannter Fehler");
    }
  } catch (e) {
    console.error("Create error:", e);
    alert("Fehler beim Erstellen");
  }
}

async function deleteNode() {
  const activeNode = document.querySelector(".node.selected");
  if (!activeNode) {
    alert("Keine Node ausgewählt");
    return;
  }

  const nodeId = activeNode._nodeId || activeNode.dataset.id;
  if (!nodeId) {
    alert("Node-ID nicht gefunden");
    return;
  }

  if (!confirm("Node wirklich löschen?")) {
    return;
  }

  try {
    const response = await fetch("/api/nodes/" + encodeURIComponent(nodeId), {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Delete fehlgeschlagen: " + response.status);
    }

    const result = await response.json();
    if (result.ok) {
      alert("Node gelöscht!");
      location.reload(); // Seite neu laden
    } else {
      throw new Error(result.error || "Unbekannter Fehler");
    }
  } catch (e) {
    console.error("Delete error:", e);
    alert("Fehler beim Löschen");
  }
}`;
}

