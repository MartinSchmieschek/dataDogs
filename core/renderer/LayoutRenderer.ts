import { LayoutBase } from "./layouts/LayoutBase";


export class LayoutRenderer {
  render(layout: LayoutBase<any>): string {
    const html = layout.renderHtml();
    const styles = layout.collectStyles();
    const scripts = layout.collectScripts();

    return `
      <html>
        <head>
          <style>${styles}</style>
        </head>
        <body>
          ${html}
          <script>
            ${scripts}

            // Simulation für Gesten mit Keyboard:
            document.addEventListener('keydown', (e) => {
              if (e.key === 'ArrowLeft') window.dispatchEvent(new Event('swipeLeft'));
              if (e.key === 'ArrowRight') window.dispatchEvent(new Event('swipeRight'));
            });
          </script>
        </body>
      </html>
    `;
  }
}
