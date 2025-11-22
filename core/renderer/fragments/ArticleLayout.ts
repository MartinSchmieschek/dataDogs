import { ArticleLayoutEnum } from "../enums/ArticleLayoutEnum";
import { ImageFragment } from "../fragments/ImageFragment";
import { TextFragment } from "../fragments/TextFragment";
import { ButtonFragment } from "../fragments/ButtonFragment";
import { FragmentBase } from "../fragments/FragmentBase";

export class ArticleLayout {
  private fragments = new Map<ArticleLayoutEnum, FragmentBase>();

  constructor() {
    this.fragments.set(ArticleLayoutEnum.HeaderImage, new ImageFragment());
    this.fragments.set(ArticleLayoutEnum.Headline, new TextFragment("Headline"));
    this.fragments.set(ArticleLayoutEnum.Paragraph, new TextFragment("Lorem ipsum..."));
    this.fragments.set(ArticleLayoutEnum.ReadMore, new ButtonFragment("Read more"));
  }

  get(zone: ArticleLayoutEnum) {
    return this.fragments.get(zone);
  }

  render(): string {
    const html = Array.from(this.fragments.values()).map(f => f.render()).join("\n");
    const script = Array.from(this.fragments.values()).map(f => f.getScript()).join("\n");
    return `<div class="layout article-layout">${html}</div><script>${script}</script>`;
  }
}
