// TinderLayout.ts
import { ButtonFragment } from "../fragments/ButtonFragment";
import { ImageFragment } from "../fragments/ImageFragment";
import { SwipeLeftGestureFragment } from "../fragments/SwipeLeftGestureFragment";
import { SwipeRightGestureFragment } from "../fragments/SwipeRightGestureFragment";
import { TextFragment } from "../fragments/TextFragment";
import { GestureFragment } from "../fragments/GestureFragment";
import { LayoutBase } from "./LayoutBase";
import type { ILayoutInput, ITinderInput } from "./ILayoutInput";

export enum TinderLayoutEnum {
  PresentationImage = "PresentationImage",
  Title = "Title",
  Description = "Description",
  Next = "Next",
  SwipeLeft = "SwipeLeft",
  SwipeRight = "SwipeRight",
}

export class TinderLayout extends LayoutBase<TinderLayoutEnum> {
  constructor() {
    super();

    this.fragments.set(TinderLayoutEnum.PresentationImage, new ImageFragment());
    this.fragments.set(TinderLayoutEnum.Title, new TextFragment("Dog Name"));
    this.fragments.set(TinderLayoutEnum.Description, new TextFragment("Recipe description here..."));
    this.fragments.set(TinderLayoutEnum.Next, new ButtonFragment("Next"));
    this.fragments.set(TinderLayoutEnum.SwipeLeft, new SwipeLeftGestureFragment());
    this.fragments.set(TinderLayoutEnum.SwipeRight, new SwipeRightGestureFragment());
  }

  populate(input: ILayoutInput): void {
    const data = input as ITinderInput;

    const image = this.get(TinderLayoutEnum.PresentationImage);
    if (image && "imageUrl" in image) (image as ImageFragment).imageUrl = data.imageUrl;

    const title = this.get(TinderLayoutEnum.Title);
    if (title && "text" in title) (title as TextFragment).text = data.title;

    if (data.description) {
      const desc = this.get(TinderLayoutEnum.Description);
      if (desc && "text" in desc) (desc as TextFragment).text = data.description;
    }

    const next = this.get(TinderLayoutEnum.Next);
    if (next) (next as ButtonFragment).action = () => window.location.reload();

    const swipes = this.find(item => item instanceof SwipeLeftGestureFragment || item instanceof SwipeRightGestureFragment);
    swipes.forEach(item => {
      (item as GestureFragment).action = () => window.location.reload();
    });
  }
}
