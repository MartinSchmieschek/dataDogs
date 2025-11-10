import { LayoutDefinition } from "../LayoutRenderer";


export function presentationLayout(): LayoutDefinition {
  return {
    name: "Presentation Layout",
    zones: [
      {
        id: "mainDog",
        fragment: "dog",
        style: {
          top: "5vh",
          left: "5vw",
          width: "40vw",
          height: "80vh",
        },
      },
      {
        id: "videoSide",
        fragment: "video",
        style: {
          top: "5vh",
          right: "5vw",
          width: "45vw",
          height: "60vh",
        },
      },
      {
        id: "buttons",
        fragment: "buttons",
        style: {
          bottom: "5vh",
          left: "50%",
          transform: "translateX(-50%)",
        },
      },
    ],
  };
}
