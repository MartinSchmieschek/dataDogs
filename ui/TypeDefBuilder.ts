export class TypeDefBuilder {

  // =====================================================
  // PUBLIC
  // =====================================================
  public static buildContextLib(rawName: string, ctx: any): string {
    const typeName = this.safeTypeName(rawName);

    const typeBody = this.valueToType(ctx, 1);


    // make global declarations for ctx keys
    let globalVars = "";
    Object.keys(ctx).forEach(key => {
      globalVars += `
            declare global {
            type ${key} = ${this.valueToType(ctx[key], 2) };

            const ${key}: ${key};
          }
      `;
    });

    return `
${globalVars}

export type ${typeName} = ${typeBody};

${this.buildGlobals(typeName, ctx)}

`;
  }

  // =====================================================
  // INTERNAL
  // =====================================================
  private static safeTypeName(name: string): string {
    return (
      "Node_" +
      name
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/^[^a-zA-Z_]/, "_")
    );
  }

  private static buildGlobals(typeName: string, ctx: any): string {
    return Object.keys(ctx)
      .map(
        key =>
          `declare global {\n  const ${key}: ${typeName}["${key}"];\n}`
      )
      .join("\n");
  }

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
        const args = Array.from(
          { length: value.length },
          (_, i) => `arg${i}: any`
        ).join(", ");
        return `(${args}) => any`;
      }

      case "object": {
        const entries = Object.entries(value);
        if (!entries.length) return "{}";

        const lines = entries.map(
          ([k, v]) =>
            `${pad(indent)}${k}: ${this.valueToType(v, indent + 1)};`
        );

        return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
      }

      default:
        return "any";
    }
  }
}
