import { RecipeLayoutEnum } from "../enums/RecipeLayoutEnum";
import { ImageFragment } from "../fragments/ImageFragment";
import { TextFragment } from "../fragments/TextFragment";
import { FragmentBase } from "../fragments/FragmentBase";

export class RecipeLayout {
  private fragments = new Map<RecipeLayoutEnum, FragmentBase>();

  constructor() {
    this.fragments.set(RecipeLayoutEnum.Image, new ImageFragment());
    this.fragments.set(RecipeLayoutEnum.Title, new TextFragment("Recipe title"));
    this.fragments.set(RecipeLayoutEnum.Ingredients, new TextFragment("Ingredients list"));
    this.fragments.set(RecipeLayoutEnum.Steps, new TextFragment("Cooking steps"));
  }

  get(zone: RecipeLayoutEnum) {
    return this.fragments.get(zone);
  }

  render(): string {
    const html = Array.from(this.fragments.values()).map(f => f.render()).join("\n");
    const script = Array.from(this.fragments.values()).map(f => f.getScript()).join("\n");
    return `<div class="layout recipe-layout">${html}</div><script>${script}</script>`;
  }
}
