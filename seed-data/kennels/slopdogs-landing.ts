import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, BASE_DOG_PREFIX } from '@slopdogs/core';
import { kennelExists } from '../seed-helpers';

/** Default der Env LANDING_KENNEL_ID: der Kennel, dessen Lead-Ausgabe `/` liefert (PLAN P5). */
export const SLOPDOGS_LANDING_KENNEL_ID = 'slopdogs-landing';

/** Die vier Looks der Landing (?look=), Default c Mixtape (PLAN 8.19). */
const SKINS = [
    { key: 'a', name: 'Breakout', icon: '🧱' },
    { key: 'b', name: 'Zine', icon: '🗞️' },
    { key: 'c', name: 'Mixtape', icon: '📼' },
    { key: 'd', name: 'Neon Alley', icon: '🌃' },
] as const;

/**
 * Die Quellen des Landing-Kennels: Content-Dog, vier Skins, Lead — Dog-Code als Dateien unter
 * `seed-data/kennels/slopdogs-landing/`. Dieselben Dateien baut scripts/build-landing.cjs zum
 * statischen Fallback (`public/landing/index.html`); Kennel und Fallback koennen so nicht auseinanderlaufen.
 */
export class SlopdogsLandingSource {
    private constructor(private readonly dir: string) {}

    /** ts-node liest neben dieser Datei, dist/ (tsc kopiert keine .js-Quellen) liest im Repo. */
    static locate(): SlopdogsLandingSource | null {
        const candidates = [
            path.join(__dirname, 'slopdogs-landing'),
            path.join(__dirname, '..', '..', '..', 'seed-data', 'kennels', 'slopdogs-landing'),
            path.join(process.cwd(), 'seed-data', 'kennels', 'slopdogs-landing'),
        ];
        const dir = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'lead.js')));
        return dir ? new SlopdogsLandingSource(dir) : null;
    }

    read(fileName: string): string {
        return fs.readFileSync(path.join(this.dir, fileName), 'utf8');
    }
}

/** Ein oeffentlicher Community-Dog (ownerId null) in seiner ersten Version; liefert die lineageId. */
async function saveLandingDog(store: IStore, dog: {
    displayName: string; theRun: string; parentsRequired: string[]; icon: string; description: string;
}): Promise<string> {
    const versionId = randomUUID();
    const lineageId = randomUUID();
    const cfg = {
        id: versionId, lineageId, parentId: null,
        displayName: dog.displayName,
        description: dog.description,
        icon: dog.icon,
        parentsRequired: dog.parentsRequired,
        parentsOptional: [],
        theRun: dog.theRun,
    };
    await store.save({
        id: versionId, type: SerializedDog.name, lineageId, parentId: null,
        displayName: dog.displayName, serializedDogConfig: JSON.stringify(cfg),
        visibility: 'public', createdAt: new Date(),
    });
    return lineageId;
}

/**
 * Der Landing-Kennel (PLAN P5): `/` liefert seine Lead-Ausgabe. Idempotent wie jeder Seed — steht der
 * Kennel schon, bleibt er unberuehrt (die Instanz wird regelmaessig geleert; danach legt der Boot ihn neu an).
 */
export async function seedSlopdogsLandingKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = SLOPDOGS_LANDING_KENNEL_ID;
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const source = SlopdogsLandingSource.locate();
    if (!source) {
        console.warn(`[seed] ${kennelId}: Quellen (seed-data/kennels/slopdogs-landing/) nicht gefunden — / liefert den statischen Fallback.`);
        return;
    }

    // Wave 1: der Inhalt — reine Daten, eine Quelle fuer alle Looks.
    const contentId = await saveLandingDog(nodesStore, {
        displayName: 'SlopdogsLandingContent', theRun: source.read('content.js'), parentsRequired: [],
        icon: '🧾', description: 'SlopDogs landing copy as pure data; the four skins render it.',
    });

    // Wave 2: vier Skins, jeder rendert den Inhalt als ganze Seite.
    const skinIds: string[] = [];
    for (const skin of SKINS) {
        skinIds.push(await saveLandingDog(nodesStore, {
            displayName: `SlopdogsLandingSkin${skin.key.toUpperCase()}`, theRun: source.read(`skin_${skin.key}.js`),
            parentsRequired: [contentId], icon: skin.icon,
            description: `Landing skin ${skin.key.toUpperCase()} "${skin.name}" rendering SlopdogsLandingContent.`,
        }));
    }

    // Wave 3: der Lead waehlt per ?look= und verdrahtet /api/landing und den Host.
    const leadId = await saveLandingDog(nodesStore, {
        displayName: 'SlopdogsLandingLead', theRun: source.read('lead.js'), parentsRequired: [...skinIds, 'QueryRetriever'],
        icon: '🐕', description: 'Picks the landing skin by ?look=a|b|c|d (default c) and wires the live rankings from /api/landing.',
    });

    const now = new Date().toISOString();
    await kennelsStore.save({
        id: randomUUID(),
        type: 'KennelConfig',
        lineageId: kennelId,
        parentId: null,
        name: 'SlopDogs',
        description: 'The SlopDogs landing page, served by SlopDogs itself at /. Switch looks with ?look=a|b|c|d.',
        emoji: '🐕',
        visibility: 'public',
        dogIds: [leadId, contentId, ...skinIds, BASE_DOG_PREFIX + 'QueryRetriever'],
        nodes: JSON.stringify([
            { id: leadId, comment: 'Lead: waehlt den Skin per ?look=, haengt /api/landing und den Host an.' },
            { id: contentId, comment: 'Gemeinsamer Inhalt, eine Quelle fuer alle Looks.' },
            ...SKINS.map((skin, i) => ({ id: skinIds[i], comment: `Skin ${skin.key.toUpperCase()} ${skin.name}.` })),
            { id: BASE_DOG_PREFIX + 'QueryRetriever', comment: 'Traegt ?look= herein.' },
        ]),
        task: '## Wunsch\nDie SlopDogs-Landing ist selbst ein Kennel: ein Inhalt, vier Looks, Umschalter per ?look=, Default c (Mixtape).\n\n'
            + '## Quelle\nseed-data/kennels/slopdogs-landing/ (Seed); der statische Fallback public/landing/index.html wird daraus gebaut (scripts/build-landing.cjs).\n\n'
            + '## Betrieb\nGET / bedient die Lead-Ausgabe aus einem HTML-Memo je Look (LANDING_HTML_MEMO_MS), Quelle landing (rankt nicht). PLAN P5.',
        createdAt: now,
        updatedAt: now,
    });

    console.log(`✅ Seeded SlopDogs Landing Kennel (kennelId: ${kennelId})`);
}
