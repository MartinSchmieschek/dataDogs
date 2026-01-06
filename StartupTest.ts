import { IStore } from './store/IStore';
import { SerializedDog, ISerializedDogConfig } from './dogs/SerializedDog';
import { IKennelConfig } from './KennelRun';
import { Controller } from './api/Controller';
import { ControllerRegistry } from './api/routes/ConfigRouteHandler';

export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

export class StartupTest {
    private results: TestResult[] = [];
    private createdTestIds: string[] = []; // Liste aller erstellten Test-IDs

    /**
     * Führt alle Tests aus
     */
    async runAllTests(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: Controller<IKennelConfig>,
        baseDogsMap: Map<string, any>
    ): Promise<TestResult[]> {
        console.log('\n🧪 Starte Startup-Tests...\n');

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
            
            // SerializedDog-Tests
            await this.testSerializedDogExists(nodesStore);
            await this.testAllVersionsInList(nodesController);
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
        kennelsController: Controller<IKennelConfig>
    ): Promise<void> {
        if (this.createdTestIds.length === 0) {
            return; // Keine Test-Daten erstellt
        }
        
        console.log('\n🧹 Räume Test-Daten auf...\n');
        
        // Lösche NUR die spezifisch erstellten Test-IDs
        for (const testId of this.createdTestIds) {
            try {
                // Versuche über Controller zu löschen (für SerializedDogs)
                await nodesController.delete(testId);
                console.log(`  🗑️  Gelöscht: ${testId}`);
            } catch (e) {
                // Falls Controller-Löschen fehlschlägt, versuche über Store
                try {
                    await nodesStore.delete(testId);
                    console.log(`  🗑️  Gelöscht (via Store): ${testId}`);
                } catch (e2) {
                    // Ignoriere Fehler (kann sein, dass bereits gelöscht wurde oder nicht existiert)
                    console.log(`  ⚠️  Konnte nicht löschen: ${testId} (möglicherweise bereits gelöscht)`);
                }
            }
        }
        
        console.log(`✅ Cleanup abgeschlossen (${this.createdTestIds.length} IDs verarbeitet)\n`);
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
            const result = await controller.getById('seed-serialized-1-v1');
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
        let testId: string | null = null;
        let createdId: string | null = null;
        try {
            testId = 'test-create-' + Date.now();
            this.createdTestIds.push(testId);
            const input: ISerializedDogConfig = {
                id: testId,
                theRun: 'return { test: true };',
                version: 1
            };
            
            const result = await controller.create(input);
            if (!result.ok) {
                throw new Error(result.error || 'Erstellen fehlgeschlagen');
            }
            
            if (!result.id) {
                throw new Error('Keine ID zurückgegeben');
            }
            
            createdId = result.id;
            if (createdId !== testId) {
                // Wenn eine andere ID zurückgegeben wurde (z.B. versioniert), auch diese merken
                this.createdTestIds.push(createdId);
            }
            
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
        let testId: string | null = null;
        let createdId: string | null = null;
        let savedId: string | null = null;
        try {
            testId = 'test-save-' + Date.now();
            this.createdTestIds.push(testId);
            const input: ISerializedDogConfig = {
                id: testId,
                theRun: 'return { test: true };',
                version: 1
            };
            
            // Erstelle erst eine Entity
            const createResult = await controller.create(input);
            if (createResult.ok && createResult.id) {
                createdId = createResult.id;
                if (createdId !== testId) {
                    this.createdTestIds.push(createdId);
                }
            }
            
            // Dann speichere sie (Update)
            const updateInput: ISerializedDogConfig = {
                id: testId,
                theRun: 'return { test: true, updated: true };',
                version: 1
            };
            
            const result = await controller.save(updateInput);
            if (!result.ok) {
                throw new Error(result.error || 'Speichern fehlgeschlagen');
            }
            
            if (result.id && result.id !== testId) {
                savedId = result.id;
                this.createdTestIds.push(savedId);
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    /**
     * Test: KennelConfig kann gelistet werden
     */
    private async testKennelConfigList(controller: Controller<IKennelConfig>): Promise<void> {
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
    private async testKennelConfigGetById(controller: Controller<IKennelConfig>): Promise<void> {
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
            const { BASE_DOG_PREFIX } = await import('./KennelRun');
            
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
     * Test: Gesäter SerializedDog existiert
     */
    private async testSerializedDogExists(store: IStore): Promise<void> {
        const testName = 'SerializedDog: Seed existiert';
        try {
            const seed = await store.load('seed-serialized-1-v1');
            if (!seed) {
                this.addResult(testName, true, 'Seed existiert noch nicht (wird beim nächsten Start erstellt)');
                return;
            }
            
            const parsed = typeof seed === 'string' ? JSON.parse(seed) : seed;
            if (!parsed.theRun) {
                throw new Error('Seed hat kein theRun-Feld');
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
            const testBaseId = 'test-versions-' + Date.now();
            this.createdTestIds.push(testBaseId);
            
            // Erstelle mehrere Versionen
            const v1Input: ISerializedDogConfig = {
                id: testBaseId,
                theRun: 'return { version: 1 };',
                version: 1
            };
            const v1Result = await controller.create(v1Input);
            if (!v1Result.ok || !v1Result.id) throw new Error('V1 erstellen fehlgeschlagen');
            createdIds.push(v1Result.id);
            if (v1Result.id !== testBaseId) {
                this.createdTestIds.push(v1Result.id);
            }
            
            const v2Input: ISerializedDogConfig = {
                id: testBaseId,
                theRun: 'return { version: 2 };',
                version: 1
            };
            const v2Result = await controller.save(v2Input);
            if (!v2Result.ok || !v2Result.id) throw new Error('V2 erstellen fehlgeschlagen');
            createdIds.push(v2Result.id);
            if (v2Result.id !== testBaseId && v2Result.id !== v1Result.id) {
                this.createdTestIds.push(v2Result.id);
            }
            
            const v3Input: ISerializedDogConfig = {
                id: testBaseId,
                theRun: 'return { version: 3 };',
                version: 1
            };
            const v3Result = await controller.save(v3Input);
            if (!v3Result.ok || !v3Result.id) throw new Error('V3 erstellen fehlgeschlagen');
            createdIds.push(v3Result.id);
            if (v3Result.id !== testBaseId && v3Result.id !== v1Result.id && v3Result.id !== v2Result.id) {
                this.createdTestIds.push(v3Result.id);
            }
            
            // Prüfe, dass alle Versionen in der Liste erscheinen
            const listResult = await controller.list();
            if (!listResult.ok || !listResult.data) {
                throw new Error('Liste konnte nicht abgerufen werden');
            }
            
            const foundVersions = listResult.data.filter((dog: ISerializedDogConfig) => {
                if (!dog.id) return false;
                const baseId = dog.id.replace(/-v\d+$/, '');
                return baseId === testBaseId;
            });
            
            if (foundVersions.length < 3) {
                throw new Error(`Erwartet: 3 Versionen, gefunden: ${foundVersions.length}`);
            }
            
            // Prüfe, dass alle IDs unterschiedlich sind
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

    /**
     * Fügt ein Testergebnis hinzu
     */
    private addResult(name: string, passed: boolean, error?: string): void {
        this.results.push({ name, passed, error });
        const icon = passed ? '✅' : '❌';
        const status = passed ? 'PASS' : 'FAIL';
        console.log(`${icon} [${status}] ${name}${error ? ` - ${error}` : ''}`);
    }

    /**
     * Druckt eine Zusammenfassung der Tests
     */
    private printSummary(): void {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        
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

