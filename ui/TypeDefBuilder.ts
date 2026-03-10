import { CompilerCache } from './CompilerCache';

export class TypeDefBuilder {

  // =====================================================
  // PUBLIC
  // =====================================================
  public static buildContextLib(rawName: string, ctx: any): string {
    const typeName = this.safeTypeName(rawName);
    let interfaceDefs = "";

    for (const value of Object.values(ctx)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const proto = Object.getPrototypeOf(value);
        if (proto && proto !== Object.prototype) {
          const className = value.constructor?.name;
          if (className && className !== 'Object') {
            const classType = CompilerCache.getClassType(className);
            if (classType?.referencedInterfaces) {
              interfaceDefs += classType.referencedInterfaces + "\n";
            }
          }
        }
      }
    }

    const typeBody = this.valueToType(ctx, 1);

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
${interfaceDefs}
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
        const isAsync = value.constructor?.name === 'AsyncFunction';
        const returnType = isAsync ? 'Promise<any>' : 'any';
        return `(${args}) => ${returnType}`;
      }

      case "object": {
        const proto = Object.getPrototypeOf(value);

        if (proto && proto !== Object.prototype) {
          const className = value.constructor?.name;
          if (className && className !== 'Object') {
            const classType = CompilerCache.getClassType(className);
            if (classType) {
              const lines = Object.entries(classType.members).map(
                ([k, v]) => `${pad(indent)}${k}: ${v};`
              );
              if (!lines.length) return "{}";
              return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
            }
          }

          // Fallback: runtime inspection for class instances without compiler info
          const entries: [string, any][] = Object.entries(value);
          for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === 'constructor') continue;
            const desc = Object.getOwnPropertyDescriptor(proto, key);
            if (!desc) continue;

            if (desc.get) {
              try {
                entries.push([key, desc.get.call(value)]);
              } catch {
                entries.push([key, undefined]);
              }
            } else if (typeof desc.value === 'function') {
              entries.push([key, desc.value]);
            }
          }

          if (!entries.length) return "{}";
          const lines = entries.map(
            ([k, v]) => `${pad(indent)}${k}: ${this.valueToType(v, indent + 1)};`
          );
          return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
        }

        // Plain objects
        const entries: [string, any][] = Object.entries(value);
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
