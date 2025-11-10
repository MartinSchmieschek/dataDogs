import { FragmentRenderer } from "./FragmentRenderer";

export class ButtonsFragmentRenderer extends FragmentRenderer<void> {
  render(): string {
    return `
        <button class="btn like" data-action="like">❤️</button>
        <button class="btn dislike" data-action="dislike">💔</button>
    `;
  }
}
