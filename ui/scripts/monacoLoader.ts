export function loadMonaco(cb) {
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js";
  s.onload = () => {
    // @ts-ignore
    require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" }});
    // @ts-ignore
    require(["vs/editor/editor.main"], () => cb());
  };
  document.body.appendChild(s);
}
