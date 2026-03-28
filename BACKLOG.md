# Backlog

Prioritized technical debt and release topics (as of: code review / release check).

---

## High

- [ ] **Build & Deploy — ungeprüft:** Bisher **kein** systematischer Nachweis, dass das Projekt **end-to-end** **baubar und deploybar** ist: z. B. frischer Clone → `npm ci` → `npm run build` + `npm run ui:build` → `start:prod` mit echter `DATABASE_URL`, Angular-Assets ausgeliefert, Health/Smoke gegen API. Im Repo gibt es **keine** GitHub-Actions-Workflow-Datei — lokal: `npm test` / `npm run typecheck` / `npm run build`; **kein** Deploy-Job, **kein** Container-Image, **kein** Smoke-Test auf einer Zielumgebung.
- [ ] **Packaging:** Dogs as **installable npm packages** (`npm install …`), not only inside the monorepo — including **Core Dogs** and **Kennel Runner** as separately publishable packages (versioning, `exports`, peer deps as needed).
- [ ] **Kennel Runner vs. API:** The **Kennel Runner** itself **without an HTTP/API surface** (runtime/execution only); for REST/OpenAPI use a **wrapper** (thin API layer / separate package or service) that invokes the runner.

---

## Medium

- [ ] **UI — Scope:** Die Oberfläche soll faktisch nur **Kennel-Liste** (`/`) und **Node-Viewer** (`/kennel/:id`) benötigen; weitere Routen nur falls nötig oder zusammenlegen.
- [ ] **UI — Kennel bearbeiten:** Die Seite **Kennel bearbeiten** (`/kennel/:id/edit`) mit separaten **Kennel-Properties** ist überflüssig, wenn **alles im Node-Viewer** (Graph, Side-Panel, Query/Body, ggf. eingebettete Kennel-Metadaten) erledigt werden kann — Edit-Route reduzieren oder in den Viewer integrieren.
- [ ] **UI — SerializedDog Default-Tab:** Im Edit-Fenster (Node-Side-Panel) soll bei **SerializedDogs** die **Code-Ansicht** standardmäktiv aktiv sein *(bereits umgesetzt: `getDefaultPanelSection` → `code`, wenn `codeTs` gesetzt; bei Bedarf noch speziell für reinen Node-Viewer testen/verdichten).*
- [ ] **Mimics — default parameters:** Mimics need sensible **defaults** for parameters; ideally these come from the **Pact** (contract as single source of truth: define defaults there or generate from it).
- [ ] **OpenAPI/Swagger — GET vs. POST:** **GET and POST** often appear side by side; **POST** is redundant when the default body is effectively **`{}`** and adds no semantics — adjust generation/annotations so only the needed method is documented (or POST only when the body is actually used).
- [ ] **OpenAPI/Swagger — nur Lead-Dog:** Die generierte Spec gibt **mehr** her, als für den **öffentlichen Kennel-Vertrag** nötig — maßgeblich ist nur der **Lead** (erster Eintrag in `dogIds`); Pfade/Schemas aus **Nicht-Lead-Dogs** sollten die Swagger-Ausgabe nicht unnötig aufblähen (Spec auf Lead-Yield bzw. dokumentierte öffentliche Oberfläche fokussieren; siehe [`SwaggerGenerator`](services/SwaggerGenerator.ts)).
- [ ] **Kennel versioning:** Same versioning model as **Serialized Dogs** for **Kennels** too (versions per save, history, load older states — analogous to dog versions).
- [ ] **Serialized Dog — rename:** A serialized dog must support **renaming** (display name / identifier as needed) without breaking references where the model allows — UI + persistence + contract updates as required.
- [ ] **History — parent / branch from past:** Version history should be modeled with an explicit **parent** (or equivalent lineage) so users can **navigate backward** in time and **start a new line** from any historical version (fork-style continuation, not only linear “latest”).
- [ ] **Tag/release workflow** (align SemVer with root version; UI `ui-app` is at `0.0.0`); optional release job building UI.

---

## Low / cleanup

- [ ] **Dependencies:** `fs` (`0.0.1-security`) — whether needed; `vm2` — briefly note risk/roadmap (see README *Dependency notes*).
- [ ] Run **`npm audit`** before releases.
- [ ] **Optional:** `CONTRIBUTING.md`, `SECURITY.md` for a public repo.

---

## Done

- [x] **UI — Kennel-Antwort im Node-Viewer:** Button **Antwort (Server)** öffnet den **öffentlichen** Endpunkt `GET http://localhost:3000/:kennelId` (Lead-Yield), z. B. `/default-kennel`; Query-Parameter aus dem Panel werden angehängt. (Nicht `/api/kennels/.../run`.)
- [x] **License in `package.json`:** Root and `packages/core` set to `MIT`, aligned with [LICENSE](LICENSE).
- [x] **`package.json` metadata:** `description`, `repository` (origin `MartinSchmieschek/dataDogs`), `engines.node` (`>=18.19.0`), `main` → `main.ts`, `private` as boolean.
- [x] **`ARCHITECTURE.md`:** Section *Deployment — where the lodge meets the wild* (ports, env, DB, static UI; README vibe).
- [x] **Production:** Build pipeline (`npm run build` → `dist/`), `start` / `start:prod`, `postinstall` builds `packages/core`; README documents dev vs. production.
- [x] **Prisma seed:** `prisma.seed` → `ts-node seed.ts`; CLI entry in `seed.ts` when run as main module.
- [x] **`.gitignore`:** `store/prisma/*.db`, `dist/`; removed obsolete `/mbdhEnrichShit`.
- [x] **`npm test`:** runs `typecheck` (core + app) until unit tests exist.
- [x] **`CHANGELOG.md`:** initial [Keep a Changelog](https://keepachangelog.com/) scaffold; tags/releases still manual.
