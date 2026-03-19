import { IHuntingSeason } from "./IHuntingSeason"

// Hilfstyp: Ein Konstruktor, der eine Instanz vom Typ T erzeugt
export type DogClass<T> = new (...args: any[]) => T;

export interface IHuntingDog<Y> {
    get name(): string
    /** Optional display glyph (e.g. emoji) for UI */
    get icon(): string | undefined
    isReady(collection:IHuntingSeason):boolean
    collectYield(collection:IHuntingSeason):Promise<Y>
    get collected(): Y|undefined
}



