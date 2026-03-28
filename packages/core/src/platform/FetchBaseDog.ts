import { Dog } from '../core/entities/abstractHuntingDog';
import { IHuntingDog } from '../core/entities/IHuntingDog';
import { IHuntingSeason } from '../core/entities/IHuntingSeason';

/**
 * Abstrakte Basis-Klasse für Dogs, die Daten über Fetch-Requests von APIs abrufen.
 * Abgeleitete Klassen müssen nur die apiUrl definieren.
 */
export abstract class FetchBaseDog<T> extends Dog<T> {
    abstract get apiUrl(): string;

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<T> => {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json() as T;
        } catch (error) {
            throw new Error(`Fehler beim Abrufen von ${this.apiUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
}
