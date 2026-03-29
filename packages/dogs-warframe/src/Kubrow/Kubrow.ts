import type {
    IAlertData, IWarframeWorldState, RawEventFromApi,
    ISortieData, IArchonHuntData, IInvasionData,
    IFissureData, IVoidStormData, IVoidTraderData,
    ISyndicateMissionData, IDailyDealData, IFlashSaleData,
    INightwaveData, IGoalData, INodeOverrideData,
    IPVPChallengeData, ICalendarSeasonData, IConquestData,
    IDescentData, IEndlessXpChoiceData, IFeaturedGuildData,
    IPersistentEnemyData, IGlobalUpgradeData,
    IAlertMission,
} from './interfaces/warframeWorldState';
import { normalizeAlert } from './interfaces/normalizeAlerts';
import {
    normalizeSortie, normalizeArchonHunt, normalizeInvasion,
    normalizeFissure, normalizeVoidStorm, normalizeVoidTrader,
    normalizeSyndicateMission, normalizeDailyDeal, normalizeFlashSale,
    normalizeNightwave, normalizeGoal, normalizeNodeOverride,
    normalizePVPChallenge, normalizeCalendarSeason, normalizeConquest,
    normalizeDescent, normalizeEndlessXpChoice, normalizeFeaturedGuild,
    normalizePersistentEnemy, normalizeGlobalUpgrade,
} from './interfaces/normalizers';
import { ForumFirstPost } from './ForumFirstPost';
import { PostTopic } from './PostTopic';
import { enrichDateFields } from './DateFieldHandler';
import type { IMissionDetails } from './interfaces/missionDetails';
import staticWorld from './static.world.json';

const FORUM_TOPIC_PREFIX = 'forums.warframe.com/topic/';

/** Lookup static.world nach InternalName (entspricht API-node). */
const STATIC_MISSION_BY_INTERNAL_NAME = new Map<string, IMissionDetails>(
    (staticWorld as IMissionDetails[]).map((m) => [m.InternalName, m]),
);

function enemyToFactionString(enemy: IMissionDetails['Enemy']): string {
    if (enemy == null || enemy === '') return '';
    return Array.isArray(enemy) ? (enemy[0] ?? '') : enemy;
}

/** Kubrow: World-State-Daten (simaris) + normalisierte Getter fuer alle Kategorien. */
export class Kubrow {
    private raw: IWarframeWorldState | undefined;

    constructor(readonly simaris: IWarframeWorldState) {
        this.raw = enrichDateFields(simaris);
    }

    // ── Alerts ──────────────────────────────────────────────

    private get alerts(): IAlertData[] {
        return (this.raw?.Alerts ?? []).map((raw) => {
            const a = normalizeAlert(raw);
            return { ...a, mission: this.enrichAlertMission(a.mission) };
        });
    }

    getAlerts(): IAlertData[] {
        return [...this.alerts];
    }

    getActiveAlerts(): IAlertData[] {
        return this.alerts.filter(a => a.active);
    }

    getAlertsByNode(node: string): IAlertData[] {
        const lower = node.toLowerCase();
        return this.alerts.filter(a => a.mission.node.toLowerCase().includes(lower));
    }

    getAlertsByType(type: string): IAlertData[] {
        const lower = type.toLowerCase();
        return this.alerts.filter(a => a.mission.type.toLowerCase().includes(lower));
    }

    getAlertsByFaction(faction: string): IAlertData[] {
        const lower = faction.toLowerCase();
        return this.alerts.filter(a => a.mission.faction.toLowerCase().includes(lower));
    }

    getAlertsByRewardItem(itemNameSubstring: string): IAlertData[] {
        const lower = itemNameSubstring.toLowerCase();
        return this.alerts.filter(a => {
            const items = a.mission.reward?.items ?? [];
            const counted = a.mission.reward?.countedItems?.map(c => c.type) ?? [];
            return [...items, ...counted].some(name => name.toLowerCase().includes(lower));
        });
    }

    getAlertById(id: string): IAlertData | undefined {
        return this.alerts.find(a => a.id === id);
    }

    get alertCount(): number {
        return this.alerts.length;
    }

    get activeAlertCount(): number {
        return this.getActiveAlerts().length;
    }

    // ── Events / Forum ─────────────────────────────────────

    private get forumEvents(): RawEventFromApi[] {
        return (this.raw?.Events ?? []).filter(
            e => e.Prop?.includes(FORUM_TOPIC_PREFIX),
        );
    }

    getForumEvents(): RawEventFromApi[] {
        return [...this.forumEvents];
    }

    getEvents(): RawEventFromApi[] {
        return [...(this.raw?.Events ?? [])];
    }

    // ── Sorties ─────────────────────────────────────────────

    getSorties(): ISortieData[] {
        return (this.raw?.Sorties ?? []).map((raw) =>
            this.enrichSortie(normalizeSortie(raw)),
        );
    }

    getActiveSortie(): ISortieData | undefined {
        return this.getSorties().find(s => s.active);
    }

    // ── Archon Hunts (LiteSorties) ─────────────────────────

    getArchonHunts(): IArchonHuntData[] {
        return (this.raw?.LiteSorties ?? []).map((raw) =>
            this.enrichArchonHunt(normalizeArchonHunt(raw)),
        );
    }

    getActiveArchonHunt(): IArchonHuntData | undefined {
        return this.getArchonHunts().find(a => a.active);
    }

    // ── Invasions ───────────────────────────────────────────

    getInvasions(): IInvasionData[] {
        return (this.raw?.Invasions ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeInvasion(raw)),
        );
    }

    getActiveInvasions(): IInvasionData[] {
        return this.getInvasions().filter(i => i.active);
    }

    getInvasionsByFaction(faction: string): IInvasionData[] {
        const lower = faction.toLowerCase();
        return this.getInvasions().filter(i =>
            i.attackerFaction.toLowerCase().includes(lower) ||
            i.defenderFaction.toLowerCase().includes(lower)
        );
    }

    // ── Fissures (ActiveMissions) ───────────────────────────

    getFissures(): IFissureData[] {
        return (this.raw?.ActiveMissions ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeFissure(raw)),
        );
    }

    getActiveFissures(): IFissureData[] {
        return this.getFissures().filter(f => f.active);
    }

    getFissuresByTier(tier: string): IFissureData[] {
        const lower = tier.toLowerCase();
        return this.getActiveFissures().filter(f => f.tier.toLowerCase().includes(lower));
    }

    // ── Void Storms (Railjack) ──────────────────────────────

    getVoidStorms(): IVoidStormData[] {
        return (this.raw?.VoidStorms ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeVoidStorm(raw)),
        );
    }

    getActiveVoidStorms(): IVoidStormData[] {
        return this.getVoidStorms().filter(s => s.active);
    }

    // ── Void Trader (Baro Ki'Teer) ──────────────────────────

    getVoidTraders(): IVoidTraderData[] {
        return (this.raw?.VoidTraders ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeVoidTrader(raw)),
        );
    }

    getActiveVoidTrader(): IVoidTraderData | undefined {
        return this.getVoidTraders().find(t => t.active);
    }

    // ── Syndicate Missions ──────────────────────────────────

    getSyndicateMissions(): ISyndicateMissionData[] {
        return (this.raw?.SyndicateMissions ?? []).map((raw) =>
            this.enrichSyndicateMission(normalizeSyndicateMission(raw)),
        );
    }

    getSyndicateMissionsBySyndicate(tag: string): ISyndicateMissionData[] {
        const lower = tag.toLowerCase();
        return this.getSyndicateMissions().filter(s => s.syndicate.toLowerCase().includes(lower));
    }

    // ── Daily Deals (Darvo) ─────────────────────────────────

    getDailyDeals(): IDailyDealData[] {
        return (this.raw?.DailyDeals ?? []).map(normalizeDailyDeal);
    }

    getActiveDailyDeal(): IDailyDealData | undefined {
        return this.getDailyDeals().find(d => d.active);
    }

    // ── Flash Sales ─────────────────────────────────────────

    getFlashSales(): IFlashSaleData[] {
        return (this.raw?.FlashSales ?? []).map(normalizeFlashSale);
    }

    getActiveFlashSales(): IFlashSaleData[] {
        return this.getFlashSales().filter(s => s.active);
    }

    // ── Nightwave (SeasonInfo) ──────────────────────────────

    getNightwave(): INightwaveData | undefined {
        const raw = this.raw?.SeasonInfo;
        return raw ? normalizeNightwave(raw) : undefined;
    }

    // ── Goals / Events ──────────────────────────────────────

    getGoals(): IGoalData[] {
        return (this.raw?.Goals ?? []).map((raw) =>
            this.enrichGoal(normalizeGoal(raw)),
        );
    }

    getActiveGoals(): IGoalData[] {
        return this.getGoals().filter(g => g.active);
    }

    // ── Node Overrides ──────────────────────────────────────

    getNodeOverrides(): INodeOverrideData[] {
        return (this.raw?.NodeOverrides ?? []).map((raw) =>
            this.attachMissionIfKnown(normalizeNodeOverride(raw)),
        );
    }

    // ── PVP Challenges ──────────────────────────────────────

    getPVPChallenges(): IPVPChallengeData[] {
        return (this.raw?.PVPChallengeInstances ?? []).map(normalizePVPChallenge);
    }

    // ── Calendar Seasons ────────────────────────────────────

    getCalendarSeasons(): ICalendarSeasonData[] {
        return (this.raw?.KnownCalendarSeasons ?? []).map(normalizeCalendarSeason);
    }

    getActiveCalendarSeason(): ICalendarSeasonData | undefined {
        return this.getCalendarSeasons().find(c => c.active);
    }

    // ── Conquests ───────────────────────────────────────────

    getConquests(): IConquestData[] {
        return (this.raw?.Conquests ?? []).map(normalizeConquest);
    }

    getActiveConquests(): IConquestData[] {
        return this.getConquests().filter(c => c.active);
    }

    // ── Descents (Circuit) ──────────────────────────────────

    getDescents(): IDescentData[] {
        return (this.raw?.Descents ?? []).map(normalizeDescent);
    }

    getActiveDescents(): IDescentData[] {
        return this.getDescents().filter(d => d.active);
    }

    // ── Endless XP Choices ──────────────────────────────────

    getEndlessXpChoices(): IEndlessXpChoiceData[] {
        return (this.raw?.EndlessXpChoices ?? []).map(normalizeEndlessXpChoice);
    }

    // ── Featured Guilds ─────────────────────────────────────

    getFeaturedGuilds(): IFeaturedGuildData[] {
        return (this.raw?.FeaturedGuilds ?? []).map(normalizeFeaturedGuild);
    }

    // ── Persistent Enemies (Acolytes) ───────────────────────

    getPersistentEnemies(): IPersistentEnemyData[] {
        return (this.raw?.PersistentEnemies ?? []).map((raw) =>
            this.enrichPersistentEnemy(normalizePersistentEnemy(raw)),
        );
    }

    // ── Global Upgrades ─────────────────────────────────────

    getGlobalUpgrades(): IGlobalUpgradeData[] {
        return (this.raw?.GlobalUpgrades ?? []).map(normalizeGlobalUpgrade);
    }

    getActiveGlobalUpgrades(): IGlobalUpgradeData[] {
        return this.getGlobalUpgrades().filter(u => u.active);
    }

    // ── Metadata ────────────────────────────────────────────

    get worldSeed(): string | undefined {
        return this.raw?.WorldSeed;
    }

    get version(): number | undefined {
        return this.raw?.Version;
    }

    get buildLabel(): string | undefined {
        return this.raw?.BuildLabel;
    }

    get constructionProgress(): number[] {
        return this.raw?.ProjectPct ?? [];
    }

    get primeAccessState(): string | undefined {
        return this.raw?.PrimeAccessAvailability?.State;
    }

    // ── Static World (Mission Details) ─────────────────────

    getMissionDetails(): IMissionDetails[] {
        return staticWorld as IMissionDetails[];
    }

    getMissionByName(name: string): IMissionDetails | undefined {
        const lower = name.toLowerCase();
        return this.getMissionDetails().find(m => m.Name.toLowerCase() === lower);
    }

    getMissionsByPlanet(planet: string): IMissionDetails[] {
        const lower = planet.toLowerCase();
        return this.getMissionDetails().filter(m => m.Planet.toLowerCase() === lower);
    }

    getMissionsByType(type: string): IMissionDetails[] {
        const lower = type.toLowerCase();
        return this.getMissionDetails().filter(m => m.Type.toLowerCase() === lower);
    }

    getMissionsByEnemy(enemy: string): IMissionDetails[] {
        const lower = enemy.toLowerCase();
        return this.getMissionDetails().filter(m => {
            const e = m.Enemy;
            if (Array.isArray(e)) return e.some(f => f.toLowerCase().includes(lower));
            return e.toLowerCase().includes(lower);
        });
    }

    getMissionByInternalName(internalName: string): IMissionDetails | undefined {
        return STATIC_MISSION_BY_INTERNAL_NAME.get(internalName);
    }

    private enrichAlertMission(mission: IAlertMission): IAlertMission {
        const details = STATIC_MISSION_BY_INTERNAL_NAME.get(mission.node);
        return details ? { ...mission, details } : mission;
    }

    /** IAlertMission aus API-node + static.world (details nur bei Treffer). */
    private missionFromNode(node: string): IAlertMission {
        const details = STATIC_MISSION_BY_INTERNAL_NAME.get(node);
        if (!details) {
            return { node, type: '', faction: '' };
        }
        return {
            node,
            type: details.Type,
            faction: enemyToFactionString(details.Enemy),
            minEnemyLevel: details.MinLevel,
            maxEnemyLevel: details.MaxLevel,
            details,
        };
    }

    private attachMissionIfKnown<T extends { node: string }>(
        item: T,
    ): T & { mission?: IAlertMission } {
        const mission = this.missionFromNode(item.node);
        return mission.details ? { ...item, mission } : item;
    }

    private enrichSortie(sortie: ISortieData): ISortieData {
        return {
            ...sortie,
            variants: sortie.variants.map((v) => {
                const details = STATIC_MISSION_BY_INTERNAL_NAME.get(v.node);
                return details ? { ...v, details } : v;
            }),
        };
    }

    private enrichArchonHunt(archon: IArchonHuntData): IArchonHuntData {
        return {
            ...archon,
            missions: archon.missions.map((m) => {
                const details = STATIC_MISSION_BY_INTERNAL_NAME.get(m.node);
                return details ? { ...m, details } : m;
            }),
        };
    }

    private enrichSyndicateMission(
        syndicate: ISyndicateMissionData,
    ): ISyndicateMissionData {
        return {
            ...syndicate,
            missions: syndicate.nodes.map((node) => this.missionFromNode(node)),
        };
    }

    private enrichGoal(goal: IGoalData): IGoalData {
        if (!goal.node) return goal;
        const mission = this.missionFromNode(goal.node);
        return mission.details ? { ...goal, mission } : goal;
    }

    private enrichPersistentEnemy(
        enemy: IPersistentEnemyData,
    ): IPersistentEnemyData {
        if (!enemy.lastLocation) return enemy;
        const details = STATIC_MISSION_BY_INTERNAL_NAME.get(enemy.lastLocation);
        return details ? { ...enemy, locationDetails: details } : enemy;
    }

    private ensureHttps(url: string): string {
        if (url.startsWith('https://') || url.startsWith('http://')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        return 'https://' + url;
    }
}
