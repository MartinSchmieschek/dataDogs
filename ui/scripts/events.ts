import { loadMonaco } from './monacoLoader';
import { drawLines } from '../logic/lines';
import { saveNode } from '../logic/save';

export function MainScripts() {
  return `
  <script>
    (${loadMonaco.toString()})(function() {
      const editor = monaco.editor.create(document.getElementById('editor'), {
        value: "// write TS here",
        language: "typescript"
      });

      window.drawDemo = function() {
        const nodes = [
          { x: 100, y: 200, connections: [] },
          { x: 200, y: 100, connections: [] }
        ];
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "lines-svg";
        document.getElementById("nodes").appendChild(svg);
        drawLines(nodes);
      }

      window.saveCurrent = function() {
        saveNode("node1", editor.getValue());
      }

      drawDemo();
    });
  </script>
  `;
}
