import { RecipeLayoutEnum } from "../enums/RecipeLayoutEnum";
import { ImageFragment } from "../fragments/ImageFragment";
import { TextFragment } from "../fragments/TextFragment";
import { LayoutBase } from "./LayoutBase";
import type { ILayoutInput, IRecipeInput } from "./ILayoutInput";

export class RecipeLayout extends LayoutBase<RecipeLayoutEnum> {
  constructor() {
    super();
    this.fragments.set(RecipeLayoutEnum.Image, new ImageFragment());
    this.fragments.set(RecipeLayoutEnum.Title, new TextFragment("Recipe title"));
    this.fragments.set(RecipeLayoutEnum.Ingredients, new TextFragment("Ingredients list"));
    this.fragments.set(RecipeLayoutEnum.Steps, new TextFragment("Cooking steps"));
  }

  populate(input: ILayoutInput): void {
    const data = input as IRecipeInput;

    const image = this.get(RecipeLayoutEnum.Image);
    if (image && "imageUrl" in image) (image as ImageFragment).imageUrl = data.imageUrl;

    const title = this.get(RecipeLayoutEnum.Title);
    if (title && "text" in title) (title as TextFragment).text = data.title;

    const ingredients = this.get(RecipeLayoutEnum.Ingredients);
    if (ingredients && "text" in ingredients) (ingredients as TextFragment).text = data.ingredients.join(', ');

    const steps = this.get(RecipeLayoutEnum.Steps);
    if (steps && "text" in steps) (steps as TextFragment).text = data.steps.join('\n');
  }
}
