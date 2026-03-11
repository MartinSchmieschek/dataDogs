import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";

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

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<Record<string, string>> = 
        async (season: IHuntingSeason) => {
            return this.queryData;
        }
}

