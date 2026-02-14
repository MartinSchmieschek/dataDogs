import { FetchBaseDog } from "../FetchBaseDog";

export interface SortieData {
    id: string;
    activation: string;
    expiry: string;
    rewardPool: string;
    variants: Array<{
        boss: string;
        planet: string;
        missionType: string;
        modifier: string;
        modifierDescription: string;
    }>;
    boss: string;
    faction: string;
    expired: boolean;
    eta: string;
}

export class WarframeSortieRetriever extends FetchBaseDog<SortieData> {
    get apiUrl(): string {
        return 'https://api.warframestat.us/pc/sortie';
    }

    get name(): string {
        return WarframeSortieRetriever.name;
    }
}

