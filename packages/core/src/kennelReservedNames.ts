/**
 * Kennel-Stammdaten (lineageId / Kennel-ID) und Anzeigename dürfen keine reservierten Slugs sein
 * (Routing, API, SPA). Vergleich case-insensitive, exakt (kein Teilstring).
 *
 * UI-Spiegel (Bundler): ui-app/src/app/config/kennel-reserved-names.ts — bei Änderung mitpflegen.
 */
export const KENNEL_RESERVED_SLUGS: readonly string[] = [
    'api',
    'kennel',
    'edit',
    'static',
    'save',
    'nodes',
    'auth',
    'mcp',
    'actions',
    '.well-known',
];

const LOWER = new Set(KENNEL_RESERVED_SLUGS.map((s) => s.toLowerCase()));

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
