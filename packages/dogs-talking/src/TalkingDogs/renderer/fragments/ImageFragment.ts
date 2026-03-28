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
      return `<div class="image-fragment-box"><video id="${this.id}" src="${url}" class="image-fragment" controls autoplay loop muted playsinline></video></div>`;
    }
    return `<div class="image-fragment-box"><img id="${this.id}" src="${url}" alt="${this.alt}" class="image-fragment" /></div>`;
  }

  getScript(): string {
    return "";
  }

  getStyle(): string {
    return `
      .image-fragment-box {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        min-height: 0;
        max-height: min(90vh, 90dvh);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }
      .image-fragment {
        display: block;
        flex: 0 1 auto;
        /* Vollständig sichtbar: proportional verkleinern, Seitenverhältnis bleibt */
        max-width: 100%;
        max-height: min(90vh, 90dvh);
        width: auto;
        height: auto;
        object-fit: contain;
        object-position: center;
        border-radius: 12px;
      }
      video.image-fragment {
        background: #111;
      }
    `;
  }
}
