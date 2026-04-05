// Arr, this be the seeding rite — spoken once at the dawn of time (or a fresh database).
// We end as we began: from the void we summon the first hound and its kennel.
import { randomUUID } from 'crypto';
import { PrismaStore } from '../store/PrismaStore';
import { IStore } from '../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@datadogs/core';
import { TalkingDog } from '@datadogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@datadogs/dogs-demo';
import { VoidHuntDataCode } from './VoidHuntData';
import { VoidHuntGalleryCode } from './VoidHuntGallery';

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
    await seedWindMapKennel(nodesStore, kennelsStore);
    await seedTransitScoutKennel(nodesStore, kennelsStore);
    await seedNaturkundlerKennel(nodesStore, kennelsStore);
    await seedEarthPulseKennel(nodesStore, kennelsStore);
    await seedVoidStormsKennel(nodesStore, kennelsStore);
    await seedElevationKennel(nodesStore, kennelsStore);
    await seedTrailScoutKennel(nodesStore, kennelsStore);
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
 * Raises the wind-map kennel — a wind grid rendered on a Leaflet map.
 * Fetches wind data from Open-Meteo (no API key needed) for a grid of points
 * around the given GPS coordinate, renders an interactive HTML map with arrows.
 *
 * Wave 1: QueryRetriever
 * Wave 2: WindGridFetcher (SerializedDog — fetches Open-Meteo wind for a grid)
 * Wave 3: WindMapRenderer (lead — renders HTML with Leaflet)
 */
export async function seedWindMapKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'wind-map';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Wave 2: WindGridFetcher
    const fetcherVersionId = randomUUID();
    const fetcherDogId = randomUUID();
    const fetcherCfg = {
        id: fetcherVersionId, lineageId: fetcherDogId, parentId: null,
        displayName: 'WindGridFetcher',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
var lat = parseFloat(QueryRetriever.lat);
var lng = parseFloat(QueryRetriever.lng);
var spread = parseFloat(QueryRetriever.spread || "0.3");
var steps = parseInt(QueryRetriever.steps || "4");
var points = [];
for (var dy = -steps/2; dy <= steps/2; dy++) {
  for (var dx = -steps/2; dx <= steps/2; dx++) {
    points.push({ lat: +(lat + dy * spread / steps).toFixed(4), lng: +(lng + dx * spread / steps).toFixed(4) });
  }
}
var lats = points.map(function(p){return p.lat}).join(',');
var lngs = points.map(function(p){return p.lng}).join(',');
var url = 'https://api.open-meteo.com/v1/forecast?latitude='+lats+'&longitude='+lngs+'&current=windspeed_10m,winddirection_10m,windgusts_10m,temperature_2m,weathercode&timezone=auto';
var res = await fetch(url);
var data = await res.json();
var results = (Array.isArray(data) ? data : [data]).map(function(d,i) {
  var c = d.current || {};
  return { lat: points[i].lat, lng: points[i].lng, speed: c.windspeed_10m||0, direction: c.winddirection_10m||0, gusts: c.windgusts_10m||0, temp: c.temperature_2m, code: c.weathercode };
});
return { center: {lat:lat, lng:lng}, points: results };
`,
    };
    await nodesStore.save({ id: fetcherVersionId, type: SerializedDog.name, lineageId: fetcherDogId, parentId: null, displayName: 'WindGridFetcher', serializedDogConfig: JSON.stringify(fetcherCfg), createdAt: new Date() });

    // Wave 3: WindMapRenderer (lead)
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'WindMapRenderer',
        parentsRequired: [fetcherDogId],
        parentsOptional: [],
        theRun: WIND_MAP_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'WindMapRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Wind Map',
        description: 'Wind-Grid auf Leaflet-Karte — Open-Meteo Windgeschwindigkeit, Richtung, Boeen',
        emoji: '\uD83C\uDF2C\uFE0F',
        dogIds: [
            rendererDogId,
            fetcherDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
        ],
        defaultQuery: { lat: '54.5997', lng: '9.5142' },
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

    console.log(`\u2705 Seeded Wind Map Kennel (kennelId: ${kennelId})`);
}

const WIND_MAP_RENDERER_CODE = `
var d = Windgridfetcher;
var pts = d.points || [];
var c = d.center || {lat:50,lng:8};
var scriptEnd = '<' + '/script>';

var arrowsJS = '';
pts.forEach(function(wp) {
  var sz = 20 + Math.min(wp.speed, 60) * 0.6;
  var i = Math.min(wp.speed / 50, 1);
  var cr = Math.round(30 + 200*i); var cg = Math.round(120*(1-i)); var cb = Math.round(180*(1-i));
  var col = 'rgb('+cr+','+cg+','+cb+')';
  arrowsJS += 'L.marker(['+wp.lat+','+wp.lng+'],{icon:L.divIcon({className:\\'\\',html:\\'<div style="transform:rotate('+wp.direction+'deg);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="'+col+'" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4))"><path d="M12 2L8 12h3v8h2v-8h3z"/></svg></div>\\',iconSize:['+sz+','+sz+'],iconAnchor:['+(sz/2)+','+(sz/2)+']})}).addTo(map).bindPopup("<b>'+wp.speed+' km/h</b><br>Richtung: '+wp.direction+'°<br>Böen: '+wp.gusts+' km/h<br>Temp: '+(wp.temp!=null?wp.temp+'°':'?')+'");';
});

var avgWind = 0; var maxGusts = 0; var avgDir = 0; var cnt = 0;
pts.forEach(function(wp) { avgWind += wp.speed; avgDir += wp.direction; cnt++; if(wp.gusts>maxGusts)maxGusts=wp.gusts; });
if (cnt>0) { avgWind=(avgWind/cnt).toFixed(1); avgDir=Math.round(avgDir/cnt); }
var dirNames=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
var dirName=dirNames[Math.round(avgDir/22.5)%16]||'';

var h = '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>';
h += '<title>Wind Map</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<'+'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">'+scriptEnd;
h += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#eee}';
h += '#map{width:100%;height:70vh;min-height:300px}';
h += '.info{max-width:600px;margin:0 auto;padding:16px}';
h += '.card{background:#16213e;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #0f3460}';
h += '.big{font-size:2.5rem;font-weight:700;line-height:1} .sub{color:#8899aa;font-size:0.85rem;margin-top:4px}';
h += '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px} .gc{text-align:center} .gc-v{font-size:1.3rem;font-weight:700} .gc-l{font-size:0.65rem;color:#8899aa;text-transform:uppercase}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(22,33,62,0.95);padding:6px 10px;border-radius:22px;border:1px solid #0f3460;backdrop-filter:blur(10px);width:calc(100% - 20px);max-width:340px}';
h += '.sb input{background:transparent;border:none;color:#eee;font-size:0.85rem;flex:1;min-width:0;outline:none} .sb button{background:#e94560;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem}';
h += '</style></head><body>';
h += '<div class="sb"><input id="lat" placeholder="Lat" value="'+c.lat+'" style="width:80px"/><input id="lng" placeholder="Lng" value="'+c.lng+'" style="width:80px"/><button id="go">Wind</button></div>';
h += '<div id="map"></div>';
h += '<div class="info"><div class="card"><div class="big">'+avgWind+' km/h <span style="font-size:1rem;color:#8899aa">'+dirName+'</span></div>';
h += '<div class="sub">Durchschnitt aus '+cnt+' Messpunkten</div>';
h += '<div class="grid"><div class="gc"><div class="gc-v">'+maxGusts+'</div><div class="gc-l">Max Böen km/h</div></div>';
h += '<div class="gc"><div class="gc-v">'+avgDir+'°</div><div class="gc-l">Ø Richtung</div></div>';
h += '<div class="gc"><div class="gc-v">'+cnt+'</div><div class="gc-l">Messpunkte</div></div></div></div></div>';
h += '<'+'script>';
h += 'var map=L.map("map",{zoomControl:true,attributionControl:false}).setView(['+c.lat+','+c.lng+'],11);';
h += 'L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19}).addTo(map);';
h += arrowsJS;
h += 'document.getElementById("go").addEventListener("click",function(){var u=new URL(window.location);u.searchParams.set("lat",document.getElementById("lat").value);u.searchParams.set("lng",document.getElementById("lng").value);window.location=u.toString()});';
h += scriptEnd + '</body></html>';
return h;
`;

/**
 * Raises the transit-scout kennel — sniffing out complete trip data
 * from nearby transit stations via MOTIS.
 *
 * Wave 1: QueryRetriever (captures ?lat=...&lng=...&distance=...&results=...)
 * Wave 2: Transit Trip Query Mimic (maps query params → TransitTripQuery)
 * Wave 3: TransitTripRetriever (fetches station trips from MOTIS)
 */
export async function seedTransitScoutKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'transit-scout';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Transit Trip Query Mapper',
        imitates: 'TransitTripQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `
return {
    lat: QueryRetriever.lat,
    lng: QueryRetriever.lng,
    distance: QueryRetriever.distance || "1000",
    stations: QueryRetriever.stations || "5",
    line: QueryRetriever.line || undefined,
    limit: QueryRetriever.results || QueryRetriever.limit || "10"
}
`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Transit Trip Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Transit Scout',
        description: 'Komplette Bus- und Bahn-Trips in der Naehe — Stationen, Linien, Fahrplaene via MOTIS',
        emoji: '\uD83D\uDE8C',
        dogIds: [
            BASE_DOG_PREFIX + 'TransitTripRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821', distance: '3000', results: '50' },
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

    // Wave 4: TransitRenderer (lead — renders HTML with Leaflet map + trip cards)
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'TransitRenderer',
        parentsRequired: ['TransitTripRetriever', 'QueryRetriever'],
        parentsOptional: [],
        theRun: TRANSIT_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'TransitRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    // Update kennelConfig to use renderer as lead
    kennelConfig.dogIds = [rendererDogId, ...kennelConfig.dogIds];

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Transit Scout Kennel (kennelId: ${kennelId})`);
}

const TRANSIT_RENDERER_CODE = `
var tr = TransitTripRetriever;
var lat = parseFloat(QueryRetriever.lat);
var lng = parseFloat(QueryRetriever.lng);
var trips = (tr.trips || []);
var lineColors = ['#e11d48','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#c026d3','#4f46e5','#059669','#d97706','#7c3aed','#0d9488'];
var scriptEnd = '<' + '/script>';

var transitJS = '';
var cards = '';
trips.forEach(function(trip, i) {
  var color = lineColors[i % lineColors.length];
  var stops = trip.stops || [];
  var coords = '';
  stops.forEach(function(s, j) { if (s.lat && s.lng) { if (j > 0) coords += ','; coords += '['+s.lat+','+s.lng+']'; } });
  if (coords) {
    transitJS += 'L.polyline(['+coords+'],{color:"'+color+'",weight:4,opacity:0.8}).addTo(map);';
    stops.forEach(function(s) {
      if (s.lat && s.lng) {
        transitJS += 'L.circleMarker(['+s.lat+','+s.lng+'],{radius:4,fillColor:"'+color+'",color:"#fff",weight:1,fillOpacity:0.9}).addTo(map).bindPopup("<b>'+(s.name||'').replace(/'/g,'')+'</b>");';
      }
    });
  }
  var depStr = stops[0] && (stops[0].departure||stops[0].scheduledDeparture) ? new Date(stops[0].departure||stops[0].scheduledDeparture).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var arrStr = stops.length && (stops[stops.length-1].arrival||stops[stops.length-1].scheduledArrival) ? new Date(stops[stops.length-1].arrival||stops[stops.length-1].scheduledArrival).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var first = (stops[0]||{}).name||'';
  var last = (stops[stops.length-1]||{}).name||'';
  var dur = null;
  if (stops[0] && stops[stops.length-1]) {
    var d1 = stops[0].departure||stops[0].scheduledDeparture;
    var d2 = stops[stops.length-1].arrival||stops[stops.length-1].scheduledArrival;
    if (d1&&d2) dur = Math.round((new Date(d2)-new Date(d1))/60000);
  }
  cards += '<div class="tc"><div class="tc-h"><span class="tc-l" style="background:'+color+'">'+(trip.lineName||'?')+'</span><span class="tc-m">'+(trip.mode||'')+'</span>';
  if (dur) cards += '<span class="tc-d">'+dur+' min</span>';
  cards += '</div><div class="tc-dir">'+(trip.headsign||last)+'</div>';
  cards += '<div class="tc-r">'+first+' <span style="color:#888">→</span> '+last+'</div>';
  cards += '<div class="tc-t">'+depStr+' → '+arrStr+'</div>';
  cards += '<div class="tc-s">'+stops.length+' Halte</div></div>';
});

var h = '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>';
h += '<title>Transit Scout</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<'+'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">'+scriptEnd;
h += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#fafaf8;color:#333}';
h += '#map{width:100%;height:50vh;min-height:280px}';
h += '.ct{max-width:680px;margin:0 auto;padding:12px 14px 40px}';
h += '.hd{font-size:1.5rem;font-weight:700;margin:16px 0 8px;color:#1a1a1a} .hd span{font-size:0.85rem;color:#888;font-weight:400}';
h += '.tc{background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #e5e5e0;margin-bottom:8px}';
h += '.tc-h{display:flex;align-items:center;gap:8px} .tc-l{color:#fff;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:4px} .tc-m{font-size:0.68rem;color:#999;text-transform:uppercase} .tc-d{font-size:0.72rem;color:#1a1a1a;font-weight:600;margin-left:auto}';
h += '.tc-dir{font-size:0.9rem;font-weight:600;color:#1a1a1a;margin-top:4px} .tc-r{font-size:0.82rem;color:#555;margin-top:2px} .tc-t{font-size:0.75rem;color:#888;margin-top:2px} .tc-s{font-size:0.65rem;color:#bbb;margin-top:2px}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(255,255,255,0.95);padding:6px 10px;border-radius:22px;border:1px solid #ddd;backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,0.07);width:calc(100% - 20px);max-width:400px}';
h += '.sb input{background:transparent;border:none;color:#333;font-size:0.85rem;flex:1;min-width:0;outline:none} .sb button{background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem}';
h += '</style></head><body>';
h += '<div class="sb"><input id="lat" placeholder="Lat" value="'+lat+'" style="width:70px"/><input id="lng" placeholder="Lng" value="'+lng+'" style="width:70px"/><button id="go">Suchen</button></div>';
h += '<div id="map"></div>';
h += '<div class="ct"><div class="hd">🚌 '+trips.length+' Linien <span>in der Nähe</span></div>';
h += cards;
h += '</div>';
h += '<'+'script>';
h += 'var map=L.map("map",{zoomControl:true,attributionControl:false}).setView(['+lat+','+lng+'],14);';
h += 'L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);';
h += 'L.marker(['+lat+','+lng+']).addTo(map);';
h += transitJS;
h += 'document.getElementById("go").addEventListener("click",function(){var u=new URL(window.location);u.searchParams.set("lat",document.getElementById("lat").value);u.searchParams.set("lng",document.getElementById("lng").value);window.location=u.toString()});';
h += scriptEnd + '</body></html>';
return h;
`;

/**
 * Raises the naturkundler kennel — a gathering of nature dogs.
 * Birds, species, phenology — all three sniff the same GPS coordinates,
 * a SerializedDog lead combines their catches.
 *
 * Wave 1: QueryRetriever (captures ?lat=...&lng=...&radius=...)
 * Wave 2: Bird/Biodiversity/Phenology Query Mimics (map params → respective Pacts)
 * Wave 3: BirdRetriever + SpeciesRetriever + PhenologyRetriever (parallel)
 * Wave 4: Naturkundler Lead (combines all yields)
 */
export async function seedNaturkundlerKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'naturkundler';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Bird Query Mimic ---
    const birdMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...birdMimic,
        displayName: 'NK: GPS → Bird Query',
        imitates: 'BirdQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: QueryRetriever.radius || "10", back: QueryRetriever.back || "14" }`,
    });

    // --- Wave 2: Biodiversity Query Mimic ---
    const bioMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...bioMimic,
        displayName: 'NK: GPS → Biodiversity Query',
        imitates: 'BiodiversityQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: QueryRetriever.radius || "10", taxon: QueryRetriever.taxon || undefined, months: QueryRetriever.months || undefined }`,
    });

    // --- Wave 2: Phenology Query Mimic ---
    const phenoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...phenoMimic,
        displayName: 'NK: GPS → Phenology Query',
        imitates: 'PhenologyQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, date: QueryRetriever.date || undefined }`,
    });

    // --- Wave 4: Lead dog — combines nature data ---
    const leadVersionId = randomUUID();
    const leadDogId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Naturkundler',
        parentsRequired: ['SpeciesRetriever', 'PhenologyRetriever'],
        parentsOptional: ['BirdRetriever'],
        theRun: `
const species = SpeciesRetriever;
const pheno = PhenologyRetriever;

const result = {
    biodiversity: {
        observationCount: species.observations.length,
        observations: species.observations.slice(0, 20).map(o => ({
            name: o.speciesName,
            scientificName: o.scientificName,
            taxon: o.iconicTaxon,
            photo: o.photoUrl,
            date: o.observedOn,
            place: o.placeGuess,
            lat: o.location ? o.location.lat : null,
            lng: o.location ? o.location.lng : null,
        })),
    },
    phenology: {
        phase: pheno.currentPhase,
        date: pheno.date,
        hemisphere: pheno.hemisphere,
        info: pheno.seasonalInfo,
        upcoming: pheno.upcomingPhase,
    },
};

if (typeof BirdRetriever !== 'undefined') {
    const birds = BirdRetriever;
    result.birds = {
        totalSpecies: birds.totalSpecies,
        recentCount: birds.recentObservations.length,
        notableCount: birds.notableObservations.length,
        recentObservations: birds.recentObservations.slice(0, 15).map(o => ({
            name: o.commonName,
            scientificName: o.scientificName,
            count: o.count,
            location: o.location,
            date: o.observationDate,
            isNotable: o.isNotable,
        })),
        notableObservations: birds.notableObservations.slice(0, 10).map(o => ({
            name: o.commonName,
            scientificName: o.scientificName,
            count: o.count,
            location: o.location,
            date: o.observationDate,
        })),
    };
}

return result
`,
    };

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadDogId,
        parentId: null,
        displayName: 'Naturkundler',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    // Wave 5: NaturRenderer (lead — renders HTML)
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'NaturRenderer',
        parentsRequired: [leadDogId, 'QueryRetriever'],
        parentsOptional: [],
        theRun: NATUR_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'NaturRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Naturkundler',
        description: 'Voegel, Arten, Bluehphasen — Natur-Dashboard per GPS',
        emoji: '\uD83E\uDD89',
        dogIds: [
            rendererDogId,
            leadDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'BirdRetriever',
            BASE_DOG_PREFIX + 'SpeciesRetriever',
            BASE_DOG_PREFIX + 'PhenologyRetriever',
            birdMimic.lineageId,
            bioMimic.lineageId,
            phenoMimic.lineageId,
        ],
        defaultQuery: { lat: '50.1109', lng: '8.6821', radius: '10' },
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

    console.log(`\u2705 Seeded Naturkundler Kennel (kennelId: ${kennelId})`);
}

const NATUR_RENDERER_CODE = `
var d = Naturkundler;
var lat = parseFloat(QueryRetriever.lat);
var lng = parseFloat(QueryRetriever.lng);
var bio = d.biodiversity || {};
var ph = d.phenology || {};
var birds = d.birds || null;
var scriptEnd = '<' + '/script>';

var speciesJS = '';
(bio.observations || []).forEach(function(o) {
  if (o.lat && o.lng) {
    speciesJS += 'L.circleMarker(['+o.lat+','+o.lng+'],{radius:6,fillColor:"#16a34a",color:"#fff",weight:1,fillOpacity:0.85}).addTo(map).bindPopup("<b>'+(o.name||o.scientificName||'?').replace(/'/g,'')+'</b><br><i>'+(o.scientificName||'')+'</i><br>'+(o.taxon||'')+'");';
  }
});

var speciesCards = '';
(bio.observations || []).forEach(function(o) {
  speciesCards += '<div class="spc">';
  if (o.photo) speciesCards += '<img src="'+o.photo+'" onerror="this.style.display=\\'none\\'" loading="lazy"/>';
  speciesCards += '<div class="si"><strong>'+(o.name||o.scientificName||'?')+'</strong><span>'+(o.taxon||'')+'</span>';
  if (o.place) speciesCards += '<span class="pl">'+o.place+'</span>';
  speciesCards += '</div></div>';
});

var plantsHtml = '';
((ph.phase||{}).typicalBloom||(ph.phase||{}).indicatorPlants||[]).forEach(function(p) { plantsHtml += '<span class="tg tg-g">'+p+'</span>'; });
var faunaHtml = '';
((ph.phase||{}).typicalFauna||[]).forEach(function(f) { faunaHtml += '<span class="tg tg-a">'+f+'</span>'; });

var birdCards = '';
if (birds) {
  (birds.recentObservations||[]).forEach(function(b) {
    birdCards += '<div class="bc"><strong>'+b.name+'</strong><span>'+b.scientificName+'</span>';
    if (b.count) birdCards += '<span class="cnt">'+b.count+'x</span>';
    birdCards += '<span class="loc">'+b.location+' · '+b.date+'</span></div>';
  });
}

var h = '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>';
h += '<title>Naturkundler</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<'+'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">'+scriptEnd;
h += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;background:#f5f7f0;color:#333}';
h += '#map{width:100%;height:45vh;min-height:260px}';
h += '.ct{max-width:680px;margin:0 auto;padding:12px 14px 40px}';
h += '.sec{margin-bottom:32px} .sec-t{font-size:1.15rem;color:#1a1a1a;margin-bottom:8px;border-bottom:2px solid #d4e0c8;padding-bottom:5px}';
h += '.sr{display:flex;gap:10px;overflow-x:auto;padding:6px 0;-webkit-overflow-scrolling:touch} .sr::-webkit-scrollbar{height:3px} .sr::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px}';
h += '.spc{flex:0 0 150px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #d4e0c8} .spc img{width:100%;height:100px;object-fit:cover}';
h += '.si{padding:8px} .si strong{display:block;font-size:0.8rem;color:#1a1a1a} .si span{display:block;font-size:0.68rem;color:#888} .si .pl{color:#16a34a;font-size:0.65rem;margin-top:2px}';
h += '.tg{display:inline-block;padding:3px 10px;border-radius:14px;font-size:0.72rem;margin:2px;font-family:system-ui,sans-serif} .tg-g{background:#dcfce7;color:#166534} .tg-a{background:#fef3c7;color:#92400e}';
h += '.bc{background:#fff;border-radius:8px;padding:8px 10px;border:1px solid #d4e0c8;margin-bottom:6px} .bc strong{font-size:0.85rem;color:#1a1a1a;display:block} .bc span{font-size:0.7rem;color:#888;display:block} .bc .cnt{color:#16a34a;font-weight:600} .bc .loc{font-size:0.65rem;color:#bbb}';
h += '.pr{font-size:0.95rem;line-height:1.7;color:#555} .pr strong{color:#1a1a1a}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(245,247,240,0.95);padding:6px 10px;border-radius:22px;border:1px solid #d4e0c8;backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,0.05);width:calc(100% - 20px);max-width:340px}';
h += '.sb input{background:transparent;border:none;color:#333;font-size:0.85rem;flex:1;min-width:0;outline:none} .sb button{background:#16a34a;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem}';
h += '</style></head><body>';
h += '<div class="sb"><input id="lat" placeholder="Lat" value="'+lat+'" style="width:70px"/><input id="lng" placeholder="Lng" value="'+lng+'" style="width:70px"/><button id="go">Suchen</button></div>';
h += '<div id="map"></div>';
h += '<div class="ct">';

// Phenology
var phaseName = (ph.phase||{}).name || (ph.phase||{}).nameEn || 'Jahreszeit';
h += '<div class="sec"><div class="sec-t">🌸 '+phaseName+'</div>';
h += '<div class="pr"><strong>'+phaseName+'</strong>';
h += (ph.info ? ' — '+ph.info : '') + '</div>';
h += '<div style="margin-top:6px">'+plantsHtml+'</div>'+faunaHtml+'</div>';

// Species
h += '<div class="sec"><div class="sec-t">🦎 '+(bio.observationCount||bio.observations?.length||0)+' Artbeobachtungen</div>';
h += '<div class="sr">'+speciesCards+'</div></div>';

// Birds
if (birds) {
  h += '<div class="sec"><div class="sec-t">🐦 '+(birds.totalSpecies||0)+' Vogelarten';
  if (birds.notableCount) h += ' <span style="color:#ea580c;font-size:0.8rem">('+birds.notableCount+' selten)</span>';
  h += '</div>' + birdCards + '</div>';
}

h += '</div>';
h += '<'+'script>';
h += 'var map=L.map("map",{zoomControl:true,attributionControl:false}).setView(['+lat+','+lng+'],12);';
h += 'L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);';
h += speciesJS;
h += 'document.getElementById("go").addEventListener("click",function(){var u=new URL(window.location);u.searchParams.set("lat",document.getElementById("lat").value);u.searchParams.set("lng",document.getElementById("lng").value);window.location=u.toString()});';
h += scriptEnd+'</body></html>';
return h;
`;

/**
 * Raises the elevation kennel — a single hound that fetches meters above sea level.
 *
 * Wave 1: QueryRetriever (captures ?lat=...&lng=...)
 * Wave 2: Elevation Query Mimic (maps query params → ElevationQuery)
 * Wave 3: ElevationRetriever (fetches elevation from Open-Meteo)
 */
export async function seedElevationKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'elevation-kennel';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const mimicVersionId = randomUUID();
    const mimicDogId = randomUUID();

    const mimicCfg: IMimicDogConfig = {
        id: mimicVersionId,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Elevation Query Mapper',
        imitates: 'ElevationQueryProvider',
        parentsRequired: ['QueryRetriever'],
        parentsOptional: [],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
    };

    await nodesStore.save({
        id: mimicVersionId,
        type: SerializedDog.name,
        lineageId: mimicDogId,
        parentId: null,
        displayName: 'Elevation Query Mapper',
        serializedDogConfig: JSON.stringify(mimicCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Elevation',
        description: 'Hoehendaten: Meter ueber Normalnull per GPS (Open-Meteo)',
        emoji: '\u26F0\uFE0F',
        dogIds: [
            BASE_DOG_PREFIX + 'ElevationRetriever',
            BASE_DOG_PREFIX + 'QueryRetriever',
            mimicDogId,
        ],
        defaultQuery: { lat: '47.3769,47.3800,47.3850,47.3900', lng: '8.5417,8.5500,8.5600,8.5700' },
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

    console.log(`\u2705 Seeded Elevation Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the trail-scout kennel — hiking trails and cycling routes on a Leaflet map,
 * enriched with elevation data. Data/Renderer separation.
 *
 * Wave 1: QueryRetriever
 * Wave 2: Trail Query Mimic + Elevation Query Mimic
 * Wave 3: TrailRetriever + ElevationRetriever (parallel)
 * Wave 4: TrailScoutData (combines trails + elevation into JSON)
 * Wave 5: TrailScoutRenderer (lead — renders HTML with Leaflet map)
 */
export async function seedTrailScoutKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'trail-scout';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // --- Wave 2: Trail Query Mimic ---
    const trailMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...trailMimic,
        displayName: 'TS: GPS → Trail Query',
        imitates: 'TrailQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng, radius: QueryRetriever.radius || "3000", type: QueryRetriever.type || "both" }`,
    });

    // --- Wave 2: Elevation Query Mimic ---
    const elevMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...elevMimic,
        displayName: 'TS: GPS → Elevation Query',
        imitates: 'ElevationQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { lat: QueryRetriever.lat, lng: QueryRetriever.lng }`,
    });

    // --- Wave 4: Data dog — combines trails + elevation into clean JSON ---
    const dataVersionId = randomUUID();
    const dataDogId = randomUUID();
    const dataCfg = {
        id: dataVersionId,
        lineageId: dataDogId,
        parentId: null,
        displayName: 'TrailScoutData',
        parentsRequired: ['TrailRetriever', 'ElevationRetriever'],
        parentsOptional: [],
        theRun: `
var trails = TrailRetriever;
var elev = ElevationRetriever;
var hikingTrails = trails.trails.filter(function(t) { return t.trailType === "hiking"; });
var cyclingTrails = trails.trails.filter(function(t) { return t.trailType === "bicycle"; });
return {
    center: trails.center,
    elevation: elev.elevation,
    radiusM: trails.radiusM,
    trailType: trails.trailType,
    summary: {
        totalTrails: trails.trails.length,
        hikingCount: hikingTrails.length,
        cyclingCount: cyclingTrails.length,
        elevationM: elev.elevation,
    },
    hiking: hikingTrails.slice(0, 30).map(function(t) {
        return { id: t.id, name: t.name || null, surface: t.surface || null,
                 distance: t.distance || null, coordinates: t.coordinates, tags: t.tags };
    }),
    cycling: cyclingTrails.slice(0, 30).map(function(t) {
        return { id: t.id, name: t.name || null, surface: t.surface || null,
                 distance: t.distance || null, coordinates: t.coordinates, tags: t.tags };
    }),
}
`,
    };
    await nodesStore.save({
        id: dataVersionId, type: SerializedDog.name, lineageId: dataDogId,
        parentId: null, displayName: 'TrailScoutData',
        serializedDogConfig: JSON.stringify(dataCfg), createdAt: new Date(),
    });

    // --- Wave 5: Renderer — reads TrailScoutData, builds HTML with Leaflet map ---
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId,
        lineageId: rendererDogId,
        parentId: null,
        displayName: 'TrailScoutRenderer',
        parentsRequired: [dataDogId],
        parentsOptional: [],
        theRun: `
var data = Trailscoutdata;
var lat = data.center.lat;
var lng = data.center.lng;
var elev = data.elevation;
var hiking = data.hiking || [];
var cycling = data.cycling || [];
var summary = data.summary;
var SE = "<" + "/script>";
var SS = "<" + "script>";

var html = "";
html += "<!DOCTYPE html><html><head><meta charset='utf-8'/>";
html += "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>";
html += "<title>Trail Scout</title>";
html += "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>";
html += "<style>";
html += "*{margin:0;padding:0;box-sizing:border-box}";
html += "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1a1a2e;color:#e0e0e0}";
html += "#map{width:100%;height:60vh}";
html += ".panel{padding:16px 20px;background:#16213e}";
html += ".panel h1{font-size:1.4em;margin-bottom:8px;color:#e94560}";
html += ".stats{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0}";
html += ".stat{background:#0f3460;padding:10px 16px;border-radius:8px;min-width:110px}";
html += ".stat .v{font-size:1.5em;font-weight:bold}.stat .l{font-size:.8em;color:#aaa;margin-top:2px}";
html += ".legend{display:flex;gap:16px;margin:8px 0;font-size:.85em}";
html += ".legend .hk::before,.legend .bk::before{content:'';display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:middle}";
html += ".legend .hk::before{background:#2ecc71}.legend .bk::before{background:#3498db}";
html += ".tl{padding:12px 20px;max-height:35vh;overflow-y:auto}";
html += ".tl h2{font-size:1.1em;margin:10px 0 6px}";
html += ".ti{background:#0f3460;margin:4px 0;padding:8px 12px;border-radius:6px;font-size:.9em;cursor:pointer;transition:background .2s;display:flex;justify-content:space-between;align-items:center}";
html += ".ti:hover{background:#1a4a8a}.ti .n{flex:1}.ti .m{color:#aaa;font-size:.8em}";
html += ".hc{border-left:4px solid #2ecc71}.cc{border-left:4px solid #3498db}";
html += "</style></head><body>";

html += "<div id='map'></div>";
html += "<div class='panel'>";
html += "<h1>Trail Scout</h1>";
html += "<div class='legend'><span class='hk'>Wanderwege</span><span class='bk'>Radwege</span></div>";
html += "<div class='stats'>";
html += "<div class='stat'><div class='v'>" + elev + " m</div><div class='l'>Hoehe</div></div>";
html += "<div class='stat'><div class='v'>" + summary.totalTrails + "</div><div class='l'>Wege gesamt</div></div>";
html += "<div class='stat'><div class='v'>" + summary.hikingCount + "</div><div class='l'>Wanderwege</div></div>";
html += "<div class='stat'><div class='v'>" + summary.cyclingCount + "</div><div class='l'>Radwege</div></div>";
html += "<div class='stat'><div class='v'>" + (data.radiusM / 1000).toFixed(1) + " km</div><div class='l'>Radius</div></div>";
html += "</div></div>";

html += "<div class='tl'>";
if (hiking.length > 0) {
    html += "<h2>Wanderwege</h2>";
    for (var i = 0; i < hiking.length; i++) {
        var t = hiking[i];
        var tn = t.name || "(unbenannt)";
        var tm = [];
        if (t.surface) tm.push(t.surface);
        if (t.distance) tm.push(t.distance);
        html += "<div class='ti hc' data-idx='h" + i + "'><span class='n'>" + tn + "</span>";
        if (tm.length) html += "<span class='m'>" + tm.join(" &middot; ") + "</span>";
        html += "</div>";
    }
}
if (cycling.length > 0) {
    html += "<h2>Radwege</h2>";
    for (var j = 0; j < cycling.length; j++) {
        var c = cycling[j];
        var cn = c.name || "(unbenannt)";
        var cm = [];
        if (c.surface) cm.push(c.surface);
        if (c.distance) cm.push(c.distance);
        html += "<div class='ti cc' data-idx='c" + j + "'><span class='n'>" + cn + "</span>";
        if (cm.length) html += "<span class='m'>" + cm.join(" &middot; ") + "</span>";
        html += "</div>";
    }
}
if (!hiking.length && !cycling.length) {
    html += "<p style='color:#aaa;padding:20px 0;'>Keine Wege im Umkreis gefunden.</p>";
}
html += "</div>";

var trailsJson = JSON.stringify({ hiking: hiking, cycling: cycling });

html += SS;
html += "var LS=document.createElement('script');";
html += "LS.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';";
html += "LS.onload=function(){";
html += "var map=L.map('map').setView([" + lat + "," + lng + "],14);";
html += "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OSM',maxZoom:19}).addTo(map);";
html += "L.circle([" + lat + "," + lng + "],{radius:" + data.radiusM + ",color:'#e94560',fillColor:'#e94560',fillOpacity:0.05,weight:1,dashArray:'5,5'}).addTo(map);";
html += "L.marker([" + lat + "," + lng + "]).addTo(map).bindPopup('<b>" + elev + " m</b><br/>Standort');";
html += "var td=" + trailsJson + ";";
html += "var layers={};";
html += "function addT(arr,col,pfx){";
html += "for(var i=0;i<arr.length;i++){";
html += "var t=arr[i];if(!t.coordinates||t.coordinates.length<2)continue;";
html += "var ll=t.coordinates.map(function(c){return[c.lat,c.lon];});";
html += "var line=L.polyline(ll,{color:col,weight:3,opacity:0.8}).addTo(map);";
html += "var nm=t.name||'(unbenannt)';var pp='<b>'+nm+'</b>';";
html += "if(t.surface)pp+='<br/>Belag: '+t.surface;";
html += "if(t.distance)pp+='<br/>Distanz: '+t.distance;";
html += "line.bindPopup(pp);layers[pfx+i]=line;";
html += "}}";
html += "addT(td.hiking,'#2ecc71','h');addT(td.cycling,'#3498db','c');";
html += "document.querySelectorAll('.ti').forEach(function(el){";
html += "el.addEventListener('click',function(){";
html += "var idx=this.getAttribute('data-idx');var ly=layers[idx];";
html += "if(ly){map.fitBounds(ly.getBounds(),{padding:[30,30]});ly.openPopup();}";
html += "});});";
html += "};document.head.appendChild(LS);";
html += SE;
html += "</body></html>";
return html;
`,
    };
    await nodesStore.save({
        id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId,
        parentId: null, displayName: 'TrailScoutRenderer',
        serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date(),
    });

    // Kennel: Renderer als Anfuehrer (erste dogId), dann Data, dann BaseDogs + Mimics
    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Trail Scout',
        description: 'Wander- und Radwege auf der Karte mit Hoehendaten — OSM + Open-Meteo',
        emoji: '\uD83E\uDDB6',
        dogIds: [
            rendererDogId,
            dataDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'TrailRetriever',
            BASE_DOG_PREFIX + 'ElevationRetriever',
            trailMimic.lineageId,
            elevMimic.lineageId,
        ],
        defaultQuery: { lat: '47.3769', lng: '8.5417', radius: '3000', type: 'both' },
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

    console.log(`\u2705 Seeded Trail Scout Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the earth-pulse kennel — the ultimate address-based dashboard.
 * ?q=Berlin → Geocoding → 8 Retrievers (Weather, Sun, Air, Species, Phenology,
 * Landmarks, News, Transit) → PulsData combines → PulsRenderer renders live HTML
 * with Leaflet map, wind grid, species cards, transit routes, news feed.
 *
 * Waves:
 *   1: QueryRetriever
 *   2: GeocodingMimic + NewsMimic (read from QueryRetriever)
 *   3: GeocodingRetriever + RegionalNewsRetriever
 *   4: GPS Mimics (Weather/Sun/Air/Species/Phenology/Landmarks/Transit — read from GeocodingRetriever)
 *   5: All 7 GPS Retrievers parallel
 *   6: PulsData (combines all yields)
 *   7: PulsRenderer (lead — renders HTML)
 */
export async function seedEarthPulseKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'earth-pulse';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const gpsTheRun = `var g = GeocodingRetriever; var loc = (g.results || [])[0] || {}; return { lat: String(loc.latitude), lng: String(loc.longitude) }`;

    // --- Wave 2: Geocoding Mimic ---
    const geoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...geoMimic,
        displayName: 'EP: q → Geocoding',
        imitates: 'GeocodingQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { address: QueryRetriever.q || QueryRetriever.address || "Berlin" }`,
    });

    // --- Wave 2: News Mimic (reads from QueryRetriever) ---
    const newsMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, {
        ...newsMimic,
        displayName: 'EP: q → News',
        imitates: 'RegionalNewsQueryProvider',
        parentsRequired: ['QueryRetriever'],
        theRun: `return { query: QueryRetriever.q || "Berlin" }`,
    });

    // --- Wave 4: GPS Mimics (all read from GeocodingRetriever) ---
    const weatherMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...weatherMimic, displayName: 'EP: GPS → Weather', imitates: 'WeatherQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const sunMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...sunMimic, displayName: 'EP: GPS → Sun', imitates: 'SunQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const airMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...airMimic, displayName: 'EP: GPS → Air', imitates: 'AirQualityQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const bioMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...bioMimic, displayName: 'EP: GPS → Species', imitates: 'BiodiversityQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const phenoMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...phenoMimic, displayName: 'EP: GPS → Phenology', imitates: 'PhenologyQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const landmarkMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...landmarkMimic, displayName: 'EP: GPS → Landmarks', imitates: 'NearbyLandmarksQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: gpsTheRun });

    const transitMimic = { lineageId: randomUUID(), versionId: randomUUID() };
    await saveMimic(nodesStore, { ...transitMimic, displayName: 'EP: GPS → Transit', imitates: 'TransitTripQueryProvider', parentsRequired: ['GeocodingRetriever'], theRun: `var g = GeocodingRetriever; var loc = (g.results || [])[0] || {}; return { lat: String(loc.latitude), lng: String(loc.longitude), distance: "2000" }` });

    // --- Wave 6: PulsData (combines all retriever yields) ---
    const pulsDataVersionId = randomUUID();
    const pulsDataDogId = randomUUID();
    const pulsDataCfg = {
        id: pulsDataVersionId, lineageId: pulsDataDogId, parentId: null,
        displayName: 'Pulsdata',
        parentsRequired: ['WeatherRetriever', 'SunRetriever', 'AirQualityRetriever', 'SpeciesRetriever', 'PhenologyRetriever', 'OsmLandmarksRetriever', 'RegionalNewsRetriever', 'GeocodingRetriever', 'TransitTripRetriever'],
        parentsOptional: [],
        theRun: EARTH_PULSE_DATA_CODE,
    };
    await nodesStore.save({ id: pulsDataVersionId, type: SerializedDog.name, lineageId: pulsDataDogId, parentId: null, displayName: 'Pulsdata', serializedDogConfig: JSON.stringify(pulsDataCfg), createdAt: new Date() });

    // --- Wave 7: PulsRenderer (lead — generates HTML) ---
    const rendererVersionId = randomUUID();
    const rendererDogId = randomUUID();
    const rendererCfg = {
        id: rendererVersionId, lineageId: rendererDogId, parentId: null,
        displayName: 'PulsRenderer',
        parentsRequired: [pulsDataDogId],
        parentsOptional: [],
        theRun: EARTH_PULSE_RENDERER_CODE,
    };
    await nodesStore.save({ id: rendererVersionId, type: SerializedDog.name, lineageId: rendererDogId, parentId: null, displayName: 'PulsRenderer', serializedDogConfig: JSON.stringify(rendererCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Puls der Erde',
        description: 'Alles ueber einen Ort: Wetter, Sonne, Luft, Arten, Phaenologie, Landmarks, News, OEPNV — als interaktive Karte',
        emoji: '\uD83C\uDF0D',
        dogIds: [
            rendererDogId,
            pulsDataDogId,
            BASE_DOG_PREFIX + 'QueryRetriever',
            BASE_DOG_PREFIX + 'GeocodingRetriever',
            BASE_DOG_PREFIX + 'WeatherRetriever',
            BASE_DOG_PREFIX + 'SunRetriever',
            BASE_DOG_PREFIX + 'AirQualityRetriever',
            BASE_DOG_PREFIX + 'SpeciesRetriever',
            BASE_DOG_PREFIX + 'PhenologyRetriever',
            BASE_DOG_PREFIX + 'OsmLandmarksRetriever',
            BASE_DOG_PREFIX + 'RegionalNewsRetriever',
            BASE_DOG_PREFIX + 'TransitTripRetriever',
            geoMimic.lineageId,
            newsMimic.lineageId,
            weatherMimic.lineageId,
            sunMimic.lineageId,
            airMimic.lineageId,
            bioMimic.lineageId,
            phenoMimic.lineageId,
            landmarkMimic.lineageId,
            transitMimic.lineageId,
        ],
        defaultQuery: { q: 'Berlin' },
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

    console.log(`\u2705 Seeded Earth Pulse Kennel (kennelId: ${kennelId})`);
}

/**
 * Raises the void-storms kennel — Warframe alerts, fissures, invasions,
 * and void storms rendered as an interactive gallery.
 *
 * Wave 1: WarframeAlertsRetriever
 * Wave 2: VoidHuntData (combines all Warframe data)
 * Wave 3: VoidHuntGallery (lead — renders HTML dashboard)
 */
export async function seedVoidStormsKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'void-storms';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Wave 2: VoidHuntData
    const dataVersionId = randomUUID();
    const dataDogId = randomUUID();
    const dataCfg = {
        id: dataVersionId, lineageId: dataDogId, parentId: null,
        displayName: 'Voidhuntdata',
        parentsRequired: ['WarframeAlertsRetriever'],
        parentsOptional: [],
        theRun: VoidHuntDataCode,
    };
    await nodesStore.save({ id: dataVersionId, type: SerializedDog.name, lineageId: dataDogId, parentId: null, displayName: 'Voidhuntdata', serializedDogConfig: JSON.stringify(dataCfg), createdAt: new Date() });

    // Wave 3: VoidHuntGallery (lead — renders HTML)
    const galleryVersionId = randomUUID();
    const galleryDogId = randomUUID();
    const galleryCfg = {
        id: galleryVersionId, lineageId: galleryDogId, parentId: null,
        displayName: 'VoidHuntGallery',
        parentsRequired: [dataDogId],
        parentsOptional: [],
        theRun: VoidHuntGalleryCode,
    };
    await nodesStore.save({ id: galleryVersionId, type: SerializedDog.name, lineageId: galleryDogId, parentId: null, displayName: 'VoidHuntGallery', serializedDogConfig: JSON.stringify(galleryCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Void Hunt',
        description: 'Warframe Void Fissures, Storms, Invasions — live Dashboard aus dem Void',
        emoji: '\uD83C\uDF00',
        dogIds: [
            galleryDogId,
            dataDogId,
            BASE_DOG_PREFIX + 'WarframeAlertsRetriever',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: undefined,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Void Storms Kennel (kennelId: ${kennelId})`);
}

// --- Earth Pulse: PulsData theRun code ---
const EARTH_PULSE_DATA_CODE = `
var w = WeatherRetriever || {};
var s = SunRetriever || {};
var a = AirQualityRetriever || {};
var sp = SpeciesRetriever || {};
var ph = PhenologyRetriever || {};
var lm = OsmLandmarksRetriever || {};
var news = RegionalNewsRetriever || {};
var geo = GeocodingRetriever || {};
var transit = TransitTripRetriever || {};

var loc = (geo.results || [])[0] || {};
var addr = loc.address || {};
var cur = w.current || {};
var today = s.today || {};
var air = a.current || {};
var lat = loc.latitude || 50.11;
var lng = loc.longitude || 8.68;

var spread = 0.15;
var windPoints = [
  { lat: +(lat + spread).toFixed(4), lng: +(lng - spread).toFixed(4), label: 'NW' },
  { lat: +(lat + spread).toFixed(4), lng: +(lng + spread).toFixed(4), label: 'NE' },
  { lat: +(lat - spread).toFixed(4), lng: +(lng - spread).toFixed(4), label: 'SW' },
  { lat: +(lat - spread).toFixed(4), lng: +(lng + spread).toFixed(4), label: 'SE' }
];
var windResults = await Promise.all(windPoints.map(async function(p) {
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lng + '&current=windspeed_10m,winddirection_10m,windgusts_10m&timezone=auto';
    var res = await fetch(url);
    var data = await res.json();
    return { lat: p.lat, lng: p.lng, label: p.label, speed: data.current?.windspeed_10m || 0, direction: data.current?.winddirection_10m || 0, gusts: data.current?.windgusts_10m || 0 };
  } catch(e) { return { lat: p.lat, lng: p.lng, label: p.label, speed: 0, direction: 0, gusts: 0, error: true }; }
}));

var topSpecies = (sp.observations || []).slice(0, 15).map(function(o) {
  return { name: o.speciesName || o.scientificName, taxon: o.iconicTaxon, photo: o.photoUrl, lat: o.latitude, lng: o.longitude };
});

var landmarks = (lm.elements || []).slice(0, 25).map(function(e) {
  return { name: e.name || e.tags?.name || 'Unbenannt', lat: e.lat, lon: e.lon, type: e.tags?.tourism || e.tags?.historic || e.tags?.amenity || 'landmark', desc: e.tags?.description?.substring(0, 200) };
});

var trips = (transit.trips || []).map(function(t) {
  var stops = t.stops || [];
  var first = stops[0] || {};
  var last = stops[stops.length - 1] || {};
  var depTime = first.departure || first.scheduledDeparture;
  var arrTime = last.arrival || last.scheduledArrival;
  var durationMin = null;
  if (depTime && arrTime) {
    durationMin = Math.round((new Date(arrTime).getTime() - new Date(depTime).getTime()) / 60000);
  }
  return {
    line: t.lineName, headsign: t.headsign, mode: t.mode,
    firstStop: first.name, lastStop: last.name,
    departure: depTime, arrival: arrTime, durationMin: durationMin,
    stops: stops.map(function(s) { return { name: s.name, lat: s.lat, lng: s.lng }; })
  };
});

return {
  location: { name: addr.city || loc.displayName || 'Unbekannt', display: loc.displayName || '', state: addr.state, country: addr.country, lat: lat, lng: lng },
  weather: { temp: cur.temperature, feels: cur.apparentTemperature, humidity: cur.humidity, wind: cur.windSpeed, windDir: cur.windDirection, code: cur.weatherCode, desc: cur.weatherDescription },
  windGrid: windResults,
  sun: { rise: today.sunrise, set: today.sunset, daylight: today.daylightHours, uv: today.uvIndexMax, uvRisk: today.uvRisk },
  air: { aqi: air.europeanAqi, desc: air.aqiDescription, pm25: air.pm25, pm10: air.pm10, ozone: air.ozone },
  species: { total: sp.totalResults || 0, top: topSpecies },
  phenology: { phase: (ph.currentPhase||{}).name, phaseEn: (ph.currentPhase||{}).nameEn, plants: (ph.currentPhase||{}).typicalBloom || [], fauna: (ph.currentPhase||{}).typicalFauna || [] },
  landmarks: { total: (lm.elements || []).length, top: landmarks },
  news: { total: news.totalItems || 0, items: (news.items || []).slice(0, 8).map(function(n) { return { title: n.title, link: n.link, date: n.pubDate, source: n.source }; }) },
  transit: { totalTrips: transit.totalTrips || 0, totalStops: transit.totalStops || 0, trips: trips },
  meta: { fetchedAt: new Date().toISOString() }
};
`;

// --- Earth Pulse: PulsRenderer theRun code ---
// This renders the full interactive HTML dashboard with Leaflet map, wind arrows,
// species cards, transit routes, phenology, news, and a search bar.
const EARTH_PULSE_RENDERER_CODE = `
var d = Pulsdata;
var loc = d.location || {};
var w = d.weather || {};
var sun = d.sun || {};
var air = d.air || {};
var sp = d.species || {};
var ph = d.phenology || {};
var lm = d.landmarks || {};
var nw = d.news || {};
var tr = d.transit || {};
var wg = d.windGrid || [];
var lat = loc.lat || 50.11;
var lng = loc.lng || 8.68;

var weatherIcons = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
var wIcon = weatherIcons[w.code] || '🌍';
var aqiColor = (air.aqi||0) < 20 ? '#16a34a' : (air.aqi||0) < 40 ? '#65a30d' : (air.aqi||0) < 60 ? '#ca8a04' : (air.aqi||0) < 80 ? '#ea580c' : '#dc2626';
var uvColor = (sun.uv||0) < 3 ? '#16a34a' : (sun.uv||0) < 6 ? '#ca8a04' : (sun.uv||0) < 8 ? '#ea580c' : '#dc2626';
var lineColors = ['#e11d48','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#c026d3','#4f46e5','#059669','#d97706','#7c3aed','#0d9488'];

var avgWind = 0; var avgDir = 0; var wCount = 0; var maxGusts = 0;
wg.forEach(function(wp) { if (!wp.error) { avgWind += wp.speed; avgDir += wp.direction; wCount++; if(wp.gusts>maxGusts)maxGusts=wp.gusts; } });
if (wCount > 0) { avgWind = (avgWind / wCount).toFixed(1); avgDir = Math.round(avgDir / wCount); }
var dirNames = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
var dirName = dirNames[Math.round(avgDir / 22.5) % 16] || '';

var windArrowsJS = '';
wg.forEach(function(wp) {
  if (wp.error) {
    windArrowsJS += 'L.marker([' + wp.lat + ',' + wp.lng + '],{icon:L.divIcon({className:\\'\\',html:\\'<div style="color:#999;font-size:16px;">✕</div>\\',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map);';
  } else {
    var sz = 18 + Math.min(wp.speed, 60) * 0.5;
    var intensity = Math.min(wp.speed / 50, 1);
    var cr = Math.round(30 + 200 * intensity);
    var cg = Math.round(120 * (1 - intensity));
    var cb = Math.round(180 * (1 - intensity));
    var col = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
    windArrowsJS += 'L.marker([' + wp.lat + ',' + wp.lng + '],{icon:L.divIcon({className:\\'\\',html:\\'<div style="transform:rotate(' + wp.direction + 'deg);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="' + col + '" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));"><path d="M12 2L8 12h3v8h2v-8h3z"/></svg></div>\\',iconSize:[' + sz + ',' + sz + '],iconAnchor:[' + (sz/2) + ',' + (sz/2) + ']})}).addTo(map).bindPopup("<b>' + wp.speed + ' km/h</b><br>Richtung: ' + wp.direction + '°<br>Böen: ' + wp.gusts + ' km/h");';
  }
});

var transitJS = '';
var transitCards = '';
(tr.trips || []).forEach(function(trip, i) {
  var color = lineColors[i % lineColors.length];
  var stops = trip.stops || [];
  var coords = '';
  stops.forEach(function(s, j) { if (s.lat && s.lng) { if (j > 0) coords += ','; coords += '[' + s.lat + ',' + s.lng + ']'; } });
  if (coords) {
    transitJS += 'L.polyline([' + coords + '],{color:"' + color + '",weight:3,opacity:0.7}).addTo(map);';
    var last = stops[stops.length - 1];
    if (last && last.lat && last.lng) {
      var label = (last.name || '').replace(/'/g, '').substring(0, 25);
      transitJS += 'L.marker([' + last.lat + ',' + last.lng + '],{icon:L.divIcon({className:\\'\\',html:\\'<div style="background:' + color + ';color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;font-family:system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + (trip.line||'') + ' ' + label + '</div>\\',iconAnchor:[-4,8]})}).addTo(map);';
    }
  }
  var depStr = trip.departure ? new Date(trip.departure).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var arrStr = trip.arrival ? new Date(trip.arrival).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}) : '?';
  var durStr = trip.durationMin ? trip.durationMin + ' min' : '';
  transitCards += '<div class="tc"><div class="tc-head"><span class="tc-line" style="background:' + color + ';">' + (trip.line||'?') + '</span><span class="tc-mode">' + (trip.mode||'') + '</span>';
  if (durStr) transitCards += '<span class="tc-dur">' + durStr + '</span>';
  transitCards += '</div>';
  transitCards += '<div class="tc-route">' + (trip.firstStop||'') + ' <span class="tc-arr">→</span> ' + (trip.lastStop||'') + '</div>';
  transitCards += '<div class="tc-times">' + depStr + ' → ' + arrStr + '</div></div>';
});

var speciesJS = ''; (sp.top || []).forEach(function(s) { if (s.lat && s.lng) { speciesJS += 'L.circleMarker([' + s.lat + ',' + s.lng + '],{radius:5,fillColor:"#16a34a",color:"#fff",weight:1,fillOpacity:0.8}).addTo(map).bindPopup("<b>' + (s.name||'?').replace(/'/g,'') + '</b><br>' + (s.taxon||'') + '");'; } });
var landmarkJS = ''; (lm.top || []).slice(0, 15).forEach(function(l) { if (l.lat && l.lon) { landmarkJS += 'L.circleMarker([' + l.lat + ',' + l.lon + '],{radius:4,fillColor:"#ca8a04",color:"#fff",weight:1,fillOpacity:0.8}).addTo(map).bindPopup("<b>' + (l.name||'?').replace(/'/g,'') + '</b><br>' + (l.type||'') + '");'; } });

var speciesCards = ''; (sp.top || []).forEach(function(s) {
  speciesCards += '<div class="spc">'; if (s.photo) speciesCards += '<img src="' + s.photo + '" onerror="this.style.display=\\'none\\'" loading="lazy"/>';
  speciesCards += '<div class="spc-i"><strong>' + (s.name||'?') + '</strong><span>' + (s.taxon||'') + '</span></div></div>';
});
var landmarkCards = ''; (lm.top || []).slice(0, 12).forEach(function(l) {
  landmarkCards += '<div class="lmc"><div class="lm-t">' + (l.type||'') + '</div><div class="lm-n">' + (l.name||'?') + '</div>';
  if (l.desc) landmarkCards += '<div class="lm-d">' + l.desc + '</div>'; landmarkCards += '</div>';
});
var plantsHtml = ''; (ph.plants || []).forEach(function(p) { plantsHtml += '<span class="tg tg-g">' + p + '</span>'; });
var faunaHtml = ''; (ph.fauna || []).forEach(function(f) { faunaHtml += '<span class="tg tg-a">' + f + '</span>'; });
var newsHtml = ''; (nw.items || []).forEach(function(n) {
  newsHtml += '<a href="' + (n.link||'#') + '" target="_blank" class="ni"><div class="ni-t">' + (n.title||'?') + '</div><div class="ni-m">' + (n.source||'') + ' · ' + (n.date||'') + '</div></a>';
});

var scriptEnd = '<' + '/script>';
var h = '';
h += '<!DOCTYPE html><html><head><meta charset="utf-8"/>';
h += '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>';
h += '<title>' + (loc.name||'Ort') + ' — Puls der Erde</title>';
h += '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>';
h += '<' + 'script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js">' + scriptEnd;
h += '<style>';
h += '*{margin:0;padding:0;box-sizing:border-box;}';
h += 'body{font-family:Georgia,"Times New Roman",serif;background:#fafaf8;color:#333;-webkit-text-size-adjust:100%;}';
h += '.hero{position:relative;height:55vh;min-height:340px;} #hm{width:100%;height:100%;}';
h += '.ho{position:absolute;bottom:0;left:0;right:0;z-index:1000;padding:16px;background:rgba(250,250,248,0.92);backdrop-filter:blur(4px);}';
h += '.ho-t{font-size:clamp(1.6rem,5vw,3rem);font-weight:700;color:#1a1a1a;line-height:1.1;} .ho-s{font-size:0.85rem;color:#777;margin-top:3px;font-style:italic;}';
h += '.ct{max-width:680px;margin:0 auto;padding:12px 14px 60px;} @media(min-width:560px){.ct{padding:16px 24px 60px;}}';
h += '.sec{margin-bottom:40px;} .sec-t{font-size:1.2rem;color:#1a1a1a;margin-bottom:10px;border-bottom:2px solid #e5e5e0;padding-bottom:6px;}';
h += '.wx-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;} @media(max-width:400px){.wx-row{grid-template-columns:1fr;}}';
h += '.wx-card{background:#fff;border-radius:12px;padding:14px;border:1px solid #e5e5e0;}';
h += '.wx-big{font-size:2.4rem;font-weight:700;color:#1a1a1a;font-family:system-ui,sans-serif;line-height:1;}';
h += '.wx-sub{font-size:0.82rem;color:#666;margin-top:3px;} .wx-detail{font-size:0.78rem;color:#888;margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;} .wx-detail span{white-space:nowrap;}';
h += '.fg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;} @media(min-width:560px){.fg{grid-template-columns:repeat(4,1fr);}}';
h += '.fc{background:#fff;border-radius:10px;padding:12px;border:1px solid #e5e5e0;} .fc-v{font-size:1.4rem;font-weight:700;color:#1a1a1a;font-family:system-ui,sans-serif;} .fc-l{font-size:0.68rem;color:#999;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;}';
h += '.pr{font-size:0.95rem;line-height:1.7;color:#555;} .pr strong{color:#1a1a1a;}';
h += '.sr{display:flex;gap:10px;overflow-x:auto;padding:6px 0;-webkit-overflow-scrolling:touch;} .sr::-webkit-scrollbar{height:3px;} .sr::-webkit-scrollbar-thumb{background:#ccc;border-radius:2px;}';
h += '.spc{flex:0 0 130px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e5e0;} .spc img{width:100%;height:90px;object-fit:cover;}';
h += '.spc-i{padding:7px;} .spc-i strong{display:block;font-size:0.78rem;color:#1a1a1a;} .spc-i span{font-size:0.68rem;color:#999;}';
h += '.lmc{background:#fff;border-radius:10px;padding:10px;border:1px solid #e5e5e0;} .lm-t{font-size:0.62rem;color:#999;text-transform:uppercase;letter-spacing:1px;} .lm-n{font-size:0.88rem;color:#1a1a1a;font-weight:600;margin-top:1px;} .lm-d{font-size:0.78rem;color:#777;margin-top:3px;line-height:1.4;}';
h += '.tg{display:inline-block;padding:3px 10px;border-radius:14px;font-size:0.72rem;margin:2px;font-family:system-ui,sans-serif;} .tg-g{background:#dcfce7;color:#166534;} .tg-a{background:#fef3c7;color:#92400e;}';
h += '.tc{background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #e5e5e0;margin-bottom:8px;} .tc-head{display:flex;align-items:center;gap:8px;} .tc-line{color:#fff;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:4px;font-family:system-ui,sans-serif;} .tc-mode{font-size:0.68rem;color:#999;text-transform:uppercase;} .tc-dur{font-size:0.72rem;color:#1a1a1a;font-weight:600;font-family:system-ui,sans-serif;margin-left:auto;} .tc-route{font-size:0.85rem;color:#333;margin-top:5px;line-height:1.3;} .tc-arr{color:#bbb;} .tc-times{font-size:0.75rem;color:#888;margin-top:2px;font-family:system-ui,sans-serif;}';
h += '.ni{display:block;padding:10px 0;border-bottom:1px solid #eee;text-decoration:none;} .ni-t{color:#2563eb;font-size:0.88rem;line-height:1.4;} .ni:hover .ni-t{color:#1d4ed8;} .ni-m{color:#aaa;font-size:0.68rem;margin-top:3px;}';
h += '.aqi{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;font-size:0.95rem;font-weight:700;font-family:system-ui,sans-serif;color:#fff;}';
h += '.sb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;gap:4px;background:rgba(255,255,255,0.95);padding:6px 10px;border-radius:22px;border:1px solid #ddd;backdrop-filter:blur(10px);box-shadow:0 2px 10px rgba(0,0,0,0.07);width:calc(100% - 20px);max-width:340px;}';
h += '.sb input{background:transparent;border:none;color:#333;font-size:0.85rem;flex:1;min-width:0;outline:none;font-family:system-ui,sans-serif;} .sb button{background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:0.75rem;white-space:nowrap;} .sb button:hover{background:#1d4ed8;}';
h += '</style></head><body>';

h += '<div class="sb"><input id="q" placeholder="Ort eingeben..." /><button id="go">Erkunden</button></div>';
h += '<div class="hero"><div id="hm"></div><div class="ho"><div class="ho-t">' + (loc.name||'?') + '</div><div class="ho-s">' + (loc.display||'') + '</div></div></div>';
h += '<div class="ct">';

h += '<div class="sec"><div class="sec-t">Wetter & Tageslicht</div><div class="wx-row">';
h += '<div class="wx-card"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:1.8rem;">' + wIcon + '</span><div class="wx-big">' + (w.temp||'?') + '°</div></div>';
h += '<div class="wx-sub">' + (w.desc||'') + ', gefühlt ' + (w.feels||'?') + '°</div>';
h += '<div class="wx-detail"><span style="display:flex;align-items:center;gap:3px;"><span style="transform:rotate(' + (w.windDir||0) + 'deg);display:inline-block;"><svg viewBox="0 0 24 24" width="14" height="14" fill="#2563eb"><path d="M12 2L8 12h3v8h2v-8h3z"/></svg></span>' + (avgWind||w.wind||'?') + ' km/h ' + dirName + '</span>';
h += '<span>Böen ' + maxGusts + '</span><span>💧 ' + (w.humidity||'?') + '%</span></div></div>';
h += '<div class="wx-card"><div style="display:flex;align-items:center;gap:8px;"><div class="wx-big">' + (sun.daylight||'?') + 'h</div><span style="font-size:0.9rem;color:#888;">Tageslicht</span></div>';
h += '<div class="wx-sub">🌅 ' + ((sun.rise||'?').split('T')[1]||'?') + '  🌇 ' + ((sun.set||'?').split('T')[1]||'?') + '</div>';
h += '<div class="wx-detail"><span style="color:' + uvColor + ';font-weight:600;">UV ' + (sun.uv||'?') + '</span><span>' + (sun.uvRisk||'') + '</span>';
h += '<span><span class="aqi" style="background:' + aqiColor + ';width:24px;height:24px;font-size:0.65rem;">' + (air.aqi||'?') + '</span> ' + (air.desc||'') + '</span></div></div></div></div>';

h += '<div class="sec"><div class="sec-t">🌸 ' + (ph.phase||'Jahreszeit') + '</div>';
h += '<div class="pr" style="margin-bottom:8px;"><strong>' + (ph.phase||'?') + '</strong>';
if(ph.plants&&ph.plants.length) h += ' — ' + ph.plants.slice(0,3).join(', ') + ' blühen.';
if(ph.fauna&&ph.fauna.length) h += ' ' + ph.fauna.slice(0,2).join(' und ') + '.';
h += '</div><div style="margin-bottom:4px;">' + plantsHtml + '</div>' + faunaHtml + '</div>';

h += '<div class="sec"><div class="sec-t">🦎 ' + (sp.total||0).toLocaleString() + ' Artbeobachtungen</div><div class="sr">' + speciesCards + '</div></div>';
if(tr.trips && tr.trips.length) { h += '<div class="sec"><div class="sec-t">🚌 ' + tr.trips.length + ' Linien</div>' + transitCards + '</div>'; }
h += '<div class="sec"><div class="sec-t">🏛️ ' + (lm.total||0) + ' Orte</div><div class="fg">' + landmarkCards + '</div></div>';
if(nw.items && nw.items.length > 0) { h += '<div class="sec"><div class="sec-t">📰 Aktuelles</div>' + newsHtml + '</div>'; }
h += '<div style="color:#bbb;font-size:0.68rem;text-align:center;padding:28px 0;border-top:1px solid #eee;">🌍 Puls der Erde</div>';
h += '</div>';

h += '<' + 'script>';
h += 'var map=L.map("hm",{zoomControl:true,attributionControl:false}).setView([' + lat + ',' + lng + '],13);';
h += 'L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(map);';
h += 'L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",{maxZoom:19,pane:"overlayPane"}).addTo(map);';
h += windArrowsJS + transitJS + speciesJS + landmarkJS;
h += 'var qI=document.getElementById("q");qI.value="' + (loc.name||'') + '";';
h += 'function doSearch(){var u=new URL(window.location);u.searchParams.set("q",qI.value);window.location=u.toString();}';
h += 'document.getElementById("go").addEventListener("click",doSearch);';
h += 'qI.addEventListener("keydown",function(e){if(e.key==="Enter")doSearch();});';
h += scriptEnd;
h += '</body></html>';
return h;
`;

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
