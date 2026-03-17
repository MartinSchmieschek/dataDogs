export interface ITinderInput {
    type: 'tinder';
    imageUrl: string;
    title: string;
    description?: string;
}

export interface IBiographyInput {
    type: 'biography';
    imageUrl: string;
    name: string;
    birthInfo: string;
    story: string;
}

export interface IRecipeInput {
    type: 'recipe';
    imageUrl: string;
    title: string;
    ingredients: string[];
    steps: string[];
}

export interface IArticleInput {
    type: 'article';
    imageUrl: string;
    headline: string;
    paragraph: string;
}

export interface IGalleryInput {
    type: 'gallery';
    title: string;
    thumbnailUrl: string;
}

export type ILayoutInput = ITinderInput | IBiographyInput | IRecipeInput | IArticleInput | IGalleryInput;
