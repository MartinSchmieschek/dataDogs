export function drawLines(nodes) {
  const svg = document.getElementById("lines-svg");
  if (!svg) return;
  svg.innerHTML = "";
  nodes.forEach(a => {
    a.connections.forEach(b => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute("stroke", "#08f");
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
    });
  });
}
