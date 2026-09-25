import { IStore } from './store/IStore';
import { kennelExists } from './seed-data/seed-helpers';
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
    envFirst,
    selectLineDocs,
    sliceDogCodeLines,
    type ChannelState,
    kennelIdBlockedReason,
    publicKennelPath,
    publicKennelDocsPath,
    publicKennelOpenApiPath,
} from '@slopdogs/core';
import { Controller } from './api/Controller';
import { AbstractController } from './api/AbstractController';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { TypeDefBuilder } from './services/TypeDefBuilder';
import { HeavyRequestLimiter } from './server-app/heavyRequestLimiter';
import { EventEmitter } from 'events';
import { CompilerCache } from './services/CompilerCache';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { getSnapshotTools } from './mcp/tools/snapshots';
import { KennelSnapshotCache } from './mcp/snapshots/KennelSnapshotCache';
import type { ToolDeps } from './mcp/tools/types';
import type { AuthCtx } from './mcp/auth/middleware';
import { REDACTED_RESULT } from './services/wavesRedaction';
import { readNegativeCacheMarker } from './services/PrismaCacheHandler';
import { generateVersionId, generateLineageId } from './api/utils/versioning';
import { KennelBundleHandler } from './api/routes/KennelBundleHandler';
import { KennelSwaggerHandler } from './api/routes/KennelSwaggerHandler';
import { getAclTools } from './mcp/tools/acl';
import { toSwaggridCast } from './services/swaggridAdapter';
import { EXPRESS_APP_ROUTES, FRONTEND_ROUTES, LEGACY_ROUTE, PUBLIC_ROUTE } from './api/routes/routeTable';
import { BloodhoundIsochronePact, type BloodhoundIsochroneInput, NearbyLandmarksPact } from '@slopdogs/dogs-geo';

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
        baseDogsMap: Map<string, any>,
        /** Die fertig montierte Express-App — fuer den Abgleich Routentabelle <-> Stack. */
        app?: any,
    ): Promise<TestResult[]> {
        if (isRuntimeLogVerbose()) {
            console.log('\n🧪 Starte Startup-Tests...\n');
        }

        try {
            // Store-Tests
            await this.testStoreSaveAndLoad(nodesStore);
            await this.testStoreFindByType(nodesStore);
            await this.testKennelExistsUsesLineageLookup();
            await this.testEnvAliasFallback();
            await this.testNegativeCacheMarkerAcceptsBothPrefixes();
            
            // Controller-Tests
            await this.testControllerList(nodesController);
            await this.testControllerGetById(nodesController);
            await this.testControllerCreate(nodesController);
            await this.testControllerSave(nodesController);
            await this.testNodeDescriptionAndLineDocs(nodesController);

            // KennelConfig-Tests
            await this.testKennelConfigList(kennelsController);
            await this.testKennelConfigGetById(kennelsController);
            await this.testKennelStatusTrackingPersist(kennelsController);
            await this.testKennelStatusTrackingMerge(kennelsController);
            await this.testKennelStatusTrackingTextChanges(kennelsController);
            await this.testKennelNodeCommentMutations(kennelsController);
            await this.testKennelEdgeCommentMutations(kennelsController);
            await this.testKennelStatusTrackingVersioning(kennelsController);
            await this.testVersionsRespectCanRead(kennelsController as KennelController);
            
            // BaseDogs-Tests
            await this.testBaseDogsAvailability(baseDogsMap);
            await this.testBaseDogsFormat(baseDogsMap);
            
            // TypeDefBuilder-Tests
            await this.testTypeDefBuilder();
            await this.testPactFromSourceType();

            // Gate: zweite Schleuse fuer oeffentliche Kennel-Laeufe
            await this.testPublicLimiterCoversPublicPaths();
            await this.testPublicLimiterQueuesAndReleases();

            // P3: /k/, Segment-Regel, Alt-Weiche, HEAD ohne Lauf, Swagger unter /k, Routentabelle
            await this.testKennelIdRule();
            await this.testCreateRejectsCaseCollision(kennelsController as KennelController);
            await this.testLegacyRedirectKeepsQueryAndMethod();
            await this.testPublicUnknownIs404();
            await this.testPublicHeadDoesNotRun(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testSwaggerRedirectAndPaths(nodesStore, kennelsController as KennelController);
            if (app) await this.testRouteTableMatchesExpressStack(app);

            // SerializedDog-Tests
            await this.testSerializedDogExists(nodesStore);
            await this.testAllVersionsInList(nodesController);
            
            // Pact & MimicDog Tests
            await this.testCreatePact();
            await this.testMimicDogImitatesPact(baseDogsMap);
            await this.testMatchesParentRecognizesMimic(baseDogsMap);
            await this.testFillKennelAutoMimicForPact(baseDogsMap);
            await this.testFillKennelNoAutoMimicForOptionalOnlyPact(baseDogsMap);
            await this.testFillKennelAutoMimicOnlyForRequiredPact(baseDogsMap);
            await this.testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap);
            await this.testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap);
            await this.testRunSeasonWithMimicConsumerRuns(baseDogsMap);
            await this.testTalkingDogAllDependenciesResolved(baseDogsMap);

            // Lobby: die Einladung (?channelId=) kommt an -- auch ohne ausdruecklichen QueryRetriever
            await this.testLobbyFollowsInvitation(baseDogsMap, ['base:WebSocketChannelRetriever']);
            await this.testLobbyFollowsInvitation(baseDogsMap, ['base:WebSocketChannelRetriever', 'base:QueryRetriever']);
            await this.testAutoCreatedBodyRetrieverCarriesBody(baseDogsMap);

            // Snapshot-Werkzeuge: Redaktion je Dog wie /run
            await this.testSnapshotToolsRedactPerDog(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);

            // Export/Import Tests
            await this.testKennelExportImport(nodesStore, kennelsStore, kennelsController);

            // ACL-Lecks F1, F3, F4, F5
            await this.testExportStubsUnreadableDogs(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testSwaggerHiddenForUnreadable(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testListCollaboratorsGated(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testLegacySaveAppliesCreateDefaults(nodesStore, nodesController);
            await this.testImportAppliesCreateDefaults(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testLegacySaveIgnoresClientAcl(nodesStore, nodesController);

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
     * Test: kennelExists fragt per (type, lineageId) nach, statt die KennelConfig-Partition
     * zu ziehen — der Seed ruft das 21 Mal je Boot.
     */
    private async testKennelExistsUsesLineageLookup(): Promise<void> {
        const testName = 'Seed: kennelExists ueber findByLineage (kein Vollscan)';
        try {
            let findByTypeCalls = 0;
            const lineageLookups: Array<[string, string]> = [];
            const fakeStore = {
                findByType: async () => { findByTypeCalls++; return []; },
                findByLineage: async (type: string, lineageId: string) => {
                    lineageLookups.push([type, lineageId]);
                    return [{ id: 'v1', lineageId, type }];
                },
            } as unknown as IStore;

            const exists = await kennelExists(fakeStore, 'x');
            if (exists !== true) throw new Error(`kennelExists lieferte ${exists}, erwartet true`);
            if (findByTypeCalls !== 0) throw new Error(`findByType wurde ${findByTypeCalls} Mal gerufen`);
            if (lineageLookups.length !== 1 || lineageLookups[0][0] !== 'KennelConfig' || lineageLookups[0][1] !== 'x') {
                throw new Error(`findByLineage-Aufrufe unerwartet: ${JSON.stringify(lineageLookups)}`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Umbenennung dataDogs -> SlopDogs — alte Env-Namen greifen als Alias, der neue Name gewinnt.
     */
    private async testEnvAliasFallback(): Promise<void> {
        const testName = 'Env: DATADOGS_* als Alias fuer SLOPDOGS_*';
        const keys = ['SLOPDOGS_LOG_LEVEL', 'DATADOGS_LOG_LEVEL'];
        const saved = keys.map((k) => process.env[k]);
        const originalWarn = console.warn;
        const warnings: string[] = [];
        try {
            console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
            delete process.env.SLOPDOGS_LOG_LEVEL;
            process.env.DATADOGS_LOG_LEVEL = 'verbose';
            if (isRuntimeLogVerbose() !== true) throw new Error('alter Name DATADOGS_LOG_LEVEL=verbose wirkt nicht');
            isRuntimeLogVerbose();
            const aliasLines = warnings.filter((w) => w.includes('alias in use: DATADOGS_LOG_LEVEL -> SLOPDOGS_LOG_LEVEL'));
            if (aliasLines.length !== 1) throw new Error(`${aliasLines.length} Alias-Logzeilen, erwartet genau 1`);
            process.env.SLOPDOGS_LOG_LEVEL = 'quiet';
            if (isRuntimeLogVerbose() !== false) throw new Error('neuer Name gewinnt nicht gegen den alten');
            if (envFirst('SLOPDOGS_LOG_LEVEL', 'DATADOGS_LOG_LEVEL') !== 'quiet') throw new Error('envFirst liefert nicht den neuen Namen');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            console.warn = originalWarn;
            keys.forEach((k, i) => {
                if (saved[i] === undefined) delete process.env[k];
                else process.env[k] = saved[i];
            });
        }
    }

    /**
     * Test: Negativ-Marker im Cache werden mit neuem und altem Praefix erkannt.
     */
    private async testNegativeCacheMarkerAcceptsBothPrefixes(): Promise<void> {
        const testName = 'Cache: Negativ-Marker mit __SLOPDOGS_ und __DATADOGS_ Praefix';
        try {
            const current = JSON.stringify('__SLOPDOGS_NEG_CACHE__:boom');
            const legacy = JSON.stringify('__DATADOGS_NEG_CACHE__:old boom');
            if (readNegativeCacheMarker(current) !== 'boom') throw new Error('neues Praefix nicht erkannt');
            if (readNegativeCacheMarker(legacy) !== 'old boom') throw new Error('altes Praefix nicht erkannt');
            if (readNegativeCacheMarker(JSON.stringify({ ok: true })) !== undefined) throw new Error('positiver Wert als Negativ-Marker erkannt');
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
     * Test: SerializedDog carries a settable description + lineDocs that round-trip
     * through create/getById, a description-only save breeds a new version, and the
     * line-doc helpers resolve an annotation + code slice by line.
     */
    private async testNodeDescriptionAndLineDocs(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Node: description + lineDocs round-trip';
        try {
            const theRun = 'const a = 1;\nconst b = 2;\n// combat section\nreturn { a, b };';
            const createInput: ISerializedDogConfig = {
                displayName: 'test-desc-' + Date.now(),
                theRun,
                description: 'yields the combat numbers',
                lineDocs: [{ von: 3, bis: 4, text: 'the combat part' }],
            };

            const created = await controller.create(createInput);
            if (!created.ok || !created.id) throw new Error(created.error || 'create failed');
            this.createdTestIds.push(created.id);
            // The lineageId resolves to the LATEST incarnation; a version GUID pins one version.
            const lineageId = (created.data as any)?.lineageId ?? created.id;

            const fetched = await controller.getById(created.id);
            const cfg = fetched.data as any;
            if (!fetched.ok || !cfg) throw new Error('getById returned nothing');
            if (cfg.description !== 'yields the combat numbers') {
                throw new Error(`description not persisted: ${JSON.stringify(cfg.description)}`);
            }
            if (!Array.isArray(cfg.lineDocs) || cfg.lineDocs.length !== 1 || cfg.lineDocs[0].von !== 3) {
                throw new Error(`lineDocs not persisted: ${JSON.stringify(cfg.lineDocs)}`);
            }

            // Line retrieval: line 3 must hit the annotation and slice the right code.
            const hits = selectLineDocs(cfg.lineDocs, 3, 3);
            if (hits.length !== 1 || hits[0].text !== 'the combat part') {
                throw new Error(`selectLineDocs miss: ${JSON.stringify(hits)}`);
            }
            const slice = sliceDogCodeLines(cfg.theRun, 3, 4);
            if (!slice || !slice.text.includes('combat section')) {
                throw new Error(`sliceDogCodeLines miss: ${JSON.stringify(slice)}`);
            }
            // A line outside every range yields no annotation.
            if (selectLineDocs(cfg.lineDocs, 1, 1).length !== 0) {
                throw new Error('selectLineDocs should miss line 1');
            }

            // A description-only save must breed a new version (not silently no-op).
            const saved = await controller.save({
                id: created.id,
                theRun,
                description: 'now yields updated combat numbers',
            } as ISerializedDogConfig);
            if (!saved.ok) throw new Error(saved.error || 'save failed');
            if (saved.id) this.createdTestIds.push(saved.id);
            if (saved.id === created.id) throw new Error('description-only save did not create a new version');

            // Re-fetch the LATEST incarnation by lineageId — a version GUID would pin the old one.
            const reFetched = await controller.getById(lineageId);
            const reCfg = reFetched.data as any;
            if (reCfg?.description !== 'now yields updated combat numbers') {
                throw new Error(`updated description not persisted: ${JSON.stringify(reCfg?.description)}`);
            }
            // lineDocs must survive a save that did not re-send them.
            if (!Array.isArray(reCfg.lineDocs) || reCfg.lineDocs.length !== 1) {
                throw new Error(`lineDocs lost on save: ${JSON.stringify(reCfg?.lineDocs)}`);
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
     * Test: Status-Tracking-Felder (task / nodes / edges) ueberleben den Roundtrip.
     * Create kennel -> PUT mit task/nodes/edges -> GET zurueck -> alle Felder muessen
     * in korrekter Form vorliegen.
     */
    private async testKennelStatusTrackingPersist(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Persistence';
        const kennelId = 'test-status-persist-' + Date.now();
        try {
            const created = await controller.create({
                id: kennelId,
                name: 'Status Test Persist',
                dogIds: ['base:QueryRetriever'],
            } as any);
            if (!created.ok) throw new Error('Create fehlgeschlagen: ' + created.error);

            const saved = await controller.save({
                id: kennelId,
                task: 'Mission: tracke den Status',
                nodes: [{ id: 'base:QueryRetriever', x: 10, y: 20, comment: 'Einstieg' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'self-ref' }],
            } as any);
            if (!saved.ok) throw new Error('Save fehlgeschlagen: ' + saved.error);

            const loaded = await controller.getById(kennelId);
            if (!loaded.ok || !loaded.data) throw new Error('GetById fehlgeschlagen: ' + loaded.error);
            const cfg = loaded.data as any;

            if (cfg.task !== 'Mission: tracke den Status') {
                throw new Error('task falsch: ' + JSON.stringify(cfg.task));
            }
            if (!Array.isArray(cfg.nodes) || cfg.nodes.length !== 1) {
                throw new Error('nodes falsch: ' + JSON.stringify(cfg.nodes));
            }
            const n = cfg.nodes[0];
            if (n.id !== 'base:QueryRetriever' || n.x !== 10 || n.y !== 20 || n.comment !== 'Einstieg') {
                throw new Error('nodes[0] Inhalt falsch: ' + JSON.stringify(n));
            }
            if (!Array.isArray(cfg.edges) || cfg.edges.length !== 1) {
                throw new Error('edges falsch: ' + JSON.stringify(cfg.edges));
            }
            const e = cfg.edges[0];
            if (e.fromId !== 'base:QueryRetriever' || e.toId !== 'base:QueryRetriever' || e.comment !== 'self-ref') {
                throw new Error('edges[0] Inhalt falsch: ' + JSON.stringify(e));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Partielle Updates der Status-Felder ueberschreiben nicht die anderen.
     * PUT nur {task} laesst nodes/edges intakt; PUT nur {nodes} laesst task intakt.
     */
    private async testKennelStatusTrackingMerge(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Merge';
        const kennelId = 'test-status-merge-' + Date.now();
        try {
            await controller.create({ id: kennelId, name: 'Merge Test', dogIds: ['base:QueryRetriever'] } as any);

            // Voll bestuecken
            await controller.save({
                id: kennelId,
                task: 'initial task',
                nodes: [{ id: 'base:QueryRetriever', comment: 'note A' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'flow A' }],
            } as any);

            // Nur task aktualisieren
            await controller.save({ id: kennelId, task: 'updated task' } as any);

            let r = await controller.getById(kennelId);
            let cfg = r.data as any;
            if (cfg.task !== 'updated task') throw new Error('task nicht aktualisiert');
            if (!cfg.nodes || cfg.nodes.length !== 1 || cfg.nodes[0].comment !== 'note A') {
                throw new Error('nodes verloren nach task-only save: ' + JSON.stringify(cfg.nodes));
            }
            if (!cfg.edges || cfg.edges.length !== 1 || cfg.edges[0].comment !== 'flow A') {
                throw new Error('edges verloren nach task-only save: ' + JSON.stringify(cfg.edges));
            }

            // Nur nodes aktualisieren
            await controller.save({
                id: kennelId,
                nodes: [{ id: 'base:QueryRetriever', comment: 'note B' }],
            } as any);

            r = await controller.getById(kennelId);
            cfg = r.data as any;
            if (cfg.task !== 'updated task') {
                throw new Error('task verloren nach nodes-only save: ' + JSON.stringify(cfg.task));
            }
            if (!cfg.nodes || cfg.nodes[0].comment !== 'note B') {
                throw new Error('nodes nicht aktualisiert: ' + JSON.stringify(cfg.nodes));
            }
            if (!cfg.edges || cfg.edges[0].comment !== 'flow A') {
                throw new Error('edges verloren nach nodes-only save: ' + JSON.stringify(cfg.edges));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Vorhandene Texte koennen geaendert werden — nicht nur neu gesetzt.
     * Eine Annotation wird belegt, dann mit anderem Wert ueberschrieben.
     * Der aktuelle Stand muss den NEUEN Wert zeigen, alte Versionen den ALTEN.
     */
    private async testKennelStatusTrackingTextChanges(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Text-Aenderungen';
        const kennelId = 'test-status-changes-' + Date.now();
        try {
            await controller.create({ id: kennelId, name: 'Changes Test', dogIds: ['base:QueryRetriever'] } as any);

            // Initialer Stand
            await controller.save({
                id: kennelId,
                task: 'alt task',
                nodes: [{ id: 'base:QueryRetriever', x: 10, y: 20, comment: 'alt node' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'alt edge' }],
            } as any);

            // ALLE Texte aendern + Position verschieben
            await controller.save({
                id: kennelId,
                task: 'neu task',
                nodes: [{ id: 'base:QueryRetriever', x: 999, y: 888, comment: 'neu node' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'neu edge' }],
            } as any);

            // Aktueller Stand muss alle neuen Werte tragen
            const latest = await controller.getById(kennelId);
            const cfg = latest.data as any;
            if (cfg.task !== 'neu task') throw new Error('task nicht geaendert: ' + JSON.stringify(cfg.task));
            if (cfg.nodes?.[0]?.comment !== 'neu node') {
                throw new Error('node-comment nicht geaendert: ' + JSON.stringify(cfg.nodes?.[0]));
            }
            if (cfg.nodes?.[0]?.x !== 999 || cfg.nodes?.[0]?.y !== 888) {
                throw new Error('node-Position nicht geaendert: ' + JSON.stringify(cfg.nodes?.[0]));
            }
            if (cfg.edges?.[0]?.comment !== 'neu edge') {
                throw new Error('edge-comment nicht geaendert: ' + JSON.stringify(cfg.edges?.[0]));
            }

            // Die ALTEN Werte muessen in der History noch existieren
            const versions = await controller.getVersions(kennelId);
            // 3 Versionen: initial-create, alt-save, neu-save (newest first)
            if (versions.length !== 3) {
                throw new Error('Erwartet 3 Versionen, gefunden: ' + versions.length);
            }
            const altVersion = versions[1].config as any;
            if (altVersion?.task !== 'alt task') {
                throw new Error('Alte task-Version verloren: ' + JSON.stringify(altVersion?.task));
            }
            if (altVersion?.nodes?.[0]?.comment !== 'alt node') {
                throw new Error('Alte node-comment-Version verloren: ' + JSON.stringify(altVersion?.nodes));
            }
            if (altVersion?.nodes?.[0]?.x !== 10) {
                throw new Error('Alte node-Position verloren: ' + JSON.stringify(altVersion?.nodes?.[0]));
            }
            if (altVersion?.edges?.[0]?.comment !== 'alt edge') {
                throw new Error('Alte edge-comment-Version verloren: ' + JSON.stringify(altVersion?.edges));
            }

            // Loeschen eines Texts (leerer task -> undefined) muss auch greifen
            await controller.save({ id: kennelId, task: '' } as any);
            const cleared = await controller.getById(kennelId);
            const c = cleared.data as any;
            // Backend normalisiert leeren task auf undefined/null
            if (c.task) {
                throw new Error('task nicht geloescht (leerer String): ' + JSON.stringify(c.task));
            }
            // nodes/edges bleiben unangetastet
            if (c.nodes?.[0]?.comment !== 'neu node') {
                throw new Error('nodes verloren beim task-clear: ' + JSON.stringify(c.nodes));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Node-Kommentare werden gezielt geaendert, einer hinzugefuegt, einer entfernt.
     * Drei Knoten mit unterschiedlichen Comments; danach selektive Mutationen pruefen.
     */
    private async testKennelNodeCommentMutations(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Node-Comment Mutationen';
        const kennelId = 'test-node-comments-' + Date.now();
        try {
            await controller.create({
                id: kennelId,
                name: 'Node Comments',
                dogIds: ['base:QueryRetriever', 'base:RandomEveryThingRetriever', 'base:TalkingDog'],
            } as any);

            // 3 Knoten mit Initial-Comments + Positionen
            await controller.save({
                id: kennelId,
                nodes: [
                    { id: 'base:QueryRetriever',           x: 10, y: 10, comment: 'A initial' },
                    { id: 'base:RandomEveryThingRetriever', x: 20, y: 20, comment: 'B initial' },
                    { id: 'base:TalkingDog',                x: 30, y: 30, comment: 'C initial' },
                ],
            } as any);

            // Mutation: A behaelt Comment+Pos; B aendert NUR Comment; C verliert Comment (Pos bleibt)
            await controller.save({
                id: kennelId,
                nodes: [
                    { id: 'base:QueryRetriever',           x: 10, y: 10, comment: 'A initial' },
                    { id: 'base:RandomEveryThingRetriever', x: 20, y: 20, comment: 'B GEANDERT' },
                    { id: 'base:TalkingDog',                x: 30, y: 30 },
                ],
            } as any);

            const r = await controller.getById(kennelId);
            const ns = (r.data as any).nodes as Array<any>;
            const byId: Record<string, any> = Object.fromEntries(ns.map(n => [n.id, n]));

            if (byId['base:QueryRetriever']?.comment !== 'A initial') {
                throw new Error('A-Comment ungewollt veraendert: ' + JSON.stringify(byId['base:QueryRetriever']));
            }
            if (byId['base:RandomEveryThingRetriever']?.comment !== 'B GEANDERT') {
                throw new Error('B-Comment nicht geaendert: ' + JSON.stringify(byId['base:RandomEveryThingRetriever']));
            }
            if (byId['base:RandomEveryThingRetriever']?.x !== 20 || byId['base:RandomEveryThingRetriever']?.y !== 20) {
                throw new Error('B-Position ungewollt veraendert: ' + JSON.stringify(byId['base:RandomEveryThingRetriever']));
            }
            if (byId['base:TalkingDog']?.comment != null) {
                throw new Error('C-Comment nicht entfernt: ' + JSON.stringify(byId['base:TalkingDog']));
            }
            if (byId['base:TalkingDog']?.x !== 30 || byId['base:TalkingDog']?.y !== 30) {
                throw new Error('C-Position ungewollt veraendert: ' + JSON.stringify(byId['base:TalkingDog']));
            }

            // Mutation 2: D dazu (neuer Knoten), A weg
            await controller.save({
                id: kennelId,
                nodes: [
                    { id: 'base:RandomEveryThingRetriever', x: 20, y: 20, comment: 'B GEANDERT' },
                    { id: 'base:TalkingDog',                x: 30, y: 30 },
                    { id: 'base:CountryFlagBlackLab',       x: 40, y: 40, comment: 'D NEU' },
                ],
            } as any);
            const r2 = await controller.getById(kennelId);
            const ns2 = (r2.data as any).nodes as Array<any>;
            if (ns2.length !== 3) throw new Error('Erwartet 3 Knoten, gefunden: ' + ns2.length);
            if (ns2.find(n => n.id === 'base:QueryRetriever')) {
                throw new Error('A wurde nicht entfernt');
            }
            const d = ns2.find(n => n.id === 'base:CountryFlagBlackLab');
            if (!d || d.comment !== 'D NEU') throw new Error('D nicht hinzugefuegt: ' + JSON.stringify(d));

            // Alter Stand muss in der History noch da sein
            const versions = await controller.getVersions(kennelId);
            // 4 Versionen: initial-create, initial-save, mutation, mutation-2 (newest first)
            const initialMutation = (versions[2].config as any).nodes as Array<any>;
            const aInit = initialMutation.find(n => n.id === 'base:QueryRetriever');
            if (!aInit || aInit.comment !== 'A initial') {
                throw new Error('Alte A-Initial-Version verloren: ' + JSON.stringify(aInit));
            }
            const cInit = initialMutation.find(n => n.id === 'base:TalkingDog');
            if (!cInit || cInit.comment !== 'C initial') {
                throw new Error('Alte C-Initial-Version verloren: ' + JSON.stringify(cInit));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Edge-Kommentare werden gezielt geaendert, einer hinzugefuegt, einer entfernt.
     * Mehrere Edges mit unterschiedlichen Comments; danach selektive Mutationen pruefen.
     */
    private async testKennelEdgeCommentMutations(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Edge-Comment Mutationen';
        const kennelId = 'test-edge-comments-' + Date.now();
        try {
            await controller.create({
                id: kennelId,
                name: 'Edge Comments',
                dogIds: ['base:QueryRetriever', 'base:RandomEveryThingRetriever', 'base:TalkingDog'],
            } as any);

            // 3 Edges mit Initial-Comments
            await controller.save({
                id: kennelId,
                edges: [
                    { fromId: 'base:QueryRetriever',           toId: 'base:RandomEveryThingRetriever', comment: 'X initial' },
                    { fromId: 'base:RandomEveryThingRetriever', toId: 'base:TalkingDog',                 comment: 'Y initial' },
                    { fromId: 'base:QueryRetriever',           toId: 'base:TalkingDog',                  comment: 'Z initial' },
                ],
            } as any);

            // Mutation: X bleibt; Y aendert Comment; Z verliert Comment (Edge bleibt)
            await controller.save({
                id: kennelId,
                edges: [
                    { fromId: 'base:QueryRetriever',           toId: 'base:RandomEveryThingRetriever', comment: 'X initial' },
                    { fromId: 'base:RandomEveryThingRetriever', toId: 'base:TalkingDog',                 comment: 'Y GEANDERT' },
                    { fromId: 'base:QueryRetriever',           toId: 'base:TalkingDog' },
                ],
            } as any);

            const r = await controller.getById(kennelId);
            const es = (r.data as any).edges as Array<any>;
            const findEdge = (from: string, to: string) =>
                es.find(e => e.fromId === from && e.toId === to);

            const xE = findEdge('base:QueryRetriever', 'base:RandomEveryThingRetriever');
            const yE = findEdge('base:RandomEveryThingRetriever', 'base:TalkingDog');
            const zE = findEdge('base:QueryRetriever', 'base:TalkingDog');

            if (xE?.comment !== 'X initial') {
                throw new Error('X-Comment ungewollt veraendert: ' + JSON.stringify(xE));
            }
            if (yE?.comment !== 'Y GEANDERT') {
                throw new Error('Y-Comment nicht geaendert: ' + JSON.stringify(yE));
            }
            if (!zE) throw new Error('Z-Edge verloren');
            if (zE.comment != null) {
                throw new Error('Z-Comment nicht entfernt: ' + JSON.stringify(zE));
            }

            // Mutation 2: X loeschen (Edge weg), W dazu (neue Edge)
            await controller.save({
                id: kennelId,
                edges: [
                    { fromId: 'base:RandomEveryThingRetriever', toId: 'base:TalkingDog',                 comment: 'Y GEANDERT' },
                    { fromId: 'base:QueryRetriever',           toId: 'base:TalkingDog' },
                    { fromId: 'base:TalkingDog',                toId: 'base:QueryRetriever',           comment: 'W NEU (rueckkopplung)' },
                ],
            } as any);

            const r2 = await controller.getById(kennelId);
            const es2 = (r2.data as any).edges as Array<any>;
            if (es2.length !== 3) throw new Error('Erwartet 3 Edges, gefunden: ' + es2.length);
            if (es2.find(e => e.fromId === 'base:QueryRetriever' && e.toId === 'base:RandomEveryThingRetriever')) {
                throw new Error('X-Edge wurde nicht entfernt');
            }
            const wE = es2.find(e => e.fromId === 'base:TalkingDog' && e.toId === 'base:QueryRetriever');
            if (!wE || wE.comment !== 'W NEU (rueckkopplung)') {
                throw new Error('W nicht hinzugefuegt: ' + JSON.stringify(wE));
            }

            // Alter Stand muss in der History noch da sein
            const versions = await controller.getVersions(kennelId);
            const initialMutation = (versions[2].config as any).edges as Array<any>;
            const xInit = initialMutation.find((e: any) =>
                e.fromId === 'base:QueryRetriever' && e.toId === 'base:RandomEveryThingRetriever',
            );
            if (!xInit || xInit.comment !== 'X initial') {
                throw new Error('Alte X-Initial-Version verloren: ' + JSON.stringify(xInit));
            }
            const zInit = initialMutation.find((e: any) =>
                e.fromId === 'base:QueryRetriever' && e.toId === 'base:TalkingDog',
            );
            if (!zInit || zInit.comment !== 'Z initial') {
                throw new Error('Alte Z-Initial-Version verloren: ' + JSON.stringify(zInit));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Jede Aenderung an task/nodes/edges erzeugt eine eigene Version, alte Versionen
     * behalten ihren Snapshot. Identische PUTs erzeugen KEINE neue Version (No-Op-Detection).
     */
    private async testKennelStatusTrackingVersioning(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Versioning';
        const kennelId = 'test-status-versioning-' + Date.now();
        try {
            await controller.create({ id: kennelId, name: 'Versioning Test', dogIds: ['base:QueryRetriever'] } as any);

            // Drei Saves mit jeweils anderen Texten
            await controller.save({ id: kennelId, task: 'v1', nodes: [{ id: 'base:QueryRetriever', comment: 'a' }] } as any);
            await controller.save({ id: kennelId, task: 'v2', nodes: [{ id: 'base:QueryRetriever', comment: 'b' }] } as any);
            await controller.save({ id: kennelId, task: 'v3', nodes: [{ id: 'base:QueryRetriever', comment: 'c' }] } as any);

            const versions = await controller.getVersions(kennelId);
            // Initial-Create + 3 saves = 4 Versionen
            if (versions.length !== 4) {
                throw new Error('Erwartet 4 Versionen, gefunden: ' + versions.length);
            }

            // Versionen sind newest-first sortiert
            const tasks = versions.map(v => (v.config as any)?.task ?? null);
            // Erwartet: ["v3", "v2", "v1", null]
            if (tasks[0] !== 'v3' || tasks[1] !== 'v2' || tasks[2] !== 'v1' || tasks[3] != null) {
                throw new Error('Versions-Snapshots falsch: ' + JSON.stringify(tasks));
            }

            // Pro Version den eigenen node-comment pruefen
            const comments = versions.map(v => (v.config as any)?.nodes?.[0]?.comment ?? null);
            if (comments[0] !== 'c' || comments[1] !== 'b' || comments[2] !== 'a' || comments[3] != null) {
                throw new Error('Node-comment History falsch: ' + JSON.stringify(comments));
            }

            // No-Op-Save: identischer Payload soll KEINE neue Version anlegen
            await controller.save({ id: kennelId, task: 'v3', nodes: [{ id: 'base:QueryRetriever', comment: 'c' }] } as any);
            const afterNoop = await controller.getVersions(kennelId);
            if (afterNoop.length !== 4) {
                throw new Error('No-Op-Save erzeugte Phantom-Version, jetzt: ' + afterNoop.length);
            }

            // Aelteren Snapshot per version-GUID abrufen
            const oldVersionId = versions[2].id; // sollte v1 sein
            const old = await controller.getById(oldVersionId);
            if (!old.ok || (old.data as any)?.task !== 'v1') {
                throw new Error('Alte Version per GUID liefert nicht v1: ' + JSON.stringify((old.data as any)?.task));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
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
            // BASE_DOG_PREFIX wird jetzt aus slopdogs importiert
            
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
     * Test: Die Public-Schleuse trifft oeffentliche Kennel-Laeufe und die Spec-Erzeugung —
     * aber keine Angular-Artefakte, keine festen Segmente, keine Heavy-Pfade und kein HEAD.
     */
    private async testPublicLimiterCoversPublicPaths(): Promise<void> {
        const testName = 'Gate: Public-Schleuse trifft /k/:id und openapi.json';
        try {
            const limiter = HeavyRequestLimiter.publicRuns();
            const hits: Array<[string, string]> = [
                ['/k/wetter', 'GET'],
                ['/k/wetter/', 'POST'],
                ['/k/foo.bar', 'GET'],
                ['/k/w/openapi.json', 'GET'],
            ];
            const misses: Array<[string, string | undefined]> = [
                ['/kennels', undefined],
                ['/main-abc.js', undefined],
                ['/favicon.ico', undefined],
                ['/api/kennels', undefined],
                ['/kennel/w', undefined],
                ['/wetter', 'GET'],
                ['/k/w/docs', 'GET'],
                ['/k/wetter', 'HEAD'],
            ];
            for (const [path, method] of hits) {
                if (!limiter.isHeavy(path, method)) throw new Error(`${method} ${path} sollte gebremst werden`);
            }
            for (const [path, method] of misses) {
                if (limiter.isHeavy(path, method)) throw new Error(`${method ?? '*'} ${path} darf nicht gebremst werden`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Die Schleuse laesst maxConcurrent durch, reiht den Rest ein, gibt den Platz bei
     * 'finish' weiter und antwortet nach dem Wartebudget mit 503 + Retry-After.
     */
    private async testPublicLimiterQueuesAndReleases(): Promise<void> {
        const testName = 'Gate: Public-Schleuse reiht ein, gibt frei, 503 nach Wartebudget';
        try {
            const limiter = new HeavyRequestLimiter({
                name: 'public',
                paths: [/^\/x$/],
                methods: ['GET', 'POST'],
                maxConcurrent: 2,
                queueTimeoutMs: 200,
            });
            let middleware: any = null;
            limiter.applyTo({ use: (mw: any) => { middleware = mw; } } as any);
            if (typeof middleware !== 'function') throw new Error('applyTo hat keine Middleware montiert');

            const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
            const fire = () => {
                const res: any = new EventEmitter();
                res.statusCode = 200;
                res.headers = {} as Record<string, string>;
                res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
                res.status = (code: number) => { res.statusCode = code; return res; };
                res.json = (body: any) => { res.body = body; return res; };
                const state = { passed: false, res };
                middleware({ path: '/x', method: 'GET' }, res, () => { state.passed = true; });
                return state;
            };

            const r1 = fire();
            const r2 = fire();
            const r3 = fire();
            await tick();
            if (!r1.passed || !r2.passed) throw new Error('die ersten zwei Requests muessen durch');
            if (r3.passed) throw new Error('der dritte Request muss warten');

            r1.res.emit('finish');
            await tick();
            if (!r3.passed) throw new Error('der dritte Request muss nach finish durch');

            const r4 = fire();
            await tick();
            if (r4.passed) throw new Error('der vierte Request muss warten (zwei laufen noch)');
            await new Promise<void>((resolve) => setTimeout(resolve, 300));
            if (r4.passed) throw new Error('der vierte Request darf nie durch');
            if (r4.res.statusCode !== 503) throw new Error(`erwartet 503, erhalten ${r4.res.statusCode}`);
            if (r4.res.headers['retry-after'] !== '1') throw new Error(`Retry-After erwartet 1, erhalten ${r4.res.headers['retry-after']}`);

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
     * Basis-URL des eigenen Servers — die Suite laeuft NACH listen (main.ts), also antwortet er.
     */
    private selfBaseUrl(): string {
        return `http://127.0.0.1:${Number(process.env.PORT) || 3000}`;
    }

    /**
     * Test: Segment-Regel fuer Kennel-IDs statt Blockliste (P3, 2.6).
     */
    private async testKennelIdRule(): Promise<void> {
        const testName = 'P3: Kennel-ID-Regel (Segment statt Blockliste)';
        try {
            const allowed = ['wetter', 'Wetter-2024', 'k', 'api', 'a.b_c', 'a'.repeat(64)];
            const blocked = ['', 'a/b', '.', '..', 'a b', '-lead', 'a'.repeat(65), 'a?b', 'a#b', 'a%b'];
            for (const id of allowed) {
                const reason = kennelIdBlockedReason(id);
                if (reason !== null) throw new Error(`"${id}" sollte erlaubt sein: ${reason}`);
            }
            for (const id of blocked) {
                if (typeof kennelIdBlockedReason(id) !== 'string') throw new Error(`"${id}" sollte abgelehnt werden`);
            }
            if (publicKennelPath('wetter') !== '/k/wetter') throw new Error(`publicKennelPath: ${publicKennelPath('wetter')}`);
            if (publicKennelDocsPath('wetter') !== '/k/wetter/docs') throw new Error('publicKennelDocsPath');
            if (publicKennelOpenApiPath('wetter') !== '/k/wetter/openapi.json') throw new Error('publicKennelOpenApiPath');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: create lehnt eine ID ab, die sich nur in der Schreibweise von einer bestehenden unterscheidet.
     */
    private async testCreateRejectsCaseCollision(kennelsController: KennelController): Promise<void> {
        const testName = 'P3: create lehnt Gross-/Kleinschreibungs-Kollision ab';
        const stamp = Date.now();
        const original = `Test-Case-${stamp}`;
        const other = `test-case-${stamp}-2`;
        try {
            const created = await kennelsController.create({ id: original, dogIds: [] });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const clash = await kennelsController.create({ id: original.toLowerCase(), dogIds: [] });
            if (clash.ok) throw new Error('Kollision in der Schreibweise wurde angelegt');
            if (!String(clash.error || '').includes(original)) throw new Error(`Grund nennt die bestehende ID nicht: ${clash.error}`);
            const fine = await kennelsController.create({ id: other, dogIds: [] });
            if (!fine.ok) throw new Error(`freie ID abgelehnt: ${fine.error}`);
            const bad = await kennelsController.create({ id: 'a/b', dogIds: [] });
            if (bad.ok) throw new Error('ID mit / wurde angelegt');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(original); } catch { /* ignore */ }
            try { await kennelsController.delete(original.toLowerCase()); } catch { /* ignore */ }
            try { await kennelsController.delete(other); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Alt-Weiche `/:name` -> 308 `/k/:name` mit Query und Methode, ohne DB-Lookup;
     * feste Segmente gehen per next() weiter.
     */
    private async testLegacyRedirectKeepsQueryAndMethod(): Promise<void> {
        const testName = 'P3: Alt-Weiche 308 behaelt Query und Methode, 0 DB-Lookups';
        try {
            let lookups = 0;
            const countingController: any = { getById: async () => { lookups++; return { ok: false, data: null }; } };
            const countingStore: any = new Proxy({}, { get: () => async () => { lookups++; return null; } });
            const handler = new KennelRunHandler({ kennelsController: countingController, nodesStore: countingStore, baseDogsMap: new Map() });

            const routes: Array<{ method: string; path: string; fn: any }> = [];
            const collect = (method: string) => (path: string, fn: any) => { routes.push({ method, path, fn }); };
            handler.registerRoutes({ get: collect('get'), post: collect('post'), head: collect('head'), all: collect('all') });
            const legacyEnabled = KennelRunHandler.legacyRedirectEnabled();
            const legacyRoute = routes.find((r) => r.method === 'all' && r.path === LEGACY_ROUTE.kennel);
            if (legacyEnabled && !legacyRoute) throw new Error('Alt-Weiche nicht registriert');
            if (!legacyEnabled && legacyRoute) throw new Error('Alt-Weiche trotz LEGACY_KENNEL_REDIRECT=0 registriert');
            const headIdx = routes.findIndex((r) => r.method === 'head' && r.path === PUBLIC_ROUTE.kennel);
            const getIdx = routes.findIndex((r) => r.method === 'get' && r.path === PUBLIC_ROUTE.kennel);
            if (headIdx < 0 || getIdx < 0 || headIdx > getIdx) throw new Error('HEAD /k/:id muss vor GET registriert sein');

            const call = (method: string, name: string, originalUrl: string) => {
                const out = { status: 0, location: '', next: false };
                const res: any = { redirect: (code: number, loc: string) => { out.status = code; out.location = loc; } };
                handler.legacyRedirect({ method, params: { name }, originalUrl }, res, () => { out.next = true; });
                return out;
            };

            const get = call('GET', 'wetter', '/wetter?lat=1&channelId=AbC');
            if (get.status !== 308 || get.location !== '/k/wetter?lat=1&channelId=AbC') {
                throw new Error(`GET: ${get.status} ${get.location}`);
            }
            const post = call('POST', 'wetter', '/wetter?lat=1&channelId=AbC');
            if (post.status !== 308 || post.location !== get.location) throw new Error(`POST: ${post.status} ${post.location}`);
            for (const fixed of ['kennels', 'api', 'robots.txt', 'K', 'kennel']) {
                const r = call('GET', fixed, `/${fixed}`);
                if (!r.next || r.status !== 0) throw new Error(`/${fixed} muss per next() weitergehen`);
            }
            if (lookups !== 0) throw new Error(`Alt-Weiche hat ${lookups} DB-Lookups ausgeloest`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: ein unbekannter Kennel unter /k/ ist 404 JSON — nie index.html (SKIP_PREFIXES enthaelt /k).
     */
    private async testPublicUnknownIs404(): Promise<void> {
        const testName = 'P3: GET /k/<unbekannt> -> 404 JSON';
        try {
            const res = await fetch(`${this.selfBaseUrl()}/k/nicht-da-${Date.now()}`, { redirect: 'manual' });
            const type = res.headers.get('content-type') || '';
            const body = await res.text();
            if (res.status !== 404) throw new Error(`erwartet 404, erhalten ${res.status}`);
            if (!type.includes('application/json')) throw new Error(`Content-Type ${type}`);
            if (JSON.parse(body).error !== 'kennel_not_found') throw new Error(`Body ${body}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: HEAD /k/:id antwortet ohne Lauf — Spy auf runKennel am Handler, dazu der echte Server.
     */
    private async testPublicHeadDoesNotRun(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3: HEAD /k/:id ohne Lauf';
        const kennelId = `test-head-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'HeadProbeDog', 'return { head: 1 };', { visibility: 'public', ownerId: null });
            const created = await kennelsController.create({ id: kennelId, dogIds: [dog], visibility: 'public' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const handler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
            let runs = 0;
            (handler as any).runKennel = async () => { runs++; return []; };
            const head = async (id: string) => {
                const out = { status: 0, ended: false, body: undefined as any, headers: {} as Record<string, string> };
                const res: any = {
                    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = v; },
                    status: (code: number) => { out.status = code; return res; },
                    end: (body?: any) => { out.ended = true; out.body = body; return res; },
                };
                await (handler as any).handlePublicHead({ params: { id }, query: {}, ctx: { user: null, isSuperUser: false } }, res);
                return out;
            };
            const known = await head(kennelId);
            if (known.status !== 200 || !known.ended || known.body !== undefined) throw new Error(`bekannt: ${known.status}`);
            if (known.headers['cache-control'] !== 'no-store') throw new Error('Cache-Control no-store fehlt');
            const unknown = await head(`${kennelId}-nicht-da`);
            if (unknown.status !== 404) throw new Error(`unbekannt: ${unknown.status}`);
            if (runs !== 0) throw new Error(`HEAD hat ${runs}x runKennel ausgeloest`);

            const live = await fetch(`${this.selfBaseUrl()}/k/${kennelId}`, { method: 'HEAD' });
            if (live.status !== 200) throw new Error(`Server HEAD: ${live.status}`);
            if ((await live.text()) !== '') throw new Error('Server HEAD mit Body');
            const liveUnknown = await fetch(`${this.selfBaseUrl()}/k/${kennelId}-nicht-da`, { method: 'HEAD' });
            if (liveUnknown.status !== 404) throw new Error(`Server HEAD unbekannt: ${liveUnknown.status}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: alte Swagger-Adressen -> 308 auf /k/…; die Spec traegt paths['/k/<id>'] und servers ''.
     */
    private async testSwaggerRedirectAndPaths(nodesStore: IStore, kennelsController: KennelController): Promise<void> {
        const testName = 'P3: Swagger unter /k/:id/docs|openapi.json, 308 von /api';
        const kennelId = `test-openapi-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'OpenApiProbeDog', 'return { spec: 1 };', { visibility: 'public', ownerId: null });
            const created = await kennelsController.create({ id: kennelId, dogIds: [dog], visibility: 'public' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const base = this.selfBaseUrl();

            const docs = await fetch(`${base}/api/kennels/${kennelId}/docs?version=x`, { redirect: 'manual' });
            if (docs.status !== 308) throw new Error(`/docs alt: ${docs.status}`);
            if (docs.headers.get('location') !== `/k/${kennelId}/docs?version=x`) throw new Error(`/docs Location ${docs.headers.get('location')}`);
            const json = await fetch(`${base}/api/kennels/${kennelId}/swagger.json`, { redirect: 'manual' });
            if (json.status !== 308 || json.headers.get('location') !== `/k/${kennelId}/openapi.json`) {
                throw new Error(`swagger.json alt: ${json.status} ${json.headers.get('location')}`);
            }

            const specRes = await fetch(`${base}/k/${kennelId}/openapi.json`);
            if (specRes.status !== 200) throw new Error(`openapi.json: ${specRes.status}`);
            const spec: any = await specRes.json();
            const firstPath = Object.keys(spec.paths || {})[0];
            if (firstPath !== `/k/${kennelId}`) throw new Error(`paths[0] = ${firstPath}`);
            if (spec.servers?.[0]?.url !== '') throw new Error(`servers[0].url = ${spec.servers?.[0]?.url}`);

            const ui = await fetch(`${base}/k/${kennelId}/docs`);
            const html = await ui.text();
            if (ui.status !== 200 || !html.includes(`/k/${kennelId}/openapi.json`)) throw new Error(`/k/:id/docs: ${ui.status}, specUrl fehlt`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Express kennt genau die Routen der Routentabelle — Diff in beide Richtungen ist ein Fehler.
     */
    private async testRouteTableMatchesExpressStack(app: any): Promise<void> {
        const testName = 'P3: Routentabelle == Express-Stack';
        try {
            const stack: any[] = app?.router?.stack ?? app?._router?.stack ?? [];
            if (!stack.length) throw new Error('Express-Stack nicht lesbar');
            const registered = new Set<string>();
            for (const layer of stack) {
                const p = layer?.route?.path;
                if (typeof p === 'string') registered.add(p);
            }
            const expected = new Set<string>(
                [...EXPRESS_APP_ROUTES, ...FRONTEND_ROUTES].filter(
                    (p) => p !== LEGACY_ROUTE.kennel || KennelRunHandler.legacyRedirectEnabled(),
                ),
            );
            const missing = [...expected].filter((p) => !registered.has(p));
            const extra = [...registered].filter((p) => !expected.has(p));
            if (missing.length || extra.length) {
                throw new Error(`fehlt in Express: [${missing.join(', ')}]; fehlt in der Tabelle: [${extra.join(', ')}]`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Minimal-Response fuer Route-Handler ohne Express: haelt Status, Body und Header fest.
     */
    private fakeResponse(): { res: any; out: { statusCode: number; body: any; headers: Record<string, string> } } {
        const out = { statusCode: 200, body: undefined as any, headers: {} as Record<string, string> };
        const res: any = {
            status(code: number) { out.statusCode = code; return res; },
            json(body: any) { out.body = body; return res; },
            send(body: any) { out.body = body; return res; },
            setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; },
        };
        return { res, out };
    }

    /**
     * Test: GET /api/:subpath/:id/versions prueft canRead — Regressionstest, kein Codefix (W5).
     */
    private async testVersionsRespectCanRead(kennelsController: KennelController): Promise<void> {
        const testName = 'ACL: /versions respektiert canRead';
        const kennelId = `test-versions-acl-${Date.now()}`;
        try {
            const created = await kennelsController.create({
                id: kennelId,
                name: `Versions ACL ${kennelId}`,
                dogIds: [],
                visibility: 'private',
                ownerId: 'U1',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const registry = new ControllerRegistry();
            registry.register('kennels', kennelsController);
            const handler = new ConfigRouteHandler(registry);
            const call = async (ctx: any) => {
                const { res, out } = this.fakeResponse();
                await (handler as any).handleGetVersions({ params: { subpath: 'kennels', id: kennelId }, ctx }, res);
                return out;
            };

            const anon = await call({ user: null, isSuperUser: false });
            if (anon.statusCode !== 404) throw new Error(`anonym: erwartet 404, erhalten ${anon.statusCode}`);

            const owner = await call({ user: { id: 'U1', email: 'u1@test.invalid', name: null }, isSuperUser: false });
            if (owner.statusCode !== 200) throw new Error(`Owner: erwartet 200, erhalten ${owner.statusCode}`);
            if (!Array.isArray(owner.body?.data)) throw new Error('Owner: data ist kein Array');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
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
     * Test: fillKennel erzeugt fuer einen NUR optionalen Pact bewusst KEINEN Mimic.
     * Vertrag seit "Welle 10" (KennelRun.autoMimic): Platzhalter-Mimics entstehen ausschliesslich
     * fuer Pacts, die ein Dog WIRKLICH BRAUCHT. Ein optional-only Pact hat im Consumer einen
     * sinnvollen Default -- ein werfender Auto-Mimic wuerde nur einen Schein-Fehler in den Snapshot
     * schreiben, ohne dafuer Daten zu liefern.
     */
    private async testFillKennelNoAutoMimicForOptionalOnlyPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: optional-only Pact bekommt KEINEN Mimic';
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

            if (hasMimic) {
                throw new Error('Fuer einen optional-only Pact wurde ein Mimic erzeugt -- verletzt den Welle-10-Vertrag');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: haengen an EINEM Dog ein required und ein optionaler Pact, entsteht GENAU EIN Mimic --
     * der fuer den required Pact. Der optionale bleibt bewusst unbesetzt (Welle-10-Vertrag, siehe oben).
     */
    private async testFillKennelAutoMimicOnlyForRequiredPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Mimic nur fuer required, nicht fuer optional';
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
            if (hasOptMimic) {
                throw new Error('Fuer den optional-only Pact wurde ein Mimic erzeugt -- verletzt den Welle-10-Vertrag');
            }

            const mimicCount = kennel.filter(d => d instanceof MimicDog).length;
            if (mimicCount !== 1) {
                throw new Error(`Erwartet: genau 1 Mimic (nur der required), gefunden: ${mimicCount}`);
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

    /** Legt einen SerializedDog mit ACL-Spalten an; liefert die lineageId. Cleanup ueber createdTestIds. */
    private async saveAclTestDog(
        nodesStore: IStore,
        displayName: string,
        theRun: string,
        acl: { visibility: 'public' | 'private'; ownerId: string | null },
    ): Promise<string> {
        const versionId = generateVersionId();
        const lineageId = generateLineageId();
        const cfg: ISerializedDogConfig = {
            id: versionId,
            lineageId,
            parentId: null,
            displayName,
            theRun,
            parentsRequired: [],
            parentsOptional: [],
        };
        await nodesStore.save({
            id: versionId,
            type: SerializedDog.name,
            lineageId,
            parentId: null,
            displayName,
            serializedDogConfig: JSON.stringify(cfg),
            visibility: acl.visibility,
            ownerId: acl.ownerId,
            createdAt: new Date(),
        });
        this.createdTestIds.push(versionId);
        return lineageId;
    }

    /** Werkzeug-Abhaengigkeiten fuer MCP-Tool-Handler im Test. `prisma` ist ein Fake. */
    private toolDeps(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        runHandler: KennelRunHandler,
        prisma: any = null,
    ): ToolDeps {
        return {
            kennelsController,
            nodesController,
            kennelRunHandler: runHandler,
            kennelsStore,
            nodesStore,
            prisma,
            baseDogsList: [],
            projectRoot: process.cwd(),
            snapshotCache: new KennelSnapshotCache(),
        };
    }

    /**
     * Test: Die Snapshot-Werkzeuge redigieren je Dog wie GET /api/kennels/:id/run (Nira L4/L5).
     * Der Cache bleibt roh — nach den redigierten Lesern sieht der Owner wieder alles.
     */
    private async testSnapshotToolsRedactPerDog(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Snapshot-Werkzeuge redigieren je Dog wie /run';
        const kennelId = `test-snapshot-redact-${Date.now()}`;
        try {
            const d1 = await this.saveAclTestDog(nodesStore, 'SnapOpenDog', 'return { open: 1 };',
                { visibility: 'public', ownerId: 'U0' });
            const d2 = await this.saveAclTestDog(nodesStore, 'SnapPrivateDog', 'return { secret: "snap-secret" };',
                { visibility: 'private', ownerId: 'U1' });
            // Kennel gehoert U0, nicht U1 — sonst macht die Sichtbarkeits-Kaskade D2 oeffentlich.
            const created = await kennelsController.create({
                id: kennelId,
                name: `Snapshot Redact ${kennelId}`,
                dogIds: [d1, d2],
                visibility: 'public',
                ownerId: 'U0',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const tools = getSnapshotTools();
            const tool = (name: string) => {
                const t = tools.find((x) => x.name === name);
                if (!t) throw new Error(`Werkzeug ${name} fehlt`);
                return t;
            };
            const read = async (name: string, ctx: AuthCtx, args: Record<string, any>) => {
                const r = await tool(name).handler({ id: kennelId, ...args }, ctx, deps);
                if (r.isError) throw new Error(`${name}: ${r.content[0]?.text}`);
                return JSON.parse(r.content[0].text);
            };
            const user = (id: string): AuthCtx => ({ user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false });
            const u1 = user('U1');
            const u2 = user('U2');
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const superUser: AuthCtx = { user: null, isSuperUser: true };

            await read('refresh_kennel_snapshot', u1, {});
            const header = await read('wait_for_kennel_snapshot', u1, { timeoutMs: 30_000 });
            if (header.status !== 'ok') throw new Error(`Snapshot-Status ${header.status}: ${header.errorMessage ?? ''}`);

            const runNodeFor = async (ctx: AuthCtx, lineageId: string) => {
                const { res, out } = this.fakeResponse();
                await (runHandler as any).handleRun({ params: { id: kennelId }, query: {}, method: 'GET', ctx }, res);
                if (!out.body?.ok) throw new Error(`/run fehlgeschlagen: ${JSON.stringify(out.body)}`);
                const node = (out.body.waves as any[]).flat().find((n: any) => n.lineageId === lineageId);
                if (!node) throw new Error(`/run: Dog ${lineageId} nicht in den Waves`);
                return node;
            };

            for (const [label, ctx] of [['U2', u2], ['anonym', anon]] as Array<[string, AuthCtx]>) {
                const result = await read('get_snapshot_dog_result', ctx, { dogId: d2 });
                const code = await read('get_snapshot_dog_code', ctx, { dogId: d2 });
                const vm = await read('get_snapshot_dog_vmcontext', ctx, { dogId: d2 });
                const viaRun = await runNodeFor(ctx, d2);
                if (result.result !== REDACTED_RESULT) throw new Error(`${label}: result nicht redigiert: ${JSON.stringify(result.result)}`);
                if (result.result !== viaRun.result) throw new Error(`${label}: result weicht von /run ab`);
                if (code.codeTs !== null || viaRun.codeTs != null) throw new Error(`${label}: codeTs nicht redigiert`);
                if (vm.vmContext !== null || vm.vmContextTypeDef !== null || viaRun.vmContext != null) {
                    throw new Error(`${label}: vmContext nicht redigiert`);
                }
                const open = await read('get_snapshot_dog_code', ctx, { dogId: d1 });
                if (typeof open.codeTs !== 'string') throw new Error(`${label}: lesbarer Dog D1 wurde redigiert`);
            }

            for (const [label, ctx] of [['U1', u1], ['Super-User', superUser]] as Array<[string, AuthCtx]>) {
                const result = await read('get_snapshot_dog_result', ctx, { dogId: d2 });
                const code = await read('get_snapshot_dog_code', ctx, { dogId: d2 });
                if (result.result?.secret !== 'snap-secret') throw new Error(`${label}: result nicht roh: ${JSON.stringify(result.result)}`);
                if (typeof code.codeTs !== 'string' || !code.codeTs.includes('snap-secret')) throw new Error(`${label}: codeTs nicht roh`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
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
     * Test: die Lobby folgt der Einladung. Ohne ?channelId= entsteht je Lauf eine eigene, zufaellige
     * Lobby; mit ?channelId=abc landet der Lauf in "abc", und channelParam/channelQuery tragen die
     * Einladung weiter. Laeuft mit und ohne ausdruecklichen base:QueryRetriever: fehlt er, ergaenzt
     * ihn autoMimic -- und der muss dieselbe Query tragen (frueher war er leer, die Einladung verloren).
     */
    private async testLobbyFollowsInvitation(baseDogsMap: Map<string, any>, dogIds: string[]): Promise<void> {
        const testName = `Lobby folgt ?channelId= (dogIds: ${dogIds.join(', ')})`;
        try {
            const lobby = async (query?: Record<string, string>): Promise<ChannelState> => {
                const kennelRun = new KennelRun({ id: 'test-lobby-kennel', dogIds }, baseDogsMap, undefined, query);
                const season = await kennelRun.run();
                const lobbyDog = season.exhausted.find(d => d.name === 'WebSocketChannelRetriever');
                if (!lobbyDog) throw new Error('WebSocketChannelRetriever ist nicht gelaufen');
                return lobbyDog.collected as ChannelState;
            };

            const first = await lobby();
            const second = await lobby();
            if (!first.channelId || !second.channelId || first.channelId === second.channelId) {
                throw new Error(`Ohne Query erwartet: zwei verschiedene zufaellige Lobbys, erhalten: ${first.channelId} / ${second.channelId}`);
            }
            if (first.channelQuery !== `?channelId=${encodeURIComponent(first.channelId)}`) {
                throw new Error(`channelQuery fehlt bei frischer Lobby: ${first.channelQuery}`);
            }

            const invited = await lobby({ channelId: 'abc' });
            if (invited.channelId !== 'abc') {
                throw new Error(`Mit ?channelId=abc erwartet: abc, erhalten: ${invited.channelId}`);
            }
            if (invited.channelParam !== 'channelId' || invited.channelQuery !== '?channelId=abc') {
                throw new Error(`Einladung falsch weitergereicht: channelParam=${invited.channelParam}, channelQuery=${invited.channelQuery}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: ein BodyRetriever, den autoMimic als fehlenden Pflicht-Parent ergaenzt, traegt den echten
     * Body -- wie einer, der ausdruecklich in dogIds steht. Kein Basis-Dog verlangt heute einen
     * BodyRetriever, darum ein Stub als Verbraucher.
     */
    private async testAutoCreatedBodyRetrieverCarriesBody(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'autoMimic: ergaenzter BodyRetriever traegt den Body';
        try {
            const BodyRetrieverClass = baseDogsMap.get('BodyRetriever');
            if (!BodyRetrieverClass) throw new Error('BodyRetriever fehlt in der Registry');

            class BodyConsumerDog extends Dog<unknown> {
                get name() { return 'BodyConsumerDog'; }
                get required() { return [BodyRetrieverClass]; }
                get optional() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                protected yieldCollectorFactory = async (season: any) =>
                    season.exhausted.find((d: any) => d.name === 'BodyRetriever')?.collected;
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('BodyConsumerDog', BodyConsumerDog);

            const body = { frage: 'Wer war das?', runde: 3 };
            const config: IKennelConfig = { id: 'test-body-kennel', dogIds: ['base:BodyConsumerDog'] };
            const season = await new KennelRun(config, extendedMap, undefined, undefined, body).run();

            const consumer = season.exhausted.find(d => d.name === 'BodyConsumerDog');
            if (JSON.stringify(consumer?.collected) !== JSON.stringify(body)) {
                throw new Error(`Body erwartet: ${JSON.stringify(body)}, erhalten: ${JSON.stringify(consumer?.collected)}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Loescht alle Versionen einer Dog-Lineage (Test-Cleanup fuer Dogs, deren Version-ID der Test nicht kennt). */
    private async deleteDogLineage(nodesStore: IStore, lineageId: string): Promise<void> {
        for (const type of [SerializedDog.name, MimicDog.name]) {
            try {
                const versions = await nodesStore.findAllVersions(type, lineageId);
                for (const v of versions) await nodesStore.delete(v.id);
            } catch { /* ignore */ }
        }
    }

    /**
     * Test: Export liefert nicht lesbare Dogs als Referenz-Stub (Nira F1); Import laeuft durch,
     * warnt und laesst die Referenz stehen.
     */
    private async testExportStubsUnreadableDogs(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Export stubbt nicht lesbare Dogs, Import warnt';
        const stamp = Date.now();
        const kennelId = `test-export-stub-${stamp}`;
        const importId = `test-import-stub-${stamp}`;
        let importedLineages: string[] = [];
        try {
            const open = await this.saveAclTestDog(nodesStore, 'ExportOpenDog', 'return { open: 1 };',
                { visibility: 'public', ownerId: 'UK' });
            const hidden = await this.saveAclTestDog(nodesStore, 'ExportHiddenDog', 'return { secret: "export-secret" };',
                { visibility: 'private', ownerId: 'UF' });
            const created = await kennelsController.create({
                id: kennelId,
                name: `Export Stub ${stamp}`,
                dogIds: [open, hidden],
                visibility: 'public',
                ownerId: 'UK',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
            const bundleHandler = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);

            const exp = this.fakeResponse();
            await (bundleHandler as any).handleExport(
                { params: { id: kennelId }, query: {}, ctx: { user: null, isSuperUser: false } },
                exp.res,
            );
            if (exp.out.statusCode !== 200) throw new Error(`Export: Status ${exp.out.statusCode}`);
            const bundle = exp.out.body;
            const stub = bundle.dogs.find((d: any) => d.lineageId === hidden);
            const full = bundle.dogs.find((d: any) => d.lineageId === open);
            if (!stub || stub.redacted !== true || 'config' in stub) throw new Error(`Stub falsch: ${JSON.stringify(stub)}`);
            if (!full || !full.config) throw new Error('lesbarer Dog ohne config exportiert');
            if (JSON.stringify(bundle).includes('export-secret')) throw new Error('Code des privaten Dogs im Bundle');

            const imp = this.fakeResponse();
            await (bundleHandler as any).handleImport(
                {
                    body: { ...bundle, importTarget: { kennelId: importId, name: `Import Stub ${stamp}` } },
                    ctx: { user: { id: 'UI', email: 'ui@test.invalid', name: null }, isSuperUser: false },
                },
                imp.res,
            );
            if (imp.out.statusCode !== 200 || !imp.out.body?.ok) throw new Error(`Import: ${JSON.stringify(imp.out.body)}`);
            importedLineages = Object.values(imp.out.body.idMap ?? {}) as string[];
            if (!Array.isArray(imp.out.body.hinweise) || imp.out.body.hinweise.length !== 1) {
                throw new Error(`Import-Hinweise erwartet 1, erhalten ${JSON.stringify(imp.out.body.hinweise)}`);
            }
            const imported = await kennelsController.getById(importId);
            if (!imported.ok || !imported.data) throw new Error('importierter Kennel fehlt');
            if (!(imported.data.dogIds ?? []).includes(hidden)) throw new Error('Referenz auf den Stub-Dog ist nicht stehen geblieben');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
            try { await kennelsController.delete(importId); } catch { /* ignore */ }
            for (const lineageId of new Set(importedLineages)) await this.deleteDogLineage(nodesStore, lineageId);
        }
    }

    /**
     * Test: Spec und Swagger-UI eines privaten Kennels sind fuer Nicht-Leser 404 (Nira F3);
     * Defaults gehen nur bei includeDefaults in die Spec; private Dogs eines oeffentlichen
     * Kennels geben ihr Ergebnis nicht als Schema-Beispiel preis.
     */
    private async testSwaggerHiddenForUnreadable(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Swagger/Spec hinter canRead';
        const stamp = Date.now();
        const privateId = `test-swagger-private-${stamp}`;
        const publicId = `test-swagger-public-${stamp}`;
        try {
            const createdPrivate = await kennelsController.create({
                id: privateId,
                name: `Swagger Private ${stamp}`,
                dogIds: [],
                defaultBody: { hidden: 'swagger-default' },
                visibility: 'private',
                ownerId: 'U1',
            });
            if (!createdPrivate.ok) throw new Error(`privater Kennel nicht angelegt: ${createdPrivate.error}`);

            const open = await this.saveAclTestDog(nodesStore, 'SwaggerOpenDog', 'return { open: 1 };',
                { visibility: 'public', ownerId: 'U0' });
            const hidden = await this.saveAclTestDog(nodesStore, 'SwaggerHiddenDog', 'return { secret: "swagger-secret" };',
                { visibility: 'private', ownerId: 'U1' });
            const createdPublic = await kennelsController.create({
                id: publicId,
                name: `Swagger Public ${stamp}`,
                dogIds: [open, hidden],
                visibility: 'public',
                ownerId: 'U0',
            });
            if (!createdPublic.ok) throw new Error(`oeffentlicher Kennel nicht angelegt: ${createdPublic.error}`);

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
            const swagger = new KennelSwaggerHandler(runHandler, nodesStore);
            const anon = { user: null, isSuperUser: false };
            const call = async (method: string, id: string) => {
                const { res, out } = this.fakeResponse();
                await (swagger as any)[method]({ params: { id }, query: {}, ctx: anon, get: () => undefined }, res);
                return out;
            };

            const json = await call('handleSwaggerJson', privateId);
            const docs = await call('handleSwaggerUi', privateId);
            if (json.statusCode !== 404) throw new Error(`swagger.json privat anonym: erwartet 404, erhalten ${json.statusCode}`);
            if (docs.statusCode !== 404) throw new Error(`/docs privat anonym: erwartet 404, erhalten ${docs.statusCode}`);
            if (JSON.stringify(docs.body ?? '').includes('Swagger Private')) throw new Error('/docs verraet den Titel');

            const pub = await call('handleSwaggerJson', publicId);
            if (pub.statusCode !== 200) throw new Error(`swagger.json oeffentlich: Status ${pub.statusCode}`);
            if (JSON.stringify(pub.body).includes('swagger-secret')) throw new Error('Spec traegt das Ergebnis eines privaten Dogs');

            const withDefaults = toSwaggridCast({ id: 'x', dogIds: [], defaultQuery: { q: '1' }, defaultBody: { b: 2 } } as any, []);
            const withoutDefaults = toSwaggridCast(
                { id: 'x', dogIds: [], defaultQuery: { q: '1' }, defaultBody: { b: 2 } } as any, [], { includeDefaults: false },
            );
            if (!withDefaults.whispers || !withDefaults.offering) throw new Error('Defaults fehlen trotz includeDefaults');
            if (withoutDefaults.whispers !== undefined || withoutDefaults.offering !== undefined) {
                throw new Error('Defaults in der Spec ohne includeDefaults');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(privateId); } catch { /* ignore */ }
            try { await kennelsController.delete(publicId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: list_collaborators ist hinter canRead (Nira F4); E-Mails nur fuer Owner/Editors.
     */
    private async testListCollaboratorsGated(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: list_collaborators hinter canRead, E-Mails nur fuer Owner/Editors';
        const kennelId = `test-collaborators-${Date.now()}`;
        try {
            const created = await kennelsController.create({
                id: kennelId,
                name: `Collaborators ${kennelId}`,
                dogIds: [],
                visibility: 'private',
                ownerId: 'U1',
                editors: ['U2'],
                viewers: ['U3'],
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const users = ['U1', 'U2', 'U3'].map((id) => ({ id, email: `${id.toLowerCase()}@test.invalid`, name: null }));
            const fakePrisma = { user: { findMany: async () => users } };
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler, fakePrisma);
            const tool = getAclTools().find((t) => t.name === 'list_collaborators');
            if (!tool) throw new Error('Werkzeug list_collaborators fehlt');
            const call = (ctx: AuthCtx) => tool.handler({ entity_type: 'kennel', id: kennelId }, ctx, deps);
            const user = (id: string): AuthCtx => ({ user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false });

            const anon = await call({ user: null, isSuperUser: false });
            if (!anon.isError) throw new Error('anonym: erwartet not found');
            const stranger = await call(user('U9'));
            if (!stranger.isError) throw new Error('Fremder: erwartet not found');

            const viewer = await call(user('U3'));
            if (viewer.isError) throw new Error(`Viewer: ${viewer.content[0]?.text}`);
            const viewerBody = JSON.parse(viewer.content[0].text);
            if (viewer.content[0].text.includes('@test.invalid')) throw new Error('Viewer sieht E-Mails');
            if (viewerBody.owner?.id !== 'U1' || viewerBody.editorCount !== 1 || viewerBody.viewerCount !== 1) {
                throw new Error(`Viewer: ids/Anzahl falsch: ${viewer.content[0].text}`);
            }

            for (const id of ['U1', 'U2']) {
                const r = await call(user(id));
                if (r.isError) throw new Error(`${id}: ${r.content[0]?.text}`);
                if (!r.content[0].text.includes('u1@test.invalid')) throw new Error(`${id}: E-Mails fehlen`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Legacy POST /save mit unbekannter id legt die Node mit Create-Defaults an (Nira F5):
     * Owner = Aufrufer, visibility private — nicht herrenlos und oeffentlich.
     */
    private async testLegacySaveAppliesCreateDefaults(
        nodesStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
    ): Promise<void> {
        const testName = 'ACL: Legacy /save wendet Create-Defaults an';
        let lineageId: string | undefined;
        try {
            const registry = new ControllerRegistry();
            registry.register('nodes', nodesController);
            const handler = new ConfigRouteHandler(registry);
            const { res, out } = this.fakeResponse();
            await (handler as any).handleSave(
                {
                    query: {},
                    body: { id: `test-legacy-save-${Date.now()}`, tsCode: 'return 1;' },
                    ctx: { user: { id: 'U1', email: 'u1@test.invalid', name: null }, isSuperUser: false },
                    get: () => undefined,
                },
                res,
            );
            if (out.statusCode !== 200 || !out.body?.ok) throw new Error(`/save: ${out.statusCode} ${JSON.stringify(out.body)}`);
            lineageId = out.body.lineageId;
            if (!lineageId) throw new Error('/save lieferte keine lineageId');

            const rows = await nodesStore.findLatestVersionsByType(SerializedDog.name, [lineageId]);
            const row: any = rows[0];
            if (!row) throw new Error('gespeicherte Node nicht gefunden');
            if (row.ownerId !== 'U1') throw new Error(`ownerId erwartet U1, erhalten ${row.ownerId}`);
            if (row.visibility !== 'private') throw new Error(`visibility erwartet private, erhalten ${row.visibility}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (lineageId) await this.deleteDogLineage(nodesStore, lineageId);
        }
    }

    /**
     * Test: Import legt Dogs und Kennel mit Create-Defaults an — Owner = Importeur, privat,
     * nie herrenlos/community.
     */
    private async testImportAppliesCreateDefaults(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Import vergibt Owner und Sichtbarkeit (nie herrenlos)';
        const stamp = Date.now();
        const importId = `test-import-acl-${stamp}`;
        let importedLineages: string[] = [];
        try {
            const oldLineage = generateLineageId();
            const bundle = {
                bundleVersion: 2,
                kennel: { kennelId: `bundle-${stamp}`, name: `Bundle ${stamp}`, dogIds: [oldLineage] },
                dogs: [{
                    lineageId: oldLineage,
                    versionId: generateVersionId(),
                    displayName: 'ImportAclDog',
                    type: 'SerializedDog',
                    config: { displayName: 'ImportAclDog', theRun: 'return 1;', parentsRequired: [], parentsOptional: [] },
                }],
            };
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
            const bundleHandler = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);
            const { res, out } = this.fakeResponse();
            await (bundleHandler as any).handleImport(
                {
                    body: { ...bundle, importTarget: { kennelId: importId, name: `Import ACL ${stamp}` } },
                    ctx: { user: { id: 'UI', email: 'ui@test.invalid', name: null }, isSuperUser: false },
                },
                res,
            );
            if (out.statusCode !== 200 || !out.body?.ok) throw new Error(`Import: ${JSON.stringify(out.body)}`);
            importedLineages = Object.values(out.body.idMap ?? {}) as string[];
            const newLineage = out.body.idMap?.[oldLineage];
            if (!newLineage) throw new Error('idMap ohne den importierten Dog');

            const rows: any[] = await nodesStore.findLatestVersionsByType(SerializedDog.name, [newLineage]);
            const dog = rows[0];
            if (!dog) throw new Error('importierter Dog nicht gefunden');
            if (dog.ownerId !== 'UI') throw new Error(`Dog-ownerId erwartet UI, erhalten ${dog.ownerId}`);
            if (dog.visibility !== 'private') throw new Error(`Dog-visibility erwartet private, erhalten ${dog.visibility}`);

            const kennel: any = (await kennelsController.getById(importId)).data;
            if (!kennel) throw new Error('importierter Kennel fehlt');
            if (kennel.ownerId !== 'UI') throw new Error(`Kennel-ownerId erwartet UI, erhalten ${kennel.ownerId}`);
            if (kennel.visibility !== 'private') throw new Error(`Kennel-visibility erwartet private, erhalten ${kennel.visibility}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(importId); } catch { /* ignore */ }
            for (const lineageId of new Set(importedLineages)) await this.deleteDogLineage(nodesStore, lineageId);
        }
    }

    /**
     * Test: Legacy /save uebernimmt keine ACL-Felder aus serializedDogConfig — bestehende
     * Nodes behalten ihre, neue bekommen die Create-Defaults.
     */
    private async testLegacySaveIgnoresClientAcl(
        nodesStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
    ): Promise<void> {
        const testName = 'ACL: Legacy /save ignoriert ACL-Felder des Clients';
        let createdLineage: string | undefined;
        let existing: string | undefined;
        try {
            existing = await this.saveAclTestDog(nodesStore, 'SaveAclDog', 'return 1;',
                { visibility: 'private', ownerId: 'U1' });
            const registry = new ControllerRegistry();
            registry.register('nodes', nodesController);
            const handler = new ConfigRouteHandler(registry);
            const forged = { ownerId: 'U9', visibility: 'public', editors: 'U9', viewers: 'U9' };
            const save = async (id: string) => {
                const { res, out } = this.fakeResponse();
                await (handler as any).handleSave(
                    {
                        query: {},
                        body: { id, tsCode: 'return 2;', serializedDogConfig: forged },
                        ctx: { user: { id: 'U1', email: 'u1@test.invalid', name: null }, isSuperUser: false },
                        get: () => undefined,
                    },
                    res,
                );
                if (out.statusCode !== 200 || !out.body?.ok) throw new Error(`/save ${id}: ${out.statusCode} ${JSON.stringify(out.body)}`);
                return out.body.lineageId as string;
            };
            const check = async (lineageId: string, label: string) => {
                const row: any = (await nodesStore.findLatestVersionsByType(SerializedDog.name, [lineageId]))[0];
                if (!row) throw new Error(`${label}: Node nicht gefunden`);
                if (row.ownerId !== 'U1') throw new Error(`${label}: ownerId erwartet U1, erhalten ${row.ownerId}`);
                if (row.visibility !== 'private') throw new Error(`${label}: visibility erwartet private, erhalten ${row.visibility}`);
                if (String(row.editors ?? '').includes('U9') || String(row.viewers ?? '').includes('U9')) {
                    throw new Error(`${label}: editors/viewers vom Client uebernommen`);
                }
                const cfg = JSON.parse(row.serializedDogConfig || '{}');
                if ('ownerId' in cfg || 'visibility' in cfg) throw new Error(`${label}: ACL-Felder in serializedDogConfig gelandet`);
            };

            await check(await save(existing), 'bestehend');
            createdLineage = await save(`test-legacy-save-acl-${Date.now()}`);
            await check(createdLineage, 'neu');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (createdLineage) await this.deleteDogLineage(nodesStore, createdLineage);
            if (existing) await this.deleteDogLineage(nodesStore, existing);
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
        let cache: { getTileFeatureCache(): any; prune?(): Promise<void>; disconnect(): Promise<void> } | null = null;
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
            if (cache) {
                // Dieser Handler ist ein Test-Eigenbau NEBEN dem App-Cache: ein eigener
                // Prisma-Client mit eigenem Connection-Pool. Ohne Schliessen haengt der
                // Pool bis Prozessende an derselben Postgres wie alle anderen — genau die
                // Verbindungen, die dem Store spaeter im Pool fehlen.
                try {
                    await cache.disconnect();
                } catch { /* ignore */ }
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

