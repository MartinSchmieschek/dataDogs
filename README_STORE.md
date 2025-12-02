Store (Prisma) — Install & Usage

Kurz: Die Implementierung `store/PrismaStore.ts` nutzt Prisma + Postgres. Dadurch kannst du lokal mit SQLite/SQLite→Postgres wechseln oder in die Cloud (Supabase, Neon) deployen.

Schritte zum Einrichten (lokal):

1) Abhängigkeiten installieren
```powershell
npm install
npm install -D prisma
npx prisma generate
```

2) Lokale Datenbank (SQLite) - empfohlen für schnelle Entwicklung
- Setze `DATABASE_URL` für SQLite (Datei `dev.db` im Repo-Root):
```powershell
$env:DATABASE_URL = "file:./dev.db"
```
- Datenbank-Schema anwenden (push erstellt die Datei und das Schema):
```powershell
npx prisma db push
```

3) Optional: Wechsel zu Postgres (Cloud)
- Wenn du in die Cloud wechseln willst, setze `DATABASE_URL` auf deinen Postgres-Connection-String (z. B. Supabase/Neon) und passe `prisma/schema.prisma` an `provider = "postgresql"`, dann:
```powershell
$env:DATABASE_URL = "postgresql://user:pass@host:5432/dbname"
npx prisma db push
```

4) Code nutzen
In `main.ts` instanziiert das Projekt nun automatisch den `PrismaStore` mit `process.env.DATABASE_URL` (standard: `file:./dev.db`). Beispiel:
```ts
import { PrismaStore } from './store/PrismaStore';

const store = new PrismaStore(process.env.DATABASE_URL ?? 'file:./dev.db');
await store.init();
// nutze store.save/load/findByType
```

Hinweise
- Für Entwicklung ist SQLite sehr praktisch (keine zusätzliche Installation).
- In Produktion empfehle ich Migrationen via `prisma migrate` und eine echte Postgres-Instanz.
