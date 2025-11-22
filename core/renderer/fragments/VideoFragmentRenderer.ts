import { FragmentBase } from "./FragmentBase";

export interface VideoData {
  youtubeId: string;
}

export class VideoFragmentRenderer extends FragmentBase {
  getStyle(): string {
    throw new Error("Method not implemented.");
  }

  render(): string {
    throw new Error("Method not implemented.");
  }
  getScript(): string {
    throw new Error("Method not implemented.");
  }
  /*
  render(data: VideoData): string {
    return `
      <div class="video-fragment">
        <iframe
          width="100%"
          height="100%"
          src="https://www.youtube.com/embed/${data.youtubeId}"
          title="Rezeptvideo"
          frameborder="0"
          allowfullscreen>
        </iframe>
      </div>
    `;
  }
    */
}
