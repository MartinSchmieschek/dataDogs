import { FragmentBase } from "./FragmentBase";

export class TextFragment extends FragmentBase {
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  render(): string {
    return `<p id="${this.id}" class="text-fragment">${this.text}</p>`;
  }

  getScript(): string {
    return "";
  }

  getStyle(): string {
    return `
      .text-fragment {
        font-family: sans-serif;
        margin: 0.5rem 0;
      }
    `;
  }
}
