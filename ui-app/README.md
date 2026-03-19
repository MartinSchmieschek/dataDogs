# Data Hunt -- The Lodge

> You don't go out there yourself. You send the dogs. They know the wilderness better than you ever will. Your job is to point them in the right direction, loose the pack, and sort through the spoils when they drag it back.

This is where you do that.

The Angular frontend for [Data Hunt](../README.md). Assemble your pack in Kennels, send them out in Waves, and pick through every scrap of data they haul back from the wild.

**Angular 18** | **Monaco Editor** | **vis-network** | **TypeScript**

---

## The Wilderness

Out there, data lives scattered across APIs, databases, endpoints, request bodies. No structure. No mercy. That's where your dogs go.

This UI is your lodge. Warm, dark, glowing screens. From here you breed new dogs, train them with custom TypeScript, chain them to the ones that ran before, and watch the whole pack tear through the wilderness wave by wave. Everything they bring back -- you see it here. Every dependency, every bite of data, every trail they followed.

**Product model** (lead vs waves) lives in the [root README](../README.md): **Waves** = who runs when (dependency graph + Pacts). **Lead** = first entry in `dogIds` = whose result the public Kennel URL returns. Don’t confuse the graph with the lead slot.

---

## The Grounds

### The Kennel List -- `/`

Your kennel yard. Every pack you've assembled, ready to be unleashed.

- **Breed** a new Kennel -- give it a name, a purpose, a pack.
- **Unleash** any Kennel with one click -- the spoils open in a new tab.
- **Inspect** the pack composition or watch the Waves from here.

Some packs carry provisions (a default body). Those go out as POST hunts. The rest run light -- a simple GET and they're off.

---

### The Waves Viewer -- `/kennel/:id`

The hunt, live.

A **dependency graph** maps out every dog in the pack. Nodes cluster by wave -- first wave hits the ground, second wave follows their trails, third wave picks the bones. Lines between them show who depends on whose catch. That layout follows the **dependency graph** (required/optional parents, Pacts, Mimics) — same story as [Waves](../README.md#waves) in the root README.

**Lead dog** -- At the top of this screen, a **Lead** strip lists `dogIds` in config order. Only the **first** entry is the lead: the public Kennel URL returns **that** dog’s result (`GET /:kennelId`, `GET /api/kennels/:id/execute`). Use **Lead werden** to promote another dog without mistaking wave order for “who answers the API.” Details: [Lead dog](../README.md#lead-dog).

Click any dog. The **Side Panel** cracks open and you see everything: what they brought back, the code that drives them, who they depend on, who feeds off their haul.

From the top bar:
- **Query / Body** -- Toggle the inline params panel. Edit query key/value pairs and body JSON without leaving the Waves view. Changes get sent with the next reload. Hit "Speichern & Neu laden" to persist them to the Kennel config. A dirty dot shows unsaved tweaks.
- **Draft** an existing dog into the pack (appended to `dogIds`; reorder in config or use **Lead werden**)
- **Breed** a new one on the spot
- **Re-run** the whole hunt for fresh spoils (sends current query/body params along)
- **Reconfigure** the Kennel

---

### The Kennel Config -- `/kennel/:id/edit`

Where you assemble the pack before the hunt.

- **BaseDogs** -- Battle-tested breeds. Toggle them on: RandomRecipesRetriever, QueryRetriever, BodyRetriever, and more. They know their job.
- **Pack list (`dogIds`)** -- One ordered list (Base + Serialized). The **first** row is the [lead dog](../README.md#lead-dog): public URL result. **Lead werden** / ordering edits change that; wave execution is still graph-driven.
- **Default Query Params** -- Scent markers. Key/value pairs baked into every hunt.
- **Default Body** -- Provisions for the pack. A Monaco JSON editor for POST body data, fed straight to BodyRetriever.

Lock it in. Go watch the Waves.

---

### The Dog Side Panel

Click a dog in the Waves Viewer and it opens up. Everything about that animal, in collapsible sections:

**Save Bar** -- Pinned at the top. One button saves the dog's code and its bloodline (parent config) in a single shot. **Lead** promotes this dog to first in `dogIds` (see [Lead dog](../README.md#lead-dog)); delete retires it.

**Version Selector** -- Dogs evolve. Every save breeds a new version. The dropdown lets you look back at any ancestor -- load its code, its dependencies, see how it used to hunt. Saving from an old version breeds a new one. No history is ever lost.

**Code** -- The dog's instincts, written in TypeScript. A full Monaco editor with IntelliSense -- type definitions are generated from the dog's hunting context, so autocomplete knows exactly what parent data is in reach. BaseDogs show their raw catch as read-only JSON.

**Result** -- The spoils. When a dog brings back JSON, you see it raw. When a dog brings back HTML -- like TalkingDog's rendered layouts -- the result view fires up a sandboxed iframe and renders it live. A toggle button cycles between Auto, Raw, and HTML mode. Auto detects the format and picks the right view.

**Parents** -- The bloodline. Checkboxes for every other dog in the Kennel. Mark each as Required (must hunt first) or Optional (used if they ran, ignored if they didn't). This is what shapes the Waves.

**Read Tracking** -- Collapsed by default. The trail log. Which properties did this dog sniff from other dogs' catches? Which dogs came after and picked through this one's haul? Full traceability of every data trail.

---

## Architecture

```
AppComponent
  +-- KennelListComponent           /
  +-- WavesViewerComponent          /kennel/:id
  |     +-- DogToolbarComponent          (drag & drop dog selection)
  |     +-- VisNetworkComponent          (dependency graph)
  |     +-- Inline Params Panel          (query/body editing)
  |     +-- DogSidePanelComponent
  |           +-- VersionTimelineComponent (version history)
  |           +-- EditSectionComponent     (reusable collapsible wrapper)
  |           +-- DogEditorComponent       (Monaco)
  |           +-- HTML Result Preview      (sandboxed iframe for HTML results)
  +-- KennelConfigComponent         /kennel/:id/edit
```

All components are **standalone** -- no NgModules. State is managed with **Angular signals**. Routes are lazy-loaded.

### Design Decisions

- **Monaco via CDN**, not bundled. Loaded in `index.html` before Angular bootstraps. Keeps the build lean and the dogs fast.
- **Dark lodge aesthetic**. Courier New. Black backgrounds. Green for action, blue for navigation. It looks like the kind of terminal a hunter would use if hunters used terminals.
- **Reusable EditSectionComponent**. Every collapsible section in the side panel uses the same frame -- title bar, collapse toggle, content projection. One pattern for every view.
- **Save logic lives in the Side Panel**, not the editor. The panel knows the full picture -- code, parents, version -- and fires one request that captures it all.

### Services

| Service | Purpose |
|---------|---------|
| `DogService` | Breed, save, version, and retire dogs |
| `KennelService` | Assemble kennels, unleash hunts, fetch spoils |

### Proxy

`/api` and `/save` are forwarded to the backend at `http://localhost:3000`. Configured in [`proxy.conf.json`](proxy.conf.json).

---

## Getting Started

### UI Only (backend must already be running)

```bash
cd ui-app
npm install
npx ng serve --proxy-config proxy.conf.json
```

Opens at `http://localhost:4200`. The lodge is warm.

### Full Pack (from project root)

```bash
npm run dev
```

Starts backend on `:3000` and UI on `:4200` together. The dogs are ready. The wilderness is waiting.

---

## Build

```bash
cd ui-app
npx ng build
```

Output lands in `dist/ui-app`. Deploy it anywhere. Point it at a backend. Loose the pack.
