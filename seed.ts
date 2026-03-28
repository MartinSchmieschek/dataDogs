import { PrismaStore } from './store/PrismaStore';
import { IStore } from './store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@datadogs/core';
import { TalkingDog } from '@datadogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@datadogs/dogs-demo';

/**
 * Seeded initial SerializedDog in die Datenbank
 */
export async function seedSerializedDog(nodesStore: IStore): Promise<void> {
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        const seedCfg: IMimicDogConfig = {
            version: 1,
            imitates: 'LayoutInputProvider',
            parentsRequired: ['RandomRecipesRetriever', 'RandomEveryThingRetriever'],
            parentsOptional: [],
            theRun: `
return {
    type: "tinder",
    imageUrl: RandomEveryThingRetriever.woof.url,
    title: RandomRecipesRetriever.name,
    description: RandomRecipesRetriever.instructions.join(" and ")
}
`,
        };

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

        // Speichere KennelConfig - dogIds wird in PrismaStore.save() automatisch zu JSON-String konvertiert
        await kennelsStore.save({ 
            id: defaultKennelConfig.id, 
            type: 'KennelConfig', 
            name: defaultKennelConfig.name,
            description: defaultKennelConfig.description,
            dogIds: defaultKennelConfig.dogIds, // Array - wird in PrismaStore.save() zu JSON-String konvertiert
            // defaultQuery und defaultBody sind optional und werden nur gesetzt, wenn vorhanden
            defaultQuery: defaultKennelConfig.defaultQuery ? JSON.stringify(defaultKennelConfig.defaultQuery) : undefined,
            defaultBody: defaultKennelConfig.defaultBody ? JSON.stringify(defaultKennelConfig.defaultBody) : undefined,
            createdAt: defaultKennelConfig.createdAt?.toISOString(),
            updatedAt: defaultKennelConfig.updatedAt?.toISOString()
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

/**
 * Eintrag für `npx prisma db seed` (siehe package.json → prisma.seed).
 * Nutzt dieselbe Store-Logik wie die Startup-Seeds in main.ts.
 */
async function prismaSeedMain(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);
    if ((nodesStore as { init?: () => Promise<void> }).init) {
        await (nodesStore as any).init();
    }
    if ((kennelsStore as { init?: () => Promise<void> }).init) {
        await (kennelsStore as any).init();
    }
    await runSeeds(nodesStore, kennelsStore);
}

if (require.main === module) {
    prismaSeedMain().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
