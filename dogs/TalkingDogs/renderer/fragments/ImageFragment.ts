import { FragmentBase } from "./FragmentBase";

export class ImageFragment extends FragmentBase {

  imageUrl?: string;
  alt?: string;

  constructor(imageUrl?: string, alt?: string) {
    super();
    this.imageUrl = imageUrl;
    this.alt = alt ?? "";
  }

  private isVideo(url?: string): boolean {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video');
  }

  render(): string {
    const url = this.imageUrl ?? "";
    if (this.isVideo(url)) {
      return `<video id="${this.id}" src="${url}" class="image-fragment" controls autoplay loop muted playsinline></video>`;
    }
    return `<img id="${this.id}" src="${url}" alt="${this.alt}" class="image-fragment" />`;
  }

  getScript(): string {
    return "";
  }

  getStyle(): string {
    return `
      .image-fragment {
        width: 100%;
        max-height: 60vh;
        object-fit: contain;
        border-radius: 12px;
        display: block;
        margin: 0 auto;
      }
    `;
  }
}
