// LayoutBase.ts

import { FragmentBase } from "../fragments/FragmentBase";


export abstract class LayoutBase<E extends string> {
  protected fragments = new Map<E, FragmentBase>();

  get(id: E): FragmentBase | undefined {
    return this.fragments.get(id);
  }

  find(is: (fragment:FragmentBase, id:string)=>boolean): FragmentBase[] {
    return Array.from(this.fragments.entries()).filter(item => is(item[1],item[0])).map(item => item[1])
  }

  getAllFragments(): FragmentBase[] {
    return Array.from(this.fragments.values());
  }

  renderHtml(): string {
    return this.getAllFragments()
      .map(f => f.render())
      .join("\n");
  }

  collectStyles(): string {
    return this.getAllFragments()
      .map(f => f.getStyle())
      .join("\n");
  }

  collectScripts(): string {
    return this.getAllFragments()
      .map(f => f.getScript())
      .join("\n");
  }
}
