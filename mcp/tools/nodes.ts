// Node (Hunter / Breed) tools — list, create, save code, get versions.
// Nodes carry the same rights model as Kennels (NONE < RUN < READ < EDIT < OWN): each
// Breed has an ownerId, optional editors/viewers/runners, and is public, run-only or
// private. Referencing a node from a kennel grants no edit right (see canMutateNode).

import {
    canManageAcl,
    canRead,
    canRun,
    canMutate,
    isFrozen,
    normalizeVisibility,
    filterRunnable,
    applyCreateDefaults,
    withMyRights,
    VISIBILITIES,
} from '../auth/visibility';
import { canMutateNode } from '../auth/permissions';
import { ListQuery } from '../../api/routes/ListQuery';
import { type ToolDef, ok, fail, resolveTsCode, codeHinweise } from './types';
import { checkSerializedDogCode, sanitizeLineDocs, selectLineDocs, sliceDogCodeLines } from '@slopdogs/core';

/** JSON-Schema fragment for the optional lineDocs field — shared by create_node / save_node. */
const LINE_DOCS_SCHEMA = {
    type: 'array',
    description:
        'Optional line-range annotations over this dog\'s tsCode (1-based, inclusive). Each entry {von, bis, text} labels a section — retrieve them by id + line via get_node_lines so a reader can reach one part without reading the whole dog.',
    items: {
        type: 'object',
        required: ['von', 'bis', 'text'],
        additionalProperties: false,
        properties: {
            von: { type: 'number', description: 'first line of the section (1-based, inclusive)' },
            bis: { type: 'number', description: 'last line of the section (1-based, inclusive)' },
            text: { type: 'string', description: 'what this section of the code does' },
        },
    },
} as const;

const DESCRIPTION_SCHEMA = {
    type: 'string',
    description: 'One short sentence: what this dog yields. Returned by list_nodes / get_node / get_node_schema and matched by list_nodes {search}.',
} as const;

export function getNodeTools(): ToolDef[] {
    return [
        {
            name: 'list_nodes',
            description:
                'Lists nodes visible to the current user — the discovery surface: start here to find out what exists. Returns a paged window with metadata only (no tsCode), including each entry\'s `description` and its wiring contract `parentsRequired` / `parentsOptional` (bare class names, exactly the syntax build_kennel expects). Hunters (BaseDogs), Pacts and Breeds (SerializedDogs/MimicDogs) share the same listing; Pacts are flagged `isPact: true` and carry `pactTypeDef` when they declare a shape — a Pact is a contract, fulfil it with a MimicDog (dogs[].imitates) or a providing dog, never call it directly. Default limit=50, cap=200. Filter via type, search by name/displayName/description substring (case-insensitive). Run-only dogs (you may run them, not read them) are listed too, with `tsCodePreview: null`; use their `id` (a version GUID) to reference them in a kennel.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    limit: { type: 'number', description: 'max results (default 50, hard cap 200)' },
                    offset: { type: 'number', description: 'skip first N (default 0)' },
                    type: {
                        type: 'string',
                        enum: ['BaseDog', 'SerializedDog', 'MimicDog'],
                        description: 'filter by node type',
                    },
                    search: {
                        type: 'string',
                        description: 'case-insensitive substring match on name and displayName',
                    },
                    sort: {
                        type: 'string',
                        enum: ['name', 'updatedAt', 'proven', 'calls30d', 'reuse'],
                        description: 'proven = battle-tested first (usage x reliability x reuse x kennel stars). Prefer proven dogs over building new ones.',
                    },
                    dir: { type: 'string', enum: ['asc', 'desc'] },
                    provenOnly: {
                        type: 'boolean',
                        description: 'only dogs carrying the proven badge (>=5 runs in 30 days, >=1 public run, >=1 kennel, reliability >= 0.8)',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.nodesController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                // W17 (8.17): run-only dogs are listed too — without their code (W6).
                const visibleSerialized = filterRunnable(result.data ?? [], ctx);

                // MimicDog-Heuristik: ein SerializedDog gilt als MimicDog, wenn
                // sein displayName mit "auto-mimic-" beginnt oder sein
                // serializedDogConfig ein `imitates`-Feld traegt. Beides sind
                // die Marker, die der Server beim Auto-Spawn setzt.
                const classifyType = (s: any): 'SerializedDog' | 'MimicDog' => {
                    if (typeof s?.type === 'string' && s.type === 'MimicDog') return 'MimicDog';
                    if (typeof s?.displayName === 'string' && s.displayName.startsWith('auto-mimic-')) return 'MimicDog';
                    if (s?.imitates || s?.serializedDogConfig?.imitates) return 'MimicDog';
                    return 'SerializedDog';
                };

                const all = [
                    ...deps.baseDogsList.map((b) => ({
                        id: b.id,
                        lineageId: undefined as string | undefined,
                        displayName: b.name,
                        name: b.name,
                        // Frueher fielen description UND der Vertrag hier unter den Tisch (leere
                        // Arrays waren hartcodiert) -- ein Agent sah nur Name und Icon.
                        description: b.description ?? null,
                        icon: b.icon,
                        type: 'BaseDog' as const,
                        isPact: b.isPact === true,
                        pactTypeDef: b.pactTypeDef ?? null,
                        // Verdrahtungs-Anweisung fuer Infrastruktur-Dogs (z.B. die Lobby) --
                        // damit niemand sie nachbaut, weil er sie nicht gefunden hat.
                        guidance: b.guidance ?? null,
                        visibility: 'public',
                        ownerId: null as string | null,
                        tsCodePreview: null as string | null,
                        parentsRequired: b.parentsRequired ?? [],
                        parentsOptional: b.parentsOptional ?? [],
                        updatedAt: null as string | null,
                    })),
                    ...visibleSerialized.map((s: any) => {
                        const code = typeof s.theRun === 'string' ? s.theRun : '';
                        // W6: RUN sees no code — not even 200 characters of it.
                        const preview = !canRead(s, ctx)
                            ? null
                            : code.length > 200 ? code.substring(0, 200) + '…' : code;
                        return {
                            id: s.id,
                            lineageId: s.lineageId,
                            displayName: s.displayName,
                            name: s.displayName,
                            description: s.description ?? null,
                            icon: s.icon,
                            type: classifyType(s),
                            isPact: false,
                            pactTypeDef: null as string | null,
                            visibility: s.visibility ?? 'public',
                            ownerId: s.ownerId ?? null,
                            tsCodePreview: preview,
                            parentsRequired: s.parentsRequired ?? [],
                            parentsOptional: s.parentsOptional ?? [],
                            updatedAt: s.updatedAt ?? null,
                        };
                    }),
                ];

                const typeFilter = typeof args.type === 'string' ? args.type : undefined;
                const searchRaw = typeof args.search === 'string' ? args.search : undefined;
                const s = searchRaw ? searchRaw.toLowerCase() : undefined;

                const matching = all.filter((n) => {
                    if (typeFilter && n.type !== typeFilter) return false;
                    if (s) {
                        const name = (n.name ?? '').toLowerCase();
                        const display = (n.displayName ?? '').toLowerCase();
                        // Auch die Beschreibung durchsuchen: wer einen Hund fuer "websocket" oder
                        // "wetter" sucht, kennt selten schon dessen Klassennamen.
                        const desc = (n.description ?? '').toLowerCase();
                        if (!name.includes(s) && !display.includes(s) && !desc.includes(s)) return false;
                    }
                    return true;
                });
                // P4b: jeder Eintrag traegt `stats` (Laeufe, Wiederverwendung, Bewaehrt). Sortiert wird nur
                // auf Wunsch — ohne sort/provenOnly bleibt die bisherige Reihenfolge (Base-Dogs zuerst).
                await deps.dogStats.attach(matching as any[]);
                const wantsOrder = typeof args.sort === 'string' || args.provenOnly === true;
                const filtered = wantsOrder
                    ? ListQuery.from({ sort: args.sort, dir: args.dir, proven: args.provenOnly === true ? '1' : undefined }).apply(matching, ctx).data
                    : matching;

                const total = filtered.length;
                const rawLimit = typeof args.limit === 'number' ? args.limit : 50;
                const limit = Math.max(0, Math.min(200, Math.floor(rawLimit)));
                const rawOffset = typeof args.offset === 'number' ? args.offset : 0;
                const offset = Math.max(0, Math.floor(rawOffset));
                const paged = filtered.slice(offset, offset + limit);

                return ok({
                    nodes: paged,
                    total,
                    offset,
                    limit,
                    hasMore: offset + paged.length < total,
                });
            },
        },
        {
            name: 'get_node',
            description:
                'Returns the full detail of a node — including tsCode, the complete SerializedDogConfig (or BaseDog metadata) and `myRights: {run, read, edit, own, frozen}`. Requires the read right; a run-only dog answers "not found" — use get_node_schema for its interface. For SerializedDogs this carries `description` and any `lineDocs` (line-range annotations); to fetch only the annotation/code for one line without the whole dog, use get_node_lines.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID, or a BaseDog name' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                // BaseDog first — match against the in-memory list.
                const base = deps.baseDogsList.find(
                    (b) => b.id === id || b.name === id || `base:${b.name}` === id,
                );
                if (base) {
                    const node = await deps.dogStats.attachOne({ ...base, ownerId: null });
                    return ok({ ...node, usage: await deps.dogStats.usageOf(node, ctx) });
                }
                const result = await deps.nodesController.getById(id);
                if (!result.ok || !result.data) return fail(`Node ${id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Node ${id} not found`);
                const node = await deps.dogStats.attachOne(withMyRights(result.data as any, ctx));
                return ok({ ...node, usage: await deps.dogStats.usageOf(node, ctx) });
            },
        },
        {
            name: 'get_node_schema',
            description:
                'Returns just the interface of a node — id, lineageId, displayName, name, description, icon, type, parents. No tsCode, no extra config. Use when you only need to bind to a node\'s shape. The run right is enough — this is how you learn a run-only dog\'s interface and the version `id` to pin it by.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const base = deps.baseDogsList.find(
                    (b) => b.id === id || b.name === id || `base:${b.name}` === id,
                );
                if (base) {
                    // Die echten Werte -- vorher standen hier leere Arrays, ausgerechnet in dem
                    // Werkzeug, dessen Zweck das Binden an die Form eines Nodes ist.
                    return ok({
                        id: base.id,
                        lineageId: undefined,
                        displayName: base.name,
                        name: base.name,
                        description: base.description ?? null,
                        icon: base.icon,
                        type: 'BaseDog',
                        isPact: base.isPact === true,
                        pactTypeDef: base.pactTypeDef ?? null,
                        guidance: base.guidance ?? null,
                        parentsRequired: base.parentsRequired ?? [],
                        parentsOptional: base.parentsOptional ?? [],
                    });
                }
                const result = await deps.nodesController.getById(id);
                if (!result.ok || !result.data) return fail(`Node ${id} not found`);
                // W5: the interface is what a runner binds to — RUN is enough, no code travels.
                if (!canRun(result.data as any, ctx)) return fail(`Node ${id} not found`);
                const s = result.data as any;
                return ok({
                    id: s.id,
                    lineageId: s.lineageId,
                    displayName: s.displayName,
                    name: s.displayName,
                    description: s.description ?? null,
                    icon: s.icon,
                    type: 'SerializedDog',
                    parentsRequired: s.parentsRequired ?? [],
                    parentsOptional: s.parentsOptional ?? [],
                });
            },
        },
        {
            name: 'get_node_lines',
            description:
                'Fetches the line-level docs (and optionally the code) of a SerializedDog for one line or a line range, without pulling the whole dog. Answers "what does line N do / where is the combat part" — pass `line` (single, 1-based) OR `fromLine` (+ optional `toLine`). Returns every lineDoc annotation whose range intersects the window, plus the matching code slice unless includeCode:false. Same read gate as get_node — a private dog you cannot read returns "not found".',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID (BaseDogs have no line docs)' },
                    line: { type: 'number', description: 'single line to look up (1-based). Use this OR fromLine/toLine.' },
                    fromLine: { type: 'number', description: 'first line of the range (1-based, inclusive)' },
                    toLine: { type: 'number', description: 'last line of the range (1-based, inclusive). Defaults to fromLine.' },
                    includeCode: { type: 'boolean', description: 'include the code slice of the window (default true)' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                // BaseDogs are compiled classes — they carry no editable source or line docs.
                const base = deps.baseDogsList.find(
                    (b) => b.id === id || b.name === id || `base:${b.name}` === id,
                );
                if (base) {
                    return ok({
                        id: base.id,
                        displayName: base.name,
                        type: 'BaseDog',
                        annotations: [],
                        note: 'BaseDogs are compiled classes and carry no line-level docs.',
                    });
                }
                const result = await deps.nodesController.getById(id);
                if (!result.ok || !result.data) return fail(`Node ${id} not found`);
                // Same fail-closed read gate as get_node — never leak a private dog's code/docs.
                if (!canRead(result.data as any, ctx)) return fail(`Node ${id} not found`);
                const node = result.data as any;

                let from: number;
                let to: number;
                if (typeof args.line === 'number' && Number.isFinite(args.line)) {
                    from = to = Math.trunc(args.line);
                } else if (typeof args.fromLine === 'number' && Number.isFinite(args.fromLine)) {
                    from = Math.trunc(args.fromLine);
                    to = typeof args.toLine === 'number' && Number.isFinite(args.toLine)
                        ? Math.trunc(args.toLine)
                        : from;
                } else {
                    return fail('Provide `line` (single, 1-based) or `fromLine` (+ optional `toLine`).');
                }
                if (from < 1) return fail('Line numbers are 1-based; `line`/`fromLine` must be >= 1.');

                const annotations = selectLineDocs(node.lineDocs, from, to);
                const includeCode = args.includeCode !== false;
                const slice = includeCode ? sliceDogCodeLines(node.theRun, from, to) : null;
                return ok({
                    id: node.id,
                    lineageId: node.lineageId ?? null,
                    displayName: node.displayName ?? null,
                    requestedFrom: Math.min(from, to),
                    requestedTo: Math.max(from, to),
                    annotations,
                    ...(slice
                        ? { code: slice.text, codeFromLine: slice.fromLine, codeToLine: slice.toLine }
                        : {}),
                });
            },
        },
        {
            name: 'create_node',
            description:
                'Creates a new Breed (SerializedDog). **Keep a dog small** — one dog does one nameable thing; HTML fragments, the script block, data preparation and composition each get their own dog and the lead puts them together. The response tells you when a dog has grown too large. Defaults visibility to "private" and ownerId to the current user. Pass "visibility":"public" to share. Parents are referenced as either "ClassName" for Hunters or a lineageId GUID for Breeds. Use refresh_kennel_snapshot afterwards to see the run state. Provide EITHER tsCode (raw string) OR tsCodeBase64 (utf8 base64) — the base64 form avoids JSON-escape hell for code with backticks, newlines, template literals or PowerShell-hostile quoting.',
            inputSchema: {
                type: 'object',
                required: ['displayName'],
                additionalProperties: false,
                properties: {
                    displayName: { type: 'string' },
                    tsCode: { type: 'string', description: 'TypeScript body (return yields the spoils). Mutually exclusive with tsCodeBase64.' },
                    tsCodeBase64: { type: 'string', description: 'utf8-encoded base64 of the TypeScript body — use this to avoid JSON-escape hell. Mutually exclusive with tsCode.' },
                    parentsRequired: { type: 'array', items: { type: 'string' } },
                    parentsOptional: { type: 'array', items: { type: 'string' } },
                    icon: { type: 'string', description: 'one emoji' },
                    description: DESCRIPTION_SCHEMA,
                    lineDocs: LINE_DOCS_SCHEMA,
                    visibility: { type: 'string', enum: [...VISIBILITIES] },
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to create nodes');
                // Resolve tsCode/tsCodeBase64. Default to 'return {}' if neither given (back-compat).
                let theRun: string;
                if (typeof args.tsCode === 'string' || typeof args.tsCodeBase64 === 'string') {
                    try {
                        theRun = resolveTsCode(args as any);
                    } catch (err: any) {
                        return fail(err?.message ?? String(err));
                    }
                } else {
                    theRun = 'return {}';
                }
                // Kaputter Code wird gar nicht erst ein Dog. Frueher fiel ein Syntaxfehler erst
                // im Lauf auf -- der Node war da, das Kennel gebaut, der Lead tot und die
                // oeffentliche Seite lieferte HTTP 200 mit leerem Rumpf. Der Fehler gehoert
                // hierhin, an die Schreibstelle, mit der Stelle im Code.
                {
                    const pruefung = checkSerializedDogCode(theRun);
                    if (!pruefung.ok) return fail('tsCode laesst sich nicht uebersetzen: ' + pruefung.message);
                }
                const baseInput = {
                    displayName: String(args.displayName),
                    theRun,
                    parentsRequired: Array.isArray(args.parentsRequired) ? args.parentsRequired : [],
                    parentsOptional: Array.isArray(args.parentsOptional) ? args.parentsOptional : [],
                    ...(typeof args.icon === 'string' ? { icon: args.icon } : {}),
                    ...(typeof args.description === 'string' ? { description: args.description } : {}),
                    ...(args.lineDocs !== undefined ? { lineDocs: sanitizeLineDocs(args.lineDocs) } : {}),
                    ...(args.visibility ? { visibility: args.visibility } : {}),
                };
                const input = applyCreateDefaults(baseInput, ctx);
                const result = await deps.nodesController.create(input);
                if (!result.ok) return fail(result.error ?? 'create failed');
                const hinweise = codeHinweise(theRun, baseInput);
                return ok({
                    id: result.id,
                    lineageId: (result.data as any)?.lineageId,
                    displayName: (result.data as any)?.displayName,
                    ...(hinweise.length ? { hinweise } : {}),
                });
            },
        },
        {
            name: 'save_node',
            description:
                'Saves a new version of a Breed (SerializedDog). The owner or an editor can save (referencing a dog in your kennel grants no edit right); not while frozen. Changing visibility (public | run-only | private) needs the owner. Pass id (lineageId or version GUID), tsCode (or tsCodeBase64) and updated parents. For Mimics, also pass serializedDogConfig with the imitates field intact. Pass "visibility" to flip public/private. Provide EITHER tsCode (raw string) OR tsCodeBase64 (utf8 base64) — the base64 form avoids JSON-escape hell.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    tsCode: { type: 'string', description: 'TypeScript body. Mutually exclusive with tsCodeBase64.' },
                    tsCodeBase64: { type: 'string', description: 'utf8-encoded base64 of the TypeScript body. Mutually exclusive with tsCode.' },
                    parentsRequired: { type: 'array', items: { type: 'string' } },
                    parentsOptional: { type: 'array', items: { type: 'string' } },
                    serializedDogConfig: { type: 'object' },
                    icon: { type: 'string' },
                    description: DESCRIPTION_SCHEMA,
                    lineDocs: LINE_DOCS_SCHEMA,
                    visibility: { type: 'string', enum: [...VISIBILITIES] },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.nodesController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Node ${id} not found`);
                const allowed = await canMutateNode(existing.data as any, ctx, deps.kennelsStore);
                if (!allowed) {
                    if (!canRead(existing.data as any, ctx)) return fail(`Node ${id} not found`);
                    return fail(isFrozen(existing.data as any) ? `Node ${id} is frozen — unfreeze it first` : 'Not authorized');
                }
                // OWN changes visibility (3.5.2): an editor saves code, not who may see it.
                const nextVisibility = normalizeVisibility(args.visibility);
                if (nextVisibility && nextVisibility !== (existing.data as any).visibility && !canManageAcl(existing.data as any, ctx)) {
                    return fail('Only the owner may change visibility');
                }
                let theRun: string;
                try {
                    theRun = resolveTsCode(args as any);
                } catch (err: any) {
                    return fail(err?.message ?? String(err));
                }
                // Auch beim Ueberschreiben: kaputter Code darf keine neue Version werden.
                {
                    const pruefung = checkSerializedDogCode(theRun);
                    if (!pruefung.ok) return fail('tsCode laesst sich nicht uebersetzen: ' + pruefung.message);
                }
                const existingConfig = (args.serializedDogConfig as Record<string, any>) ?? {};
                const input = {
                    ...existingConfig,
                    id,
                    theRun,
                    parentsRequired: Array.isArray(args.parentsRequired)
                        ? args.parentsRequired
                        : existingConfig.parentsRequired ?? [],
                    parentsOptional: Array.isArray(args.parentsOptional)
                        ? args.parentsOptional
                        : existingConfig.parentsOptional ?? [],
                    ...(args.icon !== undefined ? { icon: args.icon } : {}),
                    ...(typeof args.description === 'string' ? { description: args.description } : {}),
                    ...(args.lineDocs !== undefined ? { lineDocs: sanitizeLineDocs(args.lineDocs) } : {}),
                    ...(args.visibility ? { visibility: args.visibility } : {}),
                };
                const result = await deps.nodesController.save(input as any);
                if (!result.ok) return fail(result.error ?? 'save failed');
                return ok({
                    id: result.id,
                    lineageId: (result.data as any)?.lineageId,
                    displayName: (result.data as any)?.displayName,
                });
            },
        },
        {
            name: 'get_node_versions',
            description:
                'Returns the full version history of a node\'s lineage — every incarnation, newest first. Requires the read right — "not found" otherwise (also for run-only dogs).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or any version GUID in the lineage' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                // Visibility gate via the latest incarnation's metadata.
                const head = await deps.nodesController.getById(id);
                if (!head.ok || !head.data) return fail(`Node ${id} not found`);
                if (!canRead(head.data as any, ctx)) return fail(`Node ${id} not found`);
                const versions = await deps.nodesController.getVersions(id);
                return ok(versions);
            },
        },
    ];
}
