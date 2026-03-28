import { createPact } from "@datadogs/core";

export interface ITinderInput {
    type: 'tinder';
    imageUrl: string;
    title: string;
    description?: string;
    /** Optional: Gradient-Streifen über dem Eingabe-Bereich (z. B. „Verbessere deine Drops“). */
    inputsHeader?: string;
    /** Frage über den Auswahl-Pills (z. B. Flirt-Style). */
    inputQuestion?: string;
    /** Auswahloptionen als breite, abgerundete Pills — wie in der Tinder-UI. */
    inputOptions?: string[];
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

export const LayoutInputPact = createPact<ILayoutInput>('LayoutInputProvider', { fromSourceType: 'ILayoutInput' });
