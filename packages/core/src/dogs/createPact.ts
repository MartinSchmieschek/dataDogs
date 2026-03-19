import { Dog } from "../core/entities/abstractHuntingDog";
import { IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";

export function createPact<T>(name: string, typeDef?: string): (new () => Dog<T>) & { __isPact: true } {
    class PactDog extends Dog<T> {
        get name() { return name; }
        get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }
        get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }
        protected yieldCollectorFactory = async (_season: IHuntingSeason): Promise<T> => {
            throw new Error(`Pact '${name}' requires a MimicDog to provide data`);
        }
    }
    Object.defineProperty(PactDog, 'name', { value: name });
    (PactDog as any).__isPact = true;
    if (typeDef != null) (PactDog as any).__pactReturnTypeDef = typeDef;
    return PactDog as any;
}
