import { AbstractHuntingDog } from "../../core/enities/abstractHuntingDog";
import { IHuntingDog } from "../../core/enities/IHuntingDog";
import { IHuntingSeason } from "../../core/enities/IHuntingSeason";
import { FoodPornRetriever } from "../FoodPornRetriever";
import { RandomEveryThingRetriever } from "../RandomEverthingRetriever";
import { RandomRecipesRetriever } from "../RandomRecipesRetriever";
import { DogIntro } from "./DogIntro";
import { LayoutRenderer } from "../../core/renderer/LayoutRenderer";
import { LayoutZones, tinderLayout } from "../../core/renderer/layouts/tinderLayout";

export class TalkingDog extends AbstractHuntingDog<string> {

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

    isReady(season: IHuntingSeason): boolean {
        const reqDogs = [
            RandomRecipesRetriever,
            RandomEveryThingRetriever
        ]

        const optionalDogs = [
            FoodPornRetriever,
        ]

        let requiredIntersectionsCount = TalkingDog.intersection<IHuntingDog<unknown>>(reqDogs, season.exhausted)
        let optionalIntersectionsCount = TalkingDog.intersection<IHuntingDog<unknown>>(optionalDogs, season.exhausted)
        let maxOptionalIntersections = TalkingDog.intersection<IHuntingDog<unknown>>(optionalDogs, season.withBeesInThePants)

        // wait maybe there will be more
        if (season.run < season.maxRuns || optionalIntersectionsCount < maxOptionalIntersections)
            return false;

        if (requiredIntersectionsCount.length >= reqDogs.length) {
            return true;
        } return false;
        // compare reqested dogs and the exausted ones from current seasen.
        let match = false;
        reqDogs.forEach(rq => {
            if (season.exhausted.find(i => i instanceof rq) === undefined) {
                match = true;
            }
        })

        return match;
    }

    // Here goes the rendering magic!
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<string> = (season: IHuntingSeason) => {
        return new Promise((res, rej) => {

        

            const allOtherShitDog = season.exhausted.find(item => item instanceof RandomEveryThingRetriever)
            let name: string = allOtherShitDog?.collected?.characters.name!;
            let description: string = allOtherShitDog?.collected?.characters.gender ?? '';
            let image = allOtherShitDog?.collected?.woof.url!


              
              const layout = tinderLayout();
              
              const content = layout.zones.find((i:any) => i.id === LayoutZones.Image);
              if (content)
                content.value = {
                  name: name,
                  imageUrl: image,
                  description: description,
                };

                const cookingVideoDog = season.exhausted.find(item => item instanceof FoodPornRetriever)
              
              const videoZone = layout.zones.find((i:any) => i.id === LayoutZones.Video);
              if (videoZone)
                videoZone.value = { youtubeId: cookingVideoDog?.collected?.items[0].id.videoId};
              

          
       /*      

              const reciepeDog = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
              let ingredients: string[] = reciepeDog!.collected!.ingredients
              let steps = reciepeDog!.collected!.instructions

            const intro = new DogIntro({
                name: name,
                mediaUrl: image,
                ingredients: ingredients,
                steps: steps,
                youtubeItem: (cookingVideoDog?.collected?.items && cookingVideoDog?.collected?.items.length > 0) ? cookingVideoDog?.collected?.items[0] : undefined
            });

            // Node / Server-side: du kannst intro.render() verwenden und in eine Datei oder Response einbauen
            const html = intro.render();
            console.log(html);
*/

            // try to add new layoutRenderer
            const actions = {
                like: (id: string) => console.log("Liked 🐶"),
                dislike: (id: string) => console.log("Disliked 🐾"),
              };

            
            const renderer = new LayoutRenderer(layout, actions);
            const html = renderer.renderDocument();

            res(html)
        })
    }

}

