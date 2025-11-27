import { DogClass, IHuntingDog } from "./IHuntingDog";
import { IHuntingSeason } from "./IHuntingSeason";



export abstract class Dog<Y> implements IHuntingDog<Y>{

    
    get collected(): Y|undefined{
        return this.result
    }

    abstract get name():string

    abstract get required():(new (...args: any[]) => IHuntingDog<unknown>)[]
    abstract get optional():(new (...args: any[]) => IHuntingDog<unknown>)[]

    // Prüft ob a eine Instanz derselben Klasse ist wie b
    private static isIntersecting(a: DogClass<IHuntingDog<unknown>>, b: DogClass<IHuntingDog<unknown>>): boolean {
        return b instanceof a;
    }

    // Gibt die Überschneidungen zwischen zwei Arrays zurück
    private static intersection(arr1: any[], arr2: any[]): Array<DogClass<IHuntingDog<unknown>>> {
        return arr1.filter(a => arr2.some(b => Dog.isIntersecting(a, b)));
    }

    filterByRequirements(exhausted: IHuntingDog<unknown>[]):{
        required:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[],
        optional:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[],
    } {

        const requiredDogs = this.required
        const optionalDogs = this.optional

        let requiredIntersections:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[] = []
        let optionalIntersections:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[] = []
        exhausted.forEach(e => {
            requiredDogs.forEach(t => {
                if (e instanceof t){
                    requiredIntersections.push({
                        constructor:t,
                        instance:e
                    })
                }
            })

            optionalDogs.forEach(t => {
                if (e instanceof t){
                    optionalIntersections.push({
                        constructor:t,
                        instance:e
                    })
                }
            })
        })



        return {required:requiredIntersections,optional:optionalIntersections}
    }

    isReady(season: IHuntingSeason): boolean {

        const requiredDogs = this.required
        const optionalDogs = this.optional

        let requiredIntersections = Dog.intersection(requiredDogs, season.exhausted)
        let optionalIntersections = Dog.intersection(optionalDogs, season.exhausted)
        let maxOptionalIntersections = Dog.intersection(optionalDogs, season.withBeesInThePants)

        if (requiredIntersections.length >= requiredDogs.length) {
            // wait maybe there will be more
            if (season.runIndex < season.maxRuns && optionalIntersections.length < maxOptionalIntersections.length)
                return false;


            return true;
        } 

        return false;
    }

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