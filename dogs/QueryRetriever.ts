import { Dog } from "../core/enities/abstractHuntingDog";
import { IHuntingDog } from "../core/enities/IHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";

export class QueryRetriever extends Dog<Record<string, string>> {
    private queryData: Record<string, string> = {};

    constructor(queryData?: Record<string, string>) {
        super();
        this.queryData = queryData || {};
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

