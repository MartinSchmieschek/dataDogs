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
                if (this.matchesParent(t, e)){
                    requiredIntersections.push({
                        constructor:t,
                        instance:e
                    })
                }
            })

            optionalDogs.forEach(t => {
                if (this.matchesParent(t, e)){
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
        if (instance instanceof parentClass) return true;
        if ('imitatesClasses' in instance) {
            return (instance as any).imitatesClasses.includes(parentClass);
        }
        return false;
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
     * Prüft optional Parents — wartet NUR auf solche, die tatsächlich im Kennel sind.
     * Optionals die nicht im Kennel existieren werden ignoriert (sind ja optional).
     */
    protected areOptionalParentsReady(season: IHuntingSeason): boolean {
        const optionalDogs = this.optional;
        if (optionalDogs.length === 0) return true;

        for (const optionalClass of optionalDogs) {
            const inKennel =
                season.withBeesInThePants.some(d => this.matchesParent(optionalClass, d)) ||
                season.exhausted.some(d => this.matchesParent(optionalClass, d));

            if (!inKennel) continue;

            const isExhausted = season.exhausted.some(d => this.matchesParent(optionalClass, d));
            if (!isExhausted) return false;
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

    /**
     * Erstellt einen Proxy um season, der alle Property-Zugriffe auf collected von exhausted dogs trackt
     */
    private createTrackedSeason(season: IHuntingSeason): IHuntingSeason {
        const readerInstance = this; // Die Instance, die gerade liest
        const readerName = readerInstance.name;
        const waveIndex = season.currentWaveIndex ?? season.wave.length; // Fallback auf wave.length falls currentWaveIndex nicht gesetzt
        
        // Hilfsfunktion: Erstellt einen rekursiven Proxy für verschachtelte Properties
        const createTrackedObject = (obj: any, sourceInstance: IHuntingDog<unknown>, propertyPath: string = ''): any => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj !== 'object') return obj; // Primitives nicht tracken
            
            return new Proxy(obj, {
                get(target, prop) {
                    const propName = String(prop);
                    const fullPropertyPath = propertyPath ? `${propertyPath}.${propName}` : propName;
                    
                    // Füge Tracking-Eintrag hinzu: Wave-Index, Reader-Instance, Source-Instance, Property-Pfad
                    season.readTracking.push({
                        waveIndex: waveIndex,
                        readerInstance: readerInstance,
                        sourceInstance: sourceInstance,
                        propertyPath: fullPropertyPath
                    });
                    
                    const value = (target as any)[prop];
                    
                    // Wenn Wert ein Objekt ist, wrappe es rekursiv
                    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                        return createTrackedObject(value, sourceInstance, fullPropertyPath);
                    }
                    
                    return value;
                }
            });
        };
        
        // Hilfsfunktion: Erstellt einen Proxy-Dog mit tracked collected
        const createTrackedDog = (sourceInstance: IHuntingDog<unknown>) => {
            return new Proxy(sourceInstance, {
                get(sourceInstanceTarget, dogProp) {
                    if (dogProp === 'collected') {
                        const collected = sourceInstanceTarget.collected;
                        if (collected === undefined) return undefined;
                        
                        const sourceName = sourceInstanceTarget.name;
                        const sourceId = (sourceInstanceTarget as any).storageId || sourceName;
                        
                        // Proxy um collected-Objekt, trackt alle Property-Zugriffe rekursiv
                        const trackedCollected = createTrackedObject(collected, sourceInstanceTarget, '');
                        
                        console.log(`[TRACK] ${readerName} greift auf collected von ${sourceName} (${sourceId}) zu`);
                        return trackedCollected;
                    }
                    return (sourceInstanceTarget as any)[dogProp];
                }
            });
        };
        
        // Proxy um season.exhausted Array
        const trackedExhausted = new Proxy(season.exhausted, {
            get(target, prop) {
                // Für numerische Indizes (Array-Zugriff)
                if (typeof prop === 'string' && !isNaN(Number(prop))) {
                    const sourceInstance = target[Number(prop)];
                    if (!sourceInstance) return undefined;
                    return createTrackedDog(sourceInstance);
                }
                
                // Für Array-Methoden (find, forEach, map, etc.)
                const value = (target as any)[prop];
                if (typeof value === 'function') {
                    return function(...args: any[]) {
                        const result = value.apply(target, args);
                        
                        // Wenn Ergebnis ein Array von Dogs ist (z.B. filter)
                        if (Array.isArray(result)) {
                            return result.map((item: any) => {
                                // Prüfe ob es ein Dog ist
                                if (item && typeof item === 'object' && 'name' in item && 'collected' in item) {
                                    return createTrackedDog(item);
                                }
                                return item;
                            });
                        }
                        
                        // Wenn Ergebnis ein einzelner Dog ist (z.B. find)
                        if (result && typeof result === 'object' && 'name' in result && 'collected' in result) {
                            return createTrackedDog(result);
                        }
                        
                        return result;
                    };
                }
                
                return value;
            }
        });
        
        // Proxy um season, der exhausted überschreibt
        return new Proxy(season, {
            get(target, prop) {
                if (prop === 'exhausted') {
                    return trackedExhausted;
                }
                return (target as any)[prop];
            }
        });
    }

    private result:Y|undefined = undefined
    async collectYield(season:IHuntingSeason): Promise<Y> {
        if (this.result){
                if (this.result instanceof Error)
                    throw Error
                else 
                    return this.result
        } else {
            try {
                // wrap season here and the yield of dogs into a proxy to track the data reading
                const trackedSeason = this.createTrackedSeason(season);
                this.result = await this.yieldCollectorFactory(trackedSeason)
                return this.result
            } catch(e){
                throw e
            }
        }
    }

}



