// BaseFragment.ts
export abstract class FragmentBase {
  readonly id: string;
  action?: () => void;

  constructor() {
    // Jede Fragment-Instanz erhält eine eindeutige ID, um Action-Kollisionen zu verhindern
    this.id = crypto.randomUUID();
  }

  /**
   * Rendert das sichtbare HTML des Fragments.
   * Falls das Fragment unsichtbar ist (z. B. eine Geste), gibt es einfach einen leeren String zurück.
   */
  abstract render(): string;

  /**
   * Gibt styles zurück, die dieses Fragment benötigt.
   * Optional überschreibbar.
   */
  abstract getStyle(): string;

  /**
   * Gibt JavaScript zurück, das benötigt wird, um die Action auszuführen.
   * Hier wird automatisch der globale Handler `window["action_<id>"]` erzeugt.
   */
  getScript(): string {
    if (!this.action) return "";

    const actionName = `action_${this.id}`;
    return `
      window["${actionName}"] = ${this.action.toString()};
    `;
  }
}
