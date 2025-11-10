import { IHuntingDog } from "./IHuntingDog";

export interface IHuntingSeason{
    withBeesInThePants: IHuntingDog<unknown>[];
    exhausted:IHuntingDog<unknown>[];
    run:number;
    maxRuns:number
}