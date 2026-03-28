import { GalleryLayoutEnum } from "../enums/GalleryLayoutEnum";
import { TextFragment } from "./TextFragment";
import { ButtonFragment } from "./ButtonFragment";
import { ImageFragment } from "./ImageFragment";
import { LayoutBase } from "../layouts/LayoutBase";
import type { ILayoutInput, IGalleryInput } from "../layouts/ILayoutInput";

export class GalleryLayout extends LayoutBase<GalleryLayoutEnum> {
  constructor() {
    super();
    this.fragments.set(GalleryLayoutEnum.Title, new TextFragment("Gallery"));
    this.fragments.set(GalleryLayoutEnum.Thumbnails, new ImageFragment());
    this.fragments.set(GalleryLayoutEnum.OpenGallery, new ButtonFragment("Open"));
  }

  populate(input: ILayoutInput): void {
    const data = input as IGalleryInput;

    const title = this.get(GalleryLayoutEnum.Title);
    if (title && "text" in title) (title as TextFragment).text = data.title;

    const thumb = this.get(GalleryLayoutEnum.Thumbnails);
    if (thumb && "imageUrl" in thumb) (thumb as ImageFragment).imageUrl = data.thumbnailUrl;
  }
}
