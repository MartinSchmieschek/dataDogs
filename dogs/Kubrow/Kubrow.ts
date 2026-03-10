import type { IAlertData, IWarframeWorldState, RawEventFromApi } from './interfaces/warframeWorldState';
import { normalizeAlert } from './interfaces/normalizeAlerts';
import { ForumFirstPost } from './ForumFirstPost';
import { PostTopic } from './PostTopic';
import { enrichDateFields } from './DateFieldHandler';

const FORUM_TOPIC_PREFIX = 'forums.warframe.com/topic/';

/** Kubrow: World-State-Daten (simaris) + Alert-Filter + Forum-Event-Metadaten nach Sprache. */
export class Kubrow {
    private raw: IWarframeWorldState | undefined;

    constructor(readonly simaris: IWarframeWorldState) {
        this.raw = enrichDateFields(simaris);
    }

    private get alerts(): IAlertData[] {
        const raw = this.raw?.Alerts ?? [];
        return raw.map(normalizeAlert);
    }

    private get forumEvents(): RawEventFromApi[] {
        return (this.raw?.Events ?? []).filter(
            (e) => e.Prop?.includes(FORUM_TOPIC_PREFIX),
        );
    }

    getAlerts(): IAlertData[] {
        return [...this.alerts];
    }

    getActiveAlerts(): IAlertData[] {
        return this.alerts.filter((a) => a.active);
    }

    getAlertsByNode(node: string): IAlertData[] {
        const lower = node.toLowerCase();
        return this.alerts.filter((a) => a.mission.node.toLowerCase().includes(lower));
    }

    getAlertsByType(type: string): IAlertData[] {
        const lower = type.toLowerCase();
        return this.alerts.filter((a) => a.mission.type.toLowerCase().includes(lower));
    }

    getAlertsByFaction(faction: string): IAlertData[] {
        const lower = faction.toLowerCase();
        return this.alerts.filter((a) => a.mission.faction.toLowerCase().includes(lower));
    }

    getAlertsByRewardItem(itemNameSubstring: string): IAlertData[] {
        const lower = itemNameSubstring.toLowerCase();
        return this.alerts.filter((a) => {
            const items = a.mission.reward?.items ?? [];
            const counted = a.mission.reward?.countedItems?.map((c) => c.type) ?? [];
            const all = [...items, ...counted];
            return all.some((name) => name.toLowerCase().includes(lower));
        });
    }

    getAlertById(id: string): IAlertData | undefined {
        return this.alerts.find((a) => a.id === id);
    }

    getForumEvents(): RawEventFromApi[] {
        return [...this.forumEvents];
    }

    get count(): number {
        return this.alerts.length;
    }

    get activeCount(): number {
        return this.alerts.filter((a) => a.active).length;
    }

    private ensureHttps(url: string): string {
        if (url.startsWith('https://') || url.startsWith('http://')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        return 'https://' + url;
    }
}
