# Regeln für sicheres String-Escaping in generiertem JavaScript

## Problem
Wenn wir JavaScript-Code in TypeScript-Strings generieren, können verschachtelte Template-Strings zu Escaping-Problemen führen.

## Lösung: Immer String-Konkatenation verwenden

### ❌ FALSCH - Template-Strings in generiertem Code:
```typescript
return `
<script>
  const url = \`/api/kennels/\${kennelId}\`;
</script>
`;
```

### ✅ RICHTIG - String-Konkatenation verwenden:
```typescript
return `
<script>
  const url = '/api/kennels/' + kennelId;
</script>
`;
```

## Regeln

1. **NIEMALS** Template-Strings (Backticks) in generiertem JavaScript-Code verwenden
2. **IMMER** String-Konkatenation (`+`) verwenden
3. **IMMER** String-Literale mit einfachen Anführungszeichen (`'`) verwenden
4. Bei Variablen: Direkt verwenden, z.B. `baseId + ' (v' + version + ')'`

## Beispiele

### URL-Generierung
```typescript
// ❌ FALSCH
const url = \`/api/kennels/\${kennelId}\`;

// ✅ RICHTIG
const url = '/api/kennels/' + kennelId;
```

### Text mit Variablen
```typescript
// ❌ FALSCH
const text = \`\${baseId} (v\${version})\`;

// ✅ RICHTIG
const text = baseId + ' (v' + version + ')';
```

### Komplexe Strings
```typescript
// ❌ FALSCH
const html = \`<div class="\${className}">\${content}</div>\`;

// ✅ RICHTIG
const html = '<div class="' + className + '">' + content + '</div>';
```

## Automatische Prüfung

Wenn du einen Fehler wie "missing ) after argument list" siehst, prüfe:
1. Gibt es Template-Strings (`\`...\``) im generierten JavaScript?
2. Werden `${}` Ausdrücke verwendet?
3. Wenn ja, ersetze sie durch String-Konkatenation

