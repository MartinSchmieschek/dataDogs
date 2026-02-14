import { FetchBaseDog } from "../FetchBaseDog";

export interface FissureData {
    id: string;
    node: string;
    missionType: string;
    enemy: string;
    tier: string;
    tierNum: number;
    activation: string;
    expiry: string;
    expired: boolean;
    eta: string;
}

export class WarframeFissuresRetriever extends FetchBaseDog<FissureData[]> {
    get apiUrl(): string {
        return 'https://api.warframestat.us/pc/fissures';
    }

    get name(): string {
        return WarframeFissuresRetriever.name;
    }
}

