export enum AsciiArt {
  Dog = "Dog",
  Cat = "Cat",
  Box = "Box",
  Zombie = "Zombie",
  StartLine = "StartLine",
  FinishLine = "FinishLine",
  Treasure = "Treasure",
  NextRound = "NextRound"
}

export class AsciiPrinter {
  private static arts: Record<AsciiArt, string[]> = {
    [AsciiArt.Dog]: [
      " /\\_/\\  ",
      "( _._ ) ",
      "   U    "
    ],
    [AsciiArt.Cat]: [
      " /\\_/\\  ",
      "( -.- ) ",
      " > ^ <  "
    ],
    [AsciiArt.Box]: [
      "........",
      ".      .",
      "........"
    ],
    [AsciiArt.Zombie]: [
      " (* *)      ___",
      " / | \\     |   |",
      "  / \\      | R |",
      "           | I |"
    ],
    [AsciiArt.StartLine]: [
      "  ____  ",
      " |    | ",
      " |START|",
      " |____| "
    ],
    [AsciiArt.FinishLine]: [
      "  ____  ",
      " |    | ",
      " |FINI| ",
      " |____| "
    ],
  [AsciiArt.Treasure]: [
    "  ____  ",
    " /____\\ ",
    " | $$ | ",
    " |____| "
  ],
  [AsciiArt.NextRound]: [
    "  ____   ____  ",
    " |    | |    | ",
    " |NEXT| |ROUND|",
    " |____| |____| "
  ]
  };

  static print(art: AsciiArt, text: string) {
    const left = AsciiPrinter.arts[art];
    const right = text.split("\n"); // mehrzeiliger Text möglich

    const maxLines = Math.max(left.length, right.length);
    for (let i = 0; i < maxLines; i++) {
      const l = left[i] ?? " ".repeat(left[0].length);
      const r = right[i] ?? "";
      console.log(l + "   " + r);
    }
  }
}