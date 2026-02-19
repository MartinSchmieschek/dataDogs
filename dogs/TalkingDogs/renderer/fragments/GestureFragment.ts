import { FragmentBase } from "./FragmentBase";

// GestureFragment.ts
export class GestureFragment extends FragmentBase {

  constructor(public gestureName: string) {
    super();
  }

  render(): string {
    // Gesten haben kein sichtbares HTML
    return "";
  }

  getStyle(): string {
    // Keine Styles nötig
    return "";
  }

  getScript(): string {
    const actionName = `action_${this.id}`;
    return `
      window["${actionName}"] = window["${actionName}"] || function(){};
      window.addEventListener("${this.gestureName}", () => {
        if (typeof window["${actionName}"] === "function") {
          window["${actionName}"]();
        }
      });
    `;
  }
}
