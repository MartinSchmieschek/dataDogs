export function buildLinesDrawer(): string {
  // @ts-ignore - JavaScript code as string
  return `function drawLines(){
  const canvas=document.getElementById("lines");
  const ctx=canvas.getContext("2d");

  canvas.width=document.body.clientWidth;
  canvas.height=document.body.scrollHeight;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const nodes=[...document.querySelectorAll(".node")];
  const rectMap=new Map();

  nodes.forEach(el=>{
    const r=el.getBoundingClientRect();
    rectMap.set(el.dataset.id, {
      x:r.left+r.width/2,
      y:r.top + window.scrollY + r.height/2
    });
  });

  nodes.forEach(el=>{
    const from=rectMap.get(el.dataset.id);
    if (!from) return;

    el._req.forEach(id=>{
      const to = rectMap.get(id);
      if (!to) return;
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });

    el._opt.forEach(id=>{
      const to = rectMap.get(id);
      if (!to) return;
      ctx.strokeStyle = "#44aaff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  });

  requestAnimationFrame(drawLines);
}`;
}

