import { IStore } from './store/IStore';
import { SerializedDog, ISerializedDogConfig } from './dogs/SerializedDog';
import { IKennelConfig } from './core/KennelRun';
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { RandomRecipesRetriever } from './dogs/RandomRecipesRetriever';
import { CountryFlagBlackLab } from './dogs/CountryFlagBlackLab';
import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';

const BASE_DOG_PREFIX = 'base:';

/**
 * Seeded initial SerializedDog in die Datenbank
 */
export async function seedSerializedDog(nodesStore: IStore): Promise<void> {
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        const seedCfg = {
            theRun: `
let option = RandomRecipesRetriever.instructions
if (option){
    let f = ("" + TalkingDog).replace("Recipe description here...",option.join(" and "))
    return f;
}

    return TalkingDog
                `,
            version: 1,
            parentsRequired: ['RandomRecipesRetriever'],
            parentsOptional: ['TalkingDog']
        } as ISerializedDogConfig;

        await nodesStore.save({ id: 'seed-serialized-1-v1', type: SerializedDog.name, serializedDogConfig: seedCfg });
        console.log('✅ Seeded initial SerializedDog into DB');
    }
}

/**
 * Seeded initial Kennel-Config in die Datenbank
 */
export async function seedKennelConfig(kennelsStore: IStore): Promise<void> {
    // Liste aller verfügbaren Basis-Dog-Klassen (für Instanziierung bei jedem Run)
    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever
    ];
    
    // Erstelle Instanzen für die Kennel-Liste (nur für Anzeige)
    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());
    
    const kennelSeeds = await kennelsStore.findByType('KennelConfig');
    if (!kennelSeeds || kennelSeeds.length === 0) {
        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds: ['seed-serialized-1-v1', ...allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name)],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await kennelsStore.save({ 
            id: defaultKennelConfig.id, 
            type: 'KennelConfig', 
            serializedDogConfig: JSON.stringify(defaultKennelConfig) 
        });
        console.log('✅ Seeded initial Kennel-Config into DB');
    }
}

/**
 * Führt alle Seed-Operationen aus
 */
export async function runSeeds(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    await seedSerializedDog(nodesStore);
    await seedKennelConfig(kennelsStore);
}

