export function PageLayout() {
  return `
  <style>
    body { margin:0; display:flex; height:100vh; font-family: sans-serif; }
    #left { width:50%; border-right:2px solid #444; position:relative; }
    #right { width:50%; position:relative; }
    #boat { position:absolute; top:10px; left:10px; font-size:14px; white-space:pre; }
    #waves { position:absolute; bottom:0; width:100%; height:150px; overflow:hidden; }
    #nodes svg { position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; }
    .node { position:absolute; width:20px; height:20px; background:#4af; border-radius:50%; z-index:2; }
  </style>
  `;
}
