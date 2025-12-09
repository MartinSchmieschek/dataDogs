// ./results/layout/layout.ts
// build the main layout (left pane + placeholder for viewer)
export function buildLayout(): string {
  return `
<div class="layout-root">
  <div class="left-pane">
    <svg id="svgConnections"></svg>
    <div id="wavesContainer"></div>
  </div>

  <aside class="panel" id="panel">
    <!--VIEWER_PLACEHOLDER-->
  </aside>
</div>
`;
}
