import { Dog } from "../core/enities/abstractHuntingDog";
import { DogClass, IHuntingDog } from "../core/enities/IHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import * as vm from "vm";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

export class SerializedDog<T> extends Dog<T> {

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
                return [RandomRecipesRetriever];
    }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return []
    }

    get name(): string {
        return "Serilized Dog"
    }

    public get instanceConfig():any{
        return this.config
    }


    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<T> = (season:IHuntingSeason) => {
            return this.runExternalCode(season)
        }

    constructor(private config:{theRun:string}){
        super();
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

        
        //let runContext: any = {} // evtl. using run context if i have saved hunts ;)
        season.exhausted.forEach(dog => {
            context[dog.name] = dog.collected
            //runContext[dog.name] = dog.collected
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