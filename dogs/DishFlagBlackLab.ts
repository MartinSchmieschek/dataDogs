import { Dog } from "../core/enities/abstractHuntingDog";
import { IHuntingDog } from "../core/enities/IHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

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