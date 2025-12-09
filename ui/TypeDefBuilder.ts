export class TypeDefBuilder {

  /**
   * Wandelt ein beliebiges Objekt in eine gültige TypeScript-Typdefinition um.
   * Beispiel:
   *   {foo: 1, bar:"x"} → "export type VMContext = { foo: number; bar: string }"
   */
  public static buildType(name: string, obj: any): string {
    const typeBody = this.valueToType(obj, 1);
    return `export type ${name} = ${typeBody};\n`;
  }

  // ------------------------------------------------------
  //  INTERN
  // ------------------------------------------------------

  private static valueToType(value: any, indent: number): string {
    const pad = (n: number) => "  ".repeat(n);

    if (value === null) return "null";
    if (Array.isArray(value)) {
      if (value.length === 0) return "any[]";
      return `${this.valueToType(value[0], indent)}[]`;
    }

    switch (typeof value) {
      case "string": return "string";
      case "number": return "number";
      case "boolean": return "boolean";

      case "function": {
        const argCount = value.length;
        const args = Array.from({ length: argCount }, (_, i) => `arg${i}: any`).join(", ");
        return `(${args}) => any`;
      }

      case "object": {
        const entries = Object.entries(value);
        if (entries.length === 0) return "{}";

        const parts = entries.map(([key, val]) =>
          `${pad(indent)}${key}: ${this.valueToType(val, indent + 1)};`
        );

        return `{\n${parts.join("\n")}\n${pad(indent - 1)}}`;
      }

      default:
        return "any";
    }
  }
}
