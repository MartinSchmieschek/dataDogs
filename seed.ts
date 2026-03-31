// Arr, this be the seeding rite — spoken once at the dawn of time (or a fresh database).
// We end as we began: from the void we summon the first hound and its kennel.
import { randomUUID } from 'crypto';
import { PrismaStore } from './store/PrismaStore';
import { IStore } from './store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@datadogs/core';
import { TalkingDog } from '@datadogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@datadogs/dogs-demo';

/**
 * Summons the first SerializedDog into the deep — a MimicDog wearing the LayoutInputProvider's form.
 * Through endless faces, countless forms, a multitude unfolds; this is the first face of many.
 * If the store already holds a hound, we leave it be — we do not disturb what already lurks in the dark.
 * Returns the dogId (lineage GUID) of the seeded hound so the kennel may reference it.
 */
export async function seedSerializedDog(nodesStore: IStore): Promise<string | null> {
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        // Forge the spirit's identity — a GUID for the incarnation, a GUID for the lineage.
        const versionId = randomUUID();
        const dogId = randomUUID();

        // The first mimic — it imitates LayoutInputProvider and hunts recipes from the eldritch RandomDogs.
        // Corporeal laws are unwritten as suns and love retreat: it borrows another's form to live.
        const seedCfg: IMimicDogConfig = {
            id: versionId,
            dogId,
            parentId: null,
            displayName: 'Seed Serialized 1',
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

        await nodesStore.save({
            id: versionId,
            type: SerializedDog.name,
            dogId,
            parentId: null,
            displayName: 'Seed Serialized 1',
            serializedDogConfig: JSON.stringify(seedCfg),
            createdAt: new Date(),
        });
        console.log(`✅ Seeded initial SerializedDog into DB (dogId: ${dogId})`);
        return dogId;
    }

    // If a hound already lurks, extract its dogId for the kennel manifest.
    try {
        const config = typeof nodeSeeds[0].serializedDogConfig === 'string'
            ? JSON.parse(nodeSeeds[0].serializedDogConfig)
            : nodeSeeds[0].serializedDogConfig;
        return config.dogId || (nodeSeeds[0] as any).dogId || null;
    } catch {
        return null;
    }
}

/**
 * Raises the first kennel from the abyss — a gathering place for all base hounds.
 * To cosmic madness laws submit, though stalwart minds entreat; every dog finds its kennel.
 * If a kennel already prowls the store, we disturb it not — the void remembers what has been.
 */
export async function seedKennelConfig(kennelsStore: IStore, seedDogId: string | null): Promise<void> {
    // The full roster of base hounds — born of the code, not the store.
    // Each is summoned fresh upon every run, like stars that fell and rose again.
    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever
    ];

    // Rouse each hound just long enough to read its name for the kennel manifest.
    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());

    const kennelSeeds = await kennelsStore.findByType('KennelConfig');
    if (!kennelSeeds || kennelSeeds.length === 0) {
        // The kennel references the dogId (lineage GUID), not a specific version —
        // so it always summons the latest incarnation from the branching tree.
        const dogIds = [
            ...(seedDogId ? [seedDogId] : []),
            ...allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name)
        ];

        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Bind the dogIds to the abyss as a JSON string — the store speaks only in primitive tongues.
        await kennelsStore.save({
            id: defaultKennelConfig.id,
            type: 'KennelConfig',
            name: defaultKennelConfig.name,
            description: defaultKennelConfig.description,
            dogIds: defaultKennelConfig.dogIds,
            defaultQuery: defaultKennelConfig.defaultQuery ? JSON.stringify(defaultKennelConfig.defaultQuery) : undefined,
            defaultBody: defaultKennelConfig.defaultBody ? JSON.stringify(defaultKennelConfig.defaultBody) : undefined,
            createdAt: defaultKennelConfig.createdAt?.toISOString(),
            updatedAt: defaultKennelConfig.updatedAt?.toISOString()
        });
        console.log('✅ Seeded initial Kennel-Config into DB');
    }
}

/**
 * Performs all seeding rites in their proper order — first the hound, then the kennel.
 * In luminous space, blackened stars must be seeded before the hunt can begin.
 */
export async function runSeeds(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const seedDogId = await seedSerializedDog(nodesStore);
    await seedKennelConfig(kennelsStore, seedDogId);
}

/**
 * The standalone invocation — spoken by `npx prisma db seed` when the ship is first provisioned.
 * Uses the same eldritch store logic as the main startup rite.
 * If ye run this as the main module, the seeding begins; if it fails, we sink into the void.
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
