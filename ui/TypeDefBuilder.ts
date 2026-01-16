export class TypeDefBuilder {

  // =====================================================
  // PUBLIC
  // =====================================================
  public static buildContextLib(rawName: string, ctx: any): string {
    const typeName = this.safeTypeName(rawName);

    // Normalisiere den Context: Stelle sicher, dass alle Properties erfasst werden
    // auch wenn sie undefined sind (Object.keys() erfasst auch undefined Properties)
    const normalizedCtx = ctx || {};

    // Debug: Logge den Context (ohne JSON.stringify, um undefined Werte zu sehen)
    console.log(`[TypeDefBuilder] Context für ${rawName}:`, normalizedCtx);
    console.log(`[TypeDefBuilder] Context keys:`, Object.keys(normalizedCtx));
    if (normalizedCtx.axiosClient !== undefined) {
      console.log(`[TypeDefBuilder] axiosClient exists, type:`, typeof normalizedCtx.axiosClient);
      if (normalizedCtx.axiosClient && typeof normalizedCtx.axiosClient === 'object') {
        console.log(`[TypeDefBuilder] axiosClient keys:`, Object.keys(normalizedCtx.axiosClient));
        Object.keys(normalizedCtx.axiosClient).forEach(key => {
          const val = normalizedCtx.axiosClient[key];
          console.log(`[TypeDefBuilder] axiosClient.${key}:`, typeof val, val === undefined ? 'UNDEFINED' : val);
        });
      }
    }

    const typeBody = this.valueToType(normalizedCtx, 1);
    
    console.log(`[TypeDefBuilder] Generated typeBody:`, typeBody);

    // make global declarations for ctx keys
    let globalVars = "";
    Object.keys(normalizedCtx).forEach(key => {
      const valueType = this.valueToType(normalizedCtx[key], 2);
      globalVars += `
            declare global {
            type ${key} = ${valueType};

            const ${key}: ${key};
          }
      `;
    });
    
    // KRITISCH: axiosClient sollte immer deklariert werden, auch wenn es nicht im Context ist
    // (wird häufig im Code verwendet, auch wenn nicht explizit im Context)
    if (!normalizedCtx.hasOwnProperty('axiosClient')) {
      const axiosClientType = this.valueToType({
        post: undefined,
        get: undefined,
        put: undefined,
        delete: undefined,
        patch: undefined,
        head: undefined,
        request: undefined
      }, 2);
      globalVars += `
            declare global {
            type axiosClient = ${axiosClientType};

            const axiosClient: axiosClient;
          }
      `;
    }

    return `


declare global {
  type Test = {
    id: number;
    name: string;
    difficulty: string;
  };

  const test: Test;
}

${globalVars}



export type ${typeName} = ${typeBody};

${this.buildGlobals(typeName, normalizedCtx)}



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
          `declare global ${key}: ${typeName}["${key}"];`
      )
      .join("\n");
  }

  private static valueToType(value: any, indent: number): string {
    const pad = (n: number) => "  ".repeat(n);

    if (value === null) return "null";
    
    // Behandle undefined explizit
    if (value === undefined) return "undefined";

    if (Array.isArray(value)) {
      if (value.length === 0) return "any[]";
      return `${this.valueToType(value[0], indent)}[]`;
    }

    switch (typeof value) {
      case "string": return "string";
      case "number": return "number";
      case "boolean": return "boolean";

      case "function": {
        // Prüfe ob die Funktion undefined ist (kann vorkommen bei Objekten mit undefined Funktionen)
        if (value === undefined) return "undefined";
        const args = Array.from(
          { length: value.length },
          (_, i) => `arg${i}: any`
        ).join(", ");
        return `(${args}) => any`;
      }

      case "object": {
        // Prüfe ob value null ist (bereits oben behandelt, aber zur Sicherheit)
        if (value === null) return "null";
        
        // Verwende Object.keys() um alle Properties zu erfassen, auch wenn sie undefined sind
        const keys = Object.keys(value);
        if (!keys.length) return "{}";

        const lines = keys.map(
          (k) => {
            const v = value[k];
            let valueType: string;
            
            // Spezielle Behandlung: Wenn der Wert undefined ist, aber das Objekt
            // wahrscheinlich Funktionen enthalten sollte (z.B. axiosClient mit post, get, etc.),
            // dann behandle es als mögliche Funktion
            if (v === undefined) {
              // Prüfe ob der Key wie ein Funktionsname aussieht (z.B. post, get, put, delete)
              // oder ob das Objekt typischerweise Funktionen enthält
              const functionLikeKeys = ['post', 'get', 'put', 'delete', 'patch', 'head', 'request'];
              if (functionLikeKeys.includes(k.toLowerCase())) {
                // Behandle als optionale Funktion
                valueType = "(...args: any[]) => Promise<any>";
              } else {
                // Normale undefined Behandlung
                valueType = "undefined";
              }
            } else {
              valueType = this.valueToType(v, indent + 1);
            }
            
            // Wenn der Wert undefined ist, mache ihn optional
            const optionalMarker = v === undefined ? "?" : "";
            return `${pad(indent)}${k}${optionalMarker}: ${valueType};`;
          }
        );

        return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
      }

      default:
        return "any";
    }
  }
}
