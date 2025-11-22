import { BiographyLayoutEnum } from "../enums/BiographyLayoutEnum";
import { ImageFragment } from "../fragments/ImageFragment";
import { TextFragment } from "../fragments/TextFragment";
import { FragmentBase } from "../fragments/FragmentBase";

export class BiographyLayout {
  private fragments = new Map<BiographyLayoutEnum, FragmentBase>();

  constructor() {
    this.fragments.set(BiographyLayoutEnum.Portrait, new ImageFragment());
    this.fragments.set(BiographyLayoutEnum.Name, new TextFragment("Name"));
    this.fragments.set(BiographyLayoutEnum.BirthInfo, new TextFragment("Born ..."));
    this.fragments.set(BiographyLayoutEnum.Story, new TextFragment("Story goes here..."));
  }

  get(zone: BiographyLayoutEnum) {
    return this.fragments.get(zone);
  }

  render(): string {
    const html = Array.from(this.fragments.values()).map(f => f.render()).join("\n");
    const script = Array.from(this.fragments.values()).map(f => f.getScript()).join("\n");
    return `<div class="layout biography-layout">${html}</div><script>${script}</script>`;
  }
}
