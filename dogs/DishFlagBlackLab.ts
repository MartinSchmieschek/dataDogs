import { AbstractHuntingDog } from "../core/enities/abstractHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

export class DishFlagBlackLab extends AbstractHuntingDog<string>{
    get name(): string {
        return DishFlagBlackLab.name
    }

    isReady(collection: IHuntingSeason): boolean {
        let recip = collection.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (!recip)
            return false;

        if (recip.collected instanceof Error || recip.collected == null)
            return false

        if (recip.collected.tags.length > 0)
            return true;

        return false;
       
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