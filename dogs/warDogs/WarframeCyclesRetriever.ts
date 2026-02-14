import { FetchBaseDog } from "../FetchBaseDog";

export interface CyclesData {
    cetusCycle: {
        id: string;
        expiry: string;
        isDay: boolean;
        timeLeft: string;
        shortString: string;
    };
    vallisCycle: {
        id: string;
        expiry: string;
        isWarm: boolean;
        timeLeft: string;
        shortString: string;
    };
    cambionCycle: {
        id: string;
        expiry: string;
        active: string;
        timeLeft: string;
        shortString: string;
    };
}

export class WarframeCyclesRetriever extends FetchBaseDog<CyclesData> {
    get apiUrl(): string {
        return 'https://api.warframestat.us/pc/cycles';
    }

    get name(): string {
        return WarframeCyclesRetriever.name;
    }
}

