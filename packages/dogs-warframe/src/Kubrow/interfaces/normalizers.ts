import type {
    RawSortieFromApi, ISortieData,
    RawLiteSortieFromApi, IArchonHuntData,
    RawInvasionFromApi, IInvasionData,
    RawFissureFromApi, IFissureData,
    RawVoidStormFromApi, IVoidStormData,
    RawVoidTraderFromApi, IVoidTraderData,
    RawSyndicateMissionFromApi, ISyndicateMissionData,
    RawDailyDealFromApi, IDailyDealData,
    RawFlashSaleFromApi, IFlashSaleData,
    RawSeasonInfoFromApi, INightwaveData, INightwaveChallenge,
    RawGoalFromApi, IGoalData,
    RawNodeOverrideFromApi, INodeOverrideData,
    RawPVPChallengeFromApi, IPVPChallengeData,
    RawCalendarSeasonFromApi, ICalendarSeasonData,
    RawConquestFromApi, IConquestData,
    RawDescentFromApi, IDescentData,
    RawEndlessXpChoice, IEndlessXpChoiceData,
    RawFeaturedGuildFromApi, IFeaturedGuildData,
    RawPersistentEnemyFromApi, IPersistentEnemyData,
    RawGlobalUpgradeFromApi, IGlobalUpgradeData,
    IAlertMissionReward,
} from './warframeWorldState';

function normalizeReward(raw?: { credits?: number; items?: string[]; countedItems?: Array<{ ItemType: string; ItemCount: number }> }): IAlertMissionReward | undefined {
    if (!raw) return undefined;
    return {
        credits: raw.credits,
        items: raw.items,
        countedItems: raw.countedItems?.map(c => ({ count: c.ItemCount, type: c.ItemType })),
    };
}

export function normalizeSortie(raw: RawSortieFromApi): ISortieData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        boss: raw.Boss,
        variants: raw.Variants.map(v => ({
            missionType: v.missionType,
            modifier: v.modifierType,
            node: v.node,
            tileset: v.tileset,
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeArchonHunt(raw: RawLiteSortieFromApi): IArchonHuntData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        boss: raw.Boss,
        missions: raw.Missions.map(m => ({
            missionType: m.missionType,
            node: m.node,
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeInvasion(raw: RawInvasionFromApi): IInvasionData {
    const progress = raw.Goal !== 0 ? raw.Count / raw.Goal : 0;
    return {
        id: raw._id?.$oid ?? '',
        node: raw.Node,
        attackerFaction: raw.Faction,
        defenderFaction: raw.DefenderFaction,
        attackerReward: {
            credits: raw.AttackerReward?.credits,
            countedItems: raw.AttackerReward?.countedItems?.map(c => ({ count: c.ItemCount, type: c.ItemType })),
        },
        defenderReward: {
            credits: raw.DefenderReward?.credits,
            countedItems: raw.DefenderReward?.countedItems?.map(c => ({ count: c.ItemCount, type: c.ItemType })),
        },
        progress,
        completed: raw.Completed,
        active: !raw.Completed,
    };
}

export function normalizeFissure(raw: RawFissureFromApi): IFissureData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        node: raw.Node,
        missionType: raw.MissionType,
        tier: raw.Modifier,
        isStorm: false,
        isHard: raw.Hard ?? false,
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeVoidStorm(raw: RawVoidStormFromApi): IVoidStormData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        node: raw.Node,
        tier: raw.ActiveMissionTier,
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeVoidTrader(raw: RawVoidTraderFromApi): IVoidTraderData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        character: raw.Character,
        node: raw.Node,
        active: !raw.Expiry?.isExpired(),
        inventory: (raw.Manifest ?? []).map(m => ({
            item: m.ItemType,
            ducats: m.PrimePrice,
            credits: m.RegularPrice,
        })),
    };
}

export function normalizeSyndicateMission(raw: RawSyndicateMissionFromApi): ISyndicateMissionData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        syndicate: raw.Tag,
        nodes: raw.Nodes,
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeDailyDeal(raw: RawDailyDealFromApi): IDailyDealData {
    return {
        item: raw.StoreItem,
        activation: raw.Activation,
        expiry: raw.Expiry,
        discount: raw.Discount,
        originalPrice: raw.OriginalPrice,
        salePrice: raw.SalePrice,
        total: raw.AmountTotal,
        sold: raw.AmountSold,
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeFlashSale(raw: RawFlashSaleFromApi): IFlashSaleData {
    return {
        item: raw.TypeName,
        premiumOverride: raw.PremiumOverride,
        startDate: raw.StartDate,
        endDate: raw.EndDate,
        featured: raw.Featured ?? false,
        popular: raw.Popular ?? false,
        active: !raw.EndDate?.isExpired(),
    };
}

export function normalizeNightwave(raw: RawSeasonInfoFromApi): INightwaveData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        season: raw.Season,
        phase: raw.Phase,
        tag: raw.AffiliationTag,
        activeChallenges: (raw.ActiveChallenges ?? []).map(c => normalizeNightwaveChallenge(c)),
        active: !raw.Expiry?.isExpired(),
    };
}

function normalizeNightwaveChallenge(raw: { _id: { $oid: string }; Activation: any; Expiry: any; Challenge: string; Daily?: boolean; isHard?: boolean }): INightwaveChallenge {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        challenge: raw.Challenge,
        isDaily: raw.Daily ?? false,
        isElite: raw.isHard ?? false,
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeGoal(raw: RawGoalFromApi): IGoalData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        node: raw.Node,
        tag: raw.Tag,
        description: raw.Desc,
        tooltip: raw.ToolTip,
        healthPct: raw.HealthPct,
        goal: raw.Goal,
        count: raw.Count,
        personal: raw.Personal ?? false,
        community: raw.Community ?? false,
        active: !raw.Expiry?.isExpired(),
        reward: normalizeReward(raw.Reward),
    };
}

export function normalizeNodeOverride(raw: RawNodeOverrideFromApi): INodeOverrideData {
    return {
        id: raw._id?.$oid ?? '',
        node: raw.Node,
        hidden: raw.Hide ?? false,
        faction: raw.Faction,
    };
}

export function normalizePVPChallenge(raw: RawPVPChallengeFromApi): IPVPChallengeData {
    return {
        id: raw._id?.$oid ?? '',
        type: raw.challengeTypeRefID,
        startDate: raw.startDate,
        endDate: raw.endDate,
        mode: raw.PVPMode,
        category: raw.Category,
        active: !raw.endDate?.isExpired(),
    };
}

export function normalizeCalendarSeason(raw: RawCalendarSeasonFromApi): ICalendarSeasonData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        days: raw.Days.map(d => ({
            day: d.day,
            events: d.events.map(e => ({
                type: e.type,
                challenge: e.challenge,
                reward: e.reward,
            })),
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeConquest(raw: RawConquestFromApi): IConquestData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        type: raw.Type,
        missions: raw.Missions.map(m => ({
            faction: m.faction,
            missionType: m.missionType,
            difficulties: m.difficulties.map(d => ({
                type: d.type,
                deviation: d.deviation,
                risks: d.risks,
            })),
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeDescent(raw: RawDescentFromApi): IDescentData {
    return {
        activation: raw.Activation,
        expiry: raw.Expiry,
        seed: raw.RandSeed,
        challenges: raw.Challenges.map(c => ({
            index: c.Index,
            type: c.Type,
            challenge: c.Challenge,
            level: c.Level,
        })),
        active: !raw.Expiry?.isExpired(),
    };
}

export function normalizeEndlessXpChoice(raw: RawEndlessXpChoice): IEndlessXpChoiceData {
    return {
        category: raw.Category,
        choices: raw.Choices,
    };
}

export function normalizeFeaturedGuild(raw: RawFeaturedGuildFromApi): IFeaturedGuildData {
    return {
        id: raw._id?.$oid ?? '',
        name: raw.Name,
        tier: raw.Tier,
        emblem: raw.Emblem ?? false,
    };
}

export function normalizePersistentEnemy(raw: RawPersistentEnemyFromApi): IPersistentEnemyData {
    return {
        id: raw._id?.$oid ?? '',
        type: raw.AgentType,
        tag: raw.LocTag,
        healthPercent: raw.HealthPercent,
        discovered: raw.Discovered ?? false,
        lastLocation: raw.LastDiscoveredLocation,
        region: raw.Region,
    };
}

export function normalizeGlobalUpgrade(raw: RawGlobalUpgradeFromApi): IGlobalUpgradeData {
    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        upgradeType: raw.UpgradeType,
        operationType: raw.OperationType,
        value: raw.Value,
        description: raw.LocalizedDesc,
        active: !raw.Expiry?.isExpired(),
    };
}
