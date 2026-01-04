/**
 * Utility-Klasse für sicheres Generieren von JavaScript-Code-Strings
 * Verhindert Escaping-Probleme bei verschachtelten Template-Strings
 */
export class JsStringBuilder {
  /**
   * Erstellt einen JavaScript-String-Literal sicher escaped
   */
  static escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')  // Backslashes zuerst
      .replace(/'/g, "\\'")    // Single quotes
      .replace(/"/g, '\\"')    // Double quotes
      .replace(/\n/g, '\\n')   // Newlines
      .replace(/\r/g, '\\r')   // Carriage returns
      .replace(/\t/g, '\\t');  // Tabs
  }

  /**
   * Erstellt einen JavaScript-String mit String-Konkatenation statt Template-Literalen
   * Verhindert Probleme mit verschachtelten Template-Strings
   */
  static concat(...parts: (string | number)[]): string {
    return parts
      .map(part => {
        if (typeof part === 'number') {
          return String(part);
        }
        // Escape String und wrap in quotes
        return "'" + this.escapeString(part) + "'";
      })
      .join(' + ');
  }

  /**
   * Erstellt einen Template-Literal-ähnlichen String mit String-Konkatenation
   * z.B. jsTemplate`/api/kennels/${kennelId}` wird zu '/api/kennels/' + kennelId
   */
  static template(strings: TemplateStringsArray, ...values: any[]): string {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
      result += "'" + this.escapeString(strings[i]) + "'";
      if (i < values.length) {
        const value = values[i];
        if (typeof value === 'string') {
          result += ' + ' + this.escapeString(value);
        } else if (typeof value === 'number') {
          result += ' + ' + value;
        } else {
          result += ' + ' + JSON.stringify(value);
        }
      }
      if (i < strings.length - 1) {
        result += ' + ';
      }
    }
    return result;
  }

  /**
   * Erstellt einen URL-String sicher
   */
  static url(base: string, ...segments: (string | number)[]): string {
    const parts = ["'" + this.escapeString(base) + "'"];
    segments.forEach(seg => {
      if (typeof seg === 'string') {
        parts.push("'" + this.escapeString(seg) + "'");
      } else {
        parts.push(String(seg));
      }
    });
    return parts.join(' + ');
  }

  /**
   * Erstellt einen Template-String-Ausdruck sicher
   * z.B. safeTemplate`${baseId} (v${version})` wird zu baseId + ' (v' + version + ')'
   */
  static safeTemplate(strings: TemplateStringsArray, ...values: any[]): string {
    const parts: string[] = [];
    for (let i = 0; i < strings.length; i++) {
      if (strings[i]) {
        parts.push("'" + this.escapeString(strings[i]) + "'");
      }
      if (i < values.length) {
        const value = values[i];
        if (typeof value === 'string') {
          parts.push(value); // Variable name, nicht escaped
        } else if (typeof value === 'number') {
          parts.push(String(value));
        } else {
          parts.push(JSON.stringify(value));
        }
      }
    }
    return parts.join(' + ');
  }
}

/**
 * Helper-Funktion für einfache Verwendung
 * Verwendet String-Konkatenation statt Template-Literale
 */
export function js(str: string, ...values: any[]): string {
  // Einfache String-Interpolation mit Konkatenation
  let result = "'" + JsStringBuilder.escapeString(str) + "'";
  values.forEach(val => {
    if (typeof val === 'string') {
      result += ' + ' + val; // Variable name
    } else if (typeof val === 'number') {
      result += ' + ' + val;
    } else {
      result += ' + ' + JSON.stringify(val);
    }
  });
  return result;
}

