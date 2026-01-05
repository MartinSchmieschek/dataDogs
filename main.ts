import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { ISerializedDogConfig, SerializedDog } from './dogs/SerializedDog';
import { Results, Waves } from './ui/results';
import { KennelRun, IKennelConfig } from './core/KennelRun';
import { Controller } from './api/Controller';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelList } from './ui/kennelList';
import { KennelEditor } from './ui/kennelEditor';
import { StartupTest } from './StartupTest';

// ENTRY: start wird als erstes aufgerufen beim Programmstart
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
    
    // Separate Store-Instanzen für Nodes und Kennels
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);
    
    // Init Stores
    if ((nodesStore as any).init) await (nodesStore as any).init();
    if ((kennelsStore as any).init) await (kennelsStore as any).init();

    // Seed: Ensure at least one SerializedDog exists in DB
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        const seedCfg = {
            theRun: `
                const response = await fetch("https://dummyjson.com/recipes");
                const json = await response.json();
                const retrive = RandomRecipesRetriever.difficulty;
                return retrive;
                `,
            version: 1,
        } as ISerializedDogConfig;

        await nodesStore.save({ id: 'seed-serialized-1-v1', type: SerializedDog.name, serializedDogConfig: seedCfg });
        console.log('✅ Seeded initial SerializedDog into DB');
    }

    // Seed: Ensure at least one Kennel-Config exists in DB
    // Liste aller verfügbaren Basis-Dog-Klassen (für Instanziierung bei jedem Run)
    const allBaseDogClasses = [
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever,
        TalkingDog
    ];
    
    // Erstelle Instanzen für die Kennel-Liste (nur für Anzeige)
    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());
    
    // Präfix für BaseDog-IDs (lokal definiert, nicht aus core importiert)
    const BASE_DOG_PREFIX = 'base:';
    
    // Map von BaseDog-Namen zu Klassen (für KennelRun - erstellt neue Instanzen bei jedem Run)
    const baseDogsMap = new Map<string, new () => any>();
    allBaseDogClasses.forEach(DogClass => {
        const instance = new DogClass();
        baseDogsMap.set(instance.name, DogClass);
    });
    
    const kennelSeeds = await kennelsStore.findByType('KennelConfig');
    if (!kennelSeeds || kennelSeeds.length === 0) {
        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds: allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name),
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

    const app = express();
    const port = 3000;

    app.use(express.json());

    // Controller-Registry erstellen und Controller registrieren
    const registry = new ControllerRegistry();
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name);
    const kennelsController = new Controller<IKennelConfig>(kennelsStore, 'KennelConfig', true);
    registry.register('nodes', nodesController);
    // Kennels haben Versionsverwaltung - beim Speichern wird eine neue Version erstellt
    registry.register('kennels', kennelsController);

    // Startup-Tests ausführen
    const startupTest = new StartupTest();
    await startupTest.runAllTests(
        nodesStore,
        kennelsStore,
        nodesController,
        kennelsController,
        baseDogsMap
    );

    // Spezielle /api/nodes Route VOR dem generischen Route-System registrieren
    // (wichtig: muss vor registerRoutes sein, damit sie nicht von /api/:subpath abgefangen wird)
    app.get('/api/nodes', async (req: any, res: any) => {
        try {
            const controller = registry.get('nodes');
            if (!controller) {
                res.status(404).json({ error: 'Node-Controller nicht gefunden' });
                return;
            }

            // Lade SerializedDogs
            const result = await controller.list();
            const serializedDogs = result.ok && result.data ? result.data : [];

            // Erstelle BaseDogs-Liste
            const baseDogsList = allBaseDogs.map(dog => ({
                id: BASE_DOG_PREFIX + dog.name,
                name: dog.name,
                type: 'BaseDog'
            }));

            console.log(`[main.ts /api/nodes] BaseDogs:`, baseDogsList);
            console.log(`[main.ts /api/nodes] SerializedDogs:`, serializedDogs.length);

            // Kombiniere BaseDogs und SerializedDogs
            const combinedData = [...baseDogsList, ...serializedDogs];
            res.status(200).json({ ok: true, data: combinedData });
        } catch (e) {
            console.error(`[main.ts /api/nodes] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    });

    // Generisches Route-System registrieren
    const routeHandler = new ConfigRouteHandler(registry);
    routeHandler.registerRoutes(app, '/api');

    // Route für Kennel-Liste (ohne ID)
    app.get('/kennel', async (req: any, res: any) => {
        try {
            // Lade alle Kennels und filtere nur die neuesten Versionen
            const allKennels = await kennelsStore.findByType('KennelConfig');
            
            // Gruppiere nach Basis-ID und behalte nur die neueste Version
            const kennelsMap = new Map<string, any>();
            allKennels.forEach((k: any) => {
                const baseId = k.id.replace(/-v\d+$/, '');
                const existing = kennelsMap.get(baseId);
                if (!existing || (k.version || 0) > (existing.version || 0)) {
                    kennelsMap.set(baseId, k);
                }
            });
            
            const kennels = Array.from(kennelsMap.values()).map((k: any) => {
                const config = typeof k.serializedDogConfig === 'string' 
                    ? JSON.parse(k.serializedDogConfig) 
                    : k.serializedDogConfig;
                return {
                    id: k.id.replace(/-v\d+$/, ''), // Basis-ID ohne Version
                    name: config.name,
                    description: config.description
                };
            });
            
            const html = KennelList.buildKennelListHtml(kennels);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });



    // Route für Root - zeigt Liste aller Kennels
    app.get('/', async (req: any, res: any) => {
        try {
            // Lade alle Kennels und filtere nur die neuesten Versionen
            const allKennels = await kennelsStore.findByType('KennelConfig');
            
            // Gruppiere nach Basis-ID und behalte nur die neueste Version
            const kennelsMap = new Map<string, any>();
            allKennels.forEach((k: any) => {
                const baseId = k.id.replace(/-v\d+$/, '');
                const existing = kennelsMap.get(baseId);
                if (!existing || (k.version || 0) > (existing.version || 0)) {
                    kennelsMap.set(baseId, k);
                }
            });
            
            const kennels = Array.from(kennelsMap.values()).map((k: any) => {
                const config = typeof k.serializedDogConfig === 'string' 
                    ? JSON.parse(k.serializedDogConfig) 
                    : k.serializedDogConfig;
                return {
                    id: k.id.replace(/-v\d+$/, ''), // Basis-ID ohne Version
                    name: config.name,
                    description: config.description
                };
            });
            
            const html = KennelList.buildKennelListHtml(kennels);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });

    // Route für Editor-UI (Node Editor mit Graph)
    app.get('/edit/:kennelId', async (req: any, res: any) => {
        try {
            const kennelId = req.params.kennelId;
            
            // Prüfe ob es eine API-Route ist
            if (kennelId === 'api' || kennelId === 'kennel') {
                return;
            }
            
            // Lade neueste Version der Kennel-Config
            const latestVersions = await kennelsStore.findLatestVersionsByType('KennelConfig', [kennelId]);
            
            let kennelConfig: IKennelConfig | undefined;
            
            if (latestVersions && latestVersions.length > 0) {
                const kennelData = latestVersions[0].serializedDogConfig;
                kennelConfig = typeof kennelData === 'string' 
                    ? JSON.parse(kennelData) 
                    : kennelData;
                console.log(`[main] Geladene Kennel-Config (neueste Version): ${kennelId}`, JSON.stringify(kennelConfig, null, 2));
            } else {
                // Fallback: Versuche direkt zu laden (falls keine Versionierung)
                const kennelData = await kennelsStore.load(kennelId);
                if (kennelData) {
                    kennelConfig = typeof kennelData === 'string' 
                        ? JSON.parse(kennelData) 
                        : kennelData;
                    console.log(`[main] Geladene Kennel-Config (direkt): ${kennelId}`, JSON.stringify(kennelConfig, null, 2));
                } else {
                    console.log(`[main] Kennel-Config ${kennelId} nicht gefunden`);
                    res.status(404).send(`Kennel ${kennelId} nicht gefunden`);
                    return;
                }
            }
            
            // Factory-Funktion für SerializedDogs
            const serializedDogFactory = async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
                const loadedVersions = await nodesStore.findLatestVersionsByType(SerializedDog.name, ids);
                return loadedVersions.map((sd: any) => {
                    const config = typeof sd.serializedDogConfig === 'string' 
                        ? JSON.parse(sd.serializedDogConfig) 
                        : sd.serializedDogConfig;
                    return new SerializedDog(config, sd.id);
                });
            };
            
            // Erstelle KennelRun mit Config, BaseDog-Klassen und SerializedDog-Factory
            const kennelRun = new KennelRun(kennelConfig, baseDogsMap, serializedDogFactory);
            
            try {
                const waves = await kennelRun.run();
                const html = Results.buildWavesHtml(waves, kennelConfig);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(html);
            } catch (runError: any) {
                // Prüfe ob es der "Nothing to harvest" Fehler ist
                const errorMessage = runError?.message || String(runError);
                if (errorMessage.includes("Nothing to harvest")) {
                    // Zeige Fehlerseite für leeren Kennel
                    const html = Results.buildEmptyKennelHtml(runError, kennelConfig);
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.send(html);
                } else {
                    // Andere Fehler normal behandeln
                    throw runError;
                }
            }
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });

    // Route für Ergebnis-Ausgabe
    app.get('/api/kennels/:kennelId/result', async (req: any, res: any) => {
        try {
            const kennelId = req.params.kennelId;
            
            // Lade neueste Version der Kennel-Config
            const latestVersions = await kennelsStore.findLatestVersionsByType('KennelConfig', [kennelId]);
            
            if (!latestVersions || latestVersions.length === 0) {
                res.status(404).json({ error: `Kennel ${kennelId} nicht gefunden` });
                return;
            }
            
            const kennelData = latestVersions[0].serializedDogConfig;
            const kennelConfig: IKennelConfig = typeof kennelData === 'string' 
                ? JSON.parse(kennelData) 
                : kennelData;
            
            // Nimm den ersten Hund aus der dogIds-Liste
            const dogIds = kennelConfig.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }
            
            const targetDogId = dogIds[0];
            
            // Factory-Funktion für SerializedDogs
            const serializedDogFactory = async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
                const loadedVersions = await nodesStore.findLatestVersionsByType(SerializedDog.name, ids);
                return loadedVersions.map((sd: any) => {
                    const config = typeof sd.serializedDogConfig === 'string' 
                        ? JSON.parse(sd.serializedDogConfig) 
                        : sd.serializedDogConfig;
                    return new SerializedDog(config, sd.id);
                });
            };
            
            // Führe Kennel aus
            const kennelRun = new KennelRun(kennelConfig, baseDogsMap, serializedDogFactory);
            const waves = await kennelRun.run();
            
            if (!waves || waves.length === 0) {
                res.status(404).json({ error: 'Keine Hunde im Rudel gefunden' });
                return;
            }
            
            // Finde den Hund in den Waves
            // Entferne "base:" Präfix für BaseDogs, da Waves nur den Namen ohne Präfix enthalten
            const searchId = targetDogId.startsWith('base:') 
                ? targetDogId.substring(5) // Entferne "base:"
                : targetDogId;
            
            let oldestDog = null;
            for (const wave of waves) {
                for (const node of wave) {
                    // Vergleiche mit und ohne Version, mit und ohne base: Präfix
                    if (node.id === searchId || 
                        node.id === targetDogId ||
                        node.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '') ||
                        node.id.replace(/-v\d+$/, '') === targetDogId.replace(/-v\d+$/, '')) {
                        oldestDog = node;
                        break;
                    }
                }
                if (oldestDog) break;
            }
            
            if (!oldestDog) {
                res.status(404).json({ error: `Hund ${targetDogId} nicht in den Waves gefunden` });
                return;
            }
            
            // Gib nur das result zurück (HTML oder JSON)
            const result = oldestDog.result;
            if (typeof result === 'string' && (result.trim().startsWith('<html') || result.trim().startsWith('<!DOCTYPE') || (result.trim().startsWith('<') && result.includes('</')))) {
                // HTML
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.status(200).send(result);
            } else {
                // JSON
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.status(200).json(result);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
        }
    });

    // Route für einzelne Kennel über Root-Path (/:kennelId)
    // Gibt die Ergebnisse vom ersten Hund in der dogIds-Liste zurück
    app.get('/:kennelId', async (req: any, res: any) => {
        try {
            const kennelId = req.params.kennelId;
            
            // Prüfe ob es eine API-Route ist
            if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') {
                return;
            }
            
            // Lade neueste Version der Kennel-Config
            const latestVersions = await kennelsStore.findLatestVersionsByType('KennelConfig', [kennelId]);
            
            if (!latestVersions || latestVersions.length === 0) {
                res.status(404).json({ error: `Kennel ${kennelId} nicht gefunden` });
                return;
            }
            
            const kennelData = latestVersions[0].serializedDogConfig;
            const kennelConfig: IKennelConfig = typeof kennelData === 'string' 
                ? JSON.parse(kennelData) 
                : kennelData;
            
            // Nimm den ersten Hund aus der dogIds-Liste
            const dogIds = kennelConfig.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }
            
            const targetDogId = dogIds[0];
            
            // Factory-Funktion für SerializedDogs
            const serializedDogFactory = async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
                const loadedVersions = await nodesStore.findLatestVersionsByType(SerializedDog.name, ids);
                return loadedVersions.map((sd: any) => {
                    const config = typeof sd.serializedDogConfig === 'string' 
                        ? JSON.parse(sd.serializedDogConfig) 
                        : sd.serializedDogConfig;
                    return new SerializedDog(config, sd.id);
                });
            };
            
            // Führe Kennel aus
            const kennelRun = new KennelRun(kennelConfig, baseDogsMap, serializedDogFactory);
            const waves = await kennelRun.run();
            
            if (!waves || waves.length === 0) {
                res.status(404).json({ error: 'Keine Hunde im Rudel gefunden' });
                return;
            }
            
            // Finde den Hund in den Waves
            // Entferne "base:" Präfix für BaseDogs, da Waves nur den Namen ohne Präfix enthalten
            const searchId = targetDogId.startsWith('base:') 
                ? targetDogId.substring(5) // Entferne "base:"
                : targetDogId;
            
            let firstDog = null;
            for (const wave of waves) {
                for (const node of wave) {
                    // Vergleiche mit und ohne Version
                    if (node.id === searchId || 
                        node.id === targetDogId ||
                        node.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '') ||
                        node.id.replace(/-v\d+$/, '') === targetDogId.replace(/-v\d+$/, '')) {
                        firstDog = node;
                        break;
                    }
                }
                if (firstDog) break;
            }
            
            if (!firstDog) {
                res.status(404).json({ error: `Hund ${targetDogId} nicht in den Waves gefunden` });
                return;
            }
            
            // Gib nur das result zurück (HTML oder JSON)
            const result = firstDog.result;
            if (typeof result === 'string' && (result.trim().startsWith('<html') || result.trim().startsWith('<!DOCTYPE') || (result.trim().startsWith('<') && result.includes('</')))) {
                // HTML
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.status(200).send(result);
            } else {
                // JSON
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.status(200).json(result);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
        }
    });


    console.log('App started.');
    app.listen(port, () => {
        console.log(`✅ Server läuft auf http://localhost:${port}`);
    });
}
