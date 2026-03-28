import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

export class FoodPornRetriever extends Dog<unknown>{
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return []
    }
    get optional(): (new (...args: any[]) => Dog<unknown>)[] {
        return []
    }
    get name(): string {
        return FoodPornRetriever.name
    }

    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<unknown> = (season:IHuntingSeason) => {

            return this.request(season)

    }

    public async request(season:IHuntingSeason): Promise<unknown> {

        let theDish = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (theDish && theDish.collected && !(theDish.collected instanceof Error)){

            let searchText = [theDish.collected.name, "fast"]

            let searchString = "q=" + searchText.join(" ")

            let url = 'https://youtube.googleapis.com/youtube/v3/search?part=snippet&'+searchString+'&key=AIzaSyB2OmnQMXte5o0TKPkxbK_j26ZrI_Ny8PE'
            const reciepResponse = await fetch(url)
    
            let result = await reciepResponse.json()
            return result;
        }

        else 
            throw new Error("No yield prequisites to build on.")



    }

}