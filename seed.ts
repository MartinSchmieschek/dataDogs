// Arr, this be the seeding rite — spoken once at the dawn of time (or a fresh database).
// We end as we began: from the void we summon the first hound and its kennel.
import { randomUUID } from 'crypto';
import { PrismaStore } from './store/PrismaStore';
import { IStore } from './store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@datadogs/core';
import { TalkingDog } from '@datadogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@datadogs/dogs-demo';
import { PublicTransportRetriever } from '@datadogs/dogs-public-transport';
import { WeatherRetriever } from '@datadogs/dogs-weather';
import { AirQualityRetriever } from '@datadogs/dogs-air-quality';
import { GeocodingRetriever } from '@datadogs/dogs-geocoding';
import { WikiNearbyRetriever } from '@datadogs/dogs-wikipedia';
import { SunRetriever } from '@datadogs/dogs-sun';

/** Check if a kennel with this lineageId already exists. */
async function kennelExists(store: IStore, kennelLineageId: string): Promise<boolean> {
    const all = await store.findByType('KennelConfig');
    return all.some((r: any) => r.lineageId === kennelLineageId);
}

/** Save a versioned kennel seed — lineageId is the stable kennel ID, id is a fresh GUID. */
async function saveKennelSeed(store: IStore, kennelLineageId: string, data: {
    name?: string; description?: string; emoji?: string;
    dogIds: string[]; defaultQuery?: any; defaultBody?: any;
}): Promise<void> {
    const versionId = randomUUID();
    await store.save({
        id: versionId,
        type: 'KennelConfig',
        lineageId: kennelLineageId,
        parentId: null,
        name: data.name,
        description: data.description,
        emoji: data.emoji,
        dogIds: data.dogIds,
        defaultQuery: data.defaultQuery ? JSON.stringify(data.defaultQuery) : undefined,
        defaultBody: data.defaultBody ? JSON.stringify(data.defaultBody) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Summons the first SerializedDog into the deep — a MimicDog wearing the LayoutInputProvider's form.
 * Through endless faces, countless forms, a multitude unfolds; this is the first face of many.
 * If the store already holds a hound, we leave it be — we do not disturb what already lurks in the dark.
 * Returns the lineageId (lineage GUID) of the seeded hound so the kennel may reference it.
 */
export async function seedSerializedDog(nodesStore: IStore): Promise<string | null> {
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        // Forge the spirit's identity — a GUID for the incarnation, a GUID for the lineage.
        const versionId = randomUUID();
        const lineageId = randomUUID();

        // The first mimic — it imitates LayoutInputProvider and hunts recipes from the eldritch RandomDogs.
        // Corporeal laws are unwritten as suns and love retreat: it borrows another's form to live.
        const seedCfg: IMimicDogConfig = {
            id: versionId,
            lineageId,
            parentId: null,
            displayName: 'Seed Serialized 1',
            imitates: 'LayoutInputProvider',
            parentsRequired: ['RandomRecipesRetriever', 'RandomEveryThingRetriever'],
            parentsOptional: [],
            theRun: `
return {
    type: "tinder",
    imageUrl: RandomEveryThingRetriever.woof.url,
    title: RandomRecipesRetriever.name,
    description: RandomRecipesRetriever.instructions.join(" and ")
}
`,
        };

        await nodesStore.save({
            id: versionId,
            type: SerializedDog.name,
            lineageId,
            parentId: null,
            displayName: 'Seed Serialized 1',
            serializedDogConfig: JSON.stringify(seedCfg),
            createdAt: new Date(),
        });
        console.log(`✅ Seeded initial SerializedDog into DB (lineageId: ${lineageId})`);
        return lineageId;
    }

    // If a hound already lurks, extract its lineageId for the kennel manifest.
    try {
        const config = typeof nodeSeeds[0].serializedDogConfig === 'string'
            ? JSON.parse(nodeSeeds[0].serializedDogConfig)
            : nodeSeeds[0].serializedDogConfig;
        return config.lineageId || (nodeSeeds[0] as any).lineageId || null;
    } catch {
        return null;
    }
}

/**
 * Raises the first kennel from the abyss — a gathering place for all base hounds.
 * To cosmic madness laws submit, though stalwart minds entreat; every dog finds its kennel.
 * If a kennel already prowls the store, we disturb it not — the void remembers what has been.
 */
export async function seedKennelConfig(kennelsStore: IStore, seedLineageId: string | null): Promise<void> {
    // The full roster of base hounds — born of the code, not the store.
    // Each is summoned fresh upon every run, like stars that fell and rose again.
    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever
    ];

    // Rouse each hound just long enough to read its name for the kennel manifest.
    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());

    const kennelSeeds = await kennelsStore.findByType('KennelConfig');
    if (!kennelSeeds || kennelSeeds.length === 0) {
        // The kennel references the lineageId (lineage GUID), not a specific version —
        // so it always summons the latest incarnation from the branching tree.
        const dogIds = [
            ...(seedLineageId ? [seedLineageId] : []),
            ...allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name)
        ];

        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Bind the dogIds to the abyss as a JSON string — the store speaks only in primitive tongues.
        await saveKennelSeed(kennelsStore, defaultKennelConfig.id, {
            name: defaultKennelConfig.name,
            description: defaultKennelConfig.description,
            dogIds: defaultKennelConfig.dogIds,
            defaultQuery: defaultKennelConfig.defaultQuery,
            defaultBody: defaultKennelConfig.defaultBody,
        });
        console.log('✅ Seeded initial Kennel-Config into DB');
    }
}

/**
 * Raises the public transport kennel from the transit abyss — a gathering place
 * for hounds that sniff out nearby stations and departures.
 * The MimicDog maps QueryRetriever params (lat, lng, distance, results)
 * into the PublicTransportQueryPact's shape so the PublicTransportRetriever may feast.
 */
export async function seedPublicTransportKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'public-transport-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return; // Already seeded, disturb it not

    // Forge the MimicDog that maps query params to PublicTransportQuery
    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'DB GPS Query Mapper',
        imitates: 'PublicTransportQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    distance: QueryRetriever.distance || "1000",
    results: QueryRetriever.results || "8"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'DB GPS Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    // Raise the kennel: PublicTransportRetriever as lead, plus QueryRetriever and the MimicDog
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Public Transport Nearby',
        description: 'OEPNV: Haltestellen und Abfahrten in der Naehe (Bus, Tram, U-Bahn, S-Bahn, Zug)',
        emoji: '\uD83D\uDE82',
        dogIds: [
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded DB Nearby Kennel (kennelId: ${kennelId}, mimicDogId: ${mimicDogId})`);
}

/**
 * Performs all seeding rites in their proper order — first the hound, then the kennel.
 * In luminous space, blackened stars must be seeded before the hunt can begin.
 */
export async function runSeeds(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const seedLineageId = await seedSerializedDog(nodesStore);
    await seedKennelConfig(kennelsStore, seedLineageId);
    await seedPublicTransportKennel(nodesStore, kennelsStore);
    await seedWeatherKennel(nodesStore, kennelsStore);
    await seedAirQualityKennel(nodesStore, kennelsStore);
    await seedGeocodingKennel(nodesStore, kennelsStore);
    await seedWikiNearbyKennel(nodesStore, kennelsStore);
    await seedSunKennel(nodesStore, kennelsStore);
    await seedLocationDashboardKennel(nodesStore, kennelsStore);
    await seedAddressLookupKennel(nodesStore, kennelsStore);
    await seedSmartGuideKennel(nodesStore, kennelsStore);
    await seedCompareKennel(nodesStore, kennelsStore);
}

/**
 * The Compare kennel — kennels calling kennels.
 * Takes two addresses, fetches /smart-guide for each via fetch(),
 * then a Comparator dog compares the results.
 *
 * Wave 1: QueryRetriever (captures ?from=...&to=...)
 * Wave 2: FetchBothLocations (SerializedDog — calls /smart-guide twice via fetch)
 * Wave 3: LocationComparator (reads FetchBothLocations → compares and scores)
 */
export async function seedCompareKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'compare-locations';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Wave 2: Fetch both locations by calling /smart-guide kennel
    const fetcherVersionId = randomUUID();
    const fetcherDogId = randomUUID();
    const fetcherCfg = {
        id: fetcherVersionId,
        lineageId: fetcherDogId,
        parentId: null,
        displayName: 'Fetch Both Locations',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
const from = QueryRetriever.from;
const to = QueryRetriever.to;

if (!from || !to) throw new Error("Bitte 'from' und 'to' Adressen angeben");

const base = "http://localhost:3000/smart-guide?address=";

const [locationA, locationB] = await Promise.all([
    fetch(base + encodeURIComponent(from)).then(r => r.json()),
    fetch(base + encodeURIComponent(to)).then(r => r.json()),
]);

return { locationA, locationB, addressA: from, addressB: to }
`,
    };
    await nodesStore.save({
        id: fetcherVersionId,
        type: SerializedDog.name,
        lineageId: fetcherDogId,
        parentId: null,
        displayName: 'Fetch Both Locations',
        serializedDogConfig: JSON.stringify(fetcherCfg),
        createdAt: new Date(),
    });

    // Wave 3: Compare both locations
    const comparatorVersionId = randomUUID();
    const comparatorDogId = randomUUID();
    const comparatorCfg = {
        id: comparatorVersionId,
        lineageId: comparatorDogId,
        parentId: null,
        displayName: 'Location Comparator',
        parentsRequired: [fetcherDogId],
        parentsOptional: [],
        theRun: `
const a = FetchBothLocations.locationA;
const b = FetchBothLocations.locationB;

// Smart Guide hat: resolvedAddress, recommendation, highlight, transport
function summarize(loc, label) {
    const rec = loc.recommendation || {};
    const cond = rec.conditions || {};
    const trans = loc.transport || {};
    const hl = loc.highlight || {};
    const addr = loc.resolvedAddress || {};

    return {
        address: addr.displayName || label,
        city: addr.city || null,
        score: rec.score || 0,
        overall: rec.overall || null,
        activities: rec.activities || [],
        warnings: rec.warnings || [],
        temperature: cond.temperature || null,
        weather: cond.weatherDescription || null,
        airQuality: cond.airQuality || null,
        uvIndex: cond.uvIndex || null,
        windSpeed: cond.windSpeed || null,
        transportStations: trans.stations ? trans.stations.length : 0,
        topStation: trans.stations && trans.stations[0] ? trans.stations[0].name : null,
        highlight: hl.highlight ? hl.highlight.title : null,
        highlightExtract: hl.highlight ? hl.highlight.extract : null,
        nearbyArticles: hl.nearby ? hl.nearby.length : 0,
    };
}

const sumA = summarize(a, FetchBothLocations.addressA);
const sumB = summarize(b, FetchBothLocations.addressB);

const winner = sumA.score > sumB.score
    ? FetchBothLocations.addressA
    : sumA.score < sumB.score
        ? FetchBothLocations.addressB
        : "Unentschieden";

return {
    locationA: sumA,
    locationB: sumB,
    winner,
    verdict: sumA.score > sumB.score
        ? sumA.address.split(",")[0] + " gewinnt mit " + sumA.score + " vs " + sumB.score + " Punkten"
        : sumA.score < sumB.score
            ? sumB.address.split(",")[0] + " gewinnt mit " + sumB.score + " vs " + sumA.score + " Punkten"
            : "Beide Orte sind gleichwertig (" + sumA.score + " Punkte)",
}
`,
    };
    await nodesStore.save({
        id: comparatorVersionId,
        type: SerializedDog.name,
        lineageId: comparatorDogId,
        parentId: null,
        displayName: 'Location Comparator',
        serializedDogConfig: JSON.stringify(comparatorCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Compare Locations',
        description: 'Zwei Adressen vergleichen: Kennel ruft Kennel auf — Wetter, Luft, OEPNV, Kultur im Vergleich',
        emoji: '\u2696\uFE0F',
        dogIds: [
            comparatorDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            fetcherDogId,
        ],
        defaultQuery: { from: 'Koelner Dom', to: 'Brandenburger Tor Berlin' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Compare Locations Kennel (kennelId: ${kennelId})`);
}

/**
 * The Smart Guide kennel — the deepest dog chain (7 waves).
 *
 * Wave 1: QueryRetriever (captures ?address=...)
 * Wave 2: GeocodingMimic (address → GeocodingQuery)
 * Wave 3: GeocodingRetriever (address → lat/lng)
 * Wave 4: Weather/Air/Sun/Transport/Wiki Mimics (read GPS FROM GeocodingRetriever)
 * Wave 5: All 5 Retrievers run in parallel
 * Wave 6: ActivityRecommender (reads Weather + AirQuality + Sun → generates activity advice)
 *         + WikiHighlightPicker (reads WikiNearby → picks the best article to visit)
 * Wave 7: Lead dog combines everything + recommendation + highlight
 */
export async function seedSmartGuideKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'smart-guide';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Geocoding ---
    const geoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...geoMimic,
        displayName: 'SG: Address → Geocoding',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { address: QueryRetriever.address, limit: "1" }`,
    });

    // --- Wave 4: GPS Mimics (read from GeocodingRetriever) ---
    const weatherMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...weatherMimic,
        displayName: 'SG: GPS → Weather',
        imitates: 'WeatherQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.latitude), lng: String(loc.longitude) }`,
    });

    const airMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...airMimic,
        displayName: 'SG: GPS → AirQuality',
        imitates: 'AirQualityQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.latitude), lng: String(loc.longitude) }`,
    });

    const sunMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...sunMimic,
        displayName: 'SG: GPS → Sun',
        imitates: 'SunQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.latitude), lng: String(loc.longitude), days: "3" }`,
    });

    const transportMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...transportMimic,
        displayName: 'SG: GPS → Transport',
        imitates: 'PublicTransportQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.latitude), lng: String(loc.longitude), distance: "500", results: "5" }`,
    });

    const wikiMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...wikiMimic,
        displayName: 'SG: GPS → Wiki',
        imitates: 'WikiNearbyQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `const loc = GeocodingRetriever.results[0]; return { lat: String(loc.latitude), lng: String(loc.longitude), radius: "1000", limit: "10", lang: "de" }`,
    });

    // --- Wave 6: Activity Recommender (reads Weather + AirQuality + Sun) ---
    const recommenderVersionId = randomUUID();
    const recommenderDogId = randomUUID();
    const recommenderCfg = {
        id: recommenderVersionId,
        lineageId: recommenderDogId,
        parentId: null,
        displayName: 'Activity Recommender',
        parentsRequired: ['WeatherRetriever', 'AirQualityRetriever', 'SunRetriever'],
        parentsOptional: [],
        theRun: `
const temp = WeatherRetriever.current.temperature;
const weatherCode = WeatherRetriever.current.weatherCode;
const wind = WeatherRetriever.current.windSpeed;
const aqi = AirQualityRetriever.current.europeanAqi;
const uv = SunRetriever.today.uvIndexMax;
const sunHours = SunRetriever.today.sunshineHours;
const birch = AirQualityRetriever.pollen ? AirQualityRetriever.pollen.birch : 0;
const grass = AirQualityRetriever.pollen ? AirQualityRetriever.pollen.grass : 0;

const activities = [];
const warnings = [];

// Temperature-based
if (temp >= 15 && temp <= 28) activities.push("Perfekt fuer einen Spaziergang oder Radtour");
else if (temp >= 10 && temp < 15) activities.push("Angenehm fuer eine Wanderung mit leichter Jacke");
else if (temp >= 0 && temp < 10) activities.push("Kuehl — warm anziehen fuer Outdoor-Aktivitaeten");
else if (temp < 0) activities.push("Frostig — Indoor-Aktivitaeten empfohlen");
else activities.push("Sehr warm — Schatten suchen, viel trinken");

// Weather code based
if (weatherCode <= 3) activities.push("Klarer Himmel — gut fuer Sightseeing und Fotografie");
else if (weatherCode >= 51 && weatherCode <= 67) {
    warnings.push("Regen erwartet — Regenschirm nicht vergessen");
    activities.push("Museen und Indoor-Sehenswuerdigkeiten bevorzugen");
}
else if (weatherCode >= 71 && weatherCode <= 77) warnings.push("Schneefall — vorsichtig auf glatten Wegen");
else if (weatherCode >= 95) warnings.push("Gewitter — besser drinnen bleiben");

// Air quality
if (aqi > 60) warnings.push("Schlechte Luftqualitaet (AQI " + aqi + ") — Aufenthalt im Freien einschraenken");
if (birch > 100 || grass > 50) warnings.push("Hoher Pollenflug — Allergiker aufgepasst");

// UV
if (uv >= 6) warnings.push("Hoher UV-Index (" + uv.toFixed(1) + ") — Sonnenschutz tragen");
else if (uv >= 3) activities.push("Maessige UV-Strahlung — Sonnenbrille empfohlen");

// Wind
if (wind > 40) warnings.push("Sturmwarnung — starker Wind (" + wind + " km/h)");
else if (wind > 20) warnings.push("Windiger Tag (" + wind + " km/h)");

// Sunshine
if (sunHours > 8) activities.push("Sonnenreicher Tag — ideal fuer Outdoor-Erkundungen");

// Overall score
let score = 50;
if (temp >= 12 && temp <= 25) score += 20;
if (weatherCode <= 3) score += 15;
if (aqi <= 40) score += 10;
if (uv < 8) score += 5;
if (wind < 20) score += 5;
score = Math.min(100, Math.max(0, score));

let overall;
if (score >= 80) overall = "Ausgezeichnet — perfekter Tag fuer draussen";
else if (score >= 60) overall = "Gut — angenehme Bedingungen";
else if (score >= 40) overall = "Maessig — mit Einschraenkungen machbar";
else overall = "Ungünstig — Indoor-Alternativen empfohlen";

return {
    score,
    overall,
    activities,
    warnings,
    conditions: {
        temperature: temp,
        weatherDescription: WeatherRetriever.current.weatherDescription,
        airQuality: AirQualityRetriever.current.aqiDescription,
        uvIndex: uv,
        windSpeed: wind,
    },
}
`,
    };
    await nodesStore.save({
        id: recommenderVersionId,
        type: SerializedDog.name,
        lineageId: recommenderDogId,
        parentId: null,
        displayName: 'Activity Recommender',
        serializedDogConfig: JSON.stringify(recommenderCfg),
        createdAt: new Date(),
    });

    // --- Wave 6: Wiki Highlight Picker (reads WikiNearby → picks best article) ---
    const highlightVersionId = randomUUID();
    const highlightDogId = randomUUID();
    const highlightCfg = {
        id: highlightVersionId,
        lineageId: highlightDogId,
        parentId: null,
        displayName: 'Wiki Highlight Picker',
        parentsRequired: ['WikiNearbyRetriever'],
        parentsOptional: [],
        theRun: `
const articles = WikiNearbyRetriever.articles;
if (!articles || articles.length === 0) return { highlight: null, nearby: [] };

// Pick the article with the longest extract as "highlight" (most notable)
const sorted = [...articles].sort((a, b) => b.extract.length - a.extract.length);
const highlight = sorted[0];

// Rest sorted by distance
const nearby = articles
    .filter(a => a.pageId !== highlight.pageId)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map(a => ({ title: a.title, distance: a.distance, url: a.articleUrl }));

return {
    highlight: {
        title: highlight.title,
        extract: highlight.extract,
        url: highlight.articleUrl,
        thumbnail: highlight.thumbnailUrl,
        distance: highlight.distance,
    },
    nearby,
}
`,
    };
    await nodesStore.save({
        id: highlightVersionId,
        type: SerializedDog.name,
        lineageId: highlightDogId,
        parentId: null,
        displayName: 'Wiki Highlight Picker',
        serializedDogConfig: JSON.stringify(highlightCfg),
        createdAt: new Date(),
    });

    // --- Wave 7: Lead dog — the grand combiner ---
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();
    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Smart Guide',
        parentsRequired: [
            'GeocodingRetriever',
            recommenderDogId,
            highlightDogId,
            'PublicTransportRetriever',
        ],
        parentsOptional: [],
        theRun: `
const geo = GeocodingRetriever.results[0];

return {
    resolvedAddress: {
        displayName: geo.displayName,
        latitude: geo.latitude,
        longitude: geo.longitude,
        city: geo.address.city,
    },
    recommendation: ${JSON.stringify(recommenderDogId).replace(/"/g, "'")} in this ? this[${JSON.stringify(recommenderDogId).replace(/"/g, "'")}] : null,
    highlight: ${JSON.stringify(highlightDogId).replace(/"/g, "'")} in this ? this[${JSON.stringify(highlightDogId).replace(/"/g, "'")}] : null,
    transport: {
        stations: PublicTransportRetriever.stations.slice(0, 3).map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            departures: s.departures.slice(0, 2).map(d => d.line + " -> " + d.direction),
        })),
    },
}
`,
    };

    // Hmm, the lead dog accesses SerializedDogs by their storageId as globals.
    // Let me fix the theRun to use the display names instead.
    // Actually, SerializedDog parents are accessed by their storageId in the VM context.
    // But the recommender and highlight dogs are SerializedDogs referenced by lineageId.
    // The VM context maps parent names. Let me check...
    // For SerializedDogs, the global variable name in VM is the storageId (which is the versionId or lineageId).
    // That won't be a clean variable name. Let me use a different approach:
    // Reference them via season.exhausted.find pattern? No, SerializedDog code runs in VM with parent yields as globals.
    // The global names for SerializedDog parents are their displayName (cleaned) or storageId.
    // Actually looking at SerializedDog.ts, it maps by the dog's name property which for SerializedDog is the displayName.

    // Let me rewrite the lead dog to reference by displayName (which becomes the global variable name)
    leadCfg.theRun = `
const geo = GeocodingRetriever.results[0];

return {
    resolvedAddress: {
        displayName: geo.displayName,
        latitude: geo.latitude,
        longitude: geo.longitude,
        city: geo.address.city,
    },
    recommendation: ActivityRecommender,
    highlight: WikiHighlightPicker,
    transport: {
        stations: PublicTransportRetriever.stations.slice(0, 3).map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            departures: s.departures.slice(0, 2).map(d => d.line + " -> " + d.direction),
        })),
    },
}
`;

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Smart Guide',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Smart Guide',
        description: '7-Wave Kette: Adresse → GPS → Wetter/Luft/Sonne → Aktivitaets-Empfehlung + Wiki-Highlight + OEPNV',
        emoji: '\uD83E\uDDED',
        dogIds: [
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            geoMimic.lineageId,
            weatherMimic.lineageId,
            airMimic.lineageId,
            sunMimic.lineageId,
            transportMimic.lineageId,
            wikiMimic.lineageId,
            recommenderDogId,
            highlightDogId,
        ],
        defaultQuery: { address: 'Koelner Dom' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Smart Guide Kennel (kennelId: ${kennelId})`);
}

/**
 * The address lookup kennel — a true dog chain where data flows through.
 *
 * User enters an address → GeocodingRetriever resolves to lat/lng →
 * that lat/lng feeds into Weather, AirQuality, Sun, Transport, Wiki.
 * The MimicDogs in the middle READ from GeocodingRetriever's yield,
 * not from QueryRetriever — real dependency-driven data flow.
 *
 * Wave execution:
 *   1: QueryRetriever (captures ?address=...)
 *   2: GeocodingMimic (maps address → GeocodingQuery)
 *   3: GeocodingRetriever (resolves address → lat/lng/displayName)
 *   4: Weather/Air/Sun/Transport/Wiki Mimics (read lat/lng FROM GeocodingRetriever)
 *   5: All 5 retrievers run in parallel
 *   6: Lead SerializedDog combines everything + resolved address
 */
export async function seedAddressLookupKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'address-lookup';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Geocoding MimicDog (reads from QueryRetriever) ---
    const geoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...geoMimic,
        displayName: 'Address → GeocodingQuery',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { address: QueryRetriever.address, limit: "1" }`,
    });

    // --- Wave 4: Mimics that read FROM GeocodingRetriever's yield ---
    const weatherMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...weatherMimic,
        displayName: 'Geocoded GPS → WeatherQuery',
        imitates: 'WeatherQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.latitude), lng: String(loc.longitude) }
`,
    });

    const airMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...airMimic,
        displayName: 'Geocoded GPS → AirQualityQuery',
        imitates: 'AirQualityQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.latitude), lng: String(loc.longitude) }
`,
    });

    const sunMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...sunMimic,
        displayName: 'Geocoded GPS → SunQuery',
        imitates: 'SunQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.latitude), lng: String(loc.longitude), days: "3" }
`,
    });

    const transportMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...transportMimic,
        displayName: 'Geocoded GPS → TransportQuery',
        imitates: 'PublicTransportQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.latitude), lng: String(loc.longitude), distance: "500", results: "5" }
`,
    });

    const wikiMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...wikiMimic,
        displayName: 'Geocoded GPS → WikiQuery',
        imitates: 'WikiNearbyQueryProvider',
        parentsRequired: ['GeocodingRetriever'],
        theRun: `
const loc = GeocodingRetriever.results[0];
return { lat: String(loc.latitude), lng: String(loc.longitude), radius: "500", limit: "5", lang: "de" }
`,
    });

    // --- Wave 6: Lead dog — combines geocoding result + all data ---
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Address Lookup Dashboard',
        parentsRequired: [
            'GeocodingRetriever',
            'WeatherRetriever',
            'AirQualityRetriever',
            'SunRetriever',
            'PublicTransportRetriever',
            'WikiNearbyRetriever',
        ],
        parentsOptional: [],
        theRun: `
const geo = GeocodingRetriever.results[0];
const weather = WeatherRetriever;
const air = AirQualityRetriever;
const sun = SunRetriever;
const transport = PublicTransportRetriever;
const wiki = WikiNearbyRetriever;

return {
    resolvedAddress: {
        displayName: geo.displayName,
        latitude: geo.latitude,
        longitude: geo.longitude,
        street: geo.address.street,
        city: geo.address.city,
        postcode: geo.address.postcode,
        country: geo.address.country,
    },
    weather: {
        temperature: weather.current.temperature,
        apparentTemperature: weather.current.apparentTemperature,
        description: weather.current.weatherDescription,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
    },
    airQuality: {
        aqi: air.current.europeanAqi,
        description: air.current.aqiDescription,
        pm25: air.current.pm25,
        pm10: air.current.pm10,
        pollen: air.pollen,
    },
    sun: {
        sunrise: sun.today.sunrise,
        sunset: sun.today.sunset,
        daylightHours: sun.today.daylightHours,
        uvIndex: sun.today.uvIndexMax,
        uvRisk: sun.today.uvRisk,
    },
    transport: {
        stationCount: transport.stationCount,
        stations: transport.stations.map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            modes: s.station.modes,
            nextDepartures: s.departures.slice(0, 3).map(d => ({
                line: d.line, mode: d.mode, direction: d.direction, when: d.when,
            })),
        })),
    },
    wikipedia: {
        articleCount: wiki.articleCount,
        articles: wiki.articles.map(a => ({
            title: a.title, distance: a.distance, extract: a.extract,
            url: a.articleUrl, thumbnail: a.thumbnailUrl,
        })),
    },
}
`,
    };

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Address Lookup Dashboard',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    // Kennel config
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Address Lookup',
        description: 'Adresse eingeben → GPS aufloesen → Wetter, Luft, Sonne, OEPNV, Wikipedia',
        emoji: '\uD83D\uDD0D',
        dogIds: [
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            geoMimic.lineageId,
            weatherMimic.lineageId,
            airMimic.lineageId,
            sunMimic.lineageId,
            transportMimic.lineageId,
            wikiMimic.lineageId,
        ],
        defaultQuery: { address: 'Brandenburger Tor, Berlin' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Address Lookup Kennel (kennelId: ${kennelId})`);
}

/** Helper: save a MimicDog to the store */
async function saveMimic(store: IStore, opts: {
    versionId: string; lineageId: string; displayName: string;
    imitates: string; parentsRequired: string[]; theRun: string;
}): Promise<void> {
    const cfg: IMimicDogConfig = {
        id: opts.versionId,
        lineageId: opts.lineageId,
        parentId: null,
        displayName: opts.displayName,
        imitates: opts.imitates,
        parentsRequired: opts.parentsRequired,
        parentsOptional: [],
        theRun: opts.theRun,
    };
    await store.save({
        id: opts.versionId,
        type: SerializedDog.name,
        lineageId: opts.lineageId,
        parentId: null,
        displayName: opts.displayName,
        serializedDogConfig: JSON.stringify(cfg),
        createdAt: new Date(),
    });
}

/**
 * Raises the location dashboard kennel — the ultimate combo kennel.
 * One GPS input, all data dogs combined: Weather, AirQuality, Sun,
 * PublicTransport, WikiNearby. A SerializedDog as lead combines all yields.
 */
export async function seedLocationDashboardKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'location-dashboard';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // We need 5 MimicDogs (one per Pact) + 1 SerializedDog (lead combiner)
    const mimics: Array<{ lineageId: string; versionId: string; displayName: string; imitates: string; theRun: string }> = [
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Weather Mapper',
            imitates: 'WeatherQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard AirQuality Mapper',
            imitates: 'AirQualityQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Sun Mapper',
            imitates: 'SunQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, days: "3" }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Transport Mapper',
            imitates: 'PublicTransportQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, distance: "500", results: "5" }`,
        },
        {
            lineageId: randomUUID(), versionId: randomUUID(),
            displayName: 'Dashboard Wiki Mapper',
            imitates: 'WikiNearbyQueryProvider',
            theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: "500", limit: "5", lang: "de" }`,
        },
    ];

    // Save all MimicDogs
    for (const m of mimics) {
        const cfg: IMimicDogConfig = {
            id: m.versionId,
            lineageId: m.lineageId,
            parentId: null,
            displayName: m.displayName,
            imitates: m.imitates,
            parentsRequired: ['QueryRetriever'],
            parentsOptional: [],
            theRun: m.theRun,
        };
        await nodesStore.save({
            id: m.versionId,
            type: SerializedDog.name,
            lineageId: m.lineageId,
            parentId: null,
            displayName: m.displayName,
            serializedDogConfig: JSON.stringify(cfg),
            createdAt: new Date(),
        });
    }

    // Lead dog: SerializedDog that combines all retriever yields
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Location Dashboard',
        parentsRequired: [
            'WeatherRetriever',
            'AirQualityRetriever',
            'SunRetriever',
            'PublicTransportRetriever',
            'WikiNearbyRetriever',
        ],
        parentsOptional: [],
        theRun: `
const weather = WeatherRetriever;
const air = AirQualityRetriever;
const sun = SunRetriever;
const transport = PublicTransportRetriever;
const wiki = WikiNearbyRetriever;

return {
    location: weather.location,
    weather: {
        temperature: weather.current.temperature,
        apparentTemperature: weather.current.apparentTemperature,
        description: weather.current.weatherDescription,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
    },
    airQuality: {
        aqi: air.current.europeanAqi,
        description: air.current.aqiDescription,
        pm25: air.current.pm25,
        pm10: air.current.pm10,
        pollen: air.pollen,
    },
    sun: {
        sunrise: sun.today.sunrise,
        sunset: sun.today.sunset,
        daylightHours: sun.today.daylightHours,
        uvIndex: sun.today.uvIndexMax,
        uvRisk: sun.today.uvRisk,
    },
    transport: {
        stationCount: transport.stationCount,
        stations: transport.stations.map(s => ({
            name: s.station.name,
            distance: s.station.distance,
            modes: s.station.modes,
            nextDepartures: s.departures.slice(0, 3).map(d => ({
                line: d.line,
                mode: d.mode,
                direction: d.direction,
                when: d.when,
            })),
        })),
    },
    wikipedia: {
        articleCount: wiki.articleCount,
        articles: wiki.articles.map(a => ({
            title: a.title,
            distance: a.distance,
            extract: a.extract,
            url: a.articleUrl,
            thumbnail: a.thumbnailUrl,
        })),
    },
}
`,
    };

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Location Dashboard',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    // Kennel: lead first, then all base dogs, then all mimics
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Location Dashboard',
        description: 'Alles auf einen Blick: Wetter, Luft, Sonne, OEPNV, Wikipedia — per GPS',
        emoji: '\uD83C\uDF0D',
        dogIds: [
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'PublicTransportRetriever',
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            ...mimics.map(m => m.lineageId),
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Location Dashboard Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the sun kennel from the celestial void.
 */
export async function seedSunKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'sun-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Sun Query Mapper',
        imitates: 'SunQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, days: QueryRetriever.days || "7" }`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Sun Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Sun',
        description: 'Sonne: Aufgang, Untergang, Taglaenge, UV-Index per GPS',
        emoji: '\u2600\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Sun Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the Wikipedia Nearby kennel from the encyclopaedic void.
 */
export async function seedWikiNearbyKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'wiki-nearby-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Wiki Nearby Query Mapper',
        imitates: 'WikiNearbyQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    radius: QueryRetriever.radius || "500",
    limit: QueryRetriever.limit || "10",
    lang: QueryRetriever.lang || "de"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Wiki Nearby Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Wikipedia Nearby',
        description: 'Wikipedia: Artikel ueber Orte und Sehenswuerdigkeiten in der Naehe',
        emoji: '\uD83D\uDCDA',
        dogIds: [
            BASE_DOG_PREFIX + 'WikiNearbyRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Wiki Nearby Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the geocoding kennel from the map-void.
 * Supports both forward (address -> GPS) and reverse (GPS -> address) via query params.
 */
export async function seedGeocodingKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'geocoding-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Geocoding Query Mapper',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    address: QueryRetriever.address || undefined,
    lat: QueryRetriever.lat || undefined,
    lng: QueryRetriever.lng || undefined,
    limit: QueryRetriever.limit || "5"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Geocoding Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Geocoding',
        description: 'Geocoding: Adresse zu GPS oder GPS zu Adresse (Nominatim/OSM)',
        emoji: '\uD83D\uDCCD',
        dogIds: [
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { address: 'Hauptwache, Frankfurt am Main' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Geocoding Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the air quality kennel from the breathing void.
 */
export async function seedAirQualityKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'air-quality-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'AirQuality Query Mapper',
        imitates: 'AirQualityQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'AirQuality Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Air Quality',
        description: 'Luftqualitaet: Feinstaub, Ozon, NO2, Pollenflug per GPS',
        emoji: '\uD83C\uDF2B\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Air Quality Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the weather kennel from the sky-void — a gathering place
 * for hounds that sniff out atmospheric conditions near GPS coordinates.
 */
export async function seedWeatherKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'weather-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Forge the MimicDog that maps query params to WeatherQuery
    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Weather Query Mapper',
        imitates: 'WeatherQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    time: QueryRetriever.time || undefined,
    date: QueryRetriever.date || undefined
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Weather Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Weather',
        description: 'Wetter: Aktuelle Bedingungen und Vorhersage per GPS',
        emoji: '\u26C5',
        dogIds: [
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Weather Kennel (kennelId: ${kennelId}, mimicDogId: ${mimicDogId})`);
}

/**
 * The standalone invocation — spoken by `npx prisma db seed` when the ship is first provisioned.
 * Uses the same eldritch store logic as the main startup rite.
 * If ye run this as the main module, the seeding begins; if it fails, we sink into the void.
 */
async function prismaSeedMain(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);
    if ((nodesStore as { init?: () => Promise<void> }).init) {
        await (nodesStore as any).init();
    }
    if ((kennelsStore as { init?: () => Promise<void> }).init) {
        await (kennelsStore as any).init();
    }
    await runSeeds(nodesStore, kennelsStore);
}

if (require.main === module) {
    prismaSeedMain().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
