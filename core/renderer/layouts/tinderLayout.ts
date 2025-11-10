import { LayoutDefinition } from "../LayoutRenderer";


export enum LayoutZones {
  Image = "Image",
  Video = "recipeVideo",
  Actions = "Actions"
}

export function tinderLayout(): LayoutDefinition {
  return {
    name: "Tinder Layout",
    zones: [
      {
        id: LayoutZones.Image,
        fragment: "dog",
        style: {
          top: "10vh",
          left: "10vw",
          width: "80vw",
          height: "50vh",
        },
      },
      {
        id: LayoutZones.Video,
        fragment: "video",
        style: {
          bottom: "20vh",
          left: "10vw",
          width: "80vw",
          height: "30vh",
        },
      },
      {
        id: LayoutZones.Actions,
        fragment: "buttons",
        style: {
            display: "flex",
            width: "100vw",
            height: "100vh",
            left: "0px",
            top: "0px",
            "justify-content": "space-between",
            gap: "2rem",
            "align-items": "center",
            "flex-direction": "row",
        },
      },
    ],
  };
}
