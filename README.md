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

Who runs when -- that is decided by the dependency graph. Waves, Pacts, required parents -- the graph commands the order. The lead has no authority there. The lead answers only one question: **whose catch becomes the response.** Every other dog in the Kennel exists to feed the chain that ends at the lead.

### Waves

Dogs don't run at once. They go out in waves:
- **Wave 1** -- Dogs with no dependencies. First into the dark.
- **Wave 2** -- Dogs that depend on Wave 1's catch. They follow the trails left behind.
- **Wave N** -- Until every dog has run and nothing stirs.

The engine calculates wave order from the dependency graph. The scheduler decides; there is no separate rulebook.

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

### MimicDog

A MimicDog is a SerializedDog that *imitates* a Pact. It sits between raw data sources and consumers, transforming data into the shape the Pact demands.

- Inherits from SerializedDog -- has `parentsRequired`, `parentsOptional`, custom `theRun` code
- Config field `imitates: string` names the Pact it fulfills
- Property `imitatesClasses` returns the resolved Pact class(es)
- The Wave system treats it as if it *were* that Pact
- Cascadable: one MimicDog can depend on another -- forming chains through the dark

### Auto-Mimic

When a Dog requires a Pact that no one in the Kennel fulfills, the system conjures a MimicDog **from the void** — a stand-in until something real answers the Pact. When a real Dog arrives that honors the Pact, the Mimic dissolves. When that real Dog is removed, the Mimic returns. The runner closes the gap.

> *From brooding gulfs are we beheld*  
> *By that which bears no name.*

Core rule: **Who requires via a Pact accepts Mimics. Who requires a real class demands the real Dog.**

*(Loader verse **Lohk** — [`ui-app/src/app/data/requiem-loading.ts`](ui-app/src/app/data/requiem-loading.ts).)*

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

**Versioning** -- Every save breeds a new version (`dog-v1`, `dog-v2`, ...). Old versions remain in the database. Latest is loaded by default. Browse any ancestor from the UI. No lineage is ever severed.

**Read tracking** -- Every property access between dogs is logged. Which dog read what, from whom, in which wave. Full data-flow traceability across the pack.

**Public endpoints** -- Every Kennel gets a URL. `GET /my-kennel` runs the pack and returns the lead dog's result. Pass query params or POST a body -- the dogs pick it up.

**Swagger** -- `/api/kennels/:id/docs` runs the Kennel once and builds a live OpenAPI spec from the lead dog's actual yield — not a hand-written schema. `/api/kennels/:id/swagger.json` serves the raw spec. Swagger UI lets you try endpoints on the spot.

**Inline Kennel params** -- Edit query parameters and body data directly from the Waves Viewer. Change it, reload, see the result. Save it when it's right.

**HTML result rendering** -- When a dog brings back HTML (like TalkingDog's rendered layouts), the result view renders it live in a sandboxed iframe. Toggle between HTML preview and raw JSON with one click.

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
| `GET` | `/api/kennels/:id/swagger.json` | Xata -- the Kennel's truth as OpenAPI spec |
| `GET` | `/api/kennels/:id/docs` | Swagger UI — generated from the run |

### Dogs (Nodes)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/nodes` | List all dogs (BaseDogs + SerializedDogs) |
| `GET` | `/api/nodes/:id` | Load a specific dog or version |
| `GET` | `/api/nodes/:id/versions` | List all versions of a dog |
| `POST` | `/api/nodes` | Breed a new SerializedDog |
| `POST` | `/save?id=:id` | Save code + parents (breeds new version) |
| `DELETE` | `/api/nodes/:id` | Put a dog down |

### Public

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/:kennelId` | Run Kennel, return lead dog's yield |
| `POST` | `/:kennelId` | Same, with body data |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Express.js, TypeScript, Node.js VM |
| Database | Prisma ORM, SQLite (swappable to PostgreSQL) |
| Frontend | Angular 18, Monaco Editor, vis-network |
| Core | `datadogs` package (local, in `packages/core`) |

---

## Getting Started

Copy [`.env.example`](.env.example) to `.env` and fill in secrets (API keys, Hue bridge user, and so on) on your machine. Never commit `.env`.

```bash
npm install
npm run dev
```

Backend wakes on `:3000`, UI on `:4200`. Open the UI. The lodge is warm.

### Default Kennel seed: server run and UI

**Server-side:** On every startup, `main.ts` calls **`runSeeds()`** ([`seed.ts`](seed.ts)) against the Prisma store. If the database is still empty of those rows, the seed creates **`seed-serialized-1-v1`** (the LayoutInput Mimic) and a **`KennelConfig`** with id **`default-kennel`** — see `dogIds` there (serialized dog first as **lead**, then all registered BaseDogs). Nothing special-cases that Kennel at runtime: **`GET /api/kennels/default-kennel/run`** (waves + config), **`GET /default-kennel`** (public **lead** yield only), and **`POST /default-kennel`** with a body all go through the same **`KennelRunHandler` → `KennelRun`** path as any other Kennel (load config from DB → fill kennel → run waves).

**UI:** With **`npm run dev`**, the Angular app is proxied to the API. Open **`http://localhost:4200`**, choose **Default Kennel** from the list, or go straight to **`http://localhost:4200/kennel/default-kennel`**. The Waves viewer loads that Kennel run (graph + results); **⟳ Neu laden** re-runs it. The **Antwort (Server)** button opens the raw public response (**`http://localhost:3000/default-kennel`**, plus any query params from the panel) in a new tab so you can compare browser vs UI.

Manual seed (e.g. after resetting the DB): `npx prisma db seed` (same [`seed.ts`](seed.ts); set `DATABASE_URL` like for `prisma:sync`).

Backend only:

```bash
npm run prisma:sync
npm start
```

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

## Development

### Startup Tests

The app runs a test suite on every boot -- store ops, controller CRUD, BaseDog availability, TypeDefBuilder, SerializedDog execution. All must pass before the server starts listening.

### Seeds

See [Default Kennel seed](#default-kennel-seed-server-run-and-ui) under *Getting Started*. Example Kennels and SerializedDogs are inserted when the DB has no matching seed rows yet.

### Project Structure

```
main.ts                       Entry point
api/
  Controller.ts               Generic CRUD controller with versioning
  KennelController.ts         Kennel-specific controller
  AbstractController.ts       Base class for all controllers
  routes/
    ConfigRouteHandler.ts     REST routes + /save endpoint
    KennelRunHandler.ts       Run/execute/public/swagger endpoints
  utils/
    versioning.ts             Version ID extraction and generation
store/
  IStore.ts                   Store interface
  PrismaStore.ts              Prisma/SQLite implementation
services/
  WavesConverter.ts           Converts execution results to Wave format
  TypeDefBuilder.ts           Generates TypeScript definitions for VM context
  CompilerCache.ts            Caches compiled TypeScript
  SwaggerGenerator.ts         Generates OpenAPI specs from Kennel runs
dogs/                         BaseDog implementations (plugin-like)
packages/core/                datadogs library (Dog, Kennel, Wave engine)
ui-app/                       Angular frontend (see ui-app/README.md)
```

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Martin.

> The hunt goes on in the repository.
