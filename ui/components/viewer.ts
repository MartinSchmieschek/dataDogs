// ./results/components/viewer.ts
export function buildViewer(): string {
  return `
<h3>Context (VM)</h3>
<div id="contextList"></div>

<h3>Editor</h3>
<div class="tabs"><button id="tabJson" class="tab active">JSON</button><button id="tabTs" class="tab">TypeScript</button></div>

<div id="jsonEditorWrap"><textarea id="jsonEditor"></textarea></div>
<div id="monacoEditor" style="display:none"></div>

<div class="editor-actions">
  <button id="saveLocal" class="btn">Save (Download)</button>
  <button id="saveServer" class="btn">Save (POST /save)</button>
</div>

<div class="infoSmall">Wähle links eine Node, um JSON/TS zu laden. Änderungen lokal speichern oder an /save posten.</div>
`;
}
