import { FetchBaseDog } from "../FetchBaseDog";

export interface EventData {
    id: string;
    activation: string;
    expiry: string;
    startString: string;
    active: boolean;
    maximumScore?: number;
    currentScore?: number;
    description: string;
    tooltip: string;
    node: string;
    concurrentNodes?: string[];
    victimNode?: string;
    scoreLocTag?: string;
    rewards?: Array<{
        items?: string[];
        countedItems?: Array<{ count: number; type: string }>;
        credits?: number;
    }>;
    health?: number;
    affiliatedWith?: string;
    jobs?: Array<{
        id: string;
        rewardPool?: string[];
        type: string;
        enemyLevels?: number[];
        standingStages?: number[];
    }>;
    interimSteps?: Array<{
        goal: number;
        reward: {
            items?: string[];
            countedItems?: Array<{ count: number; type: string }>;
        };
        message: string;
    }>;
}

export class WarframeEventsRetriever extends FetchBaseDog<EventData[]> {
    get apiUrl(): string {
        return 'https://api.warframestat.us/pc/events';
    }

    get name(): string {
        return WarframeEventsRetriever.name;
    }
}

