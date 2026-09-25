// KennelStatsService — haengt `stats` an Kennel-Antworten (P4 4.4): Aufrufe aus der DB plus die
// ungeflushten Deltas dieser Instanz, Sterne als Rohschnitt und als Bayes-Score. Gelesen wird aus
// EINEM Memo fuer alle Lineages (zwei GROUP BY je Memo-Leben), nie je Kennel. Die Memo-Maps
// enthalten auch private Lineages — sie verlassen den Prozess nur ueber attach(), und attach()
// sieht nur, was der Aufrufer schon durch seinen Rechtefilter gelassen hat.
import type {
    IKennelStatsStore,
    KennelCallAggregate,
    KennelRatingHistogram,
} from '../store/IKennelStatsStore';
import { KennelCallCounter, utcDay } from './KennelCallCounter';

export interface KennelStats {
    calls:  { total: number; last30d: number; leadFailed: number; ranked: number; ranked30d: number };
    rating: { avg: number | null; count: number; score: number };   // avg null bei count 0; score 0 bei count 0
}

export type KennelRatingView = KennelStats['rating'] & {
    lineageId: string;
    histogram: KennelRatingHistogram;
    mine: number | null;
};

type CallCounts = Omit<KennelCallAggregate, 'lineageId'>;

interface StatsMemo {
    at: number;
    sinceDay: string;
    calls: Map<string, CallCounts>;
    ratings: Map<string, { count: number; sum: number }>;
    globalMean: number;
}

const DAY_MS = 86_400_000;
const NO_CALLS: CallCounts = { total: 0, last30d: 0, leadFailed: 0, rankedTotal: 0, ranked30d: 0 };

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Der Schluessel einer Kennel-Antwort: die Lineage, fuer Altbestand ohne lineageId die id. */
export function statsKeyOf(k: { id: string; lineageId?: string }): string {
    return k.lineageId || k.id;
}

export class KennelStatsService {
    static readonly BAYES_C = 5;
    static readonly WINDOW_DAYS = 30;

    private memo: StatsMemo | null = null;
    private loading: Promise<StatsMemo> | null = null;
    private readonly invalidationListeners: Array<() => void> = [];
    /** Wie oft das Memo aus der DB geladen wurde — Messpunkt fuer Tests und Abnahme (4.13). */
    private memoLoadCount = 0;
    /** Zaehlt Invalidierungen: ein Laden, das eine Invalidierung ueberholt hat, merkt sich nichts. */
    private generation = 0;

    constructor(
        private readonly store: IKennelStatsStore,
        private readonly counter: KennelCallCounter,
        private readonly memoMs = positiveIntFromEnv('KENNEL_STATS_MEMO_MS', 30_000),
        private readonly now: () => number = () => Date.now(),
    ) { }

    get memoLoads(): number {
        return this.memoLoadCount;
    }

    /** Haengt `stats` in place an (additiv wie lineageId/visibility). Schluessel: k.lineageId ?? k.id. */
    async attach<T extends { id: string; lineageId?: string }>(kennels: T[]): Promise<Array<T & { stats: KennelStats }>> {
        const memo = await this.current();
        const pending = this.counter.pendingAggregates(memo.sinceDay);
        for (const k of kennels) {
            const key = statsKeyOf(k);
            (k as T & { stats: KennelStats }).stats = this.statsOf(memo, key, pending.get(key));
        }
        return kennels as Array<T & { stats: KennelStats }>;
    }

    async attachOne<T extends { id: string; lineageId?: string }>(kennel: T): Promise<T & { stats: KennelStats }> {
        return (await this.attach([kennel]))[0];
    }

    /** Die Rating-Sicht einer Lineage — Aggregat, Verteilung und die eigene Bewertung (frisch aus der DB). */
    async ratingView(lineageId: string, userId: string | null): Promise<KennelRatingView> {
        const [memo, aggregates, histogram, mine] = await Promise.all([
            this.current(),
            this.store.readKennelRatingAggregates([lineageId]),
            this.store.readKennelRatingHistogram(lineageId),
            userId ? this.store.readKennelRating(lineageId, userId) : Promise.resolve(null),
        ]);
        const own = aggregates[0] ?? { count: 0, sum: 0 };
        return { lineageId, ...this.ratingOf(memo.globalMean, own.count, own.sum), histogram, mine };
    }

    /** Nach Flush, Rating-Schreibzugriff und Kennel-Delete: das naechste attach laedt neu. */
    invalidate(): void {
        this.memo = null;
        this.loading = null;
        this.generation += 1;
        for (const listener of this.invalidationListeners) {
            try { listener(); } catch { /* ein Zuhoerer darf die Invalidierung nicht brechen */ }
        }
    }

    /** Abhaengige Memos (Landing) haengen sich hier an. */
    onInvalidate(listener: () => void): void {
        this.invalidationListeners.push(listener);
    }

    /** Kennel geloescht: Zaehler und Sterne der Lineage fallen, ungeflushte Deltas auch. */
    async forgetKennel(lineageId: string): Promise<void> {
        this.counter.forget(lineageId);
        await this.store.deleteKennelStats(lineageId);
        this.invalidate();
    }

    /** Bayes: (C*m + sum) / (C + n); ohne Bewertung 0. m = globaler Mittelwert. */
    static score(count: number, sum: number, globalMean: number): number {
        if (count === 0) return 0;
        return (KennelStatsService.BAYES_C * globalMean + sum) / (KennelStatsService.BAYES_C + count);
    }

    private ratingOf(globalMean: number, count: number, sum: number): KennelStats['rating'] {
        return {
            avg: count === 0 ? null : sum / count,
            count,
            score: KennelStatsService.score(count, sum, globalMean),
        };
    }

    private statsOf(memo: StatsMemo, key: string, pending: CallCounts | undefined): KennelStats {
        const stored = memo.calls.get(key) ?? NO_CALLS;
        const extra = pending ?? NO_CALLS;
        const rating = memo.ratings.get(key) ?? { count: 0, sum: 0 };
        return {
            calls: {
                total: stored.total + extra.total,
                last30d: stored.last30d + extra.last30d,
                leadFailed: stored.leadFailed + extra.leadFailed,
                ranked: stored.rankedTotal + extra.rankedTotal,
                ranked30d: stored.ranked30d + extra.ranked30d,
            },
            rating: this.ratingOf(memo.globalMean, rating.count, rating.sum),
        };
    }

    /** Das gueltige Memo — ein abgelaufenes wird EINMAL neu geladen, parallele Leser teilen die Ladung. */
    private async current(): Promise<StatsMemo> {
        if (this.memo && this.now() - this.memo.at < this.memoMs) return this.memo;
        if (!this.loading) {
            const loading: Promise<StatsMemo> = this.load().finally(() => {
                if (this.loading === loading) this.loading = null;
            });
            this.loading = loading;
        }
        return this.loading;
    }

    private async load(): Promise<StatsMemo> {
        const at = this.now();
        const generation = this.generation;
        // 30 Kalendertage inklusive heute.
        const sinceDay = utcDay(new Date(at - (KennelStatsService.WINDOW_DAYS - 1) * DAY_MS));
        this.memoLoadCount += 1;
        const [callRows, ratingRows] = await Promise.all([
            this.store.readKennelCallAggregates(sinceDay),
            this.store.readKennelRatingAggregates(),
        ]);
        const calls = new Map<string, CallCounts>();
        for (const { lineageId, ...counts } of callRows) calls.set(lineageId, counts);
        const ratings = new Map<string, { count: number; sum: number }>();
        let count = 0;
        let sum = 0;
        for (const r of ratingRows) {
            ratings.set(r.lineageId, { count: r.count, sum: r.sum });
            count += r.count;
            sum += r.sum;
        }
        const memo: StatsMemo = { at, sinceDay, calls, ratings, globalMean: count === 0 ? 0 : sum / count };
        if (generation === this.generation) this.memo = memo;
        return memo;
    }
}
