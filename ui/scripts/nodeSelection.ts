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

  if (monacoEditor) {
    const code = n._ts || "// no code";
    // Setze Code + export {} um Modul zu markieren (erlaubt top-level await)
    const newline = String.fromCharCode(10);
    const codeWithExport = code + newline + newline + "export {};";
    monacoEditor.setValue(codeWithExport);
    
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
}`;
}

