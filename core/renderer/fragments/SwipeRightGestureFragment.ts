import { FragmentBase } from "./FragmentBase";


export class SwipeRightGestureFragment extends FragmentBase {
  render(): string {
    // Kein sichtbares HTML
    return "";
  }

  getStyle(): string {
    return "";
  }

  getScript(): string {
    const base = super.getScript();
    const actionVar = `action_${this.id}`;
    return `
      ${base}
      (() => {
        let touchStartX = 0;
        let touchEndX = 0;

        // --- Touch Gesten erkennen ---
        document.addEventListener("touchstart", e => {
          touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener("touchend", e => {
          touchEndX = e.changedTouches[0].screenX;
          handleSwipe();
        });

        // --- Pfeiltaste als Alternative ---
        document.addEventListener("keydown", e => {
          if (e.key === "ArrowRight") {
            const fn = window["${actionVar}"];
            if (typeof fn === "function") fn(${this.action});
          }
        });

        function handleSwipe() {
          if (touchEndX > touchStartX + 75) { // Mindestbewegung für Swipe
            const fn = window["${actionVar}"];
            if (typeof fn === "function") fn(${this.action});
          }
        }
      })();
    `;
  }
}
