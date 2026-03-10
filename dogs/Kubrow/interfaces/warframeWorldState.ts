/** Angereichertes Datumsfeld (nach enrichDateFields). */
export interface EnrichedDate {
    date: Date;
    timestamp: number;
    isExpired: () => boolean;
}

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

/** Einzelner Alert (einheitlich camelCase, nach Normalisierung). */
export interface IAlertData {
    id: string;
    activation: EnrichedDate;
    expiry: EnrichedDate;
    mission: IAlertMission;
    active: boolean;
    tag?: string;
}

/** Roh-Format eines Alerts von der API (nach enrichDateFields). */
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

/** Roh-Format eines Events von der API (nach enrichDateFields). */
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

/** Antwort der World-State-API (nach enrichDateFields). */
export interface IWarframeWorldState {
    Alerts?: RawAlertFromApi[];
    Events?: RawEventFromApi[];
    WorldSeed?: string;
    Version?: number;
    Time?: number;
    [key: string]: unknown;
}
