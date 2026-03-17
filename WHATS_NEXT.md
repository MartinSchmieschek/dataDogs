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

*Letztes Update: März 2026*
