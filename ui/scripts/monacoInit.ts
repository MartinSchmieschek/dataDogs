export function buildMonacoInit(): string {
  // @ts-ignore - JavaScript code as string
  return `// Initialisiere Monaco Editor (nur einmal)
(function initMonacoOnce() {
  // Prüfe ob bereits initialisiert
  if (window.monacoEditorInitialized === true || monacoEditor !== null) {
    return;
  }
  
  // Prüfe ob Monaco bereits global verfügbar ist
  if (typeof monaco !== 'undefined' && monaco && monaco.editor) {
    window.monacoEditorInitialized = true;
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2022,
      module: monaco.languages.typescript.ModuleKind.ES2022,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
    });

    const editorEl = document.getElementById("ts-editor");
    if (editorEl && !monacoEditor) {
      monacoEditor = monaco.editor.create(editorEl, {
        value:"// Select a node",
        language:"typescript",
        theme:"vs-dark",
        automaticLayout:true,
      });
    }
    return;
  }
  
  // Prüfe ob require verfügbar ist
  if (typeof require === 'undefined' || typeof require.config !== 'function') {
    // Warte bis require verfügbar ist
    setTimeout(initMonacoOnce, 50);
    return;
  }
  
  // Prüfe ob bereits am Laden (verhindert parallele Ladeversuche)
  if (window.monacoLoading === true) {
    return;
  }
  
  // Setze Loading-Flag BEVOR irgendetwas gemacht wird
  window.monacoLoading = true;
  
  // Konfiguriere require
  try {
    require.config({ paths:{ vs:"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs" } });
  } catch (e) {
    window.monacoLoading = false;
    return;
  }

  // Prüfe ob Modul bereits geladen ist (AMD-spezifisch)
  if (typeof require.cache !== 'undefined' && require.cache["vs/editor/editor.main"]) {
    window.monacoLoading = false;
    window.monacoEditorInitialized = true;
    if (typeof monaco !== 'undefined' && monaco && monaco.editor) {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2022,
        module: monaco.languages.typescript.ModuleKind.ES2022,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
      });
      const editorEl = document.getElementById("ts-editor");
      if (editorEl && !monacoEditor) {
        monacoEditor = monaco.editor.create(editorEl, {
          value:"// Select a node",
          language:"typescript",
          theme:"vs-dark",
          automaticLayout:true,
        });
      }
    }
    return;
  }

  // Lade Monaco
  require(["vs/editor/editor.main"], ()=>{
    window.monacoLoading = false;
    window.monacoEditorInitialized = true;
    
    if (typeof monaco === 'undefined' || !monaco || !monaco.editor) {
      return;
    }
    
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2022,
      module: monaco.languages.typescript.ModuleKind.ES2022,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
    });

    const editorEl = document.getElementById("ts-editor");
    if (editorEl && !monacoEditor) {
      monacoEditor = monaco.editor.create(editorEl, {
        value:"// Select a node",
        language:"typescript",
        theme:"vs-dark",
        automaticLayout:true,
      });
    }
  });
})();

// Initialisiere Flags
if (typeof window.monacoEditorInitialized === 'undefined') {
  window.monacoEditorInitialized = false;
}
if (typeof window.monacoLoading === 'undefined') {
  window.monacoLoading = false;
}`;
}

