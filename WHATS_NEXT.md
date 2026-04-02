# What's Next

> The lodge is built. The dogs hunt. Now we sharpen the knives.

---

## Up Next

### Auto-Run nach Code-Save

Aktuell: Code speichern → manuell "Neu laden" klicken. Zwei Schritte für etwas, das ein Schritt sein sollte.

**Ziel:** Nach erfolgreichem Save automatisch Waves neu laden, damit man sofort das Ergebnis sieht. Der Side Panel feuert `saved` → der Waves Viewer reagiert mit `loadWaves()`. Die Verdrahtung existiert schon — fehlt nur der automatische Trigger statt des manuellen Klicks.

Bonus: Visuelles Feedback im Graph, welcher Dog sich gerade aktualisiert hat.

---

### Keyboard Shortcuts

Die Maus ist für Touristen. Wer im Code steckt, braucht:

- **Ctrl+S** — Speichern im Dog Editor (triggert `saveCode()` im Side Panel)
- **Ctrl+Enter** — Waves neu laden (triggert `loadWaves()` im Viewer)
- **Escape** — Side Panel schließen

Monaco fängt Ctrl+S schon ab — muss an den Save-Flow weitergeleitet werden. Für Ctrl+Enter ein globaler `@HostListener` im WavesViewerComponent.

---

### Diff-View zwischen Versionen

Die Version-Timeline existiert. Man kann alte Versionen laden und ihren Code sehen. Aber man sieht nicht, was sich *geändert* hat.

**Ziel:** Side-by-Side-Diff zwischen zwei Versionen. Monaco hat `createDiffEditor()` eingebaut — das ist der natürliche Weg. Zwei Versionen auswählen (z.B. aktuelle + eine aus der Timeline), Diff-Editor öffnet sich. Rot/Grün zeigt was rausflog und was dazukam.

---

### Body-Editor als Monaco statt Textarea

Im Params-Panel des Waves Viewers ist der Body aktuell eine einfache Textarea. Funktioniert, aber:
- Kein Syntax-Highlighting
- Keine JSON-Validierung
- Inkonsistent mit dem Rest der App (Monaco überall sonst)

**Ziel:** Kleiner Monaco JSON-Editor mit `automaticLayout: true`, `vs-dark` Theme, Validierung. Gleiche Behandlung wie der Body-Editor in der Kennel-Config-Seite.

---

## Backlog

Ideen, die noch reifen müssen. Kein fester Zeitplan.

- **Execution-Time & Logs pro Dog** — Wie lange hat jeder Dog gebraucht? Console-Output sichtbar machen.
- **Dog-Status Farbcodierung im Graph** — Fehler = Rot, OK = Grün, Pending = Grau.
- **HTML-Preview Fullscreen** — Pop-out-Button für den iframe, damit TalkingDog-Layouts in voller Größe testbar sind.
- **Query/Body Presets** — Verschiedene Param-Sets abspeichern und schnell wechseln ("Rezept-Test", "Biografie-Test").
- **WebSocket Live-Updates** — Waves streamen während der Ausführung statt am Ende alles auf einmal.
- **Dog-Suche/Filter in der Toolbar** — Bei vielen Dogs wird die Toolbar unübersichtlich.
- **Toast-Notifications** — Statt inline-Fehler elegante Toasts für Save/Error/Success.

---

## Kombinations-Kennels (API-gesteuert)

Dogs können sich gegenseitig füttern — perfekt für LLMs und Automatisierung über die API. Alle Kennels sind über `GET /:kennelId?params` oder `POST /:kennelId` aufrufbar. Ein LLM kann die API nutzen, um Daten aus mehreren Dogs zu kombinieren:

### Ideen für zusammengesetzte Kennels

- **Geocoding + Weather + PublicTransport** — Adresse eingeben → GPS auflösen → Wetter + Abfahrten in einem Kennel. Drei Dogs in einer Pipeline, das Ergebnis ist ein vollständiger Standort-Überblick.
- **Geocoding + Wikipedia + Landmarks** — "Was ist hier interessant?" → Adresse zu GPS → Wikipedia-Artikel + OSM-Landmarks in der Nähe.
- **Weather + AirQuality + Sun** — Kombiniertes Umwelt-Dashboard per GPS: Wetter, Luftqualität, Pollenflug, UV-Index, Sonnenzeiten.

### Anleitung für LLMs

Ein LLM kann die dataDogs API direkt nutzen. Jeder Kennel hat einen eigenen Endpoint:

```
GET /weather-kennel?lat=50.1109&lng=8.6821
GET /air-quality-kennel?lat=50.1109&lng=8.6821
GET /public-transport-kennel?lat=50.1109&lng=8.6821
GET /sun-kennel?lat=50.1109&lng=8.6821
GET /wiki-nearby-kennel?lat=50.1109&lng=8.6821&radius=1000
GET /geocoding-kennel?address=Hauptwache+Frankfurt
GET /geocoding-kennel?lat=50.1109&lng=8.6821&address=
```

Workflow für ein LLM:
1. Nutzer gibt eine Adresse → `GET /geocoding-kennel?address=...` → bekommt lat/lng
2. Mit lat/lng parallel abfragen: Weather, PublicTransport, AirQuality, Wikipedia
3. Ergebnisse zusammenfassen und dem Nutzer präsentieren

Zum Erstellen neuer Kennels über die API:
```bash
# Neuen Kennel anlegen
curl -X POST http://localhost:3000/api/kennels \
  -H "Content-Type: application/json" \
  -d '{"id": "my-combo", "name": "Standort-Dashboard", "dogIds": ["base:WeatherRetriever", "base:AirQualityRetriever", "base:SunRetriever"]}'

# Kennel ausführen
curl http://localhost:3000/my-combo?lat=50.1109&lng=8.6821
```

---

## Changelog — Neue Dogs (April 2026)

| Package | Dog | Kennel-ID | API | Beschreibung |
|---|---|---|---|---|
| `dogs-public-transport` | PublicTransportRetriever | `public-transport-kennel` | MOTIS | Haltestellen + Abfahrten (Bus, Tram, U-Bahn, S-Bahn, Zug) |
| `dogs-weather` | WeatherRetriever | `weather-kennel` | Open-Meteo | Aktuelles Wetter + 48h Vorhersage, optional nach Uhrzeit |
| `dogs-air-quality` | AirQualityRetriever | `air-quality-kennel` | Open-Meteo AQ | Feinstaub, Ozon, NO2, Pollenflug |
| `dogs-geocoding` | GeocodingRetriever | `geocoding-kennel` | Nominatim/OSM | Adresse → GPS und GPS → Adresse |
| `dogs-wikipedia` | WikiNearbyRetriever | `wiki-nearby-kennel` | Wikipedia API | Artikel über Orte in der Nähe mit Summary + Thumbnail |
| `dogs-sun` | SunRetriever | `sun-kennel` | Open-Meteo | Sonnenauf-/untergang, Tageslänge, UV-Index, 7-Tage |

Alle Dogs nutzen **kostenlose APIs ohne API-Key**. Alle akzeptieren GPS-Koordinaten (`lat`/`lng`) als Input. Siehe [Creating a new BaseDog Package](README.md#creating-a-new-basedog-package) für die Anleitung zum Erstellen neuer Dogs.

---

*Letztes Update: April 2026*
