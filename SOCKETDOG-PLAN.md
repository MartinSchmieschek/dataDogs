# SocketDog — Plan & Baustellen

Ziel: Lead-Yield mit **`{ snapshot: T, live: string }`** — `snapshot` = aktueller JSON-tauglicher Stand, `live` = HTML/Script für WebSocket-Session, Listener und Rückkanal. Optional **`sessionId`** über Query trennt Unterräume.

---

## 1. Konvention (Lead-Yield)

| Feld        | Typ        | Rolle |
|------------|------------|--------|
| `snapshot` | `T` (JSON) | Momentaufnahme für API-Consumer, Tests, reine Daten |
| `live`     | `string`   | Vollständiges oder eingebettetes HTML mit Client-JS: WS verbinden, Peer-Daten mergen, Change → `peerPatch` senden |

**Hinweis:** Nur Hunde, die dieses Shape zurückgeben, profitieren von der erweiterten Auslieferung — alle anderen Leads bleiben String oder primitives JSON wie heute.

---

## 2. HTTP-Auslieferung (Server)

Heute: [`sendResult`](api/routes/KennelRunHandler.ts) entscheidet nur **String ≈ HTML** vs **sonst JSON** (`firstDog.result`).

**Geplant:**

- Wenn `result` ein **Objekt** mit **`snapshot`** und **`live`** ist:
  - **`Accept: application/json`** oder Query z. B. **`?format=json`** / **`?data=1`** → Antwort **`snapshot`** (und ggf. Metadaten), **nicht** den großen `live`-String.
  - **Default (Browser, `Accept: text/html`)** → **`live`** als `text/html` senden (oder zusammengesetztes Dokument, falls `live` nur ein Fragment ist — Konvention im Dog festlegen).
- Bestehende Kennels ohne dieses Shape: **unverändert**.

**Baustelle:** [`KennelRunHandler.sendResult`](api/routes/KennelRunHandler.ts) + ggf. alle Aufrufer von `sendResult` (`handleExecute`, `handlePublicGet`, `handlePublicPost`) um **Request** (`req.headers.accept`, `req.query`) zu berücksichtigen.

---

## 3. WebSocket — Raum & Protokoll (neu)

**Verantwortung:** eigener Modul-Service (z. B. `services/KennelPeerHub.ts` oder `api/ws/KennelSocketServer.ts`).

- **Raum-Schlüssel:** `kennelId` + optional `sessionId` (fehlend = globaler Kanal).
- **In-Memory:** `Map<roomKey, RoomState>` mit `peerId → { data: object }`, Liste der `WebSocket`-Clients.
- **Nachrichten (minimal):** `join`, `peerPatch` (broadcast), optional `snapshot` beim Join, `ping`/`pong`.
- **Merge:** flaches `Object.assign` / Patch pro Peer; Größenlimits.

**Baustelle:** Neues Modul + **HTTP-Upgrade** am bestehenden Port.

---

## 4. Server-Bootstrap — `http` + `WebSocket`

Heute: [`main.ts`](main.ts) nutzt `app.listen(port)` — kein Zugriff auf `http.Server` für `ws`.

**Geplant:** `const server = http.createServer(app);` dann `server.listen`, **`WebSocketServer` mit `{ server }`** (Package **`ws`** in [`package.json`](package.json) ergänzen).

**Baustelle:** [`main.ts`](main.ts) — Startpfad anpassen; WS-Handler registrieren und **KennelPeerHub** injizieren oder Singleton.

---

## 5. `live`-String & öffentliche URL

Das eingebettete Script muss **WS-URL** und **`kennelId` / `sessionId`** kennen — typisch aus `window.location` oder injizierte Konstante, die der Lead aus `QueryRetriever` setzt.

**Baustelle:** Konvention dokumentieren (relative `ws(s)://` + Pfad); bei Reverse-Proxy später `X-Forwarded-*` beachten.

---

## 6. `snapshot` und Live-Raum

Für **`snapshot` = „aktueller Stand aller Teilnehmer“** muss der Server beim Request **den Raum lesen** können (nicht nur `KennelRun`).

**Option A:** Snapshot nur aus **demselben Prozess** (In-Memory-Hub) — beim `GET` Lead läuft wie heute, danach oder parallel merged Hub-State in `snapshot` (erfordert **Anbindung Lead ↔ Hub** im Handler oder im Dog via injizierte Hilfe — aktuell hat VM **keinen** Hub).

**Option B (MVP):** `snapshot` im ersten Release nur **aus den Waves berechnet** (ohne Peers); Peer-Liste erst **nach WS-Join** im Client. Dann später Hub in `snapshot` einrechnen.

**Baustelle:** Produktentscheidung + ggf. **`KennelRunHandler`** erweitert um **Hub.readSnapshot(kennelId, sessionId)** vor/nach `runKennel` — oder dedizierter **API-Only-Endpunkt** `GET /api/kennels/:id/peers` (neu).

---

## 7. Core / VM

[`SerializedDog`](packages/core/src/dogs/SerializedDog.ts) muss **kein** Schema ändern, solange der Lead ein **normales Objekt** `{ snapshot, live }` zurückgibt.

**Optional später:** Typ-Hilfe oder Guard in Core (`isSocketDogYield`).

**Baustelle:** minimal **keine** Pflicht-Core-Änderung für MVP; Dokumentation der Konvention reicht.

---

## 8. Swagger / OpenAPI

[`KennelSwaggerHandler`](api/routes/KennelSwaggerHandler.ts) nimmt Lead-Yield an — bei strukturiertem Objekt ggf. Schema für `{ snapshot, live }` oder weiterhin „opaque“.

**Baustelle:** Generierung anpassen, wenn `snapshot`-Form dokumentiert werden soll.

---

## 9. UI (Angular)

[`waves-viewer`](ui-app/src/app/pages/waves-viewer/waves-viewer.component.ts) zeigt Lead-Ergebnis — bei Objekt mit `live`/`snapshot` Darstellung wählen (HTML-Preview vs. JSON-Tree).

**Baustelle:** optional **Preview** für `live`, **roh** `snapshot` tab.

---

## 10. Sicherheit & Betrieb

- Keine Auth wie heute — Räume sind öffentlich; Rate-Limits und Message-Größen empfohlen.
- **Multi-Instance:** In-Memory-Räume nicht geteilt → später Redis Pub/Sub (nicht MVP).

---

## Baustellen-Übersicht (Checkliste)

| # | Thema | Wo |
|---|--------|-----|
| 1 | Yield-Konvention `{ snapshot, live }` | SerializedDog-Code im Projekt / Seeds; README-Kurzabschnitt |
| 2 | `sendResult` + Content-Negotiation JSON vs HTML | [`api/routes/KennelRunHandler.ts`](api/routes/KennelRunHandler.ts) |
| 3 | WebSocket-Server + Raum-Logik | neu, z. B. `services/` oder `api/ws/` |
| 4 | `http.createServer` + `ws` | [`main.ts`](main.ts), [`package.json`](package.json) |
| 5 | Hub ↔ `snapshot` (wenn gewünscht) | [`KennelRunHandler`](api/routes/KennelRunHandler.ts) oder neuer Route |
| 6 | Swagger | [`KennelSwaggerHandler`](api/routes/KennelSwaggerHandler.ts) / [`@datadogs/swaggrid`](packages/swaggrid/) |
| 7 | UI Preview | [`ui-app`](ui-app/) Waves-Viewer / Kennel-Antwort |

---

## Phasen

1. **Phase A:** `ws` + In-Memory-Hub + Protokoll; manueller Test mit statischer HTML-Seite.
2. **Phase B:** `sendResult` + Query/`Accept` für `{ snapshot, live }`; Lead-Dog-Beispiel (Seed oder Doku).
3. **Phase C:** `snapshot` aus Hub + UI; optional Redis.

---

Siehe auch [BACKLOG.md](BACKLOG.md) (*WebSocket Live-Updates*).
