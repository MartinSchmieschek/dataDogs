import { DogClass, IHuntingDog } from "./IHuntingDog";

export interface IWaveEntry {
    instance:IHuntingDog<unknown>,
    requiresFrom:null|{instance: IHuntingDog<unknown>,constructor: DogClass<IHuntingDog<unknown>>}[]
    optionalRequiresFrom:null|{instance: IHuntingDog<unknown>,constructor: DogClass<IHuntingDog<unknown>>}[]
}

export interface IReadTrackingEntry {
    waveIndex: number;
    readerInstance: IHuntingDog<unknown>;
    sourceInstance: IHuntingDog<unknown>;
    propertyPath: string;
}

export interface IHuntingSeason{
    withBeesInThePants: IHuntingDog<unknown>[];
    exhausted:IHuntingDog<unknown>[];
    runIndex:number;
    maxRuns:number
    wave:Array<IWaveEntry[]>
    // Tracking: Array von Einträgen, die genau zeigen, welche Property von welcher Source-Instance 
    // von welcher Reader-Instance in welcher Welle gelesen wurde
    readTracking: IReadTrackingEntry[];
    // Aktueller Wave-Index, wird während der Ausführung gesetzt
    currentWaveIndex?: number;
}


