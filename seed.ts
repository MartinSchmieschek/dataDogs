// Arr, this be the seeding rite — spoken once at the dawn of time (or a fresh database).
// We end as we began: from the void we summon the first hound and its kennel.
import { PrismaStore } from './store/PrismaStore';
import { IStore } from './store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@datadogs/core';
import { TalkingDog } from '@datadogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@datadogs/dogs-demo';

/**
 * Summons the first SerializedDog into the deep — a MimicDog wearing the LayoutInputProvider's form.
 * Through endless faces, countless forms, a multitude unfolds; this is the first face of many.
 * If the store already holds a hound, we leave it be — we do not disturb what already lurks in the dark.
 */
export async function seedSerializedDog(nodesStore: IStore): Promise<void> {
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        // The first mimic — it imitates LayoutInputProvider and hunts recipes from the eldritch RandomDogs.
        // Corporeal laws are unwritten as suns and love retreat: it borrows another's form to live.
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
 * Raises the first kennel from the abyss — a gathering place for all base hounds.
 * To cosmic madness laws submit, though stalwart minds entreat; every dog finds its kennel.
 * If a kennel already prowls the store, we disturb it not — the void remembers what has been.
 */
export async function seedKennelConfig(kennelsStore: IStore): Promise<void> {
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
        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds: ['seed-serialized-1-v1', ...allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name)],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Bind the dogIds to the abyss as a JSON string — the store speaks only in primitive tongues.
        // defaultQuery and defaultBody are optional cargo; load them only if the manifest demands it.
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
    await seedSerializedDog(nodesStore);
    await seedKennelConfig(kennelsStore);
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
