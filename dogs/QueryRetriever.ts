import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";

export class QueryRetriever extends Dog<Record<string, string>> {
    private queryData: Record<string, string> = {};

    constructor(queryData?: Record<string, string>) {
        super();
        const raw = queryData || {};
        this.queryData = new Proxy(raw, {
            get(target, prop) {
                if (typeof prop !== 'string') return undefined;
                if (prop in target) return target[prop];
                const lower = prop.toLowerCase();
                const key = Object.keys(target).find(k => k.toLowerCase() === lower);
                return key ? target[key] : undefined;
            },
            has(target, prop) {
                if (typeof prop !== 'string') return false;
                if (prop in target) return true;
                const lower = prop.toLowerCase();
                return Object.keys(target).some(k => k.toLowerCase() === lower);
            }
        });
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

