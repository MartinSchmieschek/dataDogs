// The NodesRouteHandler — summoner of the hound manifest.
// From tangent planes the dogs emerge, each bearing name and form for those who seek to know.
import { BASE_DOG_PREFIX } from '@datadogs/core';
import { ControllerRegistry } from './ConfigRouteHandler';

/** A lean description of a base dog — enough for the toolbar to display it. */
interface IBaseDogInfo {
    id: string;
    name: string;
    description: string;
    type: string;
    icon?: string;
}

export class NodesRouteHandler {
    private registry: ControllerRegistry;
    private baseDogsList: IBaseDogInfo[];

    constructor(registry: ControllerRegistry, baseDogs: any[]) {
        this.registry = registry;
        this.baseDogsList = baseDogs.map(dog => ({
            id: BASE_DOG_PREFIX + dog.name,
            name: dog.name,
            description: dog.description,
            type: 'BaseDog',
            icon: dog.icon,
        }));
    }

    registerRoutes(app: any): void {
        app.get('/api/nodes', (req: any, res: any) => this.handleList(req, res));
    }

    // GET /api/nodes — summons the manifest of hounds.
    // If ?kennelId=xxx is given, only dogs that crew that kennel are returned.
    // Without kennelId, all base dogs and all serialized dogs are returned.
    private async handleList(req: any, res: any): Promise<void> {
        try {
            const controller = this.registry.get('nodes');
            if (!controller) { res.status(404).json({ error: 'Node controller not found' }); return; }

            const kennelId = req.query.kennelId as string | undefined;

            // Only list SerializedDogs — MimicDogs are pact-bound and never appear in the toolbar.
            // listLatest() queries by entityType 'SerializedDog', so MimicDogs (type 'MimicDog') are excluded.
            const result = await controller.listLatest();
            let serializedDogs = result.ok && result.data ? result.data : [];

            // If a kennel is specified, filter to only dogs that are in that kennel's dogIds.
            if (kennelId) {
                const kennelController = this.registry.get('kennels');
                const kennelResult = kennelController ? await kennelController.getById(kennelId) : null;
                const kennelDogIds: string[] = (kennelResult?.data as any)?.dogIds ?? [];

                if (kennelDogIds.length > 0) {
                    // Build a set of all identifiers the kennel uses — both the raw entries
                    // AND the resolved dogIds (lineage GUIDs) for pinned version references.
                    const kennelSet = new Set<string>(kennelDogIds);
                    for (const kid of kennelDogIds) {
                        if (kid.startsWith(BASE_DOG_PREFIX)) continue;
                        // If this entry is a version-ID (pinned), resolve its lineageId too.
                        const match = serializedDogs.find((d: any) => d.id === kid);
                        if (match && (match as any).lineageId) {
                            kennelSet.add((match as any).lineageId);
                        }
                    }

                    // Exclude dogs already in the kennel — the toolbar shows what can be ADDED.
                    serializedDogs = serializedDogs.filter((d: any) =>
                        !kennelSet.has(d.id) && !kennelSet.has(d.lineageId)
                    );
                    const filteredBase = this.baseDogsList.filter(d => !kennelSet.has(d.id));
                    res.status(200).json({ ok: true, data: [...filteredBase, ...serializedDogs] });
                    return;
                }
            }

            res.status(200).json({ ok: true, data: [...this.baseDogsList, ...serializedDogs] });
        } catch (e) {
            console.error('[/api/nodes]', e);
            res.status(500).json({ error: String(e) });
        }
    }
}
