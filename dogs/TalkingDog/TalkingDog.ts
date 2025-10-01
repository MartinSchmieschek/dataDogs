import { AbstractHuntingDog } from "../../enities/abstractHuntingDog";
import { IHuntingDog } from "../../enities/IHuntingDog";
import { IHuntingSeason } from "../../enities/IHuntingSeason";
import { RandomEveryThingRetriever } from "../RandomEverthingRetriever";
import { RandomRecipesRetriever } from "../RandomRecipesRetriever";
import { DogIntro } from "./DogIntro";

export class TalkingDog extends AbstractHuntingDog<string>{

    get name(): string {
        return TalkingDog.name
    }

    // helper for season testing
    // Prüft ob a eine Instanz derselben Klasse ist wie b
    private static isIntersecting(a: any, b: any): boolean {
        return b instanceof a;
    }
  
  // Gibt die Überschneidungen zwischen zwei Arrays zurück
  private static intersection<T>(arr1: any[], arr2: T[]): T[] {
    return arr1.filter(a => arr2.some(b => TalkingDog.isIntersecting(a, b)));
  }

    isReady(collection: IHuntingSeason): boolean {
        const reqDogs = [
            RandomRecipesRetriever,
            RandomEveryThingRetriever
        ]

        let status = TalkingDog.intersection<IHuntingDog<unknown>>(reqDogs,collection.exhausted)

        if (status.length > 0){
            return true;
        } return false;
        // compare reqested dogs and the exausted ones from current seasen.
        let match = false;
        reqDogs.forEach(rq => {
            if (collection.exhausted.find(i => i instanceof rq) === undefined){
                match = true;
            }
        })

        return match;
    }

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<string> = (season:IHuntingSeason) => {
        return new Promise((res,rej) => {

            const reciepeDog = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
            let ingredients:string[] = reciepeDog!.collected!.ingredients
            let steps = reciepeDog!.collected!.instructions


            const allOtherShitDog = season.exhausted.find(item => item instanceof RandomEveryThingRetriever)
            let name:string = allOtherShitDog?.collected?.characters.name!;
            let image = allOtherShitDog?.collected?.woof.url!
            
            

            const intro = new DogIntro({
                name: name,
                mediaUrl: image,
                ingredients: ingredients,
                steps: steps
              });
              
              // Node / Server-side: du kannst intro.render() verwenden und in eine Datei oder Response einbauen
              const html = intro.render();
              console.log(html);

            res(html)
        })
    }

}

