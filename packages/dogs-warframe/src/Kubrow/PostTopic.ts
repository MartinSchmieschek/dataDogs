import type { IPostMedia } from './interfaces/forumPost';

/** Ein Topic-Abschnitt aus dem ersten Forum-Post mit Inhalt (Markdown) und Medien. */
export class PostTopic {
    constructor(
        readonly title: string,
        private readonly bodyMarkdown: string,
        private readonly media: IPostMedia[]
    ) {}

    getBodyMarkdown(): string {
        return this.bodyMarkdown;
    }

    getMedia(): IPostMedia[] {
        return [...this.media];
    }

    getImages(): IPostMedia[] {
        return this.media.filter((m) => m.type === 'image');
    }

    getVideos(): IPostMedia[] {
        return this.media.filter((m) => m.type === 'video');
    }
}
