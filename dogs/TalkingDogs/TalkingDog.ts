import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { FoodPornRetriever } from "../FoodPornRetriever";
import { RandomEveryThingRetriever } from "../RandomEverthingRetriever";
import { RandomRecipesRetriever } from "../RandomRecipesRetriever";
import { LayoutRenderer } from "./renderer/LayoutRenderer";
import { ButtonFragment } from "./renderer/fragments/ButtonFragment";
import { GestureFragment } from "./renderer/fragments/GestureFragment";
import { TinderLayout, TinderLayoutEnum } from "./renderer/layouts/tinderLayout";
import { SwipeLeftGestureFragment } from "./renderer/fragments/SwipeLeftGestureFragment";
import { SwipeRightGestureFragment } from "./renderer/fragments/SwipeRightGestureFragment";
import { DishFlagBlackLab } from "../DishFlagBlackLab";

export class TalkingDog extends Dog<string> {

    get required() {
                return [
            RandomRecipesRetriever,
            RandomEveryThingRetriever,
        ]
    }

    get optional() {
            return [
            FoodPornRetriever,
                        DishFlagBlackLab
        ]
    }

    get name(): string {
        return TalkingDog.name
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

            // swipes
            const l = layout.find(item => (item instanceof SwipeLeftGestureFragment || item instanceof SwipeRightGestureFragment))
            l.forEach(item => {
                (item as GestureFragment).action = () => window.location.reload();
            })

            const renderer = new LayoutRenderer();
            const html = renderer.render(layout);

            res(html)
        })
    }

}

