import { Dog } from "../core/entities/abstractHuntingDog";
import { IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";

/** Optionen für Pacts, deren Return-Typ zur Laufzeit aus TypeScript-Quellen aufgelöst wird. */
export interface CreatePactFromSourceOptions {
    fromSourceType: string;
}

export function createPact<T>(name: string): (new () => Dog<T>) & { __isPact: true };
export function createPact<T>(name: string, typeDef: string): (new () => Dog<T>) & { __isPact: true };
export function createPact<T>(name: string, options: CreatePactFromSourceOptions): (new () => Dog<T>) & { __isPact: true };
export function createPact<T>(
    name: string,
    typeDefOrOptions?: string | CreatePactFromSourceOptions
): (new () => Dog<T>) & { __isPact: true } {
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
    if (typeof typeDefOrOptions === 'string') {
        (PactDog as any).__pactReturnTypeDef = typeDefOrOptions;
    } else if (typeDefOrOptions && typeof typeDefOrOptions === 'object' && 'fromSourceType' in typeDefOrOptions) {
        (PactDog as any).__pactSourceTypeName = typeDefOrOptions.fromSourceType;
    }
    return PactDog as any;
}
