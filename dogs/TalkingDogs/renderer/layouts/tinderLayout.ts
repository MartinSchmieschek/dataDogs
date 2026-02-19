// TinderLayout.ts
import { ButtonFragment } from "../fragments/ButtonFragment";
import { ImageFragment } from "../fragments/ImageFragment";
import { SwipeLeftGestureFragment } from "../fragments/SwipeLeftGestureFragment";
import { SwipeRightGestureFragment } from "../fragments/SwipeRightGestureFragment";
import { TextFragment } from "../fragments/TextFragment";
import { LayoutBase } from "./LayoutBase";

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
}
