/**
 * @file WarframeAlertsRetriever.ts
 * Arr, this be the vessel that sails into the void to plunder the World State from
 * the Warframe API. From brooding gulfs are we beheld, by that which bears no name.
 * It fetches the accursed JSON, and from it spawns a Kubrow -- our faithful hound
 * amidst the cosmic madness. To cosmic madness laws submit, though stalwart minds entreat.
 */
import { FetchBaseDog, getBaseDogIcon } from '@datadogs/core';
import type { IWarframeWorldState } from "./interfaces/warframeWorldState";
import { Kubrow } from "./Kubrow";
import { IHuntingSeason } from "@datadogs/core";

/** Arr, the retriever that dives into the API abyss and returns with the World State clutched in its maw. */
export class WarframeAlertsRetriever extends FetchBaseDog<Kubrow> {
    /**
     * The URL of the accursed API -- the gateway to the deep.
     * @returns The Warframe World State API URL, arr
     */
    get apiUrl(): string {
        return 'https://api.warframe.com/cdn/worldState.php?';
    }

    /**
     * The name of this vessel, matey.
     * @returns The class name of this retriever from the void
     */
    get name(): string {
        return WarframeAlertsRetriever.name;
    }

    get description(): string {
        return 'Fetches the Warframe World State and yields a Kubrow with 40+ methods: alerts, sorties, archon hunts, invasions, fissures, void storms, void trader, syndicate missions, daily deals, flash sales, nightwave, goals, conquests, descents, PVP challenges, calendar seasons, persistent enemies, global upgrades, and full static mission lookup.';
    }

    /**
     * The icon, if one exists -- a sigil against the void, or perhaps a beacon into it.
     * @returns The icon string, or undefined if no sigil be found in the deep, arr
     */
    get icon(): string | undefined {
        return getBaseDogIcon(WarframeAlertsRetriever.name);
    }

    /**
     * Arr, the factory that plunders the World State from the API's eldritch depths.
     * Its heralds are the stars it fells, the sky and Earth aflame.
     */
    protected override yieldCollectorFactory = async (_season: IHuntingSeason): Promise<Kubrow> => {
        const response = await fetch(this.apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const simaris = await response.json() as IWarframeWorldState;
        return new Kubrow(simaris);
    };
}
