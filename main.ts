import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { QueryRetriever } from './dogs/QueryRetriever';
import { BodyRetriever } from './dogs/BodyRetriever';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { ISerializedDogConfig, SerializedDog } from './dogs/SerializedDog';
import { Results, Waves } from './ui/results';
import { KennelRun, IKennelConfig } from './KennelRun';
import { Controller } from './api/Controller';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelList } from './ui/kennelList';
import { KennelEditor } from './ui/kennelEditor';
import { StartupTest } from './StartupTest';
import { runSeeds } from './seed';

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

    // Run Seeds
    await runSeeds(nodesStore, kennelsStore);

    // Liste aller verfügbaren Basis-Dog-Klassen (für Instanziierung bei jedem Run)
    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever,
        QueryRetriever,
        BodyRetriever
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

    const app = express();
    const port = 3000;

    app.use(express.json());

    // Controller-Registry erstellen und Controller registrieren
    const registry = new ControllerRegistry();
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name);
    const kennelsController = new KennelController(kennelsStore);
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
                // Neue Struktur: direkte Felder (KEIN serializedDogConfig mehr!)
                return {
                    id: k.id.replace(/-v\d+$/, ''), // Basis-ID ohne Version
                    name: k.name,
                    description: k.description,
                    defaultQuery: k.defaultQuery ? (typeof k.defaultQuery === 'string' ? JSON.parse(k.defaultQuery) : k.defaultQuery) : undefined,
                    defaultBody: k.defaultBody !== null && k.defaultBody !== undefined ? (typeof k.defaultBody === 'string' ? JSON.parse(k.defaultBody) : k.defaultBody) : undefined
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
            
            // Lade Kennel-Config über Controller (verwendet parseEntity)
            const result = await kennelsController.getById(kennelId);
            if (!result.ok || !result.data) {
                console.log(`[main] Kennel-Config ${kennelId} nicht gefunden`);
                res.status(404).send(`Kennel ${kennelId} nicht gefunden`);
                return;
            }
            const kennelConfig: IKennelConfig = result.data;
            console.log(`[main] Geladene Kennel-Config: ${kennelId}`, JSON.stringify(kennelConfig, null, 2));
            
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
            
            // Verwende defaultQuery/defaultBody aus Config für Editor-Run
            const queryData = kennelConfig?.defaultQuery || {};
            const bodyData = kennelConfig?.defaultBody;
            
            // Erstelle KennelRun mit Config, BaseDog-Klassen und SerializedDog-Factory
            const kennelRun = new KennelRun(kennelConfig, baseDogsMap, serializedDogFactory, queryData, bodyData);
            
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


    // Route für einzelne Kennel über Root-Path (/:kennelId)
    // Gibt die Ergebnisse vom ersten Hund in der dogIds-Liste zurück
    // GET: Query-Parameter werden an QueryRetriever übergeben
    // POST: Body-Daten werden an BodyRetriever übergeben
    app.get('/:kennelId', async (req: any, res: any) => {
        try {
            const kennelId = req.params.kennelId;
            
            // Prüfe ob es eine API-Route ist
            if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') {
                return;
            }
            
            // Lade Kennel-Config über Controller (verwendet parseEntity)
            const kennelResult1 = await kennelsController.getById(kennelId);
            if (!kennelResult1.ok || !kennelResult1.data) {
                res.status(404).json({ error: `Kennel ${kennelId} nicht gefunden` });
                return;
            }
            const kennelConfig: IKennelConfig = kennelResult1.data;
            
            // Nimm den ersten Hund aus der dogIds-Liste
            const dogIds = kennelConfig.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }
            
            const targetDogId = dogIds[0];
            
            // Extrahiere Query-Parameter aus Request und merge mit defaultQuery
            const queryData: Record<string, string> = {};
            
            // Starte mit defaultQuery aus Config (falls vorhanden)
            if (kennelConfig.defaultQuery) {
                Object.assign(queryData, kennelConfig.defaultQuery);
            }
            
            // Request-Query-Parameter überschreiben defaultQuery
            Object.keys(req.query).forEach(key => {
                const value = req.query[key];
                queryData[key] = typeof value === 'string' ? value : String(value);
            });
            
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
            
            // Führe Kennel aus mit Query-Daten
            const kennelRun = new KennelRun(kennelConfig, baseDogsMap, serializedDogFactory, queryData, undefined);
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

    // POST Route für Body-Daten
    app.post('/:kennelId', async (req: any, res: any) => {
        try {
            const kennelId = req.params.kennelId;
            
            // Prüfe ob es eine API-Route ist
            if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') {
                return;
            }
            
            // Lade Kennel-Config über Controller (verwendet parseEntity)
            const kennelResult1 = await kennelsController.getById(kennelId);
            if (!kennelResult1.ok || !kennelResult1.data) {
                res.status(404).json({ error: `Kennel ${kennelId} nicht gefunden` });
                return;
            }
            const kennelConfig: IKennelConfig = kennelResult1.data;
            
            // Nimm den ersten Hund aus der dogIds-Liste
            const dogIds = kennelConfig.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }
            
            const targetDogId = dogIds[0];
            
            // Extrahiere Query-Parameter aus Request und merge mit defaultQuery
            const queryData: Record<string, string> = {};
            
            // Starte mit defaultQuery aus Config (falls vorhanden)
            if (kennelConfig.defaultQuery) {
                Object.assign(queryData, kennelConfig.defaultQuery);
            }
            
            // Request-Query-Parameter überschreiben defaultQuery
            Object.keys(req.query).forEach(key => {
                const value = req.query[key];
                queryData[key] = typeof value === 'string' ? value : String(value);
            });
            
            // Body-Daten: Request-Body überschreibt defaultBody
            // BodyRetriever vorübergehend deaktiviert
            // let bodyData = kennelConfig.defaultBody;
            // if (req.body && Object.keys(req.body).length > 0) {
            //     bodyData = req.body;
            // }
            let bodyData = undefined;
            
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
            
            // Führe Kennel aus mit Query- und Body-Daten
            const kennelRun = new KennelRun(kennelConfig, baseDogsMap, serializedDogFactory, queryData, bodyData);
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
