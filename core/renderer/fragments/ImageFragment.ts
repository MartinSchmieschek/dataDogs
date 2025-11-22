import { FragmentBase } from "./FragmentBase";

export class ImageFragment extends FragmentBase {

  imageUrl?: string;
  alt?: string;

  constructor(imageUrl?: string, alt?: string) {
    super();
    this.imageUrl = imageUrl;
    this.alt = alt ?? "";
  }

  render(): string {
    return `<img id="${this.id}" src="${this.imageUrl ?? ""}" alt="${this.alt}" class="image-fragment" />`;
  }

  getScript(): string {
    return "";
  }

  getStyle(): string {
    return `
      .image-fragment {
        width: 100%;
        border-radius: 12px;
        display: block;
        margin: 0 auto;
      }
    `;
  }
}
