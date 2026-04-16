/**
 * ~~~ OSM FEATURE RETRIEVER — gemeinsame Basis fuer alle Overpass-Dogs ~~~
 *
 * Liefert den kompletten Cache-/Fetch-/Area-Cache-Tanz, sodass konkrete Dogs
 * nur noch ihr Ding deklarieren muessen: welches Tag-Filter, welches Result-Shape,
 * welche Extras am Key.
 *
 * Subklassen ueberschreiben:
 *
 *   - `layer`           Layer-Name fuer geoBucketKey/Discriminant (z.B. "drinking-water")
 *   - `defaultRadiusM`  default wenn der User keinen Radius angibt
 *   - `maxRadiusM`      Hard-Cap
 *   - `parseQuery`      Season -> {lat, lng, radiusM, extras?}
 *   - `buildOverpassBody`  Baut den `(...)` -Block, Header kommt von der Basis
 *   - `mapElements`     Overpass-Rohelemente -> TResult (Subklassen-spezifisch)
 *   - `ttlMs`           optional — default GEO_CACHE_TTL_OSM_MS (5 Tage)
 *   - `postProcess`     optional — haengt nicht-serialisierbare Helper-Fns an
 *                       das Ergebnis. Wird BEI JEDEM Pfad aufgerufen (Cache-Hit,
 *                       Cache-Miss, AreaCache-Hit), damit der Consumer immer ein
 *                       vollstaendiges Objekt sieht.
 *
 * Die Basis nutzt den persistenten Area-Cache (`IAreaCache`) fuer Circle-in-Circle
 * Containment und den key/value-Cache (`ICacheHandler`) fuer exakte Bucket-Keys.
 * Beide TTLs sind identisch (ttlMs).
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, type IAreaCache, type IAreaCacheable, geoBucketKey, GEO_CACHE_TTL_OSM_MS } from "@datadogs/core";
import {
    fetchOverpassElementsWithFallback,
    overpassSettingsHeader,
    type OverpassRawElement,
} from "./overpassMirrorChain";

export interface OsmQueryBase {
    lat: number;
    lng: number;
    radiusM: number;
    /** Key/value pairs that discriminate cache partitions (e.g. cuisine, facets). */
    extras?: Record<string, string>;
}

/**
 * Minimal result shape: alle konkreten Results haben zumindest diese Felder.
 * Subklassen extenden das mit ihren eigenen Collections.
 */
export interface OsmBaseResult {
    center: { lat: number; lng: number };
    radiusM: number;
}

export abstract class OsmFeatureRetriever<
    TResult extends OsmBaseResult,
    TQueryPact extends new (...args: any[]) => IHuntingDog<unknown>,
> extends Dog<TResult> implements ICacheable, IAreaCacheable<TResult> {
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<TResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<TResult>): void {
        this.areaCache = cache;
    }

    // ------- Deklarative Pflicht-Hooks der Subklasse -------

    /** Layer-Name fuer Cache-Key und Discriminant. Bleibt stabil; aendert Partitionierung. */
    protected abstract readonly layer: string;
    /** Default-Radius wenn keiner gegeben ist. */
    protected abstract readonly defaultRadiusM: number;
    /** Harter Radius-Cap. */
    protected abstract readonly maxRadiusM: number;
    /** Mindest-Radius (Schutz gegen 0-Queries). */
    protected readonly minRadiusM: number = 50;

    /** Subklassen-Hook: Query aus Season lesen und validieren. */
    protected abstract parseQuery(season: IHuntingSeason): OsmQueryBase;

    /**
     * Subklassen-Hook: baut den `(...)` -Overpass-Body-Block.
     * Der Settings-Header und das `out`-Statement werden von der Basis angehaengt.
     *
     * Default-Endung ist `out center;` — Subklassen koennen via `outStatement`
     * ueberschreiben (z.B. "out geom;" fuer Trail).
     */
    protected abstract buildOverpassBody(q: OsmQueryBase): string;

    /** Subklassen-Hook: Rohelemente in das Subklassen-spezifische Result ueberfuehren. */
    protected abstract mapElements(elements: OverpassRawElement[], q: OsmQueryBase): TResult;

    /** Optional: anderes `out`-Statement (Default: `out center;`). */
    protected readonly outStatement: string = "out center;";

    /** Optional: TTL ueberschreiben (Default: 5 Tage). */
    protected readonly ttlMs: number = GEO_CACHE_TTL_OSM_MS;

    /**
     * Optional: Helper-Funktionen (toPolylines, toGeoJSON, ...) ans Ergebnis haengen.
     * Wird auf JEDEM Rueckgabepfad ausgefuehrt — frisch, Area-Cache-Hit, Key-Cache-Hit —
     * damit der Consumer niemals ein "nacktes" Objekt sieht. Default: identity.
     */
    protected postProcess(result: TResult, _q: OsmQueryBase): TResult {
        return result;
    }

    /**
     * Optional: Discriminant-String fuer den Area-Cache. Default ist `layer` +
     * sortierte extras. Subklassen koennen es ueberschreiben falls sie eine
     * andere Form brauchen.
     */
    protected computeDiscriminant(q: OsmQueryBase): string {
        if (!q.extras || Object.keys(q.extras).length === 0) return this.layer;
        const parts = Object.entries(q.extras)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => `${k}=${v}`);
        return parts.length === 0 ? this.layer : `${this.layer}:${parts.join(",")}`;
    }

    /**
     * Optional: Area-Cache-Hit filtern auf den angefragten Radius. Default:
     * Ergebnis unveraendert zurueckgeben — viele Dogs tragen ohnehin alle
     * Elemente der groesseren Flaeche (kein Filter noetig), andere ueberschreiben
     * es (z.B. Landmarks mit `filterElementsByRadius`).
     */
    protected filterAreaCacheHit(covering: TResult, _q: OsmQueryBase): TResult {
        return covering;
    }

    // ------- Standard Dog-Metadata. Subklassen ueberschreiben name/description/icon -------

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [this.queryPactClass];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get icon(): string | undefined {
        return undefined;
    }

    /** Subklasse liefert die Query-Pact-Klasse. */
    protected abstract readonly queryPactClass: TQueryPact;

    // ------- Helpers fuer Subklassen -------

    protected clampRadius(parsed: number): number {
        if (Number.isNaN(parsed) || parsed < 1) return this.defaultRadiusM;
        return Math.min(Math.max(Math.round(parsed), this.minRadiusM), this.maxRadiusM);
    }

    /** Baut die vollstaendige Overpass-QL-Query inkl. Header und out-Statement. */
    private assembleOverpassQuery(q: OsmQueryBase): string {
        const body = this.buildOverpassBody(q);
        return `${overpassSettingsHeader()}\n(\n${body}\n);\n${this.outStatement}`;
    }

    // ------- Der eine Yield-Collector den alle Subklassen teilen -------

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TResult> => {
        const q = this.parseQuery(season);

        if (Number.isNaN(q.lat) || Number.isNaN(q.lng)) {
            throw new Error(`${this.name}: Missing required query params (lat, lng)`);
        }

        const discriminant = this.computeDiscriminant(q);
        const extrasForKey: Record<string, string | number | boolean> = {};
        if (q.extras) {
            for (const [k, v] of Object.entries(q.extras)) {
                if (v !== undefined && v !== null && v !== "") extrasForKey[k] = v;
            }
        }
        const key = geoBucketKey(this.layer, q.lat, q.lng, q.radiusM, { extras: extrasForKey });

        // 1. Area-Cache — deckt eine groessere gecachte Flaeche die Query ab?
        if (this.areaCache) {
            const covering = await this.areaCache.findCovering(
                { lat: q.lat, lng: q.lng },
                q.radiusM,
                discriminant,
            );
            if (covering) {
                const filtered = this.filterAreaCacheHit(covering.data, q);
                return this.postProcess(filtered, q);
            }
        }

        // 2. Fetch-Factory — baut die Query, jagt sie durch die Mirror-Kette, mapped das Result
        //    und legt ins Area-Cache ab. Die postProcess wird NICHT hier gemacht,
        //    damit JSON-serialisierbare Objekte im Cache landen.
        const fetchFeatures = async (): Promise<TResult> => {
            const overpassQuery = this.assembleOverpassQuery(q);
            const rawElements = await fetchOverpassElementsWithFallback(overpassQuery, this.name);
            const result = this.mapElements(rawElements, q);

            if (this.areaCache) {
                await this.areaCache.store(
                    {
                        center: { lat: q.lat, lng: q.lng },
                        radiusM: q.radiusM,
                        data: result,
                        cacheKey: key,
                        cachedAt: Date.now(),
                        discriminant,
                    },
                    this.ttlMs,
                );
            }

            return result;
        };

        // 3. Key/Value-Cache — bucket-genauer Key. In-flight-dedup lebt im Handler.
        //    postProcess laeuft IMMER nach dem Cache-Roundtrip, egal ob Hit oder Miss.
        if (this.cacheHandler) {
            const cached = await this.cacheHandler.getOrFetch(key, this.ttlMs, fetchFeatures);
            return this.postProcess(cached, q);
        }

        return this.postProcess(await fetchFeatures(), q);
    };
}
