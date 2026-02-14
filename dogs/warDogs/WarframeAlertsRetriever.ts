import { FetchBaseDog } from "../FetchBaseDog";

export interface AlertData {
    id: string;
    activation: string;
    expiry: string;
    mission: {
        node: string;
        type: string;
        faction: string;
        reward?: {
            items?: string[];
            countedItems?: Array<{ count: number; type: string }>;
        };
    };
    active: boolean;
}

export class WarframeAlertsRetriever extends FetchBaseDog<AlertData[]> {
    get apiUrl(): string {
        return 'https://api.warframestat.us/pc/alerts';
    }

    get name(): string {
        return WarframeAlertsRetriever.name;
    }
}

