import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { HueBridgeQueryPact, type HueBridgeQueryInput } from "./pacts";
import { fetchHueBridgeSnapshot } from "./hueSnapshot";
import { getBaseDogIcon } from "../baseDogIcons";
import { HuePlaygroundDirector } from "./HuePlaygroundDirector";

/**
 * Experimenteller Hue-Dog: Snapshot + Director-Methoden (Kubrow-Muster: `collected` ist Objekt mit API).
 * Schreiben: `setOn`, `setBrightness`, `toggle`, `setState`, `refresh` — siehe HuePlaygroundDirector.
 */
export class HuePlaygroundRetriever extends Dog<HuePlaygroundDirector> {
    get name(): string {
        return HuePlaygroundRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(HuePlaygroundRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [HueBridgeQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (
        season: IHuntingSeason
    ): Promise<HuePlaygroundDirector> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(HueBridgeQueryPact, d));
        const query =
            (queryDog?.collected as HueBridgeQueryInput | undefined) ??
            ({} as HueBridgeQueryInput);

        const bridgeHost = query.bridgehost?.trim() ?? "";
        const bridgeUser = query.bridgeuser?.trim() ?? "";

        if (!bridgeHost || !bridgeUser) {
            throw new Error(
                "HuePlaygroundRetriever: HueBridgeQueryPact benötigt bridgehost und bridgeuser (QueryRetriever-Keys)"
            );
        }

        const snapshot = await fetchHueBridgeSnapshot(bridgeHost, bridgeUser);
        return new HuePlaygroundDirector(bridgeHost, bridgeUser, snapshot.lights);
    };
}
