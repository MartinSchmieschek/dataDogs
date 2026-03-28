# Backlog

Prioritized technical debt and release topics (as of: code review / release check).

---

## High

- [ ] **Production:** Build pipeline (`tsc` → `node dist/…`), `start` script, optionally UI build in a release workflow; or document explicitly: dev-only with `ts-node`.
- [ ] **Prisma seed:** `prisma.seed` points at `scripts/seed.ts` (folder missing) — repoint to `seed.ts`, remove dummy script, or document/remove `prisma db seed`.
- [ ] **`.gitignore`:** Ignore SQLite DB under `store/prisma/*.db` as well; check first line `/mbdhEnrichShit` (orphaned?).
- [ ] **Packaging:** Dogs as **installable npm packages** (`npm install …`), not only inside the monorepo — including **Core Dogs** and **Kennel Runner** as separately publishable packages (versioning, `exports`, peer deps as needed).
- [ ] **Kennel Runner vs. API:** The **Kennel Runner** itself **without an HTTP/API surface** (runtime/execution only); for REST/OpenAPI use a **wrapper** (thin API layer / separate package or service) that invokes the runner.

---

## Medium

- [ ] **Mimics — default parameters:** Mimics need sensible **defaults** for parameters; ideally these come from the **Pact** (contract as single source of truth: define defaults there or generate from it).
- [ ] **OpenAPI/Swagger — GET vs. POST:** **GET and POST** often appear side by side; **POST** is redundant when the default body is effectively **`{}`** and adds no semantics — adjust generation/annotations so only the needed method is documented (or POST only when the body is actually used).
- [ ] **Kennel versioning:** Same versioning model as **Serialized Dogs** for **Kennels** too (versions per save, history, load older states — analogous to dog versions).
- [ ] **CI:** e.g. GitHub Actions — at least `npm ci`, `prisma generate`, build, optional tests.
- [ ] **`npm test`:** currently intentionally red — replace with real test/lint/typecheck or rename script (`test:ci`, etc.).
- [ ] **`CHANGELOG.md`** and tag/release workflow (align SemVer with root version; UI `ui-app` is at `0.0.0`).

---

## Low / cleanup

- [ ] **Dependencies:** `fs` (`0.0.1-security`) — whether needed; `vm2` — briefly note risk/roadmap.
- [ ] Run **`npm audit`** before releases.
- [ ] **Optional:** `CONTRIBUTING.md`, `SECURITY.md` for a public repo.

---

## Done

- [x] **License in `package.json`:** Root and `packages/core` set to `MIT`, aligned with [LICENSE](LICENSE).
- [x] **`package.json` metadata:** `description`, `repository` (origin `MartinSchmieschek/dataDogs`), `engines.node` (`>=18.19.0`), `main` → `main.ts`, `private` as boolean.
- [x] **`ARCHITECTURE.md`:** Section *Deployment — where the lodge meets the wild* (ports, env, DB, static UI; README vibe).
