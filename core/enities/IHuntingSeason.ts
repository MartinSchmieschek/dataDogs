
import { DogClass, IHuntingDog } from "./IHuntingDog";

export interface IWaveEntry {
    instance:IHuntingDog<unknown>,
    requiresFrom:null|{instance: IHuntingDog<unknown>,constructor: DogClass<IHuntingDog<unknown>>}[]
    optionalRequiresFrom:null|{instance: IHuntingDog<unknown>,constructor: DogClass<IHuntingDog<unknown>>}[]
}

export interface IHuntingSeason{
    withBeesInThePants: IHuntingDog<unknown>[];
    exhausted:IHuntingDog<unknown>[];
    runIndex:number;
    maxRuns:number
    wave:Array<IWaveEntry[]>
}