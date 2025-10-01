import { AbstractHuntingDog } from "../enities/abstractHuntingDog";
import { IHuntingSeason } from "../enities/IHuntingSeason";
import { InterfaceSniper } from "../InterfaceSniper";

export interface MockData {

    caloriesPerServing: number,
    cookTimeMinutes:number,
    cuisine: string,
    difficulty:string
    image:string
    ingredients:string[],
    instructions :string[],
    mealType :string[],
    name :string
    prepTimeMinutes: number
    rating: number
    reviewCount: number
    servings:number
    tags:string[]
}

export class RandomRecipesRetriever extends AbstractHuntingDog<MockData>{

    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<MockData> = (season:IHuntingSeason) => {
        return this.request(season)
    }

    @InterfaceSniper("IRecipe", "IRecipes.interface.ts")
    public async request(season: IHuntingSeason): Promise<MockData> {
      const response = await fetch("https://dummyjson.com/recipes");
      const all: { recipes: MockData[] } = await response.json();
      const random = all.recipes[Math.floor(Math.random() * all.recipes.length)];
      return random;
    }
    get name(){
        return RandomRecipesRetriever.name
    }

    isReady(collection: IHuntingSeason): boolean {
        // A Retriever is always ready
        return true;
    }


}