import { Dog } from '../core/entities/abstractHuntingDog';
import { IHuntingDog } from '../core/entities/IHuntingDog';
import { IHuntingSeason } from '../core/entities/IHuntingSeason';
import { getBaseDogIcon } from './baseDogIcons';

export class QueryRetriever extends Dog<Record<string, string>> {
    private queryData: Record<string, string> = {};

    constructor(queryData?: Record<string, string>) {
        super();
        const raw = queryData || {};
        const normalized: Record<string, string> = {};
        Object.entries(raw).forEach(([k, v]) => {
            normalized[k.toLowerCase()] = String(v).toLowerCase();
        });
        this.queryData = normalized;
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get name(): string {
        return QueryRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(QueryRetriever.name);
    }

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<Record<string, string>> =
        async (season: IHuntingSeason) => {
            return this.queryData;
        };
}
