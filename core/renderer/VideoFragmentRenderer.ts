import { FragmentRenderer } from "./FragmentRenderer";

export interface VideoData {
  youtubeId: string;
}

export class VideoFragmentRenderer extends FragmentRenderer<VideoData> {
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
}
