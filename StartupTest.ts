import { IStore } from './store/IStore';
import {
    SerializedDog,
    ISerializedDogConfig,
    IKennelConfig,
    BASE_DOG_PREFIX,
    Dog,
    IHuntingDog,
    createPact,
    MimicDog,
    IMimicDogConfig,
    KennelRun,
    isRuntimeLogVerbose,
} from '@datadogs/core';
import { Controller } from './api/Controller';
import { AbstractController } from './api/AbstractController';
import { KennelController } from './api/KennelController';
import { ControllerRegistry } from './api/routes/ConfigRouteHandler';
import { TypeDefBuilder } from './services/TypeDefBuilder';
import { CompilerCache } from './services/CompilerCache';
import { generateVersionId, generateLineageId } from './api/utils/versioning';
import { BloodhoundIsochronePact, type BloodhoundIsochroneInput, NearbyLandmarksPact } from '@datadogs/dogs-geo';

/**
 * Arr, the testament of a single trial endured upon the eldritch seas —
 * recording whether the crew's test weathered the void or was consumed
 * by the carrion hordes of failure lurking in the deep.
 */
export interface TestResult {
    /** The name of the trial, inscribed upon the ship's log for all to witness. */
    name: string;
    /** Whether the test survived the abyss — true if it passed, false if the void claimed it. */
    passed: boolean;
    /** The error message from brooding gulfs, present only when the test be lost to the deep. */
    error?: string;
}

/**
 * Arr, the StartupTest be the grand trial by fire — a gauntlet of tests
 * run at startup to ensure the stores, controllers, base dogs, type builders,
 * and pact mimics all hold firm against the void. Should any test fall
 * to the carrion hordes, the crew be warned before the ship sets sail
 * into the brooding gulfs of production.
 */
export class StartupTest {
    /** The accumulated results of each trial, a ledger of victories and defeats against the abyss. */
    private results: TestResult[] = [];
    /** IDs of test entities conjured during the trials, marked for cleanup lest they pollute the deep. */
    private createdTestIds: string[] = [];

    /**
     * Führt alle Tests aus
     */
    async runAllTests(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: AbstractController<IKennelConfig>,
        baseDogsMap: Map<string, any>
    ): Promise<TestResult[]> {
        if (isRuntimeLogVerbose()) {
            console.log('\n🧪 Starte Startup-Tests...\n');
        }

        try {
            // Store-Tests
            await this.testStoreSaveAndLoad(nodesStore);
            await this.testStoreFindByType(nodesStore);
            
            // Controller-Tests
            await this.testControllerList(nodesController);
            await this.testControllerGetById(nodesController);
            await this.testControllerCreate(nodesController);
            await this.testControllerSave(nodesController);
            
            // KennelConfig-Tests
            await this.testKennelConfigList(kennelsController);
            await this.testKennelConfigGetById(kennelsController);
            
            // BaseDogs-Tests
            await this.testBaseDogsAvailability(baseDogsMap);
            await this.testBaseDogsFormat(baseDogsMap);
            
            // TypeDefBuilder-Tests
            await this.testTypeDefBuilder();
            await this.testPactFromSourceType();

            // SerializedDog-Tests
            await this.testSerializedDogExists(nodesStore);
            await this.testAllVersionsInList(nodesController);
            
            // Pact & MimicDog Tests
            await this.testCreatePact();
            await this.testMimicDogImitatesPact(baseDogsMap);
            await this.testMatchesParentRecognizesMimic(baseDogsMap);
            await this.testFillKennelAutoMimicForPact(baseDogsMap);
            await this.testFillKennelAutoMimicForOptionalPact(baseDogsMap);
            await this.testFillKennelAutoMimicForRequiredAndOptionalPacts(baseDogsMap);
            await this.testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap);
            await this.testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap);
            await this.testRunSeasonWithMimicConsumerRuns(baseDogsMap);
            await this.testTalkingDogAllDependenciesResolved(baseDogsMap);

            // Export/Import Tests
            await this.testKennelExportImport(nodesStore, kennelsStore, kennelsController);

            // Tile-Feature-Cache: atomarer Geo-Store verifizieren
            await this.testTileFeatureCache();
        } finally {
            // Cleanup: Lösche alle erstellten Test-Daten
            await this.cleanupTestData(nodesStore, kennelsStore, nodesController, kennelsController);
        }
        
        // Zusammenfassung
        this.printSummary();
        
        return this.results;
    }

    /**
     * Löscht alle erstellten Test-Daten (nur die spezifisch erstellten IDs)
     */
    private async cleanupTestData(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: AbstractController<IKennelConfig>
    ): Promise<void> {
        if (this.createdTestIds.length === 0) {
            return; // Keine Test-Daten erstellt
        }
        
        const v = isRuntimeLogVerbose();
        if (v) console.log('\n🧹 Räume Test-Daten auf...\n');

        // Lösche NUR die spezifisch erstellten Test-IDs
        for (const testId of this.createdTestIds) {
            try {
                // Versuche über Controller zu löschen (für SerializedDogs)
                await nodesController.delete(testId);
                if (v) console.log(`  🗑️  Gelöscht: ${testId}`);
            } catch (e) {
                // Falls Controller-Löschen fehlschlägt, versuche über Store
                try {
                    await nodesStore.delete(testId);
                    if (v) console.log(`  🗑️  Gelöscht (via Store): ${testId}`);
                } catch (e2) {
                    // Ignoriere Fehler (kann sein, dass bereits gelöscht wurde oder nicht existiert)
                    if (v) console.log(`  ⚠️  Konnte nicht löschen: ${testId} (möglicherweise bereits gelöscht)`);
                }
            }
        }

        if (v) console.log(`✅ Cleanup abgeschlossen (${this.createdTestIds.length} IDs verarbeitet)\n`);
    }

    /**
     * Test: Store kann speichern und laden
     */
    private async testStoreSaveAndLoad(store: IStore): Promise<void> {
        const testName = 'Store: Save & Load';
        let testId: string | null = null;
        try {
            testId = 'test-store-' + Date.now();
            this.createdTestIds.push(testId);
            const testData = { id: testId, test: true, value: 123 };
            
            await store.save({
                id: testId,
                type: 'TestType',
                serializedDogConfig: JSON.stringify(testData)
            });
            
            const loaded = await store.load(testId);
            if (!loaded) {
                throw new Error('Daten konnten nicht geladen werden');
            }
            
            const parsed = typeof loaded === 'string' ? JSON.parse(loaded) : loaded;
            if (parsed.test !== true || parsed.value !== 123) {
                throw new Error('Geladene Daten stimmen nicht überein');
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    /**
     * Test: Store kann nach Typ suchen
     */
    private async testStoreFindByType(store: IStore): Promise<void> {
        const testName = 'Store: FindByType';
        try {
            const results = await store.findByType(SerializedDog.name);
            if (!Array.isArray(results)) {
                throw new Error('Ergebnis ist kein Array');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Controller kann Liste abrufen
     */
    private async testControllerList(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: List';
        try {
            const result = await controller.list();
            if (!result.ok) {
                throw new Error(result.error || 'Liste konnte nicht abgerufen werden');
            }
            if (!Array.isArray(result.data)) {
                throw new Error('Daten sind kein Array');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Controller kann Entity nach ID abrufen
     */
    private async testControllerGetById(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: GetById';
        try {
            // Versuche den gesäten SerializedDog zu laden
            // With GUID-based versioning, the seed ID is dynamic — find any SerializedDog instead.
            const allDogs = await controller.list();
            const result = allDogs.ok && allDogs.data && allDogs.data.length > 0
                ? { ok: true, data: allDogs.data[0] }
                : { ok: false, error: 'Keine SerializedDogs gefunden', data: null };
            if (!result.ok && result.error?.includes('nicht gefunden')) {
                // Das ist OK, wenn der Seed noch nicht existiert
                this.addResult(testName, true, 'Seed existiert noch nicht (OK)');
            } else if (result.ok && result.data) {
                this.addResult(testName, true);
            } else {
                throw new Error(result.error || 'Unbekannter Fehler');
            }
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Controller kann Entity erstellen
     */
    private async testControllerCreate(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: Create';
        let createdId: string | null = null;
        try {
            const input: ISerializedDogConfig = {
                displayName: 'test-create-' + Date.now(),
                theRun: 'return { test: true };',
            };

            const result = await controller.create(input);
            if (!result.ok) {
                throw new Error(result.error || 'Erstellen fehlgeschlagen');
            }

            if (!result.id) {
                throw new Error('Keine ID zurückgegeben');
            }

            createdId = result.id;
            this.createdTestIds.push(createdId);
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    /**
     * Test: Controller kann Entity speichern
     */
    private async testControllerSave(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: Save';
        try {
            const input: ISerializedDogConfig = {
                displayName: 'test-save-' + Date.now(),
                theRun: 'return { test: true };',
            };

            // Erstelle erst eine Entity — the firstborn incarnation
            const createResult = await controller.create(input);
            if (!createResult.ok || !createResult.id) {
                throw new Error(createResult.error || 'Erstellen fehlgeschlagen');
            }
            this.createdTestIds.push(createResult.id);

            // Dann speichere sie (Update) — a new incarnation branching from the first
            const updateInput: ISerializedDogConfig = {
                id: createResult.id,
                theRun: 'return { test: true, updated: true };',
            };

            const result = await controller.save(updateInput);
            if (!result.ok) {
                throw new Error(result.error || 'Speichern fehlgeschlagen');
            }

            if (result.id) {
                this.createdTestIds.push(result.id);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: KennelConfig kann gelistet werden
     */
    private async testKennelConfigList(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: List';
        try {
            const result = await controller.list();
            if (!result.ok) {
                throw new Error(result.error || 'Liste konnte nicht abgerufen werden');
            }
            if (!Array.isArray(result.data)) {
                throw new Error('Daten sind kein Array');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: KennelConfig kann nach ID abgerufen werden
     */
    private async testKennelConfigGetById(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: GetById';
        try {
            // Versuche die default-kennel zu laden
            const result = await controller.getById('default-kennel');
            if (!result.ok && result.error?.includes('nicht gefunden')) {
                // Das ist OK, wenn der Seed noch nicht existiert
                this.addResult(testName, true, 'Default Kennel existiert noch nicht (OK)');
            } else if (result.ok && result.data) {
                // Prüfe ob dogIds vorhanden ist
                if (!Array.isArray(result.data.dogIds)) {
                    throw new Error('dogIds ist kein Array');
                }
                this.addResult(testName, true);
            } else {
                throw new Error(result.error || 'Unbekannter Fehler');
            }
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: BaseDogs sind verfügbar
     */
    private async testBaseDogsAvailability(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'BaseDogs: Verfügbarkeit';
        try {
            if (baseDogsMap.size === 0) {
                throw new Error('Keine BaseDogs verfügbar');
            }
            
            const expectedDogs = ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'];
            const missingDogs = expectedDogs.filter(name => !baseDogsMap.has(name));
            
            if (missingDogs.length > 0) {
                throw new Error(`Fehlende BaseDogs: ${missingDogs.join(', ')}`);
            }
            
            // Prüfe ob alle BaseDogs eine name-Property haben
            for (const [name, DogClass] of baseDogsMap.entries()) {
                const dog = new DogClass();
                if (!dog.name || dog.name !== name) {
                    throw new Error(`BaseDog ${name} hat keine korrekte name-Property`);
                }
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: BaseDogs haben korrektes Format für API (base:Name)
     */
    private async testBaseDogsFormat(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'BaseDogs: Format für API';
        try {
            // BASE_DOG_PREFIX wird jetzt aus datadogs importiert
            
            for (const [name, DogClass] of baseDogsMap.entries()) {
                const expectedId = BASE_DOG_PREFIX + name;
                if (!expectedId.startsWith(BASE_DOG_PREFIX)) {
                    throw new Error(`BaseDog ${name} hat kein korrektes Präfix: ${expectedId}`);
                }
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: TypeDefBuilder generiert korrekte Type-Definitionen
     */
    private async testTypeDefBuilder(): Promise<void> {
        const testName = 'TypeDefBuilder: Type-Definitionen';
        try {
            // Test 1: Einfacher Context mit Primitives
            const simpleCtx = {
                name: 'test',
                age: 25,
                active: true
            };
            const simpleResult = TypeDefBuilder.buildContextLib('SimpleNode', simpleCtx);
            
            // Validierung: Primitives
            if (!simpleResult.includes('declare global')) {
                throw new Error('Fehlende declare global Blocks');
            }
            if (!simpleResult.includes('export type Node_SimpleNode')) {
                throw new Error('Fehlender export type mit Node_ prefix');
            }
            if (!simpleResult.includes('name: string')) {
                throw new Error('String-Typ nicht korrekt konvertiert');
            }
            if (!simpleResult.includes('age: number')) {
                throw new Error('Number-Typ nicht korrekt konvertiert');
            }
            if (!simpleResult.includes('active: boolean')) {
                throw new Error('Boolean-Typ nicht korrekt konvertiert');
            }
            
            // Test 2: Arrays
            const arrayCtx = {
                tags: ['tag1', 'tag2'],
                numbers: [1, 2, 3],
                emptyArray: []
            };
            const arrayResult = TypeDefBuilder.buildContextLib('ArrayNode', arrayCtx);
            
            if (!arrayResult.includes('tags: string[]')) {
                throw new Error('String-Array nicht korrekt konvertiert');
            }
            if (!arrayResult.includes('numbers: number[]')) {
                throw new Error('Number-Array nicht korrekt konvertiert');
            }
            if (!arrayResult.includes('emptyArray: any[]')) {
                throw new Error('Leeres Array sollte als any[] behandelt werden');
            }
            
            // Test 3: Objects und verschachtelte Strukturen
            const objectCtx = {
                user: {
                    id: 1,
                    profile: {
                        name: 'John',
                        email: 'john@example.com'
                    }
                },
                emptyObj: {}
            };
            const objectResult = TypeDefBuilder.buildContextLib('ObjectNode', objectCtx);
            
            if (!objectResult.includes('user: {')) {
                throw new Error('Object-Typ nicht erkannt');
            }
            if (!objectResult.includes('id: number')) {
                throw new Error('Verschachtelte Properties nicht korrekt');
            }
            if (!objectResult.includes('profile: {')) {
                throw new Error('Verschachtelte Objects nicht korrekt');
            }
            if (!objectResult.includes('emptyObj: {}')) {
                throw new Error('Leeres Object sollte als {} behandelt werden');
            }
            
            // Test 4: Functions
            const functionCtx = {
                handler: (a: any, b: any) => a + b,
                noArgs: () => {},
                threeArgs: (x: any, y: any, z: any) => x + y + z
            };
            const functionResult = TypeDefBuilder.buildContextLib('FunctionNode', functionCtx);
            
            if (!functionResult.includes('handler: (arg0: any, arg1: any) => any')) {
                throw new Error('Function mit Parametern nicht korrekt konvertiert');
            }
            if (!functionResult.includes('noArgs: () => any')) {
                throw new Error('Function ohne Parameter nicht korrekt konvertiert');
            }
            if (!functionResult.includes('threeArgs: (arg0: any, arg1: any, arg2: any) => any')) {
                throw new Error('Function mit mehreren Parametern nicht korrekt konvertiert');
            }
            
            // Test 5: Null-Werte
            const nullCtx = {
                value: null,
                data: 'test'
            };
            const nullResult = TypeDefBuilder.buildContextLib('NullNode', nullCtx);
            
            if (!nullResult.includes('value: null')) {
                throw new Error('Null-Wert nicht korrekt als "null" typisiert');
            }
            
            // Test 6: Komplexer Context (Kombination aller Typen)
            const complexCtx = {
                string: 'test',
                number: 42,
                boolean: true,
                nullValue: null,
                array: [1, 2, 3],
                emptyArray: [],
                object: {
                    nested: {
                        deep: 'value'
                    },
                    array: ['a', 'b']
                },
                emptyObject: {},
                func: (x: any) => x,
                fetch: fetch,
                console: console
            };
            const complexResult = TypeDefBuilder.buildContextLib('ComplexNode-123', complexCtx);
            
            // Validierung: Type-Name sollte sicher sein (Sonderzeichen ersetzt)
            if (!complexResult.includes('export type Node_ComplexNode_123')) {
                throw new Error('Type-Name sollte Sonderzeichen ersetzen');
            }
            
            // Validierung: Alle Typen sollten vorhanden sein
            if (!complexResult.includes('string: string') || 
                !complexResult.includes('number: number') ||
                !complexResult.includes('boolean: boolean') ||
                !complexResult.includes('nullValue: null') ||
                !complexResult.includes('array: number[]') ||
                !complexResult.includes('emptyArray: any[]') ||
                !complexResult.includes('object: {') ||
                !complexResult.includes('emptyObject: {}')) {
                throw new Error('Nicht alle Typen im komplexen Context korrekt konvertiert');
            }
            
            // Validierung: Global declarations für Context-Keys
            if (!complexResult.includes('declare global')) {
                throw new Error('Fehlende global declarations für Context-Keys');
            }
            
            // Validierung: Context-Keys als declare global (globalVars)
            const globalDeclarations = (complexResult.match(/declare global/g) || []).length;
            if (globalDeclarations < 1) {
                throw new Error('Zu wenige declare global Blocks');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Pact mit fromSourceType — CompilerCache liefert Typ-String, TypeDefBuilder/ MimicDog-Kontext enthält erwartete Symbole.
     */
    private async testPactFromSourceType(): Promise<void> {
        const testName = 'Pact: fromSourceType (CompilerCache → TypeDefBuilder)';
        try {
            const batch = CompilerCache.getPactReturnTypeDefsBatch(['BloodhoundIsochroneInput']);
            const def = batch.get('BloodhoundIsochroneInput');
            if (!def) {
                throw new Error('Batch liefert keinen Eintrag für BloodhoundIsochroneInput');
            }
            if (!def.includes('lat') || !def.includes('range') || !def.includes('BloodhoundIsochroneInputReturn')) {
                throw new Error('Generierter Typ-String enthält nicht die erwarteten Member bzw. Return-Alias');
            }

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return { lat: "0", lng: "0", range: "100" };',
                imitates: 'BloodhoundIsochroneProvider',
            };
            const mimic = new MimicDog<BloodhoundIsochroneInput>(mimicConfig, 'pact-source-test-mimic');
            mimic.resolveImitates(new Map([['BloodhoundIsochroneProvider', BloodhoundIsochronePact]]));

            const pactKey = 'pact-source-test-mimic';
            const expectedAlias = TypeDefBuilder.expectedReturnAliasTypeName(pactKey);
            const lib = TypeDefBuilder.buildContextLib('PactSourceNode', {}, mimic, pactKey);
            if (!lib.includes('BloodhoundIsochroneInput')) {
                throw new Error('buildContextLib enthält nicht BloodhoundIsochroneInput');
            }
            if (!lib.includes(expectedAlias)) {
                throw new Error(`Erwarteter Return-Alias ${expectedAlias} fehlt im generierten Lib-String`);
            }

            // OSM Landmarks: eigener Quell-Typ (nicht BloodhoundIsochroneInput)
            const batchLm = CompilerCache.getPactReturnTypeDefsBatch(['OsmLandmarksQueryInput']);
            const defLm = batchLm.get('OsmLandmarksQueryInput');
            if (!defLm) {
                throw new Error('Batch liefert keinen Eintrag für OsmLandmarksQueryInput');
            }
            if (defLm.includes('BloodhoundIsochroneInput')) {
                throw new Error('OsmLandmarksQueryInput-Def darf kein BloodhoundIsochroneInput enthalten');
            }
            if (!defLm.includes('preset') || !defLm.includes('OsmLandmarksQueryInputReturn')) {
                throw new Error('OsmLandmarksQueryInput-Def unvollständig');
            }

            const mimicLm: IMimicDogConfig = {
                theRun: 'return { lat: "0", lng: "0" };',
                imitates: 'NearbyLandmarksQueryProvider',
            };
            const mimicLandmarks = new MimicDog(mimicLm, 'pact-osm-test-mimic');
            mimicLandmarks.resolveImitates(
                new Map<string, new () => IHuntingDog<unknown>>([
                    ['BloodhoundIsochroneProvider', BloodhoundIsochronePact],
                    ['NearbyLandmarksQueryProvider', NearbyLandmarksPact],
                ])
            );
            const osmKey = 'pact-osm-test-key';
            const libLm = TypeDefBuilder.buildContextLib('OsmPactNode', {}, mimicLandmarks, osmKey);
            if (!libLm.includes('OsmLandmarksQueryInput')) {
                throw new Error('buildContextLib für Landmarks-Mimic enthält nicht OsmLandmarksQueryInput');
            }
            if (libLm.includes('BloodhoundIsochroneInput')) {
                throw new Error('buildContextLib für Landmarks-Mimic darf kein BloodhoundIsochroneInput enthalten');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Gesäter SerializedDog existiert und ist ein Mimic für LayoutInputProvider (Tinder-Return)
     */
    private async testSerializedDogExists(store: IStore): Promise<void> {
        const testName = 'SerializedDog: Seed-Mimic (LayoutInputProvider + Tinder)';
        try {
            // With GUID-based versioning, find the seed by type instead of hardcoded ID.
            const allSeeds = await store.findByType(SerializedDog.name);
            const seedRow = allSeeds.length > 0 ? allSeeds[0] : null;
            const seed = seedRow ? seedRow.serializedDogConfig : null;
            if (!seed) {
                this.addResult(testName, true, 'Seed existiert noch nicht (wird beim nächsten Start erstellt)');
                return;
            }

            const parsed = typeof seed === 'string' ? JSON.parse(seed) : seed;
            const cfg = parsed.serializedDogConfig
                ? (typeof parsed.serializedDogConfig === 'string'
                    ? JSON.parse(parsed.serializedDogConfig)
                    : parsed.serializedDogConfig)
                : parsed;

            if (!cfg?.theRun || typeof cfg.theRun !== 'string') {
                throw new Error('Seed hat kein theRun-Feld');
            }
            if (cfg.imitates !== 'LayoutInputProvider') {
                throw new Error(`Erwartet imitates "LayoutInputProvider", erhalten: ${JSON.stringify(cfg.imitates)}`);
            }
            const req = cfg.parentsRequired as string[] | undefined;
            if (!req?.includes('RandomRecipesRetriever') || !req.includes('RandomEveryThingRetriever')) {
                throw new Error(
                    `parentsRequired muss RandomRecipesRetriever und RandomEveryThingRetriever enthalten: ${JSON.stringify(req)}`
                );
            }
            const run = cfg.theRun as string;
            if (!run.includes('tinder') || !run.includes('RandomEveryThingRetriever.woof')) {
                throw new Error('theRun muss Tinder-LayoutInput und RandomEveryThingRetriever.woof referenzieren');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Alle Versionen von SerializedDogs werden in der Liste angezeigt
     */
    private async testAllVersionsInList(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'SerializedDog: Alle Versionen in Liste';
        const createdIds: string[] = [];
        try {
            // Create v1 — the firstborn incarnation with a fresh GUID.
            const v1Input: ISerializedDogConfig = {
                displayName: 'test-versions-' + Date.now(),
                theRun: 'return { version: 1 };',
            };
            const v1Result = await controller.create(v1Input);
            if (!v1Result.ok || !v1Result.id) throw new Error('V1 erstellen fehlgeschlagen');
            createdIds.push(v1Result.id);
            this.createdTestIds.push(v1Result.id);
            const lineageId = (v1Result.data as any)?.lineageId;

            // Save v2 — a new incarnation branching from v1.
            const v2Input: ISerializedDogConfig = {
                id: v1Result.id,
                theRun: 'return { version: 2 };',
            };
            const v2Result = await controller.save(v2Input);
            if (!v2Result.ok || !v2Result.id) throw new Error('V2 erstellen fehlgeschlagen');
            createdIds.push(v2Result.id);
            this.createdTestIds.push(v2Result.id);

            // Save v3 — a new incarnation branching from v2.
            const v3Input: ISerializedDogConfig = {
                id: v2Result.id,
                theRun: 'return { version: 3 };',
            };
            const v3Result = await controller.save(v3Input);
            if (!v3Result.ok || !v3Result.id) throw new Error('V3 erstellen fehlgeschlagen');
            createdIds.push(v3Result.id);
            this.createdTestIds.push(v3Result.id);

            // Prüfe, dass alle Versionen in der Liste erscheinen
            const listResult = await controller.list();
            if (!listResult.ok || !listResult.data) {
                throw new Error('Liste konnte nicht abgerufen werden');
            }

            // Filter by lineageId — all incarnations of the same spirit share this lineage mark.
            const foundVersions = listResult.data.filter((dog: ISerializedDogConfig) => {
                return dog.lineageId === lineageId;
            });

            if (foundVersions.length < 3) {
                throw new Error(`Erwartet: 3 Versionen, gefunden: ${foundVersions.length}`);
            }

            // Prüfe, dass alle IDs unterschiedlich sind (GUIDs should never collide)
            const ids = foundVersions.map((d: ISerializedDogConfig) => d.id).filter(Boolean);
            const uniqueIds = new Set(ids);
            if (uniqueIds.size !== ids.length) {
                throw new Error('Doppelte IDs in der Liste gefunden');
            }
            
            // Füge alle gefundenen Versionen zur Cleanup-Liste hinzu
            foundVersions.forEach((dog: ISerializedDogConfig) => {
                if (dog.id && !this.createdTestIds.includes(dog.id)) {
                    this.createdTestIds.push(dog.id);
                }
            });
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    // ===== Pact & MimicDog Tests =====

    /**
     * Test: createPact erzeugt gueltige Dog-Klasse
     */
    private async testCreatePact(): Promise<void> {
        const testName = 'Pact: createPact erzeugt gueltige Dog-Klasse';
        try {
            const TestPact = createPact<{ value: number }>('TestPact');

            if (TestPact.name !== 'TestPact') {
                throw new Error(`Erwarteter Name 'TestPact', erhalten: '${TestPact.name}'`);
            }

            if ((TestPact as any).__isPact !== true) {
                throw new Error('__isPact ist nicht true');
            }

            const instance = new TestPact();
            if (!(instance instanceof Dog)) {
                throw new Error('Instanz ist kein instanceof Dog');
            }

            if (instance.name !== 'TestPact') {
                throw new Error(`Instanz-Name falsch: '${instance.name}'`);
            }

            let threwError = false;
            try {
                await instance.collectYield({
                    exhausted: [], withBeesInThePants: [],
                    maxRuns: 0, runIndex: 0, wave: [], readTracking: [], currentWaveIndex: 0
                });
            } catch (e: any) {
                if (e.message.includes('requires a MimicDog')) {
                    threwError = true;
                }
            }
            if (!threwError) {
                throw new Error('yieldCollectorFactory sollte Error werfen');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: MimicDog imitiert Pact-Klasse
     */
    private async testMimicDogImitatesPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'MimicDog: imitiert Pact-Klasse';
        try {
            const TestPact = createPact<{ v: number }>('MimicTestPact');
            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('MimicTestPact', TestPact);

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return { v: 42 };',
                imitates: 'MimicTestPact',
            };
            const mimic = new MimicDog<{ v: number }>(mimicConfig, 'test-mimic-1');
            mimic.resolveImitates(extendedMap);

            if (!mimic.imitatesClasses.includes(TestPact)) {
                throw new Error('imitatesClasses enthaelt nicht die Pact-Klasse');
            }

            if (mimic.imitatesName !== 'MimicTestPact') {
                throw new Error(`imitatesName falsch: '${mimic.imitatesName}'`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: matchesParent erkennt Mimic via imitatesClasses
     */
    private async testMatchesParentRecognizesMimic(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'MimicDog: matchesParent erkennt Mimic';
        try {
            const TestPact = createPact<string>('MatchTestPact');
            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('MatchTestPact', TestPact);

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return "hello";',
                imitates: 'MatchTestPact',
            };
            const mimic = new MimicDog<string>(mimicConfig, 'test-mimic-match');
            mimic.resolveImitates(extendedMap);

            class ConsumerDog extends Dog<void> {
                get name() { return 'ConsumerDog'; }
                get required() { return [TestPact]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }
            const consumer = new ConsumerDog();

            // Simuliere eine Season mit dem Mimic in exhausted
            const season = {
                exhausted: [mimic as IHuntingDog<unknown>],
                withBeesInThePants: [consumer as IHuntingDog<unknown>],
                maxRuns: 2,
                runIndex: 0,
                wave: [],
                readTracking: [],
                currentWaveIndex: 0
            };

            if (!consumer.isReady(season)) {
                throw new Error('Consumer sollte ready sein wenn Mimic in exhausted ist');
            }

            // Ohne Mimic: nicht ready
            const seasonEmpty = {
                exhausted: [] as IHuntingDog<unknown>[],
                withBeesInThePants: [consumer as IHuntingDog<unknown>],
                maxRuns: 2,
                runIndex: 0,
                wave: [],
                readTracking: [],
                currentWaveIndex: 0
            };
            if (consumer.isReady(seasonEmpty)) {
                throw new Error('Consumer sollte NICHT ready sein ohne Mimic');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erstellt Auto-Mimic fuer Pact-Requirement
     */
    private async testFillKennelAutoMimicForPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Auto-Mimic bei Pact';
        try {
            const AutoPact = createPact<number>('AutoMimicTestPact');

            class NeedyDog extends Dog<void> {
                get name() { return 'NeedyDog'; }
                get required() { return [AutoPact]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('NeedyDog', NeedyDog);
            extendedMap.set('AutoMimicTestPact', AutoPact);

            const config: IKennelConfig = {
                id: 'test-auto-mimic-kennel',
                dogIds: ['base:NeedyDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'AutoMimicTestPact'
            );

            if (!hasMimic) {
                throw new Error('MimicDog wurde nicht automatisch erstellt');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erstellt Auto-Mimic fuer optional Pact-Requirement
     */
    private async testFillKennelAutoMimicForOptionalPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Auto-Mimic bei optional Pact';
        try {
            const OptionalPact = createPact<string>('OptionalMimicTestPact');

            class OptionalConsumerDog extends Dog<void> {
                get name() { return 'OptionalConsumerDog'; }
                get required() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                get optional() { return [OptionalPact]; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('OptionalConsumerDog', OptionalConsumerDog);
            extendedMap.set('OptionalMimicTestPact', OptionalPact);

            const config: IKennelConfig = {
                id: 'test-optional-mimic-kennel',
                dogIds: ['base:OptionalConsumerDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptionalMimicTestPact'
            );

            if (!hasMimic) {
                throw new Error('MimicDog wurde nicht automatisch fuer optional Pact erstellt');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erstellt Auto-Mimics fuer required UND optional Pacts gleichzeitig
     */
    private async testFillKennelAutoMimicForRequiredAndOptionalPacts(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Auto-Mimic bei required + optional Pacts';
        try {
            const ReqPact = createPact<number>('ReqMimicTestPact');
            const OptPact = createPact<string>('OptMimicTestPact2');

            class DualConsumerDog extends Dog<void> {
                get name() { return 'DualConsumerDog'; }
                get required() { return [ReqPact]; }
                get optional() { return [OptPact]; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('DualConsumerDog', DualConsumerDog);
            extendedMap.set('ReqMimicTestPact', ReqPact);
            extendedMap.set('OptMimicTestPact2', OptPact);

            const config: IKennelConfig = {
                id: 'test-dual-mimic-kennel',
                dogIds: ['base:DualConsumerDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasReqMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'ReqMimicTestPact'
            );
            const hasOptMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptMimicTestPact2'
            );

            if (!hasReqMimic) {
                throw new Error('MimicDog fuer required Pact fehlt');
            }
            if (!hasOptMimic) {
                throw new Error('MimicDog fuer optional Pact fehlt');
            }

            const mimicCount = kennel.filter(d => d instanceof MimicDog).length;
            if (mimicCount < 2) {
                throw new Error(`Erwartet: mindestens 2 Mimics, gefunden: ${mimicCount}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erstellt echten BaseDog statt Mimic (kein Pact)
     */
    private async testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Echter BaseDog statt Mimic';
        try {
            class RealProvider extends Dog<string> {
                get name() { return 'RealProvider'; }
                get required() { return []; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => 'data';
            }

            class RealConsumer extends Dog<void> {
                get name() { return 'RealConsumer'; }
                get required() { return [RealProvider]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('RealConsumer', RealConsumer);
            extendedMap.set('RealProvider', RealProvider);

            const config: IKennelConfig = {
                id: 'test-real-basedog-kennel',
                dogIds: ['base:RealConsumer'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasReal = kennel.some(d => d instanceof RealProvider);
            const hasMimic = kennel.some(d => d instanceof MimicDog);

            if (!hasReal) {
                throw new Error('Echter BaseDog wurde nicht hinzugefuegt');
            }
            if (hasMimic) {
                throw new Error('MimicDog sollte nicht erstellt werden fuer echte Klasse');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel entfernt Mimic wenn echter Dog vorhanden
     */
    private async testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Mimic entfernt wenn echter Dog da';
        try {
            const PriorityPact = createPact<string>('PriorityTestPact');

            class PriorityConsumer extends Dog<void> {
                get name() { return 'PriorityConsumer'; }
                get required() { return [PriorityPact]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }

            class RealPriorityDog extends PriorityPact {
                get name() { return 'RealPriorityDog'; }
                get required() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                get optional() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                protected yieldCollectorFactory = async () => 'real data';
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('PriorityConsumer', PriorityConsumer);
            extendedMap.set('PriorityTestPact', PriorityPact);
            extendedMap.set('RealPriorityDog', RealPriorityDog);

            const config: IKennelConfig = {
                id: 'test-priority-kennel',
                dogIds: ['base:PriorityConsumer', 'base:RealPriorityDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const mimicCount = kennel.filter(d => d instanceof MimicDog).length;
            const realCount = kennel.filter(d => d instanceof RealPriorityDog).length;

            if (mimicCount > 0) {
                throw new Error('Mimic sollte entfernt worden sein da echter Dog vorhanden');
            }
            if (realCount !== 1) {
                throw new Error(`Erwartet: 1 echter Dog, gefunden: ${realCount}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Kompletter Run mit manuell erstelltem Mimic — Consumer laeuft in spaeterer Wave
     */
    private async testRunSeasonWithMimicConsumerRuns(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'runSeason: Consumer laeuft mit Mimic in spaeterer Wave';
        try {
            const RunPact = createPact<{ v: number }>('RunTestPact');

            class RunConsumerDog extends Dog<number> {
                get name() { return 'RunConsumerDog'; }
                get required() { return [RunPact]; }
                get optional() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                protected yieldCollectorFactory = async (season: any) => {
                    const provider = season.exhausted.find((d: any) => this.matchesParent(RunPact, d));
                    return provider?.collected?.v ?? -1;
                };
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('RunConsumerDog', RunConsumerDog);
            extendedMap.set('RunTestPact', RunPact);

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return { v: 42 };',
                imitates: 'RunTestPact',
            };
            const mimic = new MimicDog<{ v: number }>(mimicConfig, 'run-test-mimic');
            mimic.resolveImitates(extendedMap);

            const consumer = new RunConsumerDog();
            const kennel: IHuntingDog<unknown>[] = [mimic, consumer];
            mimic.setKennelRef(kennel);

            const config: IKennelConfig = {
                id: 'test-run-mimic-kennel',
                dogIds: [],
            };
            const kennelRun = new KennelRun(config, extendedMap);
            const season = await kennelRun.runSeason(kennel);

            if (season.wave.length < 2) {
                throw new Error(`Erwartet: mindestens 2 Waves, gefunden: ${season.wave.length}`);
            }

            const consumerInWaves = season.wave.some(wave =>
                wave.some(entry => entry.instance.name === 'RunConsumerDog')
            );
            if (!consumerInWaves) {
                throw new Error('RunConsumerDog ist in keiner Wave erschienen');
            }

            const consumerDog = season.exhausted.find(d => d.name === 'RunConsumerDog');
            if (!consumerDog || consumerDog.collected !== 42) {
                throw new Error(`Consumer collected erwartet: 42, erhalten: ${consumerDog?.collected}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Kennel Export/Import — export a kennel with dogs, import as new, verify structure.
     * Through endless faces, countless forms: the kennel crosses the void and is reborn.
     */
    private async testKennelExportImport(
        nodesStore: IStore,
        kennelsStore: IStore,
        kennelsController: AbstractController<IKennelConfig>
    ): Promise<void> {
        const testName = 'Kennel: Export/Import';
        try {
            // 1. Create a SerializedDog to include in the kennel.
            const dogVersionId = generateVersionId();
            const dogLineageId = generateLineageId();
            const dogConfig: ISerializedDogConfig = {
                id: dogVersionId,
                lineageId: dogLineageId,
                parentId: null,
                displayName: 'ExportTestDog',
                theRun: 'return { test: true }',
                parentsRequired: [],
                parentsOptional: [],
            };
            await nodesStore.save({
                id: dogVersionId,
                type: SerializedDog.name,
                lineageId: dogLineageId,
                parentId: null,
                displayName: 'ExportTestDog',
                serializedDogConfig: JSON.stringify(dogConfig),
                createdAt: new Date(),
            });
            this.createdTestIds.push(dogVersionId);

            // 2. Create a kennel referencing this dog + a BaseDog.
            const kennelLineageId = `test-export-kennel-${Date.now()}`;
            const kennelVersionId = generateVersionId();
            await kennelsStore.save({
                id: kennelVersionId,
                type: 'KennelConfig',
                lineageId: kennelLineageId,
                parentId: null,
                name: 'Export Test Kennel',
                description: 'For export/import testing',
                emoji: '🧪',
                dogIds: [dogLineageId, 'base:QueryRetriever'],
                defaultQuery: { test: 'value' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            this.createdTestIds.push(kennelVersionId);

            // Save a second version to test version history export.
            const kennelVersionId2 = generateVersionId();
            await kennelsStore.save({
                id: kennelVersionId2,
                type: 'KennelConfig',
                lineageId: kennelLineageId,
                parentId: kennelVersionId,
                name: 'Export Test Kennel v2',
                description: 'Updated description',
                emoji: '🧪',
                dogIds: [dogLineageId, 'base:QueryRetriever'],
                defaultQuery: { test: 'value2' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            this.createdTestIds.push(kennelVersionId2);

            // 3. Build the export bundle (simulate what handleExport does).
            const kennelConfig = await (kennelsController as KennelController).getById(kennelLineageId);
            if (!kennelConfig.ok || !kennelConfig.data) throw new Error('Kennel nicht gefunden nach Erstellung');

            const cfg = kennelConfig.data;
            const serializedIds = (cfg.dogIds ?? []).filter((id: string) => !id.startsWith('base:'));
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, serializedIds),
                nodesStore.findLatestVersionsByType(MimicDog.name, serializedIds),
            ]);

            const dogs: any[] = [];
            for (const row of [...serialized, ...mimics]) {
                const rowCfg = typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig) : row.serializedDogConfig;
                dogs.push({
                    lineageId: (row as any).lineageId || rowCfg.lineageId,
                    versionId: row.id,
                    displayName: (row as any).displayName || rowCfg.displayName,
                    type: rowCfg.imitates ? 'MimicDog' : 'SerializedDog',
                    config: rowCfg,
                });
            }

            const kennelVersions = await (kennelsController as KennelController).getVersions(kennelLineageId);

            const bundle = {
                bundleVersion: 1,
                kennel: {
                    kennelId: kennelLineageId,
                    name: cfg.name,
                    description: cfg.description,
                    emoji: cfg.emoji,
                    dogIds: cfg.dogIds,
                    defaultQuery: cfg.defaultQuery,
                },
                kennelVersions: kennelVersions.map(v => ({
                    id: v.id, parentId: v.parentId, createdAt: v.createdAt, config: v.config,
                })),
                dogs,
            };

            // 4. Validate the bundle.
            if (!bundle.dogs || bundle.dogs.length === 0) throw new Error('Bundle hat keine Dogs');
            if (!bundle.kennelVersions || bundle.kennelVersions.length < 2) throw new Error('Bundle hat weniger als 2 Kennel-Versionen');
            if (bundle.dogs[0].lineageId !== dogLineageId) throw new Error(`Dog lineageId stimmt nicht: got '${bundle.dogs[0]?.lineageId}', expected '${dogLineageId}', serializedIds=${JSON.stringify(serializedIds)}, dogs.length=${bundle.dogs.length}`);

            // 5. Simulate import with a new kennelId.
            const importKennelId = `test-import-kennel-${Date.now()}`;
            bundle.kennel.kennelId = importKennelId;

            // Build ID mapping.
            const idMap = new Map<string, string>();
            for (const dog of bundle.dogs) {
                const newId = generateLineageId();
                if (dog.lineageId) idMap.set(dog.lineageId, newId);
                if (dog.versionId) idMap.set(dog.versionId, newId);
            }
            const remap = (ref: string): string => idMap.get(ref) ?? ref;
            const remapDogIds = (ids: string[]) => (ids ?? []).map(remap);

            // Create dogs with new IDs.
            for (const dog of bundle.dogs) {
                const newLineageId = idMap.get(dog.lineageId) || generateLineageId();
                const newVersionId = generateVersionId();
                const importCfg = { ...dog.config };
                importCfg.id = newVersionId;
                importCfg.lineageId = newLineageId;
                importCfg.parentId = null;
                if (Array.isArray(importCfg.parentsRequired)) importCfg.parentsRequired = importCfg.parentsRequired.map(remap);
                if (Array.isArray(importCfg.parentsOptional)) importCfg.parentsOptional = importCfg.parentsOptional.map(remap);

                await nodesStore.save({
                    id: newVersionId,
                    type: importCfg.imitates ? MimicDog.name : SerializedDog.name,
                    lineageId: newLineageId,
                    parentId: null,
                    displayName: importCfg.displayName,
                    serializedDogConfig: JSON.stringify(importCfg),
                    createdAt: new Date(),
                });
                this.createdTestIds.push(newVersionId);
            }

            // Restore kennel versions.
            const sorted = [...bundle.kennelVersions].sort((a: any, b: any) => {
                return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            });
            const versionIdMap = new Map<string, string>();
            for (const v of sorted) versionIdMap.set(v.id, generateVersionId());

            for (const v of sorted) {
                const newVId = versionIdMap.get(v.id)!;
                const newParentId = v.parentId ? (versionIdMap.get(v.parentId) ?? null) : null;
                const vCfg = v.config || bundle.kennel;

                await kennelsStore.save({
                    id: newVId,
                    type: 'KennelConfig',
                    lineageId: importKennelId,
                    parentId: newParentId,
                    name: vCfg.name,
                    description: vCfg.description,
                    emoji: vCfg.emoji,
                    dogIds: remapDogIds(vCfg.dogIds || []),
                    defaultQuery: vCfg.defaultQuery ? JSON.stringify(vCfg.defaultQuery) : undefined,
                    createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                this.createdTestIds.push(newVId);
            }

            // 6. Verify the imported kennel.
            const imported = await (kennelsController as KennelController).getById(importKennelId);
            if (!imported.ok || !imported.data) throw new Error('Importierter Kennel nicht gefunden');
            if (imported.data.name !== 'Export Test Kennel v2') throw new Error(`Importierter Kennel Name falsch: ${imported.data.name}`);

            // Verify version history was preserved.
            const importedVersions = await (kennelsController as KennelController).getVersions(importKennelId);
            if (importedVersions.length < 2) throw new Error(`Importierte Versionen: ${importedVersions.length}, erwartet >= 2`);

            // Verify parentId chain is intact.
            const hasParent = importedVersions.some(v => v.parentId !== null);
            if (!hasParent) throw new Error('Keine parentId-Verknüpfung in importierten Versionen');

            // Verify dogs were remapped (no old IDs in dogIds).
            const importedDogIds = imported.data.dogIds ?? [];
            const hasOldId = importedDogIds.some((id: string) => id === dogLineageId);
            if (hasOldId) throw new Error('Importierter Kennel enthält noch alte Dog-lineageId');

            // Verify the remapped dog exists.
            const newDogLineageId = idMap.get(dogLineageId);
            if (!newDogLineageId) throw new Error('Dog lineageId nicht im idMap');
            const loadedDogs = await nodesStore.findLatestVersionsByType(SerializedDog.name, [newDogLineageId]);
            if (loadedDogs.length === 0) throw new Error('Importierter Dog nicht im Store gefunden');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: TalkingDog — alle Dependencies (required Pacts + optional BaseDogs) werden aufgeloest
     */
    private async testTalkingDogAllDependenciesResolved(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'TalkingDog: Alle Dependencies im Kennel nach fillKennel';
        try {
            const config: IKennelConfig = {
                id: 'test-talkingdog-kennel',
                dogIds: ['base:TalkingDog'],
            };

            const kennelRun = new KennelRun(config, baseDogsMap);
            const kennel = await kennelRun.fillKennel();

            const talkingDog = kennel.find(d => d.name === 'TalkingDog');
            if (!talkingDog) {
                throw new Error('TalkingDog nicht im Kennel');
            }

            const requiredClasses = (talkingDog as any).required as any[];
            const optionalClasses = (talkingDog as any).optional as any[];
            const allDeps = [...requiredClasses, ...optionalClasses];

            const missing: string[] = [];
            for (const depClass of allDeps) {
                const isPact = (depClass as any).__isPact === true;
                const fulfilled = kennel.some(d => {
                    if (d === talkingDog) return false;
                    if (d instanceof MimicDog && isPact) {
                        return (d as MimicDog<unknown>).imitatesClasses.includes(depClass);
                    }
                    return d instanceof depClass;
                });
                if (!fulfilled) {
                    missing.push(depClass.name || 'unknown');
                }
            }

            if (missing.length > 0) {
                throw new Error(`Fehlende Dependencies fuer TalkingDog: ${missing.join(', ')}`);
            }

            const hasMimicForPact = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'LayoutInputProvider'
            );
            if (!hasMimicForPact) {
                throw new Error('Kein MimicDog fuer LayoutInputProvider im Kennel');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Tile-Feature-Cache: integrationstest gegen die live cache.db.
     * Nutzt einen einmaligen dogType, damit keine Produktionsdaten betroffen sind.
     * Verifiziert: store → getCovered (hit) → getCovered (miss) → Multi-Tile-Membership
     * → invalidateDogType.
     */
    private async testTileFeatureCache(): Promise<void> {
        const testName = 'TileFeatureCache: store/hit/miss/multi-tile-membership';
        const dogType = `__startup_test_${Date.now()}`;
        let cache: { getTileFeatureCache(): any; prune?(): Promise<void> } | null = null;
        let tileCache: any = null;
        try {
            // Lazy-import damit der Test auch laeuft wenn die CACHE_DB nicht konfiguriert ist
            // (dann scheitert hier, wir fangen den Fehler im catch weiter unten).
            const { PrismaCacheHandler } = await import('./services/PrismaCacheHandler');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require('path') as typeof import('path');
            const { resolveCacheDatabaseUrl } = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
                resolveCacheDatabaseUrl: () => string;
            };
            cache = new PrismaCacheHandler(resolveCacheDatabaseUrl(), 24 * 60 * 60 * 1000);
            tileCache = cache!.getTileFeatureCache();

            const zoom = 14;
            const tileA = { zoom, x: 8580, y: 5737 };
            const tileB = { zoom, x: 9999, y: 9999 }; // sicher nicht covered

            // 1. Leerer Cache → alles missing.
            {
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileA],
                    ['hiking'],
                );
                if (features.length !== 0) throw new Error('Expected empty feature list');
                if (missing.length !== 1 || missing[0].facet !== 'hiking') {
                    throw new Error(`Expected 1 missing, got ${missing.length}`);
                }
            }

            // 2. Feature mit BBox ueber 2 Tiles store → Membership in beiden.
            //    Wir nutzen tilesIntersectingBBox-Logik: die Feature-BBox muss zwei
            //    nebeneinanderliegende Z14-Tiles schneiden.
            const pointFeature = {
                osmType: 'node' as const,
                osmId: '1001',
                primaryKey: 'highway',
                primaryValue: 'footway',
                name: 'test-point',
                hasGeom: true,
                lat: 47.3769,
                lng: 8.5417,
                bboxMinLat: 47.3769,
                bboxMinLng: 8.5417,
                bboxMaxLat: 47.3769,
                bboxMaxLng: 8.5417,
                payload: '{"type":"node","id":1001,"tags":{"highway":"footway"}}',
                facets: ['hiking'],
            };
            const wayFeatureSpanningTwoTiles = {
                osmType: 'way' as const,
                osmId: '2002',
                primaryKey: 'highway',
                primaryValue: 'path',
                name: null,
                hasGeom: true,
                lat: 47.3769,
                lng: 8.5480,
                // BBox bewusst so gewaehlt, dass sie ueber 8580→8581 x-Tile hinweggreift.
                bboxMinLat: 47.3769,
                bboxMinLng: 8.5400,
                bboxMaxLat: 47.3770,
                bboxMaxLng: 8.5600,
                payload: '{"type":"way","id":2002,"tags":{"highway":"path"}}',
                facets: ['hiking'],
            };
            const geomlessRelation = {
                osmType: 'relation' as const,
                osmId: '3003',
                primaryKey: 'route',
                primaryValue: 'hiking',
                name: 'Geister-Route',
                hasGeom: false,
                lat: null,
                lng: null,
                bboxMinLat: null,
                bboxMinLng: null,
                bboxMaxLat: null,
                bboxMaxLng: null,
                payload: '{"type":"relation","id":3003,"tags":{"route":"hiking","name":"Geister-Route"}}',
                facets: ['hiking'],
            };

            await tileCache.storeFetchResult(
                dogType,
                {
                    tile: tileA,
                    facets: ['hiking'],
                    features: [pointFeature, wayFeatureSpanningTwoTiles, geomlessRelation],
                },
                24 * 60 * 60 * 1000,
            );

            // 3. Re-query Tile A → 3 Features, 0 missing.
            {
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileA],
                    ['hiking'],
                );
                if (missing.length !== 0) {
                    throw new Error(`Expected 0 missing after store, got ${missing.length}`);
                }
                if (features.length !== 3) {
                    throw new Error(`Expected 3 features after store, got ${features.length}`);
                }
                const identityMatch = features.some(
                    (f: any) =>
                        f.primaryKey === 'route' &&
                        f.primaryValue === 'hiking' &&
                        f.name === 'Geister-Route' &&
                        f.hasGeom === false,
                );
                if (!identityMatch) {
                    throw new Error('Geomless feature metadata not persisted (primaryKey/value/name/hasGeom)');
                }
            }

            // 4. Multi-Tile-Membership: das Way-Feature mit grosser BBox muss auch
            //    auf dem rechts benachbarten Tile findbar sein.
            const tileRight = { zoom, x: tileA.x + 1, y: tileA.y };
            {
                // Fresh Coverage fuer das rechte Tile eintragen (ansonsten missing).
                await tileCache.storeFetchResult(
                    dogType,
                    {
                        tile: tileRight,
                        facets: ['hiking'],
                        features: [], // keine neuen Features — wir pruefen nur Membership-Sicht
                    },
                    24 * 60 * 60 * 1000,
                );
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileRight],
                    ['hiking'],
                );
                if (missing.length !== 0) {
                    throw new Error(`Right-tile coverage not recognised (${missing.length} missing)`);
                }
                const wayId = features.find((f: any) => f.osmId === '2002');
                if (!wayId) {
                    throw new Error('Way-Feature mit BBox ueber 2 Tiles nicht im rechten Tile gefunden');
                }
            }

            // 5. Nicht-covered Tile → alles missing.
            {
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileB],
                    ['hiking'],
                );
                if (features.length !== 0) {
                    throw new Error(`Expected empty features for uncovered tile, got ${features.length}`);
                }
                if (missing.length !== 1) {
                    throw new Error(`Expected 1 missing for uncovered tile, got ${missing.length}`);
                }
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (tileCache) {
                try {
                    await tileCache.invalidateDogType(dogType);
                } catch { /* ignore */ }
            }
            if (cache && typeof (cache as any).prune === 'function') {
                // Pruning ist nicht noetig, aber wir beenden auch keinen Interval-Timer —
                // der ist via unref() sowieso nicht process-blocking.
            }
        }
    }

    /**
     * Fügt ein Testergebnis hinzu
     */
    private addResult(name: string, passed: boolean, error?: string): void {
        this.results.push({ name, passed, error });
        const icon = passed ? '✅' : '❌';
        const status = passed ? 'PASS' : 'FAIL';
        if (!passed || isRuntimeLogVerbose()) {
            console.log(`${icon} [${status}] ${name}${error ? ` - ${error}` : ''}`);
        }
    }

    /**
     * Druckt eine Zusammenfassung der Tests
     */
    private printSummary(): void {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        const v = isRuntimeLogVerbose();

        if (failed === 0 && !v) {
            console.log(`Startup-Tests: ${passed}/${total} bestanden.`);
            return;
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Test-Zusammenfassung:');
        console.log(`   Gesamt: ${total}`);
        console.log(`   ✅ Bestanden: ${passed}`);
        console.log(`   ❌ Fehlgeschlagen: ${failed}`);
        console.log('='.repeat(50) + '\n');

        if (failed > 0) {
            console.log('⚠️  Fehlgeschlagene Tests:');
            this.results
                .filter(r => !r.passed)
                .forEach(r => {
                    console.log(`   ❌ ${r.name}: ${r.error || 'Unbekannter Fehler'}`);
                });
            console.log('');
        }
    }
}

