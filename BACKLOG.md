# Backlog

Priorisierte technische Schulden und Release-Themen (Stand: aus Code-Review / Release-Check).

---

## Hoch

- [ ] **Produktion:** Build-Pipeline (`tsc` → `node dist/…`), `start`-Script, ggf. UI-Build in einem Release-Workflow; oder explizit dokumentieren: nur Dev mit `ts-node`.
- [ ] **Prisma seed:** `prisma.seed` zeigt auf `scripts/seed.ts` (Ordner fehlt) — auf `seed.ts` umbiegen, Dummy-Script entfernen, oder `prisma db seed` dokumentieren/entfernen.
- [ ] **`.gitignore`:** SQLite-DB auch unter `store/prisma/*.db` ignorieren; erste Zeile `/mbdhEnrichShit` prüfen (verwaist?).

---

## Mittel

- [ ] **Kennel-Versionierung:** dasselbe Versionsmodell wie bei **Serialized Dogs** auch für **Kennels** (Versionen pro Speichern, Historie, ältere Stände laden — analog zu Dog-Versionen).
- [ ] **CI:** z. B. GitHub Actions — mindestens `npm ci`, `prisma generate`, Build, optional Tests.
- [ ] **`npm test`:** aktuell absichtlich rot — durch echten Test/Lint/Typecheck ersetzen oder Script umbenennen (`test:ci` o. Ä.).
- [ ] **`CHANGELOG.md`** und Tag-/Release-Workflow (SemVer mit Root-Version abstimmen; UI `ui-app` steht auf `0.0.0`).

---

## Niedrig / Aufräumen

- [ ] **Dependencies:** `fs` (`0.0.1-security`) — ob nötig; `vm2` — Risiko/Roadmap kurz erwähnen.
- [ ] **`npm audit`** vor Releases ausführen.
- [ ] **Optional:** `CONTRIBUTING.md`, `SECURITY.md` für öffentliches Repo.

---

## Erledigt

- [x] **Lizenz in `package.json`:** Root und `packages/core` auf `MIT`, abgestimmt mit [LICENSE](LICENSE).
- [x] **`package.json` Metadaten:** `description`, `repository` (Origin `MartinSchmieschek/datadogs`), `engines.node` (`>=18.19.0`), `main` → `main.ts`, `private` als Boolean.
- [x] **`ARCHITECTURE.md`:** Abschnitt *Deployment — where the lodge meets the wild* (Ports, Env, DB, statisches UI; README-Vibe).
