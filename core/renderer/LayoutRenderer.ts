import { FragmentRenderer } from "./FragmentRenderer";
import { DogFragmentRenderer } from "./DogFragmentRenderer";
import { VideoFragmentRenderer } from "./VideoFragmentRenderer";
import { ButtonsFragmentRenderer } from "./ButtonsFragmentRenderer";

export interface LayoutZone {
  id: string;
  fragment: string;
  style: Record<string, string>;
  value?: any;
}

export interface LayoutDefinition {
  name: string;
  zones: LayoutZone[];
}

export class LayoutRenderer {
  private layout: LayoutDefinition;
  private actions: Record<string, (id: string) => void>;
  private fragmentMap: Record<string, FragmentRenderer<any>>;

  constructor(layout: LayoutDefinition, actions: Record<string, (id: string) => void>) {
    this.layout = layout;
    this.actions = actions;

    // Fragment-Typen registrieren
    this.fragmentMap = {
      dog: new DogFragmentRenderer(),
      video: new VideoFragmentRenderer(),
      buttons: new ButtonsFragmentRenderer(),
    };
  }

  private renderZone(zone: LayoutZone): string {
    const renderer = this.fragmentMap[zone.fragment];
    if (!renderer) return `<div>❌ Unknown fragment: ${zone.fragment}</div>`;

    const style = Object.entries(zone.style)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");

    return `
      <div id="${zone.id}" class="zone" style="${style}">
        ${renderer.render(zone.value)}
      </div>
    `;
  }

  renderDocument(): string {
    const zonesHtml = this.layout.zones.map(z => this.renderZone(z)).join("\n");

    const style = `
      <style>
        body {
          margin: 0;
          background: #fafafa;
          font-family: system-ui, sans-serif;
          overflow: hidden;
        }
      </style>
    `;

    const script = `
      <script>
        const actions = ${JSON.stringify(Object.keys(this.actions))};
        document.querySelectorAll("[data-action]").forEach(btn => {
          btn.addEventListener("click", e => {
            const act = e.currentTarget.getAttribute("data-action");
            console.log("Action triggered:", act);
            location.reload();
          });
        });
      </script>
    `;

    return `
      <html>
        <head>${style}</head>
        <body>
          ${zonesHtml}
          ${script}
        </body>
      </html>
    `;
  }
}
