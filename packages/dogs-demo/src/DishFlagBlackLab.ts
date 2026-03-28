import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";
import { getBaseDogIcon } from '@datadogs/core';

export class DishFlagBlackLab extends Dog<string>{

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [RandomRecipesRetriever]
    }
    get optional(): (new (...args: any[]) => Dog<unknown>)[] {
        return []
    }

    get name(): string {
        return DishFlagBlackLab.name
    }

    get icon(): string | undefined {
        return getBaseDogIcon(DishFlagBlackLab.name);
    }

    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<string> = (season:IHuntingSeason) => {
        let currentYield = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (currentYield && currentYield.collected && !(currentYield.collected instanceof Error))
            return this.fetchImages(currentYield.collected.tags)
        else 
            throw new Error("No yield prequisites to build on.")
    }



public async fetchImages(
    queries: string[],
  ): Promise<string> {
    
    return 'https://dummyjson.com/image/400x200/008080/ffffff?text=' + queries.join("+")

    }
}