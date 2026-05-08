# Data Hunt

> From brooding gulfs the pack descends,
> through tangled endpoints, severed threads.
> They drag back what the void intends --
> you sort the living from the dead.

A data aggregation platform. Dogs hunt data. You breed them, chain them in Kennels, and send them out in Waves. They tear through APIs, gnaw on request bodies, stalk the forgotten corners of the web, and haul everything back -- raw, bleeding, yours.

---

## The Pack

### Dogs

Every dog is a hunter. Two breeds walk these grounds:

**BaseDogs** -- Ancient breeds. They ship with the platform and know their purpose without instruction. Fetch recipes, parse query params, extract request bodies, raid random APIs. New breeds manifest as classes. No configuration. No ceremony. They simply are.

**SerializedDogs** -- Your creations. TypeScript inscribed into the database, awakened at runtime in a VM sandbox. Full `async/await`, access to parent dogs' yields as globals, automatic IntelliSense whispering what data lies in reach. Every save breeds a new version. No ancestor is ever erased. The tree keeps branching.

### Kennels

A Kennel is a covenant. It binds:
- Which dogs to unleash (`dogIds` -- both BaseDogs and SerializedDogs). **The first entry is the [lead dog](#lead-dog)** -- public URLs return that dog's yield. Wave scheduling obeys the dependency graph alone -- see [Waves](#waves) and [Pacts](#pacts).
- Default query parameters -- scent markers for the hunt
- Default body data -- provisions, fed to BodyRetriever
- Name and description

### Lead Dog

The **first** entry in `dogIds` is the **lead**. When the hunt is over and the pack returns, only one voice speaks: the lead's yield is what `GET /:kennelId` and `GET /api/kennels/:id/execute` return.

**Lead response shape (string yields):** If the lead returns a **string**, the server picks a content type before JSON:

- **HTML** — `text/html` when the string looks like HTML (e.g. starts with `<html`, `<!DOCTYPE`, or tag-like `<`…`</`).
- **Markdown** — `text/markdown` when it is **not** treated as HTML and either the first line is an ATX heading (`#` … `######` plus space) or the document starts with YAML **frontmatter** (`---` … `---`).
- **Anything else** (objects, arrays, numbers, booleans, or strings that match neither rule) — `application/json` (objects and arrays as JSON; primitive strings are JSON-encoded).

Who runs when -- that is decided by the dependency graph. Waves, Pacts, required parents -- the graph commands the order. The lead has no authority there. The lead answers only one question: **whose catch becomes the response.** Every other dog in the Kennel exists to feed the chain that ends at the lead.

### The lead is a compositor

When a Kennel pulls from **two or more sources**, the lead **must be a compositor** — not a worker. Its only job is composition: take pre-processed entity yields, glue them together, return.

```
Wave 1 (Hunters):       WeatherRetriever, SunRetriever, BirdRetriever     ← raw fetch
Wave 2 (Entity dogs):   WeatherData, SunData, BirdData                    ← per-domain normalization
Wave 3 (Compositor):    NaturBundle  (= the lead)                         ← merge + format
```

**Rules — non-negotiable for non-trivial Kennels:**

1. **One entity per dog.** A SerializedDog handles exactly one domain — weather OR species OR routes, never two.
2. **Hunters fetch, entity dogs normalize, the compositor composes.** No mixing.
3. **The compositor does no fetching, no per-source filtering.** It reads only entity yields.
4. **A fat lead is a code smell.** If the lead is more than ~30 lines, split it.

**Why:** Reuse (entity dogs work in many Kennels), debuggability (failures localize per entity), versioning sanity (renderer evolves separately from data logic), multi-consumer (some clients want only weather, not the full bundle), HTML safety (the renderer is the only place that touches `<script>`).

If the Kennel has only one source, the lead may be the renderer directly — but the moment a second source enters, refactor to the compositor pattern.

> *Vome — order does not negotiate.*

### Waves

Dogs don't run at once. They go out in waves:
- **Wave 1** -- Dogs with no dependencies. First into the dark.
- **Wave 2** -- Dogs that depend on Wave 1's catch. They follow the trails left behind.
- **Wave N** -- Until every dog has run and nothing stirs.

The engine calculates wave order from the dependency graph. The scheduler decides; there is no separate rulebook.

> *Vome — To cosmic madness laws submit, though stalwart minds entreat.*

### Dependencies

Dogs can depend on other dogs' catches:
- **Required** -- Must run first. The dog won't move without this data.
- **Optional** -- Used if available, ignored if not. The dog adapts to what the void provides.

Referenced by ID: `base:QueryRetriever` for BaseDogs, `my-dog-v1` or `my-dog` (latest version) for SerializedDogs.

### Pacts

A Pact is a sworn agreement between dogs. Instead of requiring a specific Dog class, a Dog can require a Pact -- a pledge that defines *what data shape* is needed, not *who provides it*. The graph may twist; the Pact stays fixed.

```typescript
const LayoutInputPact = createPact<ILayoutInput>('LayoutInputProvider', {
  fromSourceType: 'ILayoutInput',
});
```

Pacts are created with `createPact<T>(name)` or with `{ fromSourceType: 'YourInterfaceOrTypeName' }` so the editor/VM types are derived from TypeScript sources at startup (see `TypeDefBuilder.registerPacts`). They produce a valid Dog class marked with `__isPact: true`. They cannot run on their own -- they exist purely to declare what must be.

> *Jahu — Corporeal laws are unwrit, as suns and love retreat.*

### MimicDog

A MimicDog is a SerializedDog that *imitates* a Pact. It sits between raw data sources and consumers, transforming data into the shape the Pact demands.

- Inherits from SerializedDog -- has `parentsRequired`, `parentsOptional`, custom `theRun` code
- Config field `imitates: string` names the Pact it fulfills
- Property `imitatesClasses` returns the resolved Pact class(es)
- The Wave system treats it as if it *were* that Pact
- Cascadable: one MimicDog can depend on another -- forming chains through the dark

### Auto-Mimic

When a Dog requires a Pact that no one in the Kennel fulfills, the system closes the gap in two passes: first it tries to **adopt** a saved Mimic from the kennel's own memory; only if that fails does it **conjure** a fresh placeholder from the void. Either way, the final Mimic is then **healed back into `dogIds`** so the kennel remembers it forever.

> *From brooding gulfs are we beheld*  
> *By that which bears no name.*

Core rule: **Who requires via a Pact accepts Mimics. Who requires a real class demands the real Dog.**

*(Loader verse **Lohk** — [`ui-app/src/app/data/requiem-loading.ts`](ui-app/src/app/data/requiem-loading.ts).)*

#### The adoption dance — lineage-aware Mimic reuse

Auto-mimicking is no longer a blind "conjure a fresh placeholder on every unmet Pact" — the runner walks a four-step liturgy before anything new is born. See [`api/routes/KennelRunHandler.ts`](api/routes/KennelRunHandler.ts) (`createMimicAdopter`, `persistNewMimics`) and [`packages/core/src/KennelRun.ts`](packages/core/src/KennelRun.ts) (`autoMimic`).

1. **Collect the kennel's memory.** On every run, `createMimicAdopter` fetches **all historical versions** of the kennel and harvests every non-base `dogId` it ever carried into a set of "remembered lineages". Even dogs the UI dropped from a later `PUT` remain in memory — nothing is ever truly forgotten.
2. **Scan the deep for candidates.** For each unmet Pact, the adopter queries `findLatestVersionsByType(MimicDog.name)` and keeps only rows whose `serializedDogConfig.imitates === <PactName>`.
3. **Pick a winner.** Candidates whose `lineageId` lives in the kennel's memory win first; tie-break by newest `createdAt`. If no remembered candidate exists, the newest overall match wins. If no candidate exists at all, adoption fails and we fall through to step 4.
4. **Fresh conjuring as last resort.** Only when adoption returns `null` does `KennelRun.autoMimic` forge a fresh `auto-mimic-<PactName>` placeholder whose `theRun` throws `"MimicDog for '<PactName>' needs user code"`.

After the season runs, **`persistNewMimics`** closes the loop: every Mimic in `exhausted` is either *already* persisted (adopted, has a `lineageId`) or freshly minted (no `lineageId`). Fresh mimics are saved to the store with a new version + lineage GUID; adopted mimics keep their existing lineage. **Both cases** trigger `kennelsController.heal(configId, { dogIds: [...old, ...addedLineageIds] })` — the kennel's own `dogIds` grow to include the mimic's `lineageId`, and the in-memory `config.dogIds` is kept in sync so the `/run` response already reflects the heal.

The net effect: **the first run teaches the kennel what it needs**, and every subsequent run loads those mimics directly from `dogIds` via `createSerializedDogFactory` — no adoption, no conjuring. If a client later PUTs a new kennel version that drops the mimic lineageIds, the adopter resurrects them from history on the next run and heals them back.

#### Factory dedup — MimicDog wins on type upgrade

`createSerializedDogFactory` in [`api/routes/KennelRunHandler.ts`](api/routes/KennelRunHandler.ts) now fetches both `SerializedDog` and `MimicDog` rows for the requested IDs in parallel, then **deduplicates by `lineageId`**. When the same logical dog exists as both types (because someone saved an `imitates` field onto a formerly-serialized dog), the most recent `createdAt` wins — MimicDog upgrades survive, older SerializedDog incarnations are dropped silently. The factory also sniffs `config.imitates` on construction: if the field is a non-empty string, a `MimicDog` is instantiated; otherwise a `SerializedDog`.

#### What Mimics reveal during a run

When you run a Kennel (`/api/kennels/:id/run`), Mimics appear in the Waves response and tell you exactly **what a dog really needs**:

| Field | What it tells you |
|-------|-------------------|
| `mimic: true` | This node is a shapeshifter, not a real dog. |
| `name` | The Pact it imitates — the **data contract** the consuming dog requires (e.g. `NearbyLandmarksPact`). |
| `displayName` | Fresh placeholders are prefixed `auto-mimic-` (e.g. `auto-mimic-NearbyLandmarksPact`). Adopted mimics keep whatever `displayName` they were saved with. |
| `error` | Fresh placeholders return `"MimicDog for '<PactName>' needs user code"` — the placeholder code throws on purpose. Adopted mimics with productive `theRun` return real data instead. |
| `serializedDogConfig.theRun` | The TypeScript code the mimic will run — either the throwing placeholder or the adopted working code. Replace it (or save a new version) to teach the mimic its voice. |
| `serializedDogConfig.imitates` | The Pact name this mimic is bound to. **Never drop this field on save** — it's the mimic's shape. |
| `serializedDogConfig.lineageId` | Set for adopted mimics and for fresh mimics after the first run (via `persistNewMimics`). The stable identity across all versions. |
| `editable: true` | You can open the Mimic in the editor and write the code that fulfills the Pact. |
| `deletable: false` | Auto-mimics cannot be deleted — remove the consuming dog or add a real dog that fulfills the Pact instead. |

> *Oull — From endless faces, countless forms, a multitude unfolds.*

**Reading Mimics as a blueprint:** Every unfilled mimic is a gap in the pipeline. Its `name` tells you which Pact is unfulfilled, and the Pact's TypeScript type (visible in the editor's IntelliSense) tells you the exact data shape the consuming dog expects. Write `theRun` code that returns that shape, `POST /save?id=<mimic-versionId>` with the full `serializedDogConfig` (keep `imitates`!), and the mimic becomes a real transformer on the next run.

**Persistence (summary):**
- **First run of a new kennel** — fresh mimics are conjured, saved to the store with brand-new `lineageId`s, and healed into `config.dogIds`. The in-memory config is mutated on the spot so the response already shows the healed `dogIds`.
- **Subsequent runs** — the factory loads the mimics directly by `lineageId`; no adoption, no heal.
- **Kennel version drop** — if a later PUT removes mimic lineages from `dogIds`, the adopter pulls them back from kennel-version history and heals them in again.
- **Manual mimic edit** — editing a mimic's `theRun` via `POST /save` bumps its version but keeps the `lineageId`. The next run loads the new version through normal lineage resolution. The `imitates` binding must be preserved in the saved config.

### Data Pipelines

Mimics act as transformers between raw-data Dogs and consumers:

```
Wave 1: [RandomRecipesRetriever, RandomEverythingRetriever]  →  raw data
Wave 2: [MimicDog (honors: LayoutInputProvider)]              →  normalized ILayoutInput
Wave 3: [TalkingDog (trusts: LayoutInputProvider)]            →  rendered HTML
```

---

## What It Does

**Custom TypeScript execution** -- Write hunting logic in TypeScript. It runs in a Node.js VM with access to parent results as globals. Sandboxed. Async. Dangerous enough to be useful.

```typescript
const recipes = await fetch('https://api.example.com/recipes');
const filtered = recipes.filter(r => r.rating > 4);
return { topRecipes: filtered, count: filtered.length };
```

**Dog versioning** -- Every SerializedDog carries four identity fields:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | GUID | Unique identifier of **this specific version**. Every save produces a new one. |
| `lineageId` | GUID | Stable identifier binding **all versions** of the same logical dog. Created once when the dog is first bred. Never changes across saves. |
| `parentId` | GUID \| null | Points to the previous version's `id`. Forms a tree -- not a flat list. Branching is possible: two versions can share the same `parentId`. |
| `displayName` | string | Human-readable name. Changeable at any time via `PATCH /api/nodes/:id/rename` -- the rename propagates across all versions sharing the `lineageId`. |

Example lineage:

```
Create "my-parser"   → id: aaa, lineageId: LLL, parentId: null,  displayName: "my-parser"
Save (edit code)     → id: bbb, lineageId: LLL, parentId: aaa,   displayName: "my-parser"
Save again           → id: ccc, lineageId: LLL, parentId: bbb,   displayName: "my-parser"
Branch off bbb       → id: ddd, lineageId: LLL, parentId: bbb,   displayName: "my-parser"
```

> *Khra — To cosmic forms from tangent planes, we end as we began.*

**Resolving a dog reference** -- When a Kennel's `dogIds` entry points to a SerializedDog, the store resolves it in order:
1. **Exact `id` match** -- pinned to a specific version (useful for reproducibility).
2. **`lineageId` match** -- returns the newest version by `createdAt` (the default "latest" behavior).
3. **`displayName` fallback** -- matched by name if neither ID hits.

In `dogIds`, BaseDogs are prefixed (`base:QueryRetriever`), SerializedDogs are referenced by `lineageId` (latest) or by exact `id` (pinned version).

**Kennel versioning** -- Every Kennel carries a stable **lineageId** (the name you chose) and a chain of **versionIds** (GUIDs). Each save creates a new version with a `parentId` pointing back. The full history is navigable -- branch off, revert, compare. The Kennel remembers its past lives.

**Kennel export & import** -- `GET /api/kennels/:id/export` bundles a Kennel with all its dogs and version history into a portable JSON artifact. `POST /api/kennels/import` re-creates it elsewhere. If the Kennel ID already exists, the system auto-suffixes (`-copy`, `-copy-2`, ...) and remaps all internal references. Copy and paste across instances.

**Caching** -- Two-tier memory so dogs don't repeat themselves:
- **KV cache** (`CacheHandler`) -- TTL-based key-value store with in-flight request deduplication plus negative-caching for 429/504 to break provider retry storms.
- **Tile feature cache** (`PrismaTileFeatureCache`) -- Atomarer Geo-Feature-Store auf Slippy-Map-Tiles (Multi-Zoom). Features werden per OSM-ID dedupliziert; Coverage ist pro (dog-type, zoom, tile, facet) getrennt. Fehlende Tiles × Facets werden gezielt nachgeladen, bestehende aus der DB bedient. Polygone über Tile-Grenzen werden im Volltext zurückgegeben.

Dogs opt in by implementing `ICacheable` (simple KV) or `ITileCacheable` (geo-aware tile feature cache). The cache is injected at runtime -- dogs that don't implement the interface are unaffected. *Khra* -- what was fetched once defies time.

**Read tracking** -- Every property access between dogs is logged. Which dog read what, from whom, in which wave. Full data-flow traceability across the pack.

**Public endpoints** -- Every Kennel gets a URL. `GET /my-kennel` runs the pack and returns the lead dog's result. Pass query params or POST a body -- the dogs pick it up.

**Swagger** -- `/api/kennels/:id/docs` runs the Kennel once and builds a live OpenAPI spec from the lead dog's actual yield — not a hand-written schema. `/api/kennels/:id/swagger.json` serves the raw spec. Swagger UI lets you try endpoints on the spot.

**Inline Kennel params** -- Edit query parameters and body data directly from the Waves Viewer. Change it, reload, see the result. Save it when it's right.

**HTML and Markdown in the UI** -- When the lead returns HTML, the result view can show a sandboxed iframe preview; toggle between preview and raw source. When the lead returns Markdown (same detection rules as the server), the editor uses Markdown highlighting and an Auto/Raw toggle. JSON and other structured yields still appear as formatted JSON in Monaco.

---

## Authentication & Access Control

dataDogs ships with optional Google SSO + OAuth 2.1 + an ACL-based permission model.

### Toggle

| `MCP_AUTH_REQUIRED` | Behavior |
|---|---|
| `false` (or unset) | Dev mode. Every request is super-user, all entities visible, no login required. |
| `true` | Production mode. Anonymous sees only public entities. Mutations require login + ownership/edit-rights. |

### Identity

- **Google SSO** via `GET /auth/google/login` → cookie session for the browser UI.
- **Personal Access Tokens** at `GET /auth/tokens` (HTML page). Long-lived JWTs for MCP clients, Custom GPT API-keys, scripts.
- **Full OAuth 2.1 Authorization Server** at `/auth/authorize`, `/auth/token`, `/auth/register`. Discovery via `GET /.well-known/oauth-authorization-server` — for clients that auto-configure (Cursor, Claude.ai Connectors, Custom GPTs with OAuth).

### Visibility & Ownership

Both Kennels and SerializedDogs carry:

- **`visibility`** — `"public"` (anyone reads + runs) or `"private"`.
- **`ownerId`** — the creator's `User.id`, full rights.
- **`editors[]`** — additional users who may mutate.
- **`viewers[]`** — additional users who may read on private entities.

**Special rules:**
- Legacy entities (`ownerId = null`) are **community-editable** — any logged-in user reads + mutates.
- Hunters (BaseDogs) are project-wide infrastructure — no per-user ACL.
- **Cascade respects manual visibility:** when a kennel flips to public, its own SerializedDogs cascade — **but only nodes whose `visibility` is still `NULL`** (never explicitly set). A node you manually flipped to private (or to public) is never overwritten by a kennel cascade. Other-user-owned nodes stay where they are.
- **Node bypass:** any kennel-owner or kennel-editor of a kennel that uses a node may also mutate that node. *"If you depend on it, you can fix it."*

### ACL tools

Available via MCP (`POST /mcp`) and via the OpenAPI mirror (`POST /actions/<tool>`):

- `grant_access(entity_type, id, user, role)` — `role ∈ "editor" | "viewer" | "owner"`. `"owner"` transfers ownership.
- `revoke_access(entity_type, id, user, role)` — remove from `editors[]` or `viewers[]`.
- `release_ownership(entity_type, id)` — set `ownerId = null`, hand the entity back to community-edit mode. Editors and viewers stay intact. Only the current owner (or super-user) can release.
- `list_collaborators(entity_type, id)` — owner + editors + viewers, resolved with email and name.

`user` accepts an email or a `User.id` GUID. Only the owner (or super-user, or any logged-in user on a community-owned entity) may manage the ACL.

`grant_access` returns informative `action` codes for redundant requests:
- `already_editor` / `already_viewer` / `already_owner` — user is already in that role.
- `redundant_owner_is_editor` / `redundant_owner_is_viewer` — owner already has those rights.
- `redundant_editor_is_viewer` — editor includes read; viewer is implicit.

### Endpoint reference

```
GET  /auth/me                         Browser session check
GET  /auth/google/login                Start Google flow (?returnTo=…)
GET  /auth/google/callback             Google OAuth callback
POST /auth/logout                      Clear session

GET  /auth/tokens                      HTML — manage Personal Access Tokens
POST /auth/tokens                      Create new PAT (returned once)
POST /auth/tokens/:jti/revoke          Revoke a PAT

GET  /auth/authorize                   OAuth 2.1 authorization endpoint
POST /auth/authorize                   Consent submit
POST /auth/token                       Token + refresh
POST /auth/revoke                      Token revocation
POST /auth/register                    Dynamic Client Registration (RFC 7591)

GET  /.well-known/oauth-authorization-server   OAuth metadata
GET  /.well-known/oauth-protected-resource     MCP protected-resource metadata
```

### Tone for AI clients

The MCP server returns `mcp/skill.md` as the `instructions` field at initialization, so connected AI clients adopt the kennel-master voice automatically. For Custom GPTs and Vertex agents, copy the same content into the GPT's instructions field — `GET /actions/gpt-template` returns a ready-to-paste config block.

---

## API

### Kennels

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/kennels` | Survey all Kennels |
| `GET` | `/api/kennels/:id` | Load a Kennel's covenant |
| `POST` | `/api/kennels` | Forge a new Kennel |
| `PUT` | `/api/kennels/:id` | Rewrite the covenant |
| `DELETE` | `/api/kennels/:id` | Dissolve the pack |
| `GET/POST` | `/api/kennels/:id/run` | Unleash the hunt, return Waves + config |
| `GET/POST` | `/api/kennels/:id/execute` | Unleash the hunt, return the lead's yield |
| `GET` | `/api/kennels/:id/versions` | List all versions of a Kennel's lineage |
| `GET` | `/api/kennels/:id/export` | Export Kennel bundle (dogs + history) as JSON |
| `POST` | `/api/kennels/import` | Import a Kennel bundle (auto-renames on collision) |
| `GET` | `/api/kennels/:id/swagger.json` | Xata -- the Kennel's truth as OpenAPI spec |
| `GET` | `/api/kennels/:id/docs` | Swagger UI — generated from the run |

### Dogs (Nodes)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/nodes` | List all dogs (BaseDogs + SerializedDogs) |
| `GET` | `/api/nodes?kennelId=xxx` | List dogs **not yet** in that Kennel (toolbar: what can be added) |
| `GET` | `/api/nodes/:id` | Load a specific dog or version |
| `GET` | `/api/nodes/:id/versions` | List all versions of a dog's lineage |
| `POST` | `/api/nodes` | Breed a new SerializedDog |
| `POST` | `/save?id=:id` | Save code + parents (breeds new version) |
| `PUT` | `/api/nodes/:id` | Update a dog (creates new version, keeps lineage) |
| `PATCH` | `/api/nodes/:id/rename` | Rename a dog across all versions (`{ "displayName": "new-name" }`) |
| `DELETE` | `/api/nodes/:id` | Put a dog down |

### Public

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET/POST` | `/:kennelId` | Run Kennel, return lead dog's yield |

### Meta

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/readme` | Project README as rendered HTML |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Express.js, TypeScript, Node.js VM |
| Databases | **Four** physically-separate Prisma schemas, each with its own `*_DATABASE_URL`: `DATABASE_URL` (kennels + nodes), `CACHE_DATABASE_URL` (run-cache), `JSON_STORAGE_DATABASE_URL` (fachliche JSON-Ablage), `AUTH_DATABASE_URL` (User, OAuthClient, AccessToken, RefreshToken, AuthorizationCode). SQLite for local dev; PostgreSQL for **integration** and production. |
| Auth | Google SSO via `openid-client`, OAuth 2.1 AS via `jose` (HS256 JWTs), browser session via `express-session` |
| Frontend | Angular 18, Monaco Editor, vis-network |
| Core | `datadogs` package (local, in `packages/core`) |

---

## Getting Started

Copy [`.env.example`](.env.example) to `.env` and fill in secrets (API keys, Hue bridge user, and so on) on your machine. Never commit `.env`.

```bash
npm install
npm run dev
```

Backend wakes on `:3000`, UI (dev) on `:4300`. Open the UI. The lodge is warm.

### Default Kennel seed: server run and UI

**Server-side:** On every startup, `main.ts` calls **`runSeeds()`** ([`seed.ts`](seed.ts)) against the Prisma store. If the database is still empty of those rows, the seed creates **`seed-serialized-1-v1`** (the LayoutInput Mimic) and a **`KennelConfig`** with id **`default-kennel`** — see `dogIds` there (serialized dog first as **lead**, then all registered BaseDogs). Nothing special-cases that Kennel at runtime: **`GET /api/kennels/default-kennel/run`** (waves + config), **`GET /default-kennel`** (public **lead** yield only), and **`POST /default-kennel`** with a body all go through the same **`KennelRunHandler` → `KennelRun`** path as any other Kennel (load config from DB → fill kennel → run waves).

**UI:** With **`npm run dev`**, the Angular app is proxied to the API. Open **`http://localhost:4300`**, choose **Default Kennel** from the list, or go straight to **`http://localhost:4300/kennel/default-kennel`**. The Waves viewer loads that Kennel run (graph + results); **⟳ Neu laden** re-runs it. The **Antwort (Server)** button opens the raw public response (**`http://localhost:3000/default-kennel`**, plus any query params from the panel) in a new tab so you can compare browser vs UI.

Manual seed (e.g. after resetting the DB): `npx prisma db seed` (same [`seed.ts`](seed.ts); set `DATABASE_URL` like for `prisma:sync`).

Backend only:

```bash
npm run prisma:sync
npm start
```

### Integration mode (pre-release staging)

**Integration mode** (`NODE_ENV=integration`) is a **staging profile** added for the stretch between local dev and a full production deploy: exercise the app against **external databases** (PostgreSQL for the main store and the HTTP cache — see [`.env.integration.example`](.env.integration.example)) and run with the **built Angular UI only** (no `ng serve`; Express serves `ui-app/dist/.../browser` from the same port as the API).

Typical flow: configure `.env.integration` with your hosted URLs, run `npm run prisma:sync:integration` to align schemas, build the backend with **`npm run build:prod`**, the frontend with **`npm run ui:build:integration`** (injects `PUBLIC_API_BASE_URL` using `NODE_ENV=integration`), then start locally with **`npm run start:integration`** (runs `main.ts` via ts-node). On a host that serves **compiled** output only (e.g. **Render**), use **Build Command** **`npm run render:integration:build`** (runs `npm install`, then `build:prod`, then `ui:build:integration`) and **Start Command** **`npm run start:integration:dist`** — it runs `dist/main.js` with `NODE_ENV=integration`. Use this as a **pre-release** checkpoint before going fully online.

### Quick Hunt

```bash
# Forge a Kennel
curl -X POST http://localhost:3000/api/kennels \
  -H "Content-Type: application/json" \
  -d '{"id": "my-kennel", "name": "First Hunt", "dogIds": ["base:RandomRecipesRetriever"]}'

# Unleash it
curl http://localhost:3000/my-kennel
```

Or skip the terminal -- the [UI](ui-app/README.md) does all of this with a few clicks.

---

## Creating a new BaseDog Package

Every BaseDog lives in its own package under `packages/`. Follow these steps to add a new one.

### 1. Scaffold the package

```bash
mkdir -p packages/dogs-mydog/src
```

Create three files:

**`packages/dogs-mydog/package.json`**
```json
{
  "name": "@datadogs/dogs-mydog",
  "version": "0.1.0-alpha.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "private": true,
  "dependencies": { "@datadogs/core": "file:../core" },
  "peerDependencies": { "@datadogs/core": "0.1.0-alpha.1" },
  "scripts": { "build": "tsc" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

**`packages/dogs-mydog/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "es2016", "module": "commonjs", "lib": ["ES2020"],
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "moduleResolution": "node", "declaration": true,
    "outDir": "./dist", "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**`packages/dogs-mydog/src/index.ts`** — barrel export for all public symbols.

### 2. Define a Pact (if the Dog needs input)

A Pact declares _what data shape_ the Dog requires, without specifying _who provides it_. At runtime, a MimicDog or another Dog fulfills it.

```typescript
import { createPact } from "@datadogs/core";

export interface MyDogQuery {
    someParam: string;
}

export const MyDogQueryPact = createPact<MyDogQuery>(
    "MyDogQueryProvider",
    { fromSourceType: "MyDogQuery" }
);
```

### 3. Write the Dog class

Extend `Dog<YieldType>` and implement:

| Member | Purpose |
|---|---|
| `get name()` | Return `MyRetriever.name` (the class name) |
| `get icon()` | Return `getBaseDogIcon(MyRetriever.name)` |
| `get required()` | Pact/Dog classes that must run before this Dog |
| `get optional()` | Pact/Dog classes that are used if present |
| `yieldCollectorFactory` | Async function that does the actual work |

```typescript
import { Dog, IHuntingDog, IHuntingSeason, getBaseDogIcon } from "@datadogs/core";
import { MyDogQueryPact, type MyDogQuery } from "./pacts";

export class MyRetriever extends Dog<MyResult> {
    get name() { return MyRetriever.name; }
    get icon() { return getBaseDogIcon(MyRetriever.name); }
    get required() { return [MyDogQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<MyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(MyDogQueryPact, d));
        const query = (queryDog?.collected as MyDogQuery | undefined) ?? ({} as MyDogQuery);
        // ... fetch data, transform, return
    };
}
```

### 4. Register in the platform

**`packages/core/src/platform/baseDogIcons.ts`** — add an icon entry:
```typescript
MyRetriever: '🔮',
```

**`main.ts`** — three touches:
```typescript
import { MyRetriever, MyDogQueryPact } from '@datadogs/dogs-mydog';
// add to allBaseDogClasses array:
const allBaseDogClasses = [ ..., MyRetriever ];
// add Pact to allPacts array:
const allPacts = [ ..., MyDogQueryPact ];
```

### 5. Wire up the build

**Root `tsconfig.json`** — add path mapping:
```json
"@datadogs/dogs-mydog": ["packages/dogs-mydog/src/index.ts"]
```

**Root `package.json`** — add dependency, build script, and typecheck:
```json
"dependencies": { "@datadogs/dogs-mydog": "file:packages/dogs-mydog" }
"scripts": {
  "build:dogs-mydog": "cd packages/dogs-mydog && npx tsc",
  "build:dogs": "... && npm run build:dogs-mydog",
  "typecheck:dogs": "... && cd ../dogs-mydog && npx tsc --noEmit"
}
```

Then run `npm install` so the symlink in `node_modules/@datadogs/dogs-mydog` is created.

### 6. Seed a Kennel (optional)

In `seed.ts`, create a MimicDog that maps `QueryRetriever` params to your Pact, then a `KennelConfig` with `dogIds`:

```typescript
dogIds: [
    BASE_DOG_PREFIX + 'MyRetriever',       // lead dog (1st = public response)
    BASE_DOG_PREFIX + 'QueryRetriever',     // captures ?param=value from URL
    mimicDogId,                              // MimicDog that fulfills MyDogQueryPact
],
defaultQuery: { someParam: 'defaultValue' },
```

The MimicDog's `theRun` maps QueryRetriever fields to your Pact interface:
```typescript
theRun: `return { someParam: QueryRetriever.someparam }`
// Note: QueryRetriever lowercases all keys
```

### 7. Verify

```bash
npm run build:dogs-mydog          # compiles the package
npx tsc --noEmit -p tsconfig.build.json  # typechecks the whole project
npm start                         # server starts, seed runs, kennel is callable
curl http://localhost:3000/my-kennel?someParam=test
```

---

## Development

### Startup Tests

The app runs a test suite on every boot -- store ops, controller CRUD, BaseDog availability, TypeDefBuilder, SerializedDog execution. All must pass before the server starts listening. *Ris* -- in luminous space blackened stars; they gaze, accuse, deny.

### Seeds

See [Default Kennel seed](#default-kennel-seed-server-run-and-ui) under *Getting Started*. Example Kennels and SerializedDogs are inserted when the DB has no matching seed rows yet.

### Project Structure

```
main.ts                       Entry point, dog registration, pact registration
seed.ts                       Database seeds (dogs + kennels)
api/
  Controller.ts               Generic CRUD controller with versioning
  KennelController.ts         Kennel-specific controller
  AbstractController.ts       Base class for all controllers
  routes/
    ConfigRouteHandler.ts     REST routes + /save endpoint
    KennelRunHandler.ts       Run/execute/public endpoints
    KennelBundleHandler.ts    Export/import Kennel bundles
    KennelSwaggerHandler.ts   Swagger/OpenAPI spec generation
  utils/
    versioning.ts             Version ID extraction and generation
store/
  IStore.ts                   Store interface
  PrismaStore.ts              Prisma/SQLite implementation
  prisma/schema.prisma        Database schema
services/
  WavesConverter.ts           Converts execution results to Wave format
  TypeDefBuilder.ts           Generates TypeScript definitions for VM context
  CompilerCache.ts            Caches compiled TypeScript
  swaggridAdapter.ts          Maps Kennel runs to @datadogs/swaggrid
  CacheHandler.ts             KV cache with TTL and in-flight deduplication
  AreaCacheStrategy.ts        Geographic area cache (Haversine containment)
packages/
  core/                       datadogs library (Dog, Kennel, Wave engine, Pacts, Cache interfaces)
  swaggrid/                   OpenAPI generation (castGrimoire) — no domain deps
  dogs-demo/                  Demo dogs (recipes, flags, random data)
  dogs-biodiversity/          Species and plant GPS observations
  dogs-birds/                 Bird sightings by GPS location
  dogs-geo/                   Geo dogs (routes, isochrones, OSM landmarks)
  dogs-hue/                   Philips Hue integration
  dogs-phenology/             Phenological seasons and bloom phases
  dogs-public-transport/      Public transport (nearby stops + departures via MOTIS)
  dogs-regional-news/         Local news and events via RSS feeds
  dogs-talking/               TalkingDog (HTML rendering)
  dogs-transit-trips/         Complete bus and train journey data
  dogs-warframe/              Warframe API integration
  dogs-webcams/               Live webcams by GPS location
ui-app/                       Angular frontend (see ui-app/README.md)
```

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Martin.

> *Netra — Carrion hordes trill their profane accord with eldritch plans.*
> The hunt goes on in the repository.
