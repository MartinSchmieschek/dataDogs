/** Einzelnes Medium (Bild oder Video) innerhalb eines Topic-Inhalts. */
export interface IPostMedia {
    type: 'image' | 'video';
    url: string;
    thumbnailUrl?: string;
    alt?: string;
    width?: number;
    height?: number;
}

/** Rohe Topic-Daten aus dem Parser (für Erstellung von PostTopic). */
export interface IPostTopicData {
    title: string;
    bodyMarkdown: string;
    media: IPostMedia[];
}
