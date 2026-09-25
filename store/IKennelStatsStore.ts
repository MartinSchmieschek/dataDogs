// Aufrufe und Sterne je Kennel-Lineage (P4) — der Vertrag, den der Zaehler und der
// Stats-Dienst gegen den Store sprechen. Reine Zahlen: keine IP, kein User-Agent; die
// einzige Identitaet ist die userId einer Bewertung.

export const KENNEL_CALL_SOURCES = [
    'public', 'api-execute', 'mcp-execute',                                 // "Nutzung" — rankt
    'api-run', 'mcp-run', 'mcp-snapshot', 'mcp-build', 'swagger', 'unknown', // gespeichert, rankt nicht
] as const;
export type KennelCallSource = typeof KENNEL_CALL_SOURCES[number];
/** Quellen, die in rankedTotal/ranked30d einfliessen. Einzige Stelle fuer diese Regel. */
export const RANKED_CALL_SOURCES: readonly KennelCallSource[] = ['public', 'api-execute', 'mcp-execute'];

export interface KennelCallDelta { lineageId: string; day: string; source: KennelCallSource; count: number; leadFailed: number; }
export interface KennelCallAggregate { lineageId: string; total: number; last30d: number; leadFailed: number; rankedTotal: number; ranked30d: number; }
export interface KennelRatingAggregate { lineageId: string; count: number; sum: number; }
export type KennelRatingHistogram = { 1: number; 2: number; 3: number; 4: number; 5: number };

export interface IKennelStatsStore {
    /** Addiert jede Delta-Zeile atomar auf (lineageId, day, source). Leeres Array = no-op. Wirft bei DB-Fehler (Aufrufer behaelt die Deltas). */
    incrementKennelCalls(deltas: KennelCallDelta[]): Promise<void>;
    /** Aggregate je Lineage. Ohne lineageIds: alle. Mit lineageIds: nur diese (fehlende -> Aufrufer nimmt 0). */
    readKennelCallAggregates(sinceDay: string, lineageIds?: string[]): Promise<KennelCallAggregate[]>;
    readKennelRatingAggregates(lineageIds?: string[]): Promise<KennelRatingAggregate[]>;
    /** Verteilung 1..5 fuer eine Lineage (nur Rating-Endpunkt). */
    readKennelRatingHistogram(lineageId: string): Promise<KennelRatingHistogram>;
    readKennelRating(lineageId: string, userId: string): Promise<number | null>;
    upsertKennelRating(lineageId: string, userId: string, stars: number): Promise<void>;
    deleteKennelRating(lineageId: string, userId: string): Promise<boolean>;
    /** Loescht alle Zaehler und Bewertungen der Lineage (Kennel-Delete). */
    deleteKennelStats(lineageId: string): Promise<void>;
}
