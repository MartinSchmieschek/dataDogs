# Data Hunt

> Send the dogs. They know the wilderness. You just sort through what they drag back.

A data aggregation platform built on a simple idea: dogs hunt data. You breed them, organize them in Kennels, and send them out in Waves. They raid APIs, chew through request bodies, stalk databases, and haul everything back to you.

---

## The Pack

### Dogs

Every dog is a data hunter. Two breeds:

**BaseDogs** -- Built-in breeds that ship with the platform. Plug-and-play. They know how to fetch recipes, parse query params, extract request bodies, hit random APIs. New breeds drop in as classes -- no configuration needed. Think of them as plugins.

**SerializedDogs** -- Your custom-bred hunters. TypeScript code stored in the database, executed at runtime in a VM sandbox. Full `async/await`, access to parent dogs' catches via VM context, and automatic IntelliSense in the UI. Every save breeds a new version. No ancestor is ever lost.

### Kennels

A Kennel is a pack configuration. It defines:
- Which dogs to unleash (`dogIds` -- both BaseDogs and SerializedDogs)
- Default query parameters (scent markers for the hunt)
- Default body data (provisions, fed to BodyRetriever)
- Name and description

### Waves

Dogs don't all run at once. They go out in waves:
- **Wave 1** -- Dogs with no dependencies. First into the wilderness.
- **Wave 2** -- Dogs that depend on Wave 1's catch. They follow the trails.
- **Wave N** -- Until every dog has run.

The engine calculates wave order automatically from the dependency graph.

### Dependencies

Dogs can depend on other dogs' catches:
- **Required** -- Must run first. The dog won't hunt without this data.
- **Optional** -- Used if available, skipped if not. The dog adapts.

Referenced by ID: `base:QueryRetriever` for BaseDogs, `my-dog-v1` or `my-dog` (latest version) for SerializedDogs.

---

## What It Does

**Custom TypeScript execution** -- Write hunting logic in TypeScript. It runs in a Node.js VM with access to parent results as globals. Sandboxed. Async. Dangerous enough to be useful.

```typescript
const recipes = await fetch('https://api.example.com/recipes');
const filtered = recipes.filter(r => r.rating > 4);
return { topRecipes: filtered, count: filtered.length };
```

**Automatic versioning** -- Every save creates a new version (`dog-v1`, `dog-v2`, ...). Old versions stay in the database. Latest is loaded by default. Browse any ancestor from the UI.

**Read tracking** -- Every property access between dogs is logged. Which dog read what, from whom, in which wave. Full data flow traceability.

**Public endpoints** -- Every Kennel gets a URL. `GET /my-kennel` runs the pack and returns the lead dog's result. Pass query params or POST a body -- the dogs pick it up.

---

## API

### Kennels

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/api/kennels` | List all Kennels |
| `GET` | `/api/kennels/:id` | Load a Kennel config |
| `POST` | `/api/kennels` | Create a new Kennel |
| `PUT` | `/api/kennels/:id` | Update a Kennel |
| `DELETE` | `/api/kennels/:id` | Delete a Kennel |
| `GET/POST` | `/api/kennels/:id/run` | Run a Kennel, return Waves + config |
| `GET/POST` | `/api/kennels/:id/execute` | Run a Kennel, return lead dog's result |

### Dogs (Nodes)

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/api/nodes` | List all dogs (BaseDogs + SerializedDogs) |
| `GET` | `/api/nodes/:id` | Load a specific dog/version |
| `GET` | `/api/nodes/:id/versions` | List all versions of a dog |
| `POST` | `/api/nodes` | Breed a new SerializedDog |
| `POST` | `/save?id=:id` | Save code + parents (creates new version) |
| `DELETE` | `/api/nodes/:id` | Put a dog down |

### Public

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/:kennelId` | Run Kennel, return lead dog's result |
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

```bash
npm install
npm run dev
```

Backend starts on `:3000`, UI on `:4200`. Open the UI -- the lodge is warm.

Or backend only:

```bash
npm run prisma:sync
npm start
```

### Quick Hunt

```bash
# Create a Kennel
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

Example Kennels and SerializedDogs are seeded automatically on startup if the database is fresh.

### Project Structure

```
main.ts                       Entry point
api/
  Controller.ts               Generic CRUD controller with versioning
  KennelController.ts         Kennel-specific controller
  AbstractController.ts       Base class for all controllers
  routes/
    ConfigRouteHandler.ts     REST routes + /save endpoint
    KennelRunHandler.ts       Run/execute/public endpoints
  utils/
    versioning.ts             Version ID extraction and generation
store/
  IStore.ts                   Store interface
  PrismaStore.ts              Prisma/SQLite implementation
services/
  WavesConverter.ts           Converts execution results to Wave format
  TypeDefBuilder.ts           Generates TypeScript definitions for VM context
  CompilerCache.ts            Caches compiled TypeScript
dogs/                         BaseDog implementations (plugin-like)
packages/core/                datadogs library (Dog, Kennel, Wave engine)
ui-app/                       Angular frontend (see ui-app/README.md)
```

---

## License

UNLICENSED. Private project.
