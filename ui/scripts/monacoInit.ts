export function buildMonacoInit(): string {
  // @ts-ignore - JavaScript code as string
  return `require.config({ paths:{ vs:"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs" } });

require(["vs/editor/editor.main"], ()=>{
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ES2022,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
  });

  monacoEditor = monaco.editor.create(
    document.getElementById("ts-editor"),
    {
      value:"// Select a node",
      language:"typescript",
      theme:"vs-dark",
      automaticLayout:true,
    }
  );
});`;
}

