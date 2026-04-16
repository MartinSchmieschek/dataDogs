import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getChuckNorris } from "./chuckNorrisApiClient";
import type { ChuckNorrisResult } from "./interfaces/chuckNorrisTypes";
import { ChuckNorrisQueryPact, type ChuckNorrisQuery } from "./pacts";
import { getBaseDogIcon } from "@datadogs/core";

export class ChuckNorrisRetriever extends Dog<ChuckNorrisResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return ChuckNorrisRetriever.name;
    }

    get description(): string {
        return "Holt einen Chuck-Norris-Fact von chucknorris.io (optional nach Kategorie).";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(ChuckNorrisRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [ChuckNorrisQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ChuckNorrisResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(ChuckNorrisQueryPact, d));
        const query = (queryDog?.collected as ChuckNorrisQuery | undefined) ?? ({} as ChuckNorrisQuery);

        return getChuckNorris(query.category);
    };
}
