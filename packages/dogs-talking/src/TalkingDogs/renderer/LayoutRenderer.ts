import { LayoutBase } from "./layouts/LayoutBase";

/** Gemeinsame Basis-Styles: kein horizontales Scrollen, Inhalt an Viewport/Iframe-Breite gebunden. */
const LAYOUT_BASE_CSS = `
  html {
    height: 100%;
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0.5rem;
    min-height: 100%;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: system-ui, sans-serif;
  }
  .layout-root {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0 auto;
  }
  img, video, picture, svg, canvas, iframe {
    max-width: 100%;
    height: auto;
  }
`;

export class LayoutRenderer {
  render(layout: LayoutBase<any>): string {
    const html = layout.renderHtml();
    const styles = layout.collectStyles();
    const scripts = layout.collectScripts();

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>${LAYOUT_BASE_CSS}</style>
          <style>${styles}</style>
        </head>
        <body>
          <div class="layout-root">
          ${html}
          </div>
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
