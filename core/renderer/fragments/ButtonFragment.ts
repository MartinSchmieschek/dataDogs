import { FragmentBase } from "./FragmentBase";

export class ButtonFragment extends FragmentBase {

  private label: string;

  constructor(label: string) {
    super();
    this.label = label;
  }

  /**
   * Gibt das HTML für den Button zurück, mit eindeutiger ID und Style-Referenz.
   */
  render(): string {
    return `
      <button id="${this.id}" class="fragment-button">${this.label}</button>
    `;
  }

  /**
   * Optionale Styles speziell für Buttons.
   */
  getStyle(): string {
    return `
      .fragment-button {
        background: #ff7b00;
        border: none;
        border-radius: 1em;
        color: white;
        font-size: 1rem;
        padding: 1em 2em;
        margin: 1em;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .fragment-button:hover {
        background: #ff9e3d;
        transform: scale(1.05);
      }
    `;
  }

  /**
   * Bindet die Action (falls vorhanden) an den Button über EventListener.
   * Der Renderer sorgt später dafür, dass alle collectScript()-Ergebnisse
   * in einem globalen <script> Block landen.
   */
  getScript(): string {
    const baseScript = super.getScript();
    return `
      ${baseScript}
      document.getElementById("${this.id}")?.addEventListener("click", () => {
        const handler = window["action_${this.id}"];
        if (typeof handler === "function") handler();
      });
    `;
  }
}
