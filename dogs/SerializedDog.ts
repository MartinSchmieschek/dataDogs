import { Dog } from "../core/enities/abstractHuntingDog";
import { DogClass, IHuntingDog } from "../core/enities/IHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import * as vm from "vm";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

export interface ISerilizedDogConfig{
    theRun:string
}

export class SerializedDog<T> extends Dog<T> {

    private _storageId

    public get storageId(): string{
        return this._storageId
    }

    private requiredYieldsContext: Map<string, any> = new Map<string, any>();

    public get simpleVmContext(): Record<string, any> | undefined{
        let justContext:any = {
            fetch:fetch,
            console,
            }
        this.requiredYieldsContext.forEach((value, key) => {
            justContext[key] = value
        })
        return justContext
        
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
                return [RandomRecipesRetriever];
    }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return []
    }

    get name(): string {
        return "Serilized Dog " + this.storageId
    }

    public get instanceConfig():any{
        return this.config
    }


    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<T> = (season:IHuntingSeason) => {
            return this.runExternalCode(season)
        }

    constructor(private config:ISerilizedDogConfig, private storageIdentifier:string) {
        super();
        this._storageId = storageIdentifier
        if (!this.config.theRun){
            this.config.theRun = `throw new Error("Empty yieldCollector!")`
        }
    }

    public async runExternalCode(
    season: IHuntingSeason
  ): Promise<T>  {

        // Benutzer-Code wrappen in async-Funktion
        const wrappedCode = `
            (async () => {
                try {
                    ${this.config.theRun}
                } catch (err) {
                    throw err;
                }
            })()
        `;

        const context = vm.createContext({
            fetch,
            console,
        });

        // this magic binds the exausted dogs yield into a virtual realm so every magic can safly happen. 
        season.exhausted.forEach(dog => {
            context[dog.name] = dog.collected
            this.requiredYieldsContext.set(dog.name, dog.collected);
        })

        // Script
        const script = new vm.Script(wrappedCode);

        try {
            const result = await script.runInContext(context);
            return result as T;
        } catch (err: any) {
            console.error("Script Error:", err);
            throw err;
        }
    }


}