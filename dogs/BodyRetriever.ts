import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { getBaseDogIcon } from './baseDogIcons';

export class BodyRetriever extends Dog<any> {
    private bodyData: any = null;

    constructor(bodyData?: any) {
        super();
        this.bodyData = bodyData;
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get name(): string {
        return BodyRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(BodyRetriever.name);
    }

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<any> = 
        async (season: IHuntingSeason) => {
            return this.bodyData;
        }
}

