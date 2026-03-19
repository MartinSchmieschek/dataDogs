import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { FoodPornRetriever } from "../FoodPornRetriever";
import { DishFlagBlackLab } from "../DishFlagBlackLab";
import { LayoutInputPact } from "./renderer/layouts/ILayoutInput";
import { LayoutRenderer } from "./renderer/LayoutRenderer";
import { TinderLayout } from "./renderer/layouts/tinderLayout";
import { BiographyLayout } from "./renderer/layouts/BiographyLayout";
import { RecipeLayout } from "./renderer/layouts/RecipeLayout";
import { ArticleLayout } from "./renderer/fragments/ArticleLayout";
import { GalleryLayout } from "./renderer/fragments/GalleryLayout";
import type { ILayoutInput } from "./renderer/layouts/ILayoutInput";
import type { LayoutBase } from "./renderer/layouts/LayoutBase";
import { getBaseDogIcon } from '../baseDogIcons';

export class TalkingDog extends Dog<string> {

    get required() {
        return [
            LayoutInputPact,
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

    get icon(): string | undefined {
        return getBaseDogIcon(TalkingDog.name);
    }

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<string> = async (season: IHuntingSeason) => {
        const mimicDog = season.exhausted.find(d => this.matchesParent(LayoutInputPact, d));
        if (!mimicDog || !mimicDog.collected) {
            throw new Error('TalkingDog: LayoutInputProvider not found or has no data');
        }

        const input = mimicDog.collected as ILayoutInput;
        let layout: LayoutBase<any>;

        switch (input.type) {
            case 'tinder':    layout = new TinderLayout(); break;
            case 'biography': layout = new BiographyLayout(); break;
            case 'recipe':    layout = new RecipeLayout(); break;
            case 'article':   layout = new ArticleLayout(); break;
            case 'gallery':   layout = new GalleryLayout(); break;
            default:
                throw new Error(`TalkingDog: Unknown layout type '${(input as any).type}'`);
        }

        layout.populate(input);

        const renderer = new LayoutRenderer();
        return renderer.render(layout);
    }

}

