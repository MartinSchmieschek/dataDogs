/**
 * Abstimmung Express ↔ Angular (SPA):
 * - `/:kennelId` (öffentlicher Kennel) matcht nur ein Pfadsegment; reservierte Slugs → next().
 * - Blockliste der Kennel-IDs: `KENNEL_RESERVED_SLUGS` in @datadogs/core.
 *
 * SPA-Fallback (index.html) darf keine Backend-Pfade überschreiben (Präfixe unten).
 */
import { KENNEL_RESERVED_SLUGS } from '@datadogs/core';

export const SPA_FALLBACK_SKIP_PREFIXES = ['/api', '/static'] as const;

/** Gleiche Einträge wie KENNEL_RESERVED_SLUGS (lowercase) — Routing + Validierung. */
export const KENNEL_LINEAGE_ID_BLOCKLIST = new Set(KENNEL_RESERVED_SLUGS.map((s) => s.toLowerCase()));

/** @deprecated — gleiche Menge wie KENNEL_LINEAGE_ID_BLOCKLIST (Routing next()). */
export const RESERVED_TOP_LEVEL_SEGMENTS = KENNEL_LINEAGE_ID_BLOCKLIST;

export { kennelLineageIdBlockedReason, kennelDisplayNameBlockedReason } from '@datadogs/core';
