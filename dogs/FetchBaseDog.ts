import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";

/**
 * Abstrakte Basis-Klasse für Dogs, die Daten über Fetch-Requests von APIs abrufen.
 * Abgeleitete Klassen müssen nur die apiUrl definieren.
 */
export abstract class FetchBaseDog<T> extends Dog<T> {
    /**
     * Abstrakte Getter-Methode, die von abgeleiteten Klassen implementiert werden muss.
     * Gibt die URL der API zurück, von der Daten abgerufen werden sollen.
     */
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
            return await response.json();
        } catch (error) {
            throw new Error(`Fehler beim Abrufen von ${this.apiUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
}


