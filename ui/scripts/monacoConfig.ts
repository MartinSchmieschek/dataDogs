export function configureMonaco() {
  return `
  // Konfiguriere TypeScript für top-level await
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ES2022,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
  });
  `;
}


