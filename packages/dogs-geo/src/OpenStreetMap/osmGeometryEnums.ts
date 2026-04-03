/**
 * OSM tag enums for geometry retrievers — landuse, natural, highway.
 * Values match common OpenStreetMap tag strings.
 */

/** `landuse=*` values selectable for area geometry queries */
export enum OsmLanduseValue {
    Forest = "forest",
    Meadow = "meadow",
    Farmland = "farmland",
    Residential = "residential",
    Industrial = "industrial",
    Commercial = "commercial",
    Orchard = "orchard",
    Vineyard = "vineyard",
    Grass = "grass",
    Cemetery = "cemetery",
    RecreationGround = "recreation_ground",
    Allotments = "allotments",
    Farmyard = "farmyard",
    Greenfield = "greenfield",
    Brownfield = "brownfield",
    Landfill = "landfill",
    Reservoir = "reservoir",
    Basin = "basin",
    SaltPond = "salt_pond",
    VillageGreen = "village_green",
    Retail = "retail",
    Construction = "construction",
}

/** `natural=*` values selectable for area geometry queries */
export enum OsmNaturalValue {
    Wood = "wood",
    Scrub = "scrub",
    Grassland = "grassland",
    Water = "water",
    Wetland = "wetland",
    Sand = "sand",
    Beach = "beach",
    Cliff = "cliff",
    Peak = "peak",
    TreeRow = "tree_row",
    Tree = "tree",
    BareRock = "bare_rock",
    Fell = "fell",
    Heath = "heath",
    Moor = "moor",
    Glacier = "glacier",
    Bay = "bay",
    Coastline = "coastline",
    Spring = "spring",
}

/** `highway=*` values selectable for street geometry queries */
export enum OsmHighwayValue {
    Motorway = "motorway",
    Trunk = "trunk",
    Primary = "primary",
    Secondary = "secondary",
    Tertiary = "tertiary",
    Unclassified = "unclassified",
    Residential = "residential",
    LivingStreet = "living_street",
    Service = "service",
    Footway = "footway",
    Path = "path",
    Track = "track",
    Cycleway = "cycleway",
    Steps = "steps",
    Pedestrian = "pedestrian",
    MotorwayLink = "motorway_link",
    TrunkLink = "trunk_link",
    PrimaryLink = "primary_link",
    SecondaryLink = "secondary_link",
    TertiaryLink = "tertiary_link",
    BusGuideway = "bus_guideway",
    Raceway = "raceway",
    Road = "road",
}

/** Preset name that expands to a fixed highway set */
export enum OsmHighwayPreset {
    MajorOnly = "major_only",
}

const LANDUSE_SET = new Set<string>(Object.values(OsmLanduseValue));
const NATURAL_SET = new Set<string>(Object.values(OsmNaturalValue));
const HIGHWAY_SET = new Set<string>(Object.values(OsmHighwayValue));

/** Default forest-related query when no filters are given */
export const DEFAULT_FOREST_LANDUSE: readonly OsmLanduseValue[] = [OsmLanduseValue.Forest];
export const DEFAULT_FOREST_NATURAL: readonly OsmNaturalValue[] = [OsmNaturalValue.Wood];

/** Default street classes when none are given */
export const DEFAULT_STREET_HIGHWAY: readonly OsmHighwayValue[] = [
    OsmHighwayValue.Primary,
    OsmHighwayValue.Secondary,
    OsmHighwayValue.Tertiary,
    OsmHighwayValue.Residential,
    OsmHighwayValue.LivingStreet,
];

function parseStringList(raw: unknown): string[] | null {
    if (raw == null) return null;
    if (Array.isArray(raw)) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
        } catch {
            return [t];
        }
        return [t];
    }
    return null;
}

export function parseOsmLanduseList(raw: unknown): OsmLanduseValue[] {
    const parsed = parseStringList(raw);
    if (parsed === null || parsed.length === 0) return [...DEFAULT_FOREST_LANDUSE];
    const out: OsmLanduseValue[] = [];
    for (const s of parsed) {
        if (LANDUSE_SET.has(s)) out.push(s as OsmLanduseValue);
    }
    return out.length ? out : [...DEFAULT_FOREST_LANDUSE];
}

export function parseOsmNaturalList(raw: unknown): OsmNaturalValue[] {
    const parsed = parseStringList(raw);
    if (parsed === null || parsed.length === 0) return [...DEFAULT_FOREST_NATURAL];
    const out: OsmNaturalValue[] = [];
    for (const s of parsed) {
        if (NATURAL_SET.has(s)) out.push(s as OsmNaturalValue);
    }
    return out.length ? out : [...DEFAULT_FOREST_NATURAL];
}

function highwayPresetValues(preset: string): OsmHighwayValue[] | null {
    const v = preset.toLowerCase();
    if (v === OsmHighwayPreset.MajorOnly) {
        return [
            OsmHighwayValue.Motorway,
            OsmHighwayValue.Trunk,
            OsmHighwayValue.Primary,
            OsmHighwayValue.Secondary,
            OsmHighwayValue.Tertiary,
        ];
    }
    return null;
}

export function parseOsmHighwayList(raw: unknown, presetRaw: unknown): OsmHighwayValue[] {
    if (typeof presetRaw === "string" && presetRaw.trim()) {
        const expanded = highwayPresetValues(presetRaw.trim());
        if (expanded) return expanded;
    }
    const parsed = parseStringList(raw);
    if (parsed === null || parsed.length === 0) return [...DEFAULT_STREET_HIGHWAY];
    const out: OsmHighwayValue[] = [];
    for (const s of parsed) {
        if (HIGHWAY_SET.has(s)) out.push(s as OsmHighwayValue);
    }
    return out.length ? out : [...DEFAULT_STREET_HIGHWAY];
}
