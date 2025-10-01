import { IHuntingDog } from "./IHuntingDog";
import { IHuntingSeason } from "./IHuntingSeason";

export abstract class AbstractHuntingDog<Y> implements IHuntingDog<Y>{
    
    get collected(): Y|undefined{
        return this.result
    }

    abstract get name():string

    abstract isReady(collection: IHuntingSeason): boolean

    protected abstract yieldCollectorFactory:(season:IHuntingSeason) => Promise<Y>

    private result:Y|undefined = undefined
    async collectYield(season:IHuntingSeason): Promise<Y> {
        if (this.result){
                if (this.result instanceof Error)
                    throw Error
                else 
                    return this.result
        } else {
            try {
                this.result = await this.yieldCollectorFactory(season)
                return this.result
            } catch(e){
                throw e
            }
        }
    }

}