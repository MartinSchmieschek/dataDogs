// ./results/layout/head.ts
export function buildHead(): string {
  // Monaco loader will be requested client-side via AMD (require)
  // We include no heavy inline scripts here to keep head minimal.
  return `
<!-- Monaco (AMD loader will be initialized in client script) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs/loader.min.js"></script>
`;
}
