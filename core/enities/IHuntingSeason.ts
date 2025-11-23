import { IHuntingDog } from "./IHuntingDog";

export interface IHuntingSeason{
    withBeesInThePants: IHuntingDog<unknown>[];
    exhausted:IHuntingDog<unknown>[];
    runIndex:number;
    maxRuns:number
    wave:Array<IHuntingDog<unknown>[]>
}