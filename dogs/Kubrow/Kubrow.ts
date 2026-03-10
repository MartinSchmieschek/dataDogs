import type {
    IAlertData, IWarframeWorldState, RawEventFromApi,
    ISortieData, IArchonHuntData, IInvasionData,
    IFissureData, IVoidStormData, IVoidTraderData,
    ISyndicateMissionData, IDailyDealData, IFlashSaleData,
    INightwaveData, IGoalData, INodeOverrideData,
    IPVPChallengeData, ICalendarSeasonData, IConquestData,
    IDescentData, IEndlessXpChoiceData, IFeaturedGuildData,
    IPersistentEnemyData, IGlobalUpgradeData,
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

const FORUM_TOPIC_PREFIX = 'forums.warframe.com/topic/';

/** Kubrow: World-State-Daten (simaris) + normalisierte Getter fuer alle Kategorien. */
export class Kubrow {
    private raw: IWarframeWorldState | undefined;

    constructor(readonly simaris: IWarframeWorldState) {
        this.raw = enrichDateFields(simaris);
    }

    // ── Alerts ──────────────────────────────────────────────

    private get alerts(): IAlertData[] {
        return (this.raw?.Alerts ?? []).map(normalizeAlert);
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
        return (this.raw?.Sorties ?? []).map(normalizeSortie);
    }

    getActiveSortie(): ISortieData | undefined {
        return this.getSorties().find(s => s.active);
    }

    // ── Archon Hunts (LiteSorties) ─────────────────────────

    getArchonHunts(): IArchonHuntData[] {
        return (this.raw?.LiteSorties ?? []).map(normalizeArchonHunt);
    }

    getActiveArchonHunt(): IArchonHuntData | undefined {
        return this.getArchonHunts().find(a => a.active);
    }

    // ── Invasions ───────────────────────────────────────────

    getInvasions(): IInvasionData[] {
        return (this.raw?.Invasions ?? []).map(normalizeInvasion);
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
        return (this.raw?.ActiveMissions ?? []).map(normalizeFissure);
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
        return (this.raw?.VoidStorms ?? []).map(normalizeVoidStorm);
    }

    getActiveVoidStorms(): IVoidStormData[] {
        return this.getVoidStorms().filter(s => s.active);
    }

    // ── Void Trader (Baro Ki'Teer) ──────────────────────────

    getVoidTraders(): IVoidTraderData[] {
        return (this.raw?.VoidTraders ?? []).map(normalizeVoidTrader);
    }

    getActiveVoidTrader(): IVoidTraderData | undefined {
        return this.getVoidTraders().find(t => t.active);
    }

    // ── Syndicate Missions ──────────────────────────────────

    getSyndicateMissions(): ISyndicateMissionData[] {
        return (this.raw?.SyndicateMissions ?? []).map(normalizeSyndicateMission);
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
        return (this.raw?.Goals ?? []).map(normalizeGoal);
    }

    getActiveGoals(): IGoalData[] {
        return this.getGoals().filter(g => g.active);
    }

    // ── Node Overrides ──────────────────────────────────────

    getNodeOverrides(): INodeOverrideData[] {
        return (this.raw?.NodeOverrides ?? []).map(normalizeNodeOverride);
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
        return (this.raw?.PersistentEnemies ?? []).map(normalizePersistentEnemy);
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

    private ensureHttps(url: string): string {
        if (url.startsWith('https://') || url.startsWith('http://')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        return 'https://' + url;
    }
}
