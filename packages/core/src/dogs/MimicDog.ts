import { DogClass, IHuntingDog } from "../core/entities/IHuntingDog";
import { SerializedDog, ISerializedDogConfig } from "./SerializedDog";

export interface IMimicDogConfig extends ISerializedDogConfig {
    imitates: string;
}

export class MimicDog<T> extends SerializedDog<T> {

    private _imitatesClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];
    private _imitatesName: string;

    constructor(config: IMimicDogConfig, storageIdentifier: string) {
        super(config, storageIdentifier);
        this._imitatesName = config.imitates;
    }

    get imitatesName(): string {
        return this._imitatesName;
    }

    get imitatesClasses(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return this._imitatesClasses;
    }

    /**
     * Resolves the imitates name to actual Pact classes using the provided baseDogsMap.
     * Must be called after construction once the baseDogsMap is available.
     */
    resolveImitates(baseDogsMap: Map<string, new (...args: any[]) => IHuntingDog<unknown>>): void {
        const pactClass = baseDogsMap.get(this._imitatesName);
        if (pactClass) {
            this._imitatesClasses = [pactClass];
        }
    }

    protected matchesParent(parentClass: DogClass<IHuntingDog<unknown>>, instance: IHuntingDog<unknown>): boolean {
        if (super.matchesParent(parentClass, instance)) {
            return true;
        }
        if ('imitatesClasses' in instance) {
            return (instance as any).imitatesClasses.includes(parentClass);
        }
        return false;
    }
}
