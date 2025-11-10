import { IHuntingSeason } from "./IHuntingSeason"

export interface IHuntingDog<Y> {
    get name(): string
    isReady(collection:IHuntingSeason):boolean
    collectYield(collection:IHuntingSeason):Promise<Y>
    get collected(): Y|undefined
}