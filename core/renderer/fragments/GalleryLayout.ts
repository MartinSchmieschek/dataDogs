import { GalleryLayoutEnum } from "../enums/GalleryLayoutEnum";
import { TextFragment } from "../fragments/TextFragment";
import { ButtonFragment } from "../fragments/ButtonFragment";
import { ImageFragment } from "../fragments/ImageFragment";
import { FragmentBase } from "../fragments/FragmentBase";

export class GalleryLayout {
  private fragments = new Map<GalleryLayoutEnum, FragmentBase>();

  constructor() {
    this.fragments.set(GalleryLayoutEnum.Title, new TextFragment("Gallery"));
    this.fragments.set(GalleryLayoutEnum.Thumbnails, new ImageFragment());
    this.fragments.set(GalleryLayoutEnum.OpenGallery, new ButtonFragment("Open"));
  }

  get(zone: GalleryLayoutEnum) {
    return this.fragments.get(zone);
  }

  render(): string {
    const html = Array.from(this.fragments.values()).map(f => f.render()).join("\n");
    const script = Array.from(this.fragments.values()).map(f => f.render()).join("\n");
    return `<div class="layout gallery-layout">${html}</div><script>${script}</script>`;
  }
}
