import type { IPostMedia } from './interfaces/forumPost';
import { PostTopic } from './PostTopic';

/** Der erste Post eines Forum-Threads: Titel, Metadaten und nach Topics unterteilter Inhalt. */
export class ForumFirstPost {
    constructor(
        readonly title: string,
        readonly author: string,
        readonly date: string,
        readonly url: string,
        readonly topics: PostTopic[]
    ) {}

    getMedia(): IPostMedia[] {
        return this.topics.flatMap((t) => t.getMedia());
    }

    getImages(): IPostMedia[] {
        return this.topics.flatMap((t) => t.getImages());
    }

    getVideos(): IPostMedia[] {
        return this.topics.flatMap((t) => t.getVideos());
    }
}
