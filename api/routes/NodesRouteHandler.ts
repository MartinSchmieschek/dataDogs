// The NodesRouteHandler — summoner of the hound manifest.
// From tangent planes the dogs emerge, each bearing name and form for those who seek to know.
import { BASE_DOG_PREFIX, SerializedDog } from '@slopdogs/core';
import { ControllerRegistry } from './ConfigRouteHandler';
import { filterReadable } from '../../mcp/auth/visibility';
import { ListQuery } from './ListQuery';

/** A lean description of a base dog — enough for the toolbar to display it. */
interface IBaseDogInfo {
    id: string;
    name: string;
    description: string;
    type: string;
    icon?: string;
    /** The name this dog is bound under in a child's VM context. */
    contextName: string;
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
            // A base dog binds under its own IHuntingDog.name (its class name) — the same
            // getter SerializedDog.name implements via toCamelCase. One source, two dog kinds.
            contextName: dog.name,
        }));
    }

    /**
     * The name a dog is bound under when it serves as a parent in the VM context.
     * Derived with the very function that fills the context — never a second copy of it,
     * or the UI would one day confidently display a name that does not exist at runtime.
     */
    private static contextNameOf(dog: any): string {
        const source = dog?.displayName ?? dog?.name ?? dog?.lineageId ?? dog?.id;
        return typeof source === 'string' && source.length > 0 ? SerializedDog.toCamelCase(source) : '';
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
            const listQuery = ListQuery.from(req.query);

            // Only list SerializedDogs — MimicDogs are pact-bound and never appear in the toolbar.
            // listLatest() queries by entityType 'SerializedDog', so MimicDogs (type 'MimicDog') are excluded.
            const result = await controller.listLatest();
            let serializedDogs = result.ok && result.data ? result.data : [];
            // Visibility filter FIRST: anonymous sees only public; logged-in sees public + own private.
            // It has to precede `total` and the page, or `total` would betray how many foreign
            // private dogs exist and the pages would come out with holes.
            // BaseDogs are always visible (they are project-wide infrastructure, no per-user concept).
            serializedDogs = filterReadable(serializedDogs as any[], req.ctx);
            // Additive: the name this dog answers to inside a child's VM context.
            serializedDogs = (serializedDogs as any[]).map(dog => ({
                ...dog,
                contextName: NodesRouteHandler.contextNameOf(dog),
            }));

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
                    const scoped = [...filteredBase, ...serializedDogs];
                    res.status(200).json(listQuery.envelope(listQuery.apply(scoped, req.ctx)));
                    return;
                }
            }

            // Base dogs take part in search, order and paging: they share one list with the
            // serialized dogs, so cutting the page after the merge is the only way page 1 and
            // page 2 stay free of overlaps. `mine=1` drops them — nobody owns infrastructure.
            const all = [...this.baseDogsList, ...serializedDogs];
            res.status(200).json(listQuery.envelope(listQuery.apply(all, req.ctx)));
        } catch (e) {
            console.error('[/api/nodes]', e);
            res.status(500).json({ error: String(e) });
        }
    }
}
