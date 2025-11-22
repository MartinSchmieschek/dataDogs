import { AbstractHuntingDog } from "../../core/enities/abstractHuntingDog";
import { IHuntingDog } from "../../core/enities/IHuntingDog";
import { IHuntingSeason } from "../../core/enities/IHuntingSeason";
import { FoodPornRetriever } from "../FoodPornRetriever";
import { RandomEveryThingRetriever } from "../RandomEverthingRetriever";
import { RandomRecipesRetriever } from "../RandomRecipesRetriever";
import { LayoutRenderer } from "../../core/renderer/LayoutRenderer";
import { ButtonFragment } from "../../core/renderer/fragments/ButtonFragment";
import { TinderLayout, TinderLayoutEnum } from "../../core/renderer/layouts/TinderLayout";
import { GestureFragment } from "../../core/renderer/fragments/GestureFragment";

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
            let dogimage = allOtherShitDog?.collected?.woof.url!


              
            const layout = new TinderLayout();

            // Inhalte befüllen
            const image = layout.get(TinderLayoutEnum.PresentationImage);
            if (image && "imageUrl" in image) image.imageUrl = dogimage;
            
            const title = layout.get(TinderLayoutEnum.Title);
            if (title && "text" in title) title.text = name;
            

            // Button-Aktion
            const next = layout.get(TinderLayoutEnum.Next);
            if (next) {
              (next as ButtonFragment).action = () => window.location.reload();
            }

            // Button-Aktion
            const l = layout.get(TinderLayoutEnum.SwipeLeft);
            if (l) {
                (l as GestureFragment).action = () => window.location.reload();
            }

            const renderer = new LayoutRenderer();
            const html = renderer.render(layout);

            res(html)
        })
    }

}

