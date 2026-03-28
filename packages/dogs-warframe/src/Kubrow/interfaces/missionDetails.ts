export interface IMissionDetails {
    Name: string;
    Link: string;
    Planet: string;
    Type: string;
    Quotes: string;
    Tileset: string;
    Enemy: string | string[];
    MinLevel: number;
    MaxLevel: number;
    MasteryExp: number;
    InternalName: string;

    Image?: string;
    DropTableAlias?: string;
    CacheDropTableAlias?: string;
    ExtraDropTableAlias?: string;
    IsHidden?: boolean;
    IsTracked?: boolean;
    IsDarkSector?: boolean;
    IsArchwing?: boolean;
    IsRailjack?: boolean;
    Introduced?: string;
    Requirements?: string;
    Other?: string;

    Boss?: string;
    Pic?: string;
    Drops?: string[];

    NextNodes?: string[];
    PreviousNodes?: string[];
    PreviousNode?: string;

    CreditReward?: number;
    CreditsReward?: number;
    AdditionalCreditReward?: number;

    DSResourceBonus?: number;
    DSXPBonus?: number;
    DSWeaponBonus?: number;
    DSWeapon?: string;

    FighterMinLevel?: number;
    FighterMaxLevel?: number;
    MaxFighters?: number;
    MaxCrewships?: number;
    Objectives?: number;
    ObjectiveDetails?: string;
}
