import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getRandomFox } from "./foxApiClient";
import type { FoxResult } from "./interfaces/foxTypes";
import { FoxQueryPact } from "./pacts";
import { getBaseDogIcon } from "@datadogs/core";

export class FoxRetriever extends Dog<FoxResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return FoxRetriever.name;
    }

    get description(): string {
        return "Holt ein zufaelliges Fuchs-Bild von randomfox.ca.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(FoxRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [FoxQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (_season: IHuntingSeason): Promise<FoxResult> => {
        return getRandomFox();
    };
}
