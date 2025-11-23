import { IHuntingSeason } from "./IHuntingSeason"

// Hilfstyp: Ein Konstruktor, der eine Instanz vom Typ T erzeugt
export type DogClass<T> = new (...args: any[]) => T;

export interface IHuntingDog<Y> {
    get name(): string
    isReady(collection:IHuntingSeason):boolean
    collectYield(collection:IHuntingSeason):Promise<Y>
    get collected(): Y|undefined
}