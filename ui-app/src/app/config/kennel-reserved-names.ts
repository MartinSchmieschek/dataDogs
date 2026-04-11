/**
 * Muss mit packages/core/src/kennelReservedNames.ts (KENNEL_RESERVED_SLUGS) übereinstimmen.
 */
const LOWER = new Set(
  ['api', 'kennel', 'edit', 'static', 'save', 'nodes'].map((s) => s.toLowerCase()),
);

export function kennelLineageIdBlockedReason(id: string): string | null {
  const s = id.trim();
  if (!s) return null;
  if (LOWER.has(s.toLowerCase())) {
    return `Kennel-ID ist reserviert: ${s}`;
  }
  return null;
}

export function kennelDisplayNameBlockedReason(name: string): string | null {
  const s = name.trim();
  if (!s) return null;
  if (LOWER.has(s.toLowerCase())) {
    return `Anzeigename ist reserviert: ${s}`;
  }
  return null;
}
