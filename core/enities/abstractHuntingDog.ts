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

    /**
     * Geschützte Methode, die von abgeleiteten Klassen überschrieben werden kann,
     * um spezifische Instanz-Prüfung zu ermöglichen (z.B. nach storageId bei SerializedDog).
     * Standard-Implementierung prüft nur, ob die Instanz eine Instanz der gegebenen Klasse ist.
     */
    protected matchesParent(parentClass: DogClass<IHuntingDog<unknown>>, instance: IHuntingDog<unknown>): boolean {
        return instance instanceof parentClass;
    }

    /**
     * Prüft, ob alle required Parents in exhausted sind.
     * Verwendet matchesParent für instanz-spezifische Prüfung.
     */
    protected areRequiredParentsReady(season: IHuntingSeason): boolean {
        const requiredDogs = this.required;
        const requiredCount = requiredDogs.length;
        
        if (requiredCount === 0) {
            return true;
        }
        
        let foundCount = 0;
        for (const requiredClass of requiredDogs) {
            const found = season.exhausted.some(dog => this.matchesParent(requiredClass, dog));
            if (found) {
                foundCount++;
            }
        }
        
        return foundCount >= requiredCount;
    }

    /**
     * Prüft, ob alle optional Parents bereits in exhausted sind (nicht in derselben Welle laufen).
     * Verwendet matchesParent für instanz-spezifische Prüfung.
     */
    protected areOptionalParentsReady(season: IHuntingSeason): boolean {
        const optionalDogs = this.optional;
        const optionalCount = optionalDogs.length;
        
        if (optionalCount === 0) {
            return true;
        }
        
        // Prüfe, ob ein optional Parent noch in withBeesInThePants ist (noch nicht gelaufen)
        // Wenn ja, ist dieser Hund noch nicht ready (optional Parents müssen in vorheriger Welle laufen)
        for (const optionalClass of optionalDogs) {
            const stillRunning = season.withBeesInThePants.some(dog => this.matchesParent(optionalClass, dog));
            if (stillRunning) {
                return false;
            }
        }
        
        // Prüfe, ob alle optional Parents bereits in exhausted sind
        let foundCount = 0;
        for (const optionalClass of optionalDogs) {
            const found = season.exhausted.some(dog => this.matchesParent(optionalClass, dog));
            if (found) {
                foundCount++;
            }
        }
        
        // Wenn noch Runs möglich sind und nicht alle optional Parents gefunden wurden, warte
        // (aber nur wenn sie nicht mehr in withBeesInThePants sind - das wurde oben bereits geprüft)
        if (season.runIndex < season.maxRuns && foundCount < optionalCount) {
            return false;
        }
        
        return true;
    }

    isReady(season: IHuntingSeason): boolean {
        // Prüfe required Parents: Alle müssen in exhausted sein
        if (!this.areRequiredParentsReady(season)) {
            return false;
        }

        // Prüfe optional Parents: Sie müssen ALLE bereits in exhausted sein (nicht in derselben Welle laufen)
        if (!this.areOptionalParentsReady(season)) {
            return false;
        }

        return true;
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