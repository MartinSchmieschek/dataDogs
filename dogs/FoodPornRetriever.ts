import { AbstractHuntingDog } from "../core/enities/abstractHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import { InterfaceSniper } from "../InterfaceSniper";
import { IyoutubeSearchResults } from "../sniped/IyoutubeSearchResults.interface";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

export class FoodPornRetriever extends AbstractHuntingDog<IyoutubeSearchResults>{
    get name(): string {
        return FoodPornRetriever.name
    }

    isReady(collection: IHuntingSeason): boolean {
       return collection.exhausted.find(item => item instanceof RandomRecipesRetriever) ? true : false
    }
    
    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<IyoutubeSearchResults> = (season:IHuntingSeason) => {

            return this.request(season)

    }

    @InterfaceSniper("IyoutubeSearchResults")
    public async request(season:IHuntingSeason): Promise<IyoutubeSearchResults> {

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