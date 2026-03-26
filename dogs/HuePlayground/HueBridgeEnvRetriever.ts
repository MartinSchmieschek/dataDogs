import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { HueBridgeQueryPact, type HueBridgeQueryInput } from "./pacts";
import { getBaseDogIcon } from "../baseDogIcons";

/**
 * Liefert HueBridgeQueryPact-Daten aus der Server-Umgebung (z. B. `.env`),
 * damit dieselben Werte wie in HuePlayground (`hueHandler`: IP + API-Username)
 * ohne Query-Parameter im Kennel genutzt werden können.
 *
 * Erwartete Variablen: `HUE_BRIDGE_HOST`, `HUE_BRIDGE_USER` (Hue-API-Username, kein Passwort).
 */
export class HueBridgeEnvRetriever extends HueBridgeQueryPact {
    get name(): string {
        return HueBridgeEnvRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(HueBridgeEnvRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (
        _season: IHuntingSeason
    ): Promise<HueBridgeQueryInput> => {
        const bridgehost = process.env.HUE_BRIDGE_HOST?.trim() ?? "";
        const bridgeuser = process.env.HUE_BRIDGE_USER?.trim() ?? "";
        if (!bridgehost || !bridgeuser) {
            throw new Error(
                "HueBridgeEnvRetriever: HUE_BRIDGE_HOST und HUE_BRIDGE_USER setzen (z. B. in .env — Werte wie in HuePlayground hueHandler: IP + Bridge-API-Username)"
            );
        }
        return { bridgehost, bridgeuser };
    };
}
