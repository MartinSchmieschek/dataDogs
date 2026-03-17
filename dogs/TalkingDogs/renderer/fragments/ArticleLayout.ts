import { ArticleLayoutEnum } from "../enums/ArticleLayoutEnum";
import { ImageFragment } from "./ImageFragment";
import { TextFragment } from "./TextFragment";
import { ButtonFragment } from "./ButtonFragment";
import { LayoutBase } from "../layouts/LayoutBase";
import type { ILayoutInput, IArticleInput } from "../layouts/ILayoutInput";

export class ArticleLayout extends LayoutBase<ArticleLayoutEnum> {
  constructor() {
    super();
    this.fragments.set(ArticleLayoutEnum.HeaderImage, new ImageFragment());
    this.fragments.set(ArticleLayoutEnum.Headline, new TextFragment("Headline"));
    this.fragments.set(ArticleLayoutEnum.Paragraph, new TextFragment("Lorem ipsum..."));
    this.fragments.set(ArticleLayoutEnum.ReadMore, new ButtonFragment("Read more"));
  }

  populate(input: ILayoutInput): void {
    const data = input as IArticleInput;

    const image = this.get(ArticleLayoutEnum.HeaderImage);
    if (image && "imageUrl" in image) (image as ImageFragment).imageUrl = data.imageUrl;

    const headline = this.get(ArticleLayoutEnum.Headline);
    if (headline && "text" in headline) (headline as TextFragment).text = data.headline;

    const paragraph = this.get(ArticleLayoutEnum.Paragraph);
    if (paragraph && "text" in paragraph) (paragraph as TextFragment).text = data.paragraph;
  }
}
