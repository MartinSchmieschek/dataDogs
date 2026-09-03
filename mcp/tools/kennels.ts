// Kennel tools — list, get, create, update, delete, run, execute, plus
// granular kennel-detail accessors (defaultBody, defaultQuery, task, layout, versions).
// Each respects the visibility/ownership rules; super-user (dev mode) bypasses.

import { canRead, canMutate, filterReadable, applyCreateDefaults } from '../auth/visibility';
import { type ToolDef, type ToolDeps, ok, fail, resolveTsCode, codeHinweise } from './types';
import type { AuthCtx } from '../auth/middleware';
import { SPUREN_NODES_FIELD_HINT, SPUREN_TASK_FIELD_HINT } from '../spuren-brief';

/** Status notebook — see mcp/skill.md § Spuren & Rechtfertigung */
const KENNEL_TRACE_NODE_SCHEMA = {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
        id: {
            type: 'string',
            description:
                'dogIds entry: lineageId, version GUID, or base:Name. In build_kennel the dogs are created in the very same call, so use the sibling syntax "@DisplayName" (or the bare displayName) — it is resolved to the fresh lineageId for you.',
        },
        x: { type: 'number', description: 'Wave-View canvas X (optional)' },
        y: { type: 'number', description: 'Wave-View canvas Y (optional)' },
        comment: {
            type: 'string',
            description: SPUREN_NODES_FIELD_HINT,
        },
    },
} as const;

const KENNEL_TRACE_EDGE_SCHEMA = {
    type: 'object',
    required: ['fromId', 'toId'],
    additionalProperties: false,
    properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
        comment: { type: 'string', description: 'Optional — grobe Wunsch-Kette (z.B. „Ort → Kandidaten“), kein Feld-Mapping' },
    },
} as const;

const KENNEL_TRACE_FIELDS = {
    task: {
        type: 'string',
        description: SPUREN_TASK_FIELD_HINT,
    },
    nodes: {
        type: 'array',
        description: SPUREN_NODES_FIELD_HINT,
        items: KENNEL_TRACE_NODE_SCHEMA,
    },
    edges: {
        type: 'array',
        description: 'Optional — Wunsch-Kette in einem Satz pro Kante, nicht technisches Mapping.',
        items: KENNEL_TRACE_EDGE_SCHEMA,
    },
} as const;

/**
 * Was an Spuren wirklich haengengeblieben ist -- und was fehlt.
 *
 * Die Spuren-Pflicht stand bisher nur in Prosa (MCP-`initialize`, Tool-Beschreibungen), waehrend
 * das Schema `task`/`nodes` als optional auswies. Prosa, die ein Agent einmal beim Verbinden
 * sieht, verliert gegen ein Schema, das "kannst du weglassen" sagt -- also wurde sie weggelassen.
 * Ein Werkzeug-ERGEBNIS liest der Agent dagegen jedes Mal. Darum meldet jede Pack-Aenderung
 * zurueck, was fehlt, und nennt die ids gleich so, wie sie fuer update_kennel gebraucht werden.
 *
 * Bewusst KEIN harter Zwang ueber `required`: ein erzwungenes, leeres Pflichtfeld ist schlechter
 * als eine ehrliche Luecke -- und wuerde jeden bestehenden Aufrufer brechen.
 */
function spurenReport(task: unknown, nodes: unknown, dogIds: unknown) {
    const ids: string[] = Array.isArray(dogIds) ? dogIds.filter((d): d is string => typeof d === 'string') : [];
    const hasTask = typeof task === 'string' && task.trim().length > 0;
    const list: any[] = Array.isArray(nodes) ? nodes : [];
    const commented = new Set(
        list
            .filter((n) => n && typeof n.comment === 'string' && n.comment.trim().length > 0)
            .map((n) => String(n.id)),
    );
    const missingComments = ids.filter((id) => !commented.has(id));
    const complete = hasTask && missingComments.length === 0;
    return {
        complete,
        task: hasTask ? 'gesetzt' : 'FEHLT',
        commentedDogs: `${ids.length - missingComments.length}/${ids.length}`,
        missingComments,
        ...(complete
            ? {}
            : {
                  hint:
                      'Spuren unvollstaendig. Bevor du "fertig" meldest: update_kennel mit ' +
                      (hasTask ? '' : 'task (Wunsch in vier Bloecken) und ') +
                      'nodes:[{id, comment}] fuer die oben genannten ids nachreichen.',
              }),
    };
}

/**
 * Inline MCP-AuthCtx -> VmGlobalCapabilityContext adapter.
 * Mirrors KennelRunHandler.toCapabilityCtx, but lives here so the MCP tools
 * don't crash on runtimes whose compiled KennelRunHandler predates that
 * method (Welle 9 hotfix). Returns undefined for missing ctx so the core's
 * capabilities stay raw, matching the legacy behaviour.
 */
function authCtxToCapabilityCtx(ctx: AuthCtx | undefined | null):
    { userId: string | null; isSuperUser: boolean } | undefined {
    if (!ctx) return undefined;
    return {
        userId: ctx.user?.id ?? null,
        isSuperUser: !!ctx.isSuperUser,
    };
}

/** Minimal projection for list_kennels — no payloads, no layout. */
function leanKennel(k: any) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        name: k.name,
        emoji: k.emoji,
        dogCount: Array.isArray(k.dogIds) ? k.dogIds.length : 0,
        visibility: k.visibility ?? 'public',
        updatedAt: k.updatedAt,
    };
}

/** Header projection for get_kennel — payload presence flagged, not dumped. */
function kennelHeader(k: any) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        parentId: k.parentId ?? null,
        name: k.name,
        description: k.description,
        emoji: k.emoji,
        dogIds: Array.isArray(k.dogIds) ? k.dogIds : [],
        visibility: k.visibility ?? 'public',
        ownerId: k.ownerId ?? null,
        hasDefaultBody: k.defaultBody !== undefined && k.defaultBody !== null,
        hasDefaultQuery: !!(k.defaultQuery && Object.keys(k.defaultQuery).length > 0),
        hasTask: typeof k.task === 'string' && k.task.length > 0,
        hasNodes: Array.isArray(k.nodes) && k.nodes.length > 0,
        hasEdges: Array.isArray(k.edges) && k.edges.length > 0,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
    };
}

export function getKennelTools(): ToolDef[] {
    return [
        {
            name: 'list_kennels',
            description:
                'Lists kennels visible to the current user. Returns minimal metadata only (id, lineageId, name, emoji, dogCount, visibility, updatedAt). Use get_kennel for the header, and the get_kennel_* tools for payload fields.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => {
                const result = await deps.kennelsController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                const visible = filterReadable(result.data ?? [], ctx);
                return ok(visible.map(leanKennel));
            },
        },
        {
            name: 'get_kennel',
            description:
                'Returns the header of one kennel — identity, dogIds, visibility, owner, and presence flags for the heavy fields (defaultBody/defaultQuery/task/nodes/edges). Use get_kennel_default_body / _default_query / _task / _layout to fetch those.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(result.error ?? 'not found');
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok(kennelHeader(result.data));
            },
        },
        {
            name: 'get_kennel_default_body',
            description: 'Returns the kennel\'s defaultBody JSON.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ defaultBody: (result.data as any).defaultBody ?? null });
            },
        },
        {
            name: 'get_kennel_default_query',
            description: 'Returns the kennel\'s defaultQuery map.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ defaultQuery: (result.data as any).defaultQuery ?? {} });
            },
        },
        {
            name: 'get_kennel_task',
            description: 'Returns the kennel\'s task markdown (mission briefing). null if unset.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ task: (result.data as any).task ?? null });
            },
        },
        {
            name: 'get_kennel_layout',
            description:
                'Returns layout annotations (nodes positions + edges comments) for the kennel\'s wave-view canvas.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({
                    nodes: (result.data as any).nodes ?? [],
                    edges: (result.data as any).edges ?? [],
                });
            },
        },
        {
            name: 'get_kennel_versions',
            description:
                'Lists every version of a kennel\'s lineage. Returns slim version refs (id, parentId, createdAt, displayName) — fetch a specific version\'s details via get_kennel(versionId).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const head = await deps.kennelsController.getById(id);
                if (!head.ok || !head.data) return fail(`Kennel ${id} not found`);
                if (!canRead(head.data as any, ctx)) return fail(`Kennel ${id} not found`);
                const versions = await deps.kennelsController.getVersions(id);
                return ok(
                    versions.map((v) => ({
                        id: v.id,
                        parentId: v.parentId ?? null,
                        createdAt: v.createdAt ?? null,
                        displayName: (v.config as any)?.name ?? null,
                    })),
                );
            },
        },
        {
            name: 'create_kennel',
            description:
                'Creates a new kennel. Defaults visibility to "private" and ownerId to the current user. Pass "visibility":"public" to make it publicly accessible. dogIds is the ordered pack — first entry is the lead. **Spuren:** `task` (User-Wunsch) + `nodes[]` (ein Satz pro Hund) — siehe mcp/skill.md § Spuren & Rechtfertigung. Use refresh_kennel_snapshot afterwards to see the run state.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogIds'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'kennel id (becomes lineageId)' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    emoji: { type: 'string' },
                    dogIds: { type: 'array', items: { type: 'string' } },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    visibility: { type: 'string', enum: ['public', 'private'] },
                    ...KENNEL_TRACE_FIELDS,
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to create kennels');
                const input = applyCreateDefaults(args, ctx);
                const result = await deps.kennelsController.create(input);
                if (!result.ok) return fail(result.error ?? 'create failed');
                const d = result.data as any;
                return ok({
                    id: result.id,
                    lineageId: d?.lineageId,
                    name: d?.name,
                    dogCount: Array.isArray(d?.dogIds) ? d.dogIds.length : 0,
                    visibility: d?.visibility ?? 'public',
                    spuren: spurenReport(d?.task, d?.nodes, d?.dogIds),
                });
            },
        },
        {
            name: 'build_kennel',
            description:
                'Composed one-shot kennel build. Creates a fresh set of Breeds (SerializedDogs / Mimics) AND assembles a kennel that uses them — atomic, with rollback on failure. **Lead convention:** by default the **LAST** dog in `dogs[]` becomes the lead (renderers / finalizers typically sit at the end of a pipeline). Pass `lead: "<displayName>"` to override. **Spuren:** `task` + `nodes[]` beim Create (Wunsch, kein Vertrag — mcp/skill.md § Spuren & Rechtfertigung). Sibling dogs reference each other by displayName via "@DisplayName" in parentsRequired/Optional; BaseDogs are referenced as bare class names ("QueryRetriever"), and raw lineageId GUIDs pass through unchanged. If `refresh` is true (default), the kennel is hunted once and the lead\'s spoils are previewed in the response. Rollback semantics: any failure during the build deletes every node already created in this call and the kennel row (if any) — no orphans left in the deep. **firstRun.status values:** `ok` (every dog clean), `lead-ok-with-side-errors` (lead returned cleanly but some upstream/side dog errored — public endpoint still serves), `lead-failed` (the lead itself errored — public endpoint is broken), `failed` (the run could not even be observed: worker crash, kennel vanished). `firstRun.leadOk` is a bool shortcut: true means the public endpoint serves the lead\'s payload.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogs'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'kennel id (becomes lineageId)' },
                    name: { type: 'string' },
                    emoji: { type: 'string' },
                    description: { type: 'string' },
                    vmTimeoutMs: {
                        type: 'number',
                        minimum: 1,
                        description: 'Per-run VM timeout in ms for the first hunt (run-time-only, NOT persisted). Overrides DATADOGS_VM_TIMEOUT_MS (default 10000).',
                    },
                    visibility: { type: 'string', enum: ['public', 'private'] },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    ...KENNEL_TRACE_FIELDS,
                    dogs: {
                        type: 'array',
                        description:
                            'SerializedDogs to create. Each yields a fresh lineageId; later dogs can reference earlier siblings via "@<displayName>" in parentsRequired/Optional. Order matters: a referenced sibling must appear earlier in this array. Each dog requires EITHER tsCode (raw string) OR tsCodeBase64 (utf8 base64) — the base64 form avoids JSON-escape hell for code with backticks/newlines/template literals.',
                        items: {
                            type: 'object',
                            required: ['displayName'],
                            additionalProperties: false,
                            properties: {
                                displayName: { type: 'string' },
                                tsCode: { type: 'string', description: 'TypeScript body (return yields the spoils). Mutually exclusive with tsCodeBase64.' },
                                tsCodeBase64: { type: 'string', description: 'utf8-encoded base64 of the TypeScript body — use to avoid JSON-escape hell. Mutually exclusive with tsCode.' },
                                icon: { type: 'string' },
                                parentsRequired: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description:
                                        'Use bare class names for BaseDogs (e.g. "QueryRetriever" or "base:QueryRetriever"), "@DisplayName" to ref a sibling dog from this build, or a raw lineageId GUID.',
                                },
                                parentsOptional: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Same syntax as parentsRequired.',
                                },
                                imitates: {
                                    type: 'string',
                                    description:
                                        'PactProviderName, e.g. "WeatherQueryProvider" — makes this a MimicDog.',
                                },
                            },
                        },
                    },
                    extraDogIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Additional dogIds to include in the kennel besides the newly-created ones. Typically "base:XxxRetriever" or known lineageIds. Appended after the newly-created lineageIds; never displaces the lead.',
                    },
                    lead: {
                        type: 'string',
                        description:
                            'displayName of the Lead dog (the one whose result is served at /:kennelId). Must match one of the entries in `dogs[].displayName`. Default: the LAST dog in `dogs[]` becomes lead, since in a pipeline the renderer/finalizer typically sits at the end of the chain.',
                    },
                    refresh: {
                        type: 'boolean',
                        description:
                            'If true (default), refresh + wait for first run after creating, and include leadResult preview in the response.',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to build kennels');
                return await buildKennel(args, ctx, deps);
            },
        },
        {
            name: 'update_kennel',
            description:
                'Updates an existing kennel — creates a new version. Only the owner (or super-user) can update. Pass only the fields you want to change; others are preserved. **Spuren:** `task` + `nodes[]` — User-Wunsch festhalten, nicht JSON-Vertrag (mcp/skill.md § Spuren & Rechtfertigung). Use refresh_kennel_snapshot afterwards to see the run state.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    emoji: { type: 'string' },
                    dogIds: { type: 'array', items: { type: 'string' } },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    visibility: { type: 'string', enum: ['public', 'private'] },
                    ...KENNEL_TRACE_FIELDS,
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.kennelsController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Kennel ${id} not found`);
                if (!canMutate(existing.data as any, ctx)) {
                    return fail(canRead(existing.data as any, ctx) ? 'Not authorized' : `Kennel ${id} not found`);
                }
                const result = await deps.kennelsController.save({ ...args, id } as any);
                if (!result.ok) return fail(result.error ?? 'update failed');
                const d = result.data as any;
                return ok({
                    id: result.id,
                    lineageId: d?.lineageId,
                    name: d?.name,
                    dogCount: Array.isArray(d?.dogIds) ? d.dogIds.length : 0,
                    visibility: d?.visibility ?? 'public',
                    spuren: spurenReport(d?.task, d?.nodes, d?.dogIds),
                });
            },
        },
        {
            name: 'delete_kennel',
            description:
                'Deletes a kennel and ALL its versions. Only the owner (or super-user) can delete. Irreversible — every dog dies forever.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.kennelsController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Kennel ${id} not found`);
                if (!canMutate(existing.data as any, ctx)) {
                    return fail(canRead(existing.data as any, ctx) ? 'Not authorized' : `Kennel ${id} not found`);
                }
                const result = await deps.kennelsController.delete(id);
                if (!result.ok) return fail(result.error ?? 'delete failed');
                return ok({ deleted: id });
            },
        },
        {
            name: 'run_kennel',
            description:
                'Runs a kennel and returns the full Waves payload — every dog\'s yield, code, vmContext, errors and timing. WARNING: this can be megabytes per call (5–20 MB on rich kennels). Prefer refresh_kennel_snapshot + the get_snapshot_* / get_kennel_snapshot_* tools for granular access. Use run_kennel only when you truly need every dog\'s details in one shot. Optional `vmTimeoutMs` overrides the per-dog VM execution budget for this single run (resolution: vmTimeoutMs > DATADOGS_VM_TIMEOUT_MS env > 10000ms default) -- not persisted.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    query: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                        description: 'query parameters (overrides defaultQuery)',
                    },
                    body: { description: 'body data (overrides defaultBody)' },
                    vmTimeoutMs: {
                        type: 'number',
                        minimum: 1,
                        description: 'Per-run VM timeout in ms. Overrides DATADOGS_VM_TIMEOUT_MS (default 10000). Run-time-only, not persisted.',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const config = await deps.kennelRunHandler.loadKennelConfig(String(args.id));
                if (!config) return fail(`Kennel ${args.id} not found`);
                if (!canRead(config as any, ctx)) return fail(`Kennel ${args.id} not found`);
                const query = deps.kennelRunHandler.mergeQueryParams(
                    config.defaultQuery,
                    (args.query as Record<string, any>) ?? {},
                );
                const body = args.body !== undefined ? args.body : config.defaultBody;
                const vmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                    ? args.vmTimeoutMs
                    : undefined;
                try {
                    const waves = await deps.kennelRunHandler.runKennel(
                        config, query, body, authCtxToCapabilityCtx(ctx), vmTimeoutMs,
                    );
                    return ok({ waves, kennelConfig: config });
                } catch (err: any) {
                    return fail(err?.message ?? String(err));
                }
            },
        },
        {
            name: 'execute_kennel',
            description:
                'Runs a kennel and returns ONLY the lead dog\'s result — the public-facing payload. Use this when you want the spoils, not the diagnostic. The lead is the first entry in dogIds. Optional `vmTimeoutMs` overrides the per-dog VM execution budget for this run (resolution: vmTimeoutMs > DATADOGS_VM_TIMEOUT_MS env > 10000ms default) -- not persisted.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    query: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                    },
                    body: {},
                    vmTimeoutMs: {
                        type: 'number',
                        minimum: 1,
                        description: 'Per-run VM timeout in ms. Overrides DATADOGS_VM_TIMEOUT_MS (default 10000). Run-time-only, not persisted.',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const config = await deps.kennelRunHandler.loadKennelConfig(String(args.id));
                if (!config) return fail(`Kennel ${args.id} not found`);
                if (!canRead(config as any, ctx)) return fail(`Kennel ${args.id} not found`);
                const dogIds = config.dogIds ?? [];
                if (dogIds.length === 0) return fail('Kennel has no dogs');
                const query = deps.kennelRunHandler.mergeQueryParams(
                    config.defaultQuery,
                    (args.query as Record<string, any>) ?? {},
                );
                const body = args.body !== undefined ? args.body : config.defaultBody;
                const vmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                    ? args.vmTimeoutMs
                    : undefined;
                try {
                    const waves = await deps.kennelRunHandler.runKennel(
                        config, query, body, authCtxToCapabilityCtx(ctx), vmTimeoutMs,
                    );
                    const lead = findDogInWaves(waves, dogIds[0]);
                    if (!lead) return fail(`Lead ${dogIds[0]} not in waves`);
                    return ok(lead.result);
                } catch (err: any) {
                    return fail(err?.message ?? String(err));
                }
            },
        },
    ];
}

function findDogInWaves(waves: any, dogId: string): { result: any; error?: string } | null {
    if (!waves || !Array.isArray(waves)) return null;
    const searchId = dogId.startsWith('base:') ? dogId.substring(5) : dogId;
    for (const wave of waves) {
        const dogs = Array.isArray(wave) ? wave : wave?.dogs;
        if (!dogs) continue;
        for (const d of dogs) {
            if (d.id === searchId || d.lineageId === searchId || d.displayName === searchId || d.name === searchId) {
                // The lead's error must reach the firstRun-status switch — convertSeasonToWaves
                // brands a crashed dog with `error` (from `__error`), and dropping it here makes
                // `leadOk` lie when the lead itself detonated.
                return { result: d.result, error: d.error };
            }
        }
    }
    return null;
}

// ─── build_kennel implementation ────────────────────────────────────────────
// Composed flow: create N nodes, then a kennel that references them, then
// optionally hunt once and return the lead preview. On any failure: rollback.

interface DogSpec {
    displayName: string;
    tsCode?: string;
    tsCodeBase64?: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
    imitates?: string;
}

/**
 * Resolve a parent ref against the sibling map.
 * - "@DisplayName" → lineageId of the sibling (must already exist in the map).
 * - "base:X" → passed through unchanged.
 * - bare class name "X" matching a known BaseDog (heuristic: starts uppercase,
 *   no dashes) → passed through unchanged (the runtime resolves it via
 *   baseDogsMap).
 * - raw lineageId GUID → passed through unchanged.
 */
function resolveParentRef(
    ref: string,
    siblingMap: Map<string, string>,
): string {
    if (typeof ref !== 'string' || ref.length === 0) {
        throw new Error(`Invalid parent ref: ${JSON.stringify(ref)}`);
    }
    if (ref.startsWith('@')) {
        const name = ref.substring(1);
        const lineageId = siblingMap.get(name);
        if (!lineageId) {
            throw new Error(
                `Sibling reference "@${name}" not yet built. Order dogs depth-first: a referenced sibling must appear earlier in the dogs array.`,
            );
        }
        return lineageId;
    }
    return ref;
}

function previewLeadResult(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.length > 200 ? value.substring(0, 200) + '…' : value;
    }
    if (value === null || value === undefined) return value;
    try {
        const json = JSON.stringify(value);
        if (json.length <= 200) return value;
        return json.substring(0, 200) + '…';
    } catch {
        return String(value);
    }
}

async function buildKennel(
    args: Record<string, any>,
    ctx: AuthCtx,
    deps: ToolDeps,
) {
    const kennelId = typeof args.id === 'string' ? args.id.trim() : '';
    if (!kennelId) return fail('id is required');
    const rawDogs = Array.isArray(args.dogs) ? (args.dogs as DogSpec[]) : null;
    if (!rawDogs || rawDogs.length === 0) {
        return fail('dogs array is required and must be non-empty');
    }

    // Validate displayNames are unique within this build — otherwise @-refs are ambiguous.
    // Also pre-resolve tsCode/tsCodeBase64 per dog (each dog needs exactly one).
    const seenNames = new Set<string>();
    const resolvedCode = new Map<string, string>(); // displayName -> tsCode
    for (const dog of rawDogs) {
        if (!dog || typeof dog.displayName !== 'string' || dog.displayName.length === 0) {
            return fail('every dog must have a non-empty displayName');
        }
        if (seenNames.has(dog.displayName)) {
            return fail(
                `duplicate displayName "${dog.displayName}" in dogs[] — sibling references via "@${dog.displayName}" would be ambiguous`,
            );
        }
        seenNames.add(dog.displayName);
        try {
            resolvedCode.set(dog.displayName, resolveTsCode({ tsCode: dog.tsCode, tsCodeBase64: dog.tsCodeBase64 }));
        } catch (err: any) {
            return fail(`dog "${dog.displayName}": ${err?.message ?? String(err)}`);
        }
    }

    const extraDogIds: string[] = Array.isArray(args.extraDogIds)
        ? (args.extraDogIds as string[]).filter((s) => typeof s === 'string' && s.length > 0)
        : [];

    // Lead resolution — explicit `lead` overrides the default; default is the LAST dog in dogs[].
    // The Lead is the dog whose result is served at /:kennelId. In a pipeline the renderer
    // sits at the end, so making the last entry the Lead matches the caller's typical intent
    // (and frees them from having to reorder Renderer-before-Producer just to satisfy lead = dogs[0]).
    const leadDisplayName: string | null =
        typeof args.lead === 'string' && args.lead.trim().length > 0 ? args.lead.trim() : null;
    let leadIndex = rawDogs.length - 1; // default: last entry
    if (leadDisplayName) {
        const idx = rawDogs.findIndex((d) => d.displayName === leadDisplayName);
        if (idx < 0) {
            return fail(
                `lead "${leadDisplayName}" does not match any dog in dogs[] (available: ${rawDogs
                    .map((d) => d.displayName)
                    .join(', ')})`,
            );
        }
        leadIndex = idx;
    }

    // Rollback ledger — created node lineageIds, oldest first.
    const createdNodeLineageIds: string[] = [];
    let kennelCreated = false;

    const rollback = async (reason: string): Promise<void> => {
        // Drop the kennel first (so nothing references the dying nodes mid-delete).
        if (kennelCreated) {
            try {
                await deps.kennelsController.delete(kennelId);
            } catch (err) {
                console.error(`[build_kennel rollback] failed to delete kennel ${kennelId}:`, err);
            }
        }
        for (const lineageId of createdNodeLineageIds) {
            try {
                // Delete every version of the node lineage so no orphan rows linger.
                const versions = await deps.nodesController.getVersions(lineageId);
                for (const v of versions) {
                    try {
                        await deps.nodesController.delete(v.id);
                    } catch (err) {
                        console.error(`[build_kennel rollback] failed to delete node version ${v.id}:`, err);
                    }
                }
                // Fallback: try by lineageId directly in case getVersions found nothing.
                if (versions.length === 0) {
                    try { await deps.nodesController.delete(lineageId); } catch { /* swallow */ }
                }
            } catch (err) {
                console.error(`[build_kennel rollback] failed to enumerate versions for ${lineageId}:`, err);
            }
        }
        if (createdNodeLineageIds.length > 0 || kennelCreated) {
            console.error(`[build_kennel] rolled back: ${reason}`);
        }
    };

    try {
        const siblingMap = new Map<string, string>(); // displayName → lineageId
        const builtDogs: Array<{ displayName: string; lineageId: string }> = [];

        for (const spec of rawDogs) {
            const required = Array.isArray(spec.parentsRequired)
                ? spec.parentsRequired.map((ref) => resolveParentRef(ref, siblingMap))
                : [];
            const optional = Array.isArray(spec.parentsOptional)
                ? spec.parentsOptional.map((ref) => resolveParentRef(ref, siblingMap))
                : [];

            const createInput: Record<string, any> = {
                displayName: spec.displayName,
                theRun: resolvedCode.get(spec.displayName) ?? '',
                parentsRequired: required,
                parentsOptional: optional,
            };
            if (typeof spec.icon === 'string') createInput.icon = spec.icon;
            if (typeof spec.imitates === 'string' && spec.imitates.length > 0) {
                createInput.imitates = spec.imitates;
            }

            const withDefaults = applyCreateDefaults(createInput, ctx);
            const created = await deps.nodesController.create(withDefaults);
            if (!created.ok) {
                await rollback(`create_node failed for "${spec.displayName}": ${created.error}`);
                return fail(
                    `create_node failed for "${spec.displayName}": ${created.error ?? 'unknown error'}`,
                );
            }
            const lineageId = (created.data as any)?.lineageId;
            if (!lineageId || typeof lineageId !== 'string') {
                await rollback(`create_node for "${spec.displayName}" returned no lineageId`);
                return fail(`create_node for "${spec.displayName}" returned no lineageId`);
            }
            createdNodeLineageIds.push(lineageId);
            siblingMap.set(spec.displayName, lineageId);
            builtDogs.push({ displayName: spec.displayName, lineageId });
        }

        // Compose the kennel — Lead goes to position 0, the rest in original order.
        // `createdNodeLineageIds` is already in dogs[] order, so we just shift the leadIndex entry.
        const orderedLineageIds: string[] = (() => {
            if (leadIndex === 0) return [...createdNodeLineageIds];
            const reordered: string[] = [];
            reordered.push(createdNodeLineageIds[leadIndex]);
            createdNodeLineageIds.forEach((lid, i) => {
                if (i !== leadIndex) reordered.push(lid);
            });
            return reordered;
        })();
        const dogIds = [...orderedLineageIds, ...extraDogIds];
        const kennelInput: Record<string, any> = {
            id: kennelId,
            dogIds,
        };
        if (typeof args.name === 'string') kennelInput.name = args.name;
        if (typeof args.emoji === 'string') kennelInput.emoji = args.emoji;
        if (typeof args.description === 'string') kennelInput.description = args.description;
        // vmTimeoutMs ist Run-Time-Param und wandert NICHT in den Kennel (Welle 12 Korrektur).
        if (args.visibility === 'public' || args.visibility === 'private') {
            kennelInput.visibility = args.visibility;
        }
        if (args.defaultQuery && typeof args.defaultQuery === 'object') {
            kennelInput.defaultQuery = args.defaultQuery;
        }
        if (args.defaultBody !== undefined) {
            kennelInput.defaultBody = args.defaultBody;
        }
        if (typeof args.task === 'string') kennelInput.task = args.task;
        // Spuren-ids aufloesen: bei build_kennel entstehen die Hunde ERST in diesem Aufruf -- der
        // Agent kann ihre lineageIds unmoeglich kennen, sein einziger Griff ist der displayName
        // (wie bei parentsRequired auch, dort per "@Name"). Ohne diese Aufloesung landen die
        // Kommentare an ids, die in dogIds nie vorkommen: gespeichert, aber an nichts gehaengt.
        // Alles Unbekannte bleibt unveraendert (lineageId, Version-GUID, base:Name).
        const resolveTraceId = (rawId: unknown): unknown => {
            if (typeof rawId !== 'string' || rawId.length === 0) return rawId;
            const key = rawId.startsWith('@') ? rawId.slice(1) : rawId;
            return siblingMap.get(key) ?? rawId;
        };
        if (Array.isArray(args.nodes)) {
            kennelInput.nodes = args.nodes.map((n: any) =>
                n && typeof n === 'object' ? { ...n, id: resolveTraceId(n.id) } : n,
            );
        }
        if (Array.isArray(args.edges)) {
            kennelInput.edges = args.edges.map((e: any) =>
                e && typeof e === 'object'
                    ? { ...e, fromId: resolveTraceId(e.fromId), toId: resolveTraceId(e.toId) }
                    : e,
            );
        }
        const kennelWithDefaults = applyCreateDefaults(kennelInput, ctx);
        const kennelResult = await deps.kennelsController.create(kennelWithDefaults);
        if (!kennelResult.ok) {
            await rollback(`create_kennel failed: ${kennelResult.error}`);
            return fail(`create_kennel failed: ${kennelResult.error ?? 'unknown error'}`);
        }
        kennelCreated = true;
        const kennelData = kennelResult.data as any;
        const kennelLineageId = kennelData?.lineageId ?? kennelId;

        // Optional first-run preview.
        const refresh = args.refresh !== false;
        // status-Semantik (Welle 11):
        //   'ok'                        — every dog returned cleanly (errorCount === 0)
        //   'lead-ok-with-side-errors'  — lead has no error, but at least one other dog did
        //   'lead-failed'               — the lead itself errored (downstream consumers will see undefined)
        //   'failed'                    — the run could not be observed (worker crash, kennel vanished, ...)
        let firstRun:
            | {
                  status: 'ok' | 'lead-ok-with-side-errors' | 'lead-failed' | 'failed';
                  leadOk: boolean;
                  durationMs: number;
                  errorCount: number;
                  leadDogId: string | null;
                  leadResultPreview: unknown;
                  error?: string;
              }
            | undefined;

        if (refresh) {
            const startedAt = Date.now();
            try {
                const freshConfig = await deps.kennelRunHandler.loadKennelConfig(kennelLineageId);
                if (!freshConfig) {
                    firstRun = {
                        status: 'failed',
                        leadOk: false,
                        durationMs: Date.now() - startedAt,
                        errorCount: 0,
                        leadDogId: null,
                        leadResultPreview: null,
                        error: 'kennel vanished between create and refresh',
                    };
                } else {
                    const mergedQuery = deps.kennelRunHandler.mergeQueryParams(
                        freshConfig.defaultQuery,
                        {},
                    );
                    const buildVmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                        ? args.vmTimeoutMs
                        : undefined;
                    const waves = await deps.kennelRunHandler.runKennel(
                        freshConfig,
                        mergedQuery,
                        freshConfig.defaultBody,
                        authCtxToCapabilityCtx(ctx),
                        buildVmTimeoutMs,
                    );

                    // Cache the snapshot so subsequent get_snapshot_* calls work directly.
                    deps.snapshotCache.startJob(
                        kennelLineageId,
                        freshConfig.id,
                        mergedQuery,
                        freshConfig.defaultBody,
                        ctx.user?.id ?? null,
                    );

                    const leadRef = freshConfig.dogIds?.[0];
                    const lead = leadRef ? findDogInWaves(waves, leadRef) : null;
                    const flat: any[] = (waves as any[]).flat();
                    const errorCount = flat.filter((d) => d?.error).length;
                    const leadOk = !!lead && !(lead as any)?.error;

                    deps.snapshotCache.markOk(kennelLineageId, {
                        waves: waves as any,
                        kennelConfig: freshConfig,
                        leadDogId: lead ? leadRef ?? undefined : undefined,
                        leadResult: lead?.result,
                    });

                    let status: 'ok' | 'lead-ok-with-side-errors' | 'lead-failed';
                    if (errorCount === 0) {
                        status = 'ok';
                    } else if (leadOk) {
                        status = 'lead-ok-with-side-errors';
                    } else {
                        status = 'lead-failed';
                    }

                    firstRun = {
                        status,
                        leadOk,
                        durationMs: Date.now() - startedAt,
                        errorCount,
                        leadDogId: leadRef ?? null,
                        leadResultPreview: previewLeadResult(lead?.result),
                    };
                }
            } catch (err: any) {
                // The kennel was created successfully — a failed first hunt is
                // not a build failure, it's just the dogs telling us the code
                // needs work. Surface it, don't roll back.
                deps.snapshotCache.markFailed(kennelLineageId, err?.message ?? String(err));
                firstRun = {
                    status: 'failed',
                    leadOk: false,
                    durationMs: Date.now() - startedAt,
                    errorCount: 0,
                    leadDogId: null,
                    leadResultPreview: null,
                    error: err?.message ?? String(err),
                };
            }
        }

        // Waechter: build_kennel legt die Dogs selbst an (nicht ueber das create_node-Tool),
        // also wird hier geprueft. Rein beratend -- der Bau laeuft, der Hinweis steht in der Antwort.
        const hinweise: string[] = [];
        for (const spec of rawDogs) {
            const code = resolvedCode.get(spec.displayName);
            for (const h of codeHinweise(code, spec)) {
                hinweise.push(`${spec.displayName}: ${h}`);
            }
        }

        return ok({
            kennelId,
            kennelLineageId,
            publicUrl: `/${kennelId}`,
            runUrl: `/api/kennels/${kennelId}/run`,
            dogs: builtDogs,
            ...(hinweise.length ? { hinweise } : {}),
            spuren: spurenReport(kennelInput.task, kennelInput.nodes, dogIds),
            ...(firstRun ? { firstRun } : {}),
        });
    } catch (err: any) {
        await rollback(`unexpected error: ${err?.message ?? String(err)}`);
        return fail(`build_kennel failed: ${err?.message ?? String(err)}`);
    }
}
