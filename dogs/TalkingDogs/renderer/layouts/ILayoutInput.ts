import { createPact } from "datadogs";

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

/** TypeScript-String für TypeDefBuilder/VM – muss mit den Interfaces oben übereinstimmen. */
export const LAYOUT_INPUT_TYPE_DEF = `
interface ITinderInput { type: 'tinder'; imageUrl: string; title: string; description?: string; }
interface IBiographyInput { type: 'biography'; imageUrl: string; name: string; birthInfo: string; story: string; }
interface IRecipeInput { type: 'recipe'; imageUrl: string; title: string; ingredients: string[]; steps: string[]; }
interface IArticleInput { type: 'article'; imageUrl: string; headline: string; paragraph: string; }
interface IGalleryInput { type: 'gallery'; title: string; thumbnailUrl: string; }
type ILayoutInput = ITinderInput | IBiographyInput | IRecipeInput | IArticleInput | IGalleryInput;
type ILayoutInputReturn = ILayoutInput;
`;

export const LayoutInputPact = createPact<ILayoutInput>('LayoutInputProvider', LAYOUT_INPUT_TYPE_DEF);
