import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getCatFact } from "./catFactApiClient";
import type { CatFactResult } from "./interfaces/catFactTypes";
import { CatFactQueryPact, type CatFactQuery } from "./pacts";
import { getBaseDogIcon } from "@datadogs/core";

export class CatFactRetriever extends Dog<CatFactResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return CatFactRetriever.name;
    }

    get description(): string {
        return "Holt einen zufaelligen Katzen-Fakt von catfact.ninja.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(CatFactRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [CatFactQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<CatFactResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(CatFactQueryPact, d));
        const query = (queryDog?.collected as CatFactQuery | undefined) ?? ({} as CatFactQuery);
        return getCatFact(query.maxLength);
    };
}
