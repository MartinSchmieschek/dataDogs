// types.ts
export type ZoneId = string;
export type FragmentType = string;

export interface ZoneDefinition {
  id: ZoneId;
  fragment: FragmentType;
  // style object where values are raw CSS values, e.g. { position: "absolute", top: "5vh", left: "5vw", width: "60vw", height: "60vh" }
  style?: Record<string, string>;
  attrs?: Record<string,string>; // optional extra attributes for zone wrapper
  zIndex?: number;
}

export interface ActionDefinition {
  id: string;
  label?: string; // visible label
  attrs?: Record<string,string>;
}

export interface LayoutDefinition {
  name: string;
  viewportMeta?: string;
  globalStyles?: string; // optional global CSS (theme) — use sparingly
  zones: ZoneDefinition[];
  actions: ActionDefinition[]; // layout declares which actions exist and where they will be placed by fragment 'actions'
}
