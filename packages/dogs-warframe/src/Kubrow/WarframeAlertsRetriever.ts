import { FetchBaseDog, getBaseDogIcon } from '@datadogs/core';
import type { IWarframeWorldState } from "./interfaces/warframeWorldState";
import { Kubrow } from "./Kubrow";
import { IHuntingSeason } from "@datadogs/core";

export class WarframeAlertsRetriever extends FetchBaseDog<Kubrow> {
    get apiUrl(): string {
        return 'https://api.warframe.com/cdn/worldState.php?';
    }

    get name(): string {
        return WarframeAlertsRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(WarframeAlertsRetriever.name);
    }

    protected override yieldCollectorFactory = async (_season: IHuntingSeason): Promise<Kubrow> => {
        const response = await fetch(this.apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const simaris = await response.json() as IWarframeWorldState;
        return new Kubrow(simaris);
    };
}
