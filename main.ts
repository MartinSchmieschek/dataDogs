import { TypeDefBuilder } from './ui/TypeDefBuilder';
import { promises } from 'dns';
import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { IHuntingDog, IHuntingDog as IDog } from "./core/enities/IHuntingDog"
import { IHuntingSeason } from "./core/enities/IHuntingSeason"
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { AsciiArt, AsciiPrinter } from './AsciiPrinter';
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { writeFileSync } from 'fs';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { FoodPornRetriever } from './dogs/FoodPornRetriever';
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { SeasonRunner } from './core/harverster';
//import { NodeEntry, Results, Waves } from './results';
import { ISerializedDogConfig, SerializedDog } from './dogs/SerializedDog';
import { NodeEntry, Results, Waves } from './ui/results';

// ENTRY: start wird als erstes aufgerufen beim Programmstart
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
    const store: IStore = new PrismaStore(dbUrl);
    // init if available
    if ((store as any).init) await (store as any).init();

    // Ensure at least one SerializedDog seed exists in DB
    const seeds = await store.findByType(SerializedDog.name);
    if (!seeds || seeds.length === 0) {
        const seedCfg = {
            theRun: `
                const response = await fetch("https://dummyjson.com/recipes");
                const json = await response.json();
                const retrive = RandomRecipesRetriever.difficulty;
                return retrive;
                `,
            version: 1,
        } as ISerializedDogConfig;

        await store.save({ id: 'seed-serialized-1-v1', type: SerializedDog.name, serializedDogConfig: seedCfg });
        console.log('Seeded initial SerializedDog into DB');
    }

    const app = express();
    const port = 3000;

    app.use(express.json());

    // einfache Route
    app.get('/', async (req: any, res: any) => {
        try {
            const kennel = await fillKennel(store);
            const waves = await runSeason(kennel);
            const html = Results.buildWavesHtml(waves);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });

    // Route zum Speichern von SerializedDogs
    app.post('/api/saveSerializedDog', async (req: any, res: any) => {
        try {
            await store.save(req.body);
            res.status(200).json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: String(e) });
        }
    });

    // Route zum Speichern von Node-Code (kompatibel mit UI) - mit Auto-Versionierung
    app.post('/save', async (req: any, res: any) => {
        try {
            const id = req.query.id || req.body.id;
            const tsCode = req.body.tsCode || req.body.code;
            const parentsRequired = req.body.parentsRequired || [];
            const parentsOptional = req.body.parentsOptional || [];
            const serializedDogConfig = req.body.serializedDogConfig; // Config aus UI
            
            if (!id || !tsCode) {
                return res.status(400).json({ error: 'id and tsCode are required' });
            }

            // Extrahiere Basis-ID (ohne Version)
            const baseId = extractBaseId(id);
            
            // Finde nächste Versionsnummer
            const nextVersionId = await getNextVersionId(baseId, store);
            const nextVersion = parseInt(nextVersionId.match(/-v(\d+)$/)?.[1] || '1', 10);
            
            // Wenn Config aus UI übergeben wurde, verwende diese
            let config: ISerializedDogConfig;
            if (serializedDogConfig) {
                config = {
                    ...serializedDogConfig,
                    theRun: tsCode,
                    version: nextVersion,
                    parentsRequired: parentsRequired || serializedDogConfig.parentsRequired || [],
                    parentsOptional: parentsOptional || serializedDogConfig.parentsOptional || []
                };
            } else {
                // Lade existierenden Config - versuche zuerst aktuelle ID, dann suche nach neuester Version
                let existing = await store.load(id);
                
                // Wenn nicht gefunden, suche nach neuester Version dieser Basis-ID
                if (!existing) {
                    const allVersions = await store.findByType(SerializedDog.name);
                    const baseId = extractBaseId(id);
                    const matchingVersions = allVersions.filter((v: any) => {
                        const vBaseId = extractBaseId(v.id);
                        return vBaseId === baseId;
                    });
                    
                    if (matchingVersions.length > 0) {
                        // Sortiere nach version aus Config
                        matchingVersions.sort((a: any, b: any) => {
                            const aConfig = typeof a.serializedDogConfig === 'string' ? JSON.parse(a.serializedDogConfig) : a.serializedDogConfig;
                            const bConfig = typeof b.serializedDogConfig === 'string' ? JSON.parse(b.serializedDogConfig) : b.serializedDogConfig;
                            return (bConfig.version || 0) - (aConfig.version || 0);
                        });
                        existing = matchingVersions[0].serializedDogConfig;
                    }
                }
                
                if (existing) {
                    config = typeof existing === 'string' ? JSON.parse(existing) : existing;
                } else {
                    config = { theRun: '', version: 1, parentsRequired: [], parentsOptional: [] };
                }

                // Update Config
                config.theRun = tsCode;
                config.version = nextVersion; // Setze Versionsnummer in Config
                // Immer aktualisieren, auch wenn leer
                config.parentsRequired = parentsRequired || [];
                config.parentsOptional = parentsOptional || [];
            }

            // Speichere als neue Version
            console.log(`[save] Speichere neue Version: ${nextVersionId}, version: ${nextVersion}`);
            console.log(`[save] Config:`, JSON.stringify(config, null, 2));
            
            await store.save({ 
                id: nextVersionId, 
                type: SerializedDog.name, 
                serializedDogConfig: config 
            });
            
            console.log(`[save] Erfolgreich gespeichert: ${nextVersionId}`);
            res.status(200).json({ ok: true, id: nextVersionId });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: String(e) });
        }
    });

    // Route zum Erstellen neuer SerializedDog Nodes
    app.post('/api/nodes', async (req: any, res: any) => {
        try {
            const baseId = req.body.baseId || `node-${Date.now()}`;
            const tsCode = req.body.tsCode || req.body.theRun || '';
            const parentsRequired = req.body.parentsRequired || [];
            const parentsOptional = req.body.parentsOptional || [];
            
            const config: ISerializedDogConfig = {
                theRun: tsCode,
                version: 1,
                parentsRequired,
                parentsOptional
            };

            // Erste Version: baseId-v1
            const firstVersionId = `${baseId}-v1`;
            
            await store.save({ 
                id: firstVersionId, 
                type: SerializedDog.name, 
                serializedDogConfig: config 
            });
            
            res.status(200).json({ ok: true, id: firstVersionId });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: String(e) });
        }
    });

    // Route zum Löschen von SerializedDog Nodes
    app.delete('/api/nodes/:id', async (req: any, res: any) => {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'id is required' });
            }

            await store.delete(id);
            res.status(200).json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: String(e) });
        }
    });

    console.log('App started.');
    app.listen(port, () => {
        console.log(`✅ Server läuft auf http://localhost:${port}`);
    });
}

// Füllt den Zwinger mit Hunden
async function fillKennel(store: IStore): Promise<Array<IDog<unknown>>> {
    const kennel: Array<IDog<unknown>> = [
        new RandomRecipesRetriever(),
        new CountryFlagBlackLab(),
        new DishFlagBlackLab(),
        new RandomEveryThingRetriever(),
        //new FoodPornRetriever(), // deactivated to much requests for this api key
        new TalkingDog(),
    ];

    // Lade SerializedDogs aus DB (nur neueste Version jeder Basis-ID)
    const toLoad = await store.findByType(SerializedDog.name);
    console.log(`[fillKennel] Gefundene SerializedDogs in DB: ${toLoad.length}`);
    
    // Gruppiere nach Basis-ID und wähle neueste Version (nutze version aus Config als Sort-Index)
    const latestVersions = new Map<string, { id: string; serializedDogConfig: string; version: number }>();
    
    toLoad.forEach((sd: any) => {
        // Parse Config um version zu lesen
        const config = typeof sd.serializedDogConfig === 'string' 
            ? JSON.parse(sd.serializedDogConfig) 
            : sd.serializedDogConfig;
        
        // Extrahiere Basis-ID
        const versionMatch = sd.id.match(/-v(\d+)$/);
        const baseId = versionMatch ? extractBaseId(sd.id) : sd.id;
        
        // Nutze version aus Config, fallback auf ID-Extraktion
        const version = config.version || (versionMatch ? parseInt(versionMatch[1], 10) : 0);
        
        console.log(`[fillKennel] Verarbeite: ${sd.id}, baseId: ${baseId}, version: ${version}`);
        
        const existing = latestVersions.get(baseId);
        
        if (!existing) {
            latestVersions.set(baseId, { ...sd, version });
        } else {
            // Wähle die höhere Versionsnummer (aus Config)
            if (version > existing.version) {
                console.log(`[fillKennel] Ersetze ${existing.id} (v${existing.version}) durch ${sd.id} (v${version})`);
                latestVersions.set(baseId, { ...sd, version });
            } else {
                console.log(`[fillKennel] Behalte ${existing.id} (v${existing.version}), ignoriere ${sd.id} (v${version})`);
            }
        }
    });
    
    console.log(`[fillKennel] Lade ${latestVersions.size} neueste Versionen`);
    
    // Lade nur neueste Versionen
    Array.from(latestVersions.values()).forEach((sd: any) => {
        try {
            const config = typeof sd.serializedDogConfig === 'string' 
                ? JSON.parse(sd.serializedDogConfig) 
                : sd.serializedDogConfig;
            console.log(`[fillKennel] Lade Config für ${sd.id}:`, JSON.stringify(config, null, 2));
            const dog = new SerializedDog(config, sd.id);
            console.log(`[fillKennel] Lade SerializedDog: ${sd.id}, name: ${dog.name}, parentsRequired: ${config.parentsRequired?.length || 0}, parentsOptional: ${config.parentsOptional?.length || 0}`);
            kennel.push(dog);
        } catch (e) {
            console.error('Failed to load SerializedDog:', e);
        }
    });

    return kennel;
}

// Führt die Jagd/Wellen aus
async function runSeason(kennel: Array<IDog<unknown>>): Promise<Waves> {
    const hunt = new SeasonRunner({ kennel });
    const theHunt = await hunt.run();

    console.log(theHunt);

    // Baue Wellen-Struktur
    const waves: Waves = [];
    theHunt.wave.forEach((wave: any) => {
        // Remap Objects, that is no fun and schould be never done!
        waves.push(wave.map((entry: any) => {
            //create Waves dog entry 
            const nodeEntry = {
                id: (entry.instance instanceof SerializedDog) 
                    ? (entry.instance as SerializedDog<unknown>).storageId 
                    : entry.instance.name,
                name: entry.instance.name,
                result: entry.instance.collected,
                error: (entry.instance as any).__error || undefined,  // Fehler falls vorhanden
                parentsOptional: [],
                parentsRequired: [],
            } as NodeEntry;

            // add additional codeTs if SerializedDog
            if (entry.instance instanceof SerializedDog) {
                const seDog = entry.instance as SerializedDog<unknown>;
                nodeEntry.codeTs = seDog.instanceConfig.theRun;
                const vmCtx = seDog.simpleVmContext || {};
                nodeEntry.vmContextTypeDef = TypeDefBuilder.buildContextLib(seDog.name, vmCtx);
                // Übergebe die vollständige Config an die UI (aus DB, nicht aus Runtime)
                nodeEntry.serializedDogConfig = {
                    theRun: seDog.instanceConfig.theRun,
                    version: seDog.instanceConfig.version,
                    parentsRequired: seDog.instanceConfig.parentsRequired || [],
                    parentsOptional: seDog.instanceConfig.parentsOptional || []
                };
                // Nutze die Config-Werte für parentsRequired/Optional (aus DB)
                nodeEntry.parentsRequired = seDog.instanceConfig.parentsRequired || [];
                nodeEntry.parentsOptional = seDog.instanceConfig.parentsOptional || [];
            } else {
                // Für nicht-SerializedDogs: nutze Runtime-Werte
                nodeEntry.parentsOptional = [...entry.optionalRequiresFrom ? entry.optionalRequiresFrom.map((r: any) => {
                    return (r.instance instanceof SerializedDog) 
                        ? (r.instance as SerializedDog<unknown>).storageId 
                        : r.instance.name;
                }) : []];
                nodeEntry.parentsRequired = [...entry.requiresFrom ? entry.requiresFrom.map((r: any) => {
                    return (r.instance instanceof SerializedDog) 
                        ? (r.instance as SerializedDog<unknown>).storageId 
                        : r.instance.name;
                }) : []];
            }

            return nodeEntry;
        }));
    });

    return waves;
}

// =========================================================
// VERSIONIERUNGS-HELPER
// =========================================================

/**
 * Extrahiert die Basis-ID aus einer Version-ID
 * z.B. "seed-serialized-1-v2" -> "seed-serialized-1"
 */
function extractBaseId(id: string): string {
    const match = id.match(/^(.+)-v\d+$/);
    return match ? match[1] : id;
}

/**
 * Findet die nächste Versionsnummer für eine Basis-ID
 * z.B. wenn "seed-serialized-1-v1" existiert, gibt "seed-serialized-1-v2" zurück
 */
async function getNextVersionId(baseId: string, store: IStore): Promise<string> {
    const allNodes = await store.findByType(SerializedDog.name);
    
    // Finde alle Versionen dieser Basis-ID
    const versions = allNodes
        .map(n => n.id)
        .filter(id => {
            const match = id.match(/^(.+)-v(\d+)$/);
            return match && match[1] === baseId;
        })
        .map(id => {
            const match = id.match(/-v(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .sort((a, b) => b - a); // Sortiere absteigend
    
    // Wenn keine Version existiert, starte mit v1
    if (versions.length === 0) {
        return `${baseId}-v1`;
    }
    
    // Nächste Versionsnummer ist die höchste + 1
    const nextVersion = versions[0] + 1;
    return `${baseId}-v${nextVersion}`;
}


