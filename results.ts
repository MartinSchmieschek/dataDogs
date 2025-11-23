export type NodeEntry = {
  id: string;
  name: string;
  result: any;
  parentsRequired?: string[];
  parentsOptional?: string[];
};

export type Waves = NodeEntry[][];


export class Results{
   public static buildWavesHtml(waves: Waves): string {
  // Sicher serialisieren, um </script> zu entschärfen
  const safeJson = JSON.stringify(waves).replace(/<\/script>/g, "<\\/script>");

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Waves – Nodes</title>
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />

  <style>
    body {
      margin: 0;
      background: #111;
      font-family: Arial, sans-serif;
      color: #eee;
      overflow-x: hidden;
    }
    .wave-container {
      width: 50%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      padding-bottom: 200px;
    }
    .wave {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin: 40px 0;
    }
    .node {
      background: #222;
      padding: 16px 20px;
      border-radius: 10px;
      text-align: center;
      position: relative;
      min-width: 120px;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(255,255,255,0.15);
      transition: transform .2s ease;
    }
    .node:hover {
      transform: translateY(-6px);
    }
    .node::after {
      content: attr(data-id);
      font-size: 10px;
      opacity: 0.5;
      position: absolute;
      top: -16px;
      left: 50%;
      transform: translateX(-50%);
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    /* JSON viewer */
    #viewer {
      position: fixed;
      right: 0;
      top: 0;
      width: 40vw;
      min-width: 280px;
      height: 100vh;
      background: #181818;
      padding: 20px;
      border-left: 1px solid #333;
      overflow: auto;
    }
    #viewer h2 {
      margin-top: 0;
      font-size: 18px;
    }
    #json {
      white-space: pre;
      font-family: monospace;
      background: #000;
      padding: 10px;
      border-radius: 6px;
      color: #9f9;
      overflow-x: auto;
      max-height: 90vh;
    }

  </style>
</head>

<body>
  <canvas id="lines"></canvas>

  <div id="viewer">
    <h2>JSON Viewer</h2>
    <pre id="json">{}</pre>
  </div>

  <div id="waves" class="wave-container"></div>

  <script>
    // Waves-Daten aus Server
    const waves = ${safeJson};

    const wavesEl = document.getElementById("waves");
    const viewerJson = document.getElementById("json");

    function renderWaves() {
      waves.forEach((wave) => {
        const waveEl = document.createElement("div");
        waveEl.className = "wave";

        wave.forEach(node => {
          const el = document.createElement("div");
          el.className = "node";
          el.dataset.id = node.id;
          el.textContent = node.name;

          // Json speichern
          el._json = node.result;
          el.onclick = () => {
            viewerJson.textContent = JSON.stringify(el._json, null, 2);
          };

          // Parent-Information speichern
          el._parentsRequired = node.parentsRequired || [];
          el._parentsOptional = node.parentsOptional || [];

          waveEl.appendChild(el);
        });

        wavesEl.appendChild(waveEl);
        requestAnimationFrame(() => drawLines());
      });
    }

    function drawLines() {
      const canvas = document.getElementById("lines");
      const ctx = canvas.getContext("2d");

      canvas.width = document.body.clientWidth;
      canvas.height = document.body.scrollHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const nodeElements = Array.from(document.querySelectorAll(".node"));
      const map = new Map();

      // Node-Positionen sammeln
      nodeElements.forEach(el => {
        const r = el.getBoundingClientRect();
        map.set(el.dataset.id, {
          x: r.left + r.width / 2,
          y: r.top + window.scrollY + r.height / 2,
        });
      });

      // Linien zeichnen
      nodeElements.forEach(el => {
        const from = map.get(el.dataset.id);
        if (!from) return;

        // required (rot)
        el._parentsRequired.forEach(pid => {
          const to = map.get(pid);
          if (!to) return;
          ctx.strokeStyle = "#ff4444";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        });

        // optional (blau)
        el._parentsOptional.forEach(pid => {
          const to = map.get(pid);
          if (!to) return;
          ctx.strokeStyle = "#44aaff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        });
      });
    }

    renderWaves();
    window.addEventListener("resize", () => requestAnimationFrame(drawLines));
    window.addEventListener("scroll", () => requestAnimationFrame(drawLines));
  </script>

</body>
</html>
`;
}

}