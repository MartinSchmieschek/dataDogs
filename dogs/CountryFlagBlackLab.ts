import { AbstractHuntingDog } from "../core/enities/abstractHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

export class CountryFlagBlackLab extends AbstractHuntingDog<string>{
    get name(): string {
        return CountryFlagBlackLab.name
    }

    isReady(collection: IHuntingSeason): boolean {
       return collection.exhausted.find(item => item instanceof RandomRecipesRetriever) ? true : false
    }
    
    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<string> = (season:IHuntingSeason) => {
        let currentYield = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (currentYield && currentYield.collected && !(currentYield.collected instanceof Error))
            return this.fetchImages([currentYield.collected.cuisine])
        else 
            throw new Error("No yield prequisites to build on.")
    }



public async fetchImages(
    queries: string[],
  ): Promise<string> {
    
    return 'https://dummyjson.com/image/400x200/008080/ffffff?text=' + queries.join("+")

    }
}