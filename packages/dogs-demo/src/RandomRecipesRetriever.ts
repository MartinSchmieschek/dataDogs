import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { getBaseDogIcon } from '@datadogs/core';

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

export class RandomRecipesRetriever extends Dog<MockData>{

    get required(){
        return []
    }

    get optional(){
        return []
    }


    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<MockData> = (season:IHuntingSeason) => {
        return this.request(season)
    }

    public async request(season: IHuntingSeason): Promise<MockData> {
      const response = await fetch("https://dummyjson.com/recipes");
      const all = await response.json() as { recipes: MockData[] };
      const random = all.recipes[Math.floor(Math.random() * all.recipes.length)];
      return random;
    }
    get name(){
        return RandomRecipesRetriever.name
    }

    get icon(): string | undefined {
        return getBaseDogIcon(RandomRecipesRetriever.name);
    }

}