/** Angereichertes Datumsfeld (nach enrichDateFields). */
export interface EnrichedDate {
    date: Date;
    timestamp: number;
    isExpired: () => boolean;
}

// ============================================================
// Raw API types (PascalCase, as returned by the Warframe API)
// ============================================================

/** Roh-Format eines Alerts von der API. */
export interface RawAlertFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    MissionInfo: {
        location: string;
        missionType: string;
        faction: string;
        difficulty?: number;
        missionReward?: {
            credits?: number;
            countedItems?: Array<{ ItemType: string; ItemCount: number }>;
            items?: string[];
        };
        minEnemyLevel?: number;
        maxEnemyLevel?: number;
        levelOverride?: string;
        enemySpec?: string;
        descText?: string;
        maxWaveNum?: number;
    };
    Tag?: string;
    ForceUnlock?: boolean;
}

/** Einzelne Nachricht eines Events. */
export interface IRawEventMessage {
    LanguageCode: string;
    Message: string;
}

/** Roh-Format eines Events. */
export interface RawEventFromApi {
    _id: { $oid: string };
    Messages: IRawEventMessage[];
    Prop?: string;
    Date?: EnrichedDate;
    Priority?: boolean;
    MobileOnly?: boolean;
    Community?: boolean;
    Icon?: string;
}

/** Sortie-Variante. */
export interface RawSortieVariant {
    missionType: string;
    modifierType: string;
    node: string;
    tileset?: string;
}

/** Roh-Sortie. */
export interface RawSortieFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Reward: string;
    Seed: number;
    Boss: string;
    ExtraDrops: unknown[];
    Variants: RawSortieVariant[];
}

/** Lite-Sortie Mission (Archon Hunt). */
export interface RawLiteSortieMission {
    missionType: string;
    node: string;
}

/** Roh-LiteSortie (Archon Hunt). */
export interface RawLiteSortieFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Reward: string;
    Seed: number;
    Boss: string;
    Missions: RawLiteSortieMission[];
}

/** Belohnung einer Invasion. */
export interface RawInvasionReward {
    countedItems?: Array<{ ItemType: string; ItemCount: number }>;
    credits?: number;
}

/** Missions-Info einer Invasion. */
export interface RawInvasionMissionInfo {
    seed: number;
    faction: string;
}

/** Roh-Invasion. */
export interface RawInvasionFromApi {
    _id: { $oid: string };
    Faction: string;
    DefenderFaction: string;
    Node: string;
    Count: number;
    Goal: number;
    LocTag: string;
    Completed: boolean;
    ChainID?: { $oid: string };
    AttackerReward: RawInvasionReward;
    AttackerMissionInfo: RawInvasionMissionInfo;
    DefenderReward: RawInvasionReward;
    DefenderMissionInfo: RawInvasionMissionInfo;
    Activation?: EnrichedDate;
}

/** Roh-VoidTrader (Baro Ki'Teer). */
export interface RawVoidTraderFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Character: string;
    Node: string;
    Manifest?: Array<{
        ItemType: string;
        PrimePrice: number;
        RegularPrice?: number;
    }>;
}

/** Roh-PrimeVaultTrader. */
export interface RawPrimeVaultTraderFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    InitialStartDate?: EnrichedDate;
    Node: string;
    Manifest?: Array<{
        ItemType: string;
        PrimePrice: number;
    }>;
}

/** Roh-VoidStorm (Railjack-Fissure). */
export interface RawVoidStormFromApi {
    _id: { $oid: string };
    Node: string;
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    ActiveMissionTier: string;
}

/** Roh-Fissure (ActiveMission). */
export interface RawFissureFromApi {
    _id: { $oid: string };
    Region: number;
    Seed: number;
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Node: string;
    MissionType: string;
    Modifier: string;
    Hard?: boolean;
}

/** Roh-SyndicateMission. */
export interface RawSyndicateMissionFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Tag: string;
    Seed: number;
    Nodes: string[];
}

/** Roh-DailyDeal (Darvo). */
export interface RawDailyDealFromApi {
    StoreItem: string;
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Discount: number;
    OriginalPrice: number;
    SalePrice: number;
    AmountTotal: number;
    AmountSold: number;
}

/** Roh-FlashSale. */
export interface RawFlashSaleFromApi {
    TypeName: string;
    PremiumOverride: number;
    StartDate: EnrichedDate;
    EndDate: EnrichedDate;
    BogoBuy?: number;
    BogoGet?: number;
    Featured?: boolean;
    Popular?: boolean;
    ShowInMarket?: boolean;
    BannerIndex?: number;
}

/** Roh-NodeOverride. */
export interface RawNodeOverrideFromApi {
    _id: { $oid: string };
    Node: string;
    Hide?: boolean;
    Faction?: string;
    CustomNpcEncounters?: string[];
    LevelOverride?: string;
    EnemySpec?: string;
}

/** Roh-Goal (Event/Operation). */
export interface RawGoalFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Node?: string;
    ScoreVar?: string;
    ScoreLocTag?: string;
    Count?: number;
    HealthPct?: number;
    Regions?: number[];
    Desc?: string;
    ToolTip?: string;
    OptionalInMission?: boolean;
    Tag?: string;
    UpgradeIds?: Array<{ $oid: string }>;
    Personal?: boolean;
    Community?: boolean;
    Goal?: number;
    Reward?: {
        credits?: number;
        items?: string[];
        countedItems?: Array<{ ItemType: string; ItemCount: number }>;
    };
}

/** Nightwave-Challenge. */
export interface RawNightwaveChallenge {
    _id: { $oid: string };
    Daily?: boolean;
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Challenge: string;
    isHard?: boolean;
}

/** Roh-SeasonInfo (Nightwave). */
export interface RawSeasonInfoFromApi {
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    AffiliationTag: string;
    Season: number;
    Phase: number;
    Params: string;
    ActiveChallenges: RawNightwaveChallenge[];
}

/** Roh-PVPChallengeInstance. */
export interface RawPVPChallengeFromApi {
    _id: { $oid: string };
    challengeTypeRefID: string;
    startDate: EnrichedDate;
    endDate: EnrichedDate;
    params: Array<{ n: string; v: number }>;
    isGenerated?: boolean;
    PVPMode: string;
    subChallenges: unknown[];
    Category: string;
}

/** Calendar-Event. */
export interface RawCalendarEvent {
    type: string;
    challenge?: string;
    reward?: string;
}

/** Calendar-Day. */
export interface RawCalendarDay {
    day: number;
    events: RawCalendarEvent[];
}

/** Roh-CalendarSeason. */
export interface RawCalendarSeasonFromApi {
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Days: RawCalendarDay[];
}

/** Conquest-Difficulty. */
export interface RawConquestDifficulty {
    type: string;
    deviation: string;
    risks: string[];
}

/** Conquest-Mission. */
export interface RawConquestMission {
    faction: string;
    missionType: string;
    difficulties: RawConquestDifficulty[];
}

/** Roh-Conquest. */
export interface RawConquestFromApi {
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    Type: string;
    Missions: RawConquestMission[];
}

/** Descent-Challenge. */
export interface RawDescentChallenge {
    Index: number;
    Type: string;
    Challenge: string;
    Level: string;
    Specs: string[];
    Auras: string[];
}

/** Roh-Descent (Circuit). */
export interface RawDescentFromApi {
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    RandSeed: number;
    Challenges: RawDescentChallenge[];
}

/** EndlessXpChoice. */
export interface RawEndlessXpChoice {
    Category: string;
    Choices: string[];
}

/** Roh-FeaturedGuild. */
export interface RawFeaturedGuildFromApi {
    _id: { $oid: string };
    Name: string;
    Tier: number;
    Emblem?: boolean;
    AllianceId?: { $oid: string };
    HiddenPlatforms?: Record<string, boolean>;
    IconOverride?: number;
}

/** InGameMarket-Category. */
export interface RawMarketCategory {
    CategoryName: string;
    Name: string;
    Icon: string;
    AddToMenu?: boolean;
    Items: string[];
}

/** Roh-InGameMarket. */
export interface RawInGameMarketFromApi {
    LandingPage?: {
        Categories: RawMarketCategory[];
    };
}

/** Roh-GlobalUpgrade. */
export interface RawGlobalUpgradeFromApi {
    _id: { $oid: string };
    Activation: EnrichedDate;
    Expiry: EnrichedDate;
    UpgradeType: string;
    OperationType: string;
    Value: number;
    LocalizedDesc?: string;
}

/** Roh-PersistentEnemy (Acolyte/Stalker). */
export interface RawPersistentEnemyFromApi {
    _id: { $oid: string };
    AgentType: string;
    LocTag: string;
    Rank?: number;
    HealthPercent: number;
    Discovered?: boolean;
    LastDiscoveredLocation?: string;
    Region?: number;
}

// ============================================================
// Normalized types (camelCase, after normalization)
// ============================================================

/** Belohnung einer Alert-Mission (normalisiert). */
export interface IAlertMissionReward {
    items?: string[];
    countedItems?: Array<{ count: number; type: string }>;
    credits?: number;
}

/** Mission eines Alerts (normalisiert). */
export interface IAlertMission {
    node: string;
    type: string;
    faction: string;
    reward?: IAlertMissionReward;
    minEnemyLevel?: number;
    maxEnemyLevel?: number;
}

/** Einzelner Alert (normalisiert). */
export interface IAlertData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    mission: IAlertMission;
    active: boolean;
    tag?: string;
}

/** Sortie-Variante (normalisiert). */
export interface ISortieVariant {
    missionType: string;
    modifier: string;
    node: string;
    tileset?: string;
}

/** Sortie (normalisiert). */
export interface ISortieData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    boss: string;
    variants: ISortieVariant[];
    active: boolean;
}

/** Archon Hunt / LiteSortie (normalisiert). */
export interface IArchonHuntData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    boss: string;
    missions: Array<{ missionType: string; node: string }>;
    active: boolean;
}

/** Invasion (normalisiert). */
export interface IInvasionData {
    id: string;
    node: string;
    attackerFaction: string;
    defenderFaction: string;
    attackerReward: IAlertMissionReward;
    defenderReward: IAlertMissionReward;
    progress: number;
    completed: boolean;
    active: boolean;
}

/** Void Fissure (normalisiert). */
export interface IFissureData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    node: string;
    missionType: string;
    tier: string;
    isStorm: boolean;
    isHard: boolean;
    active: boolean;
}

/** Void Trader / Baro Ki'Teer (normalisiert). */
export interface IVoidTraderData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    character: string;
    node: string;
    active: boolean;
    inventory: Array<{
        item: string;
        ducats: number;
        credits?: number;
    }>;
}

/** Syndicate Mission (normalisiert). */
export interface ISyndicateMissionData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    syndicate: string;
    nodes: string[];
    active: boolean;
}

/** Daily Deal / Darvo (normalisiert). */
export interface IDailyDealData {
    item: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    discount: number;
    originalPrice: number;
    salePrice: number;
    total: number;
    sold: number;
    active: boolean;
}

/** Flash Sale (normalisiert). */
export interface IFlashSaleData {
    item: string;
    premiumOverride: number;
    startDate: EnrichedDate;
    endDate: EnrichedDate;
    featured: boolean;
    popular: boolean;
    active: boolean;
}

/** Nightwave Challenge (normalisiert). */
export interface INightwaveChallenge {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    challenge: string;
    isDaily: boolean;
    isElite: boolean;
    active: boolean;
}

/** Nightwave Season (normalisiert). */
export interface INightwaveData {
    activation: EnrichedDate;
    expiry: EnrichedDate;
    season: number;
    phase: number;
    tag: string;
    activeChallenges: INightwaveChallenge[];
    active: boolean;
}

/** Goal / Event (normalisiert). */
export interface IGoalData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    node?: string;
    tag?: string;
    description?: string;
    tooltip?: string;
    healthPct?: number;
    goal?: number;
    count?: number;
    personal: boolean;
    community: boolean;
    active: boolean;
    reward?: IAlertMissionReward;
}

/** Void Storm (normalisiert). */
export interface IVoidStormData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    node: string;
    tier: string;
    active: boolean;
}

/** Node Override (normalisiert). */
export interface INodeOverrideData {
    id: string;
    node: string;
    hidden: boolean;
    faction?: string;
}

/** PVP Challenge (normalisiert). */
export interface IPVPChallengeData {
    id: string;
    type: string;
    startDate: EnrichedDate;
    endDate: EnrichedDate;
    mode: string;
    category: string;
    active: boolean;
}

/** Calendar Day (normalisiert). */
export interface ICalendarDay {
    day: number;
    events: Array<{
        type: string;
        challenge?: string;
        reward?: string;
    }>;
}

/** Calendar Season (normalisiert). */
export interface ICalendarSeasonData {
    activation: EnrichedDate;
    expiry: EnrichedDate;
    days: ICalendarDay[];
    active: boolean;
}

/** Conquest (normalisiert). */
export interface IConquestData {
    activation: EnrichedDate;
    expiry: EnrichedDate;
    type: string;
    missions: Array<{
        faction: string;
        missionType: string;
        difficulties: Array<{
            type: string;
            deviation: string;
            risks: string[];
        }>;
    }>;
    active: boolean;
}

/** Descent / Circuit (normalisiert). */
export interface IDescentData {
    activation: EnrichedDate;
    expiry: EnrichedDate;
    seed: number;
    challenges: Array<{
        index: number;
        type: string;
        challenge: string;
        level: string;
    }>;
    active: boolean;
}

/** Endless XP Choice (normalisiert). */
export interface IEndlessXpChoiceData {
    category: string;
    choices: string[];
}

/** Featured Guild (normalisiert). */
export interface IFeaturedGuildData {
    id: string;
    name: string;
    tier: number;
    emblem: boolean;
}

/** Persistent Enemy / Acolyte (normalisiert). */
export interface IPersistentEnemyData {
    id: string;
    type: string;
    tag: string;
    healthPercent: number;
    discovered: boolean;
    lastLocation?: string;
    region?: number;
}

/** Global Upgrade (normalisiert). */
export interface IGlobalUpgradeData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    upgradeType: string;
    operationType: string;
    value: number;
    description?: string;
    active: boolean;
}

// ============================================================
// World State root interface
// ============================================================

/** Antwort der World-State-API (nach enrichDateFields). */
export interface IWarframeWorldState {
    WorldSeed?: string;
    Version?: number;
    MobileVersion?: string;
    BuildLabel?: string;
    Time?: number;
    Alerts?: RawAlertFromApi[];
    Events?: RawEventFromApi[];
    Sorties?: RawSortieFromApi[];
    LiteSorties?: RawLiteSortieFromApi[];
    Invasions?: RawInvasionFromApi[];
    VoidTraders?: RawVoidTraderFromApi[];
    PrimeVaultTraders?: RawPrimeVaultTraderFromApi[];
    VoidStorms?: RawVoidStormFromApi[];
    ActiveMissions?: RawFissureFromApi[];
    SyndicateMissions?: RawSyndicateMissionFromApi[];
    DailyDeals?: RawDailyDealFromApi[];
    FlashSales?: RawFlashSaleFromApi[];
    GlobalUpgrades?: RawGlobalUpgradeFromApi[];
    Goals?: RawGoalFromApi[];
    NodeOverrides?: RawNodeOverrideFromApi[];
    PVPChallengeInstances?: RawPVPChallengeFromApi[];
    PersistentEnemies?: RawPersistentEnemyFromApi[];
    SeasonInfo?: RawSeasonInfoFromApi;
    KnownCalendarSeasons?: RawCalendarSeasonFromApi[];
    Conquests?: RawConquestFromApi[];
    Descents?: RawDescentFromApi[];
    EndlessXpChoices?: RawEndlessXpChoice[];
    FeaturedGuilds?: RawFeaturedGuildFromApi[];
    InGameMarket?: RawInGameMarketFromApi;
    LibraryInfo?: { LastCompletedTargetType?: string };
    PrimeAccessAvailability?: { State?: string };
    PrimeVaultAvailabilities?: Array<{ State?: string }>;
    PrimeTokenAvailability?: boolean;
    HubEvents?: unknown[];
    SkuSales?: unknown[];
    PVPAlternativeModes?: unknown[];
    PVPActiveTournaments?: unknown[];
    ProjectPct?: number[];
    ConstructionProjects?: unknown[];
    TwitchPromos?: unknown[];
    ExperimentRecommended?: unknown[];
    ForceLogoutVersion?: number;
    Tmp?: string;
    [key: string]: unknown;
}
