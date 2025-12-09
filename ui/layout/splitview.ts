export function SplitView(boat: string, waves: string, editor: string, nodes: string) {
  return `
    <div id="left">
      ${editor}
    </div>
    <div id="right">
      <div id="boat">${boat}</div>
      <div id="waves">${waves}</div>
      ${nodes}
    </div>
  `;
}
