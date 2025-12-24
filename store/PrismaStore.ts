import { PrismaClient } from '@prisma/client';
import { IStore } from './IStore';
import path from 'path';

export class PrismaStore implements IStore {
  private prisma: PrismaClient;

  /**
   * connectionString optional: if not provided, Prisma client will use process.env.DATABASE_URL
   */
  constructor(connectionString?: string) {
    if (connectionString) {
      this.prisma = new PrismaClient({ datasources: { db: { url: connectionString } } } as any);
    } else {
      this.prisma = new PrismaClient();
    }
  }

  public async init(): Promise<void> {
    // For Prisma, migrations / push should be run outside of runtime.
    // But we can attempt a simple call to ensure DB connection works.
    await this.prisma.$connect();
  }

  public async save(d: any): Promise<void> {
    const id = d?.id ?? Date.now().toString();
    const type = d?.type ?? (d?.constructor?.name ?? 'unknown');

    // support two shapes:
    // 1) { serializedDogConfig: {...}, id?:..., type?:... }
    // 2) raw config object (the config itself)
    let cfg: any;
    if (d && d.serializedDogConfig !== undefined) {
      // accept either string or object; normalize to object for manipulation
      cfg = typeof d.serializedDogConfig === 'string' ? JSON.parse(d.serializedDogConfig) : d.serializedDogConfig;
    } else {
      cfg = typeof d === 'string' ? JSON.parse(d) : d;
    }

    // Persist as string because SQLite schema uses String for serializedDogConfig
    const dbValue = typeof cfg === 'string' ? cfg : JSON.stringify(cfg);

    await this.prisma.dog.upsert({
      where: { id },
      create: { id, type, serializedDogConfig: dbValue },
      update: { type, serializedDogConfig: dbValue }
    });
  }

  public async load(id: string): Promise<any> {
    const row = await this.prisma.dog.findUnique({ where: { id } });
    return row ? row.serializedDogConfig : null;
  }

  public async findByType(type: string): Promise<Array<{ id: string; serializedDogConfig: string }>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });
    // stored value is a string (JSON text). Return as-is.
    return rows.map((r: any) => ({ id: r.id, serializedDogConfig: r.serializedDogConfig }));
  }

  public async findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<{ id: string; serializedDogConfig: string }>> {
    // Lade alle Entities des Typs
    let rows = await this.prisma.dog.findMany({ where: { type } });
    
    // Wenn keine ids angegeben sind, lade alle neuesten Versionen
    if (!ids || ids.length === 0) {
      return this.getLatestVersionsForAll(rows);
    }
    
    // Trenne spezifische Version-IDs von Basis-IDs
    const specificVersionIds = new Set<string>();
    const baseIdsForLatest = new Set<string>();
    
    ids.forEach(id => {
      if (this.isVersionedId(id)) {
        // Spezifische Version-ID - lade genau diese
        specificVersionIds.add(id);
      } else {
        // Basis-ID - lade neueste Version
        baseIdsForLatest.add(id);
      }
    });
    
    const result: Array<{ id: string; serializedDogConfig: string }> = [];
    
    // Lade spezifische Versionen direkt
    rows.forEach((r: any) => {
      if (specificVersionIds.has(r.id)) {
        result.push({ id: r.id, serializedDogConfig: r.serializedDogConfig });
      }
    });
    
      // Für jede Basis-ID, finde die neueste Version
      baseIdsForLatest.forEach(baseId => {
        const versionsForBaseId = rows
          .filter((row: any) => {
            const rowBaseId = this.extractBaseId(row.id);
            return rowBaseId === baseId;
          })
          .map((row: any): { id: string; serializedDogConfig: string; version: number } | null => {
            let config: any;
            try {
              config = typeof row.serializedDogConfig === 'string' 
                ? JSON.parse(row.serializedDogConfig) 
                : row.serializedDogConfig;
            } catch (e) {
              return null;
            }
            
            const versionMatch = row.id.match(/-v(\d+)$/);
            const version = config.version || (versionMatch ? parseInt(versionMatch[1], 10) : 0);
            
            return { id: row.id, serializedDogConfig: row.serializedDogConfig, version };
          })
          .filter((v): v is { id: string; serializedDogConfig: string; version: number } => v !== null)
          .sort((a, b) => b.version - a.version);
        
        if (versionsForBaseId.length > 0) {
          const latest = versionsForBaseId[0];
          result.push({ id: latest.id, serializedDogConfig: latest.serializedDogConfig });
        }
      });
    
    return result;
  }
  
  /**
   * Hilfsmethode: Findet die neuesten Versionen für alle Entities
   */
  private getLatestVersionsForAll(rows: any[]): Array<{ id: string; serializedDogConfig: string }> {
    const latestVersions = new Map<string, { id: string; serializedDogConfig: string; version: number }>();
    
    rows.forEach((r: any) => {
      // Parse Config um version zu lesen
      let config: any;
      try {
        config = typeof r.serializedDogConfig === 'string' 
          ? JSON.parse(r.serializedDogConfig) 
          : r.serializedDogConfig;
      } catch (e) {
        console.warn(`[PrismaStore.getLatestVersionsForAll] Fehler beim Parsen der Config für ${r.id}:`, e);
        return;
      }
      
      // Extrahiere Basis-ID
      const versionMatch = r.id.match(/-v(\d+)$/);
      const baseId = versionMatch ? this.extractBaseId(r.id) : r.id;
      
      // Nutze version aus Config, fallback auf ID-Extraktion
      const version = config.version || (versionMatch ? parseInt(versionMatch[1], 10) : 0);
      
      const existing = latestVersions.get(baseId);
      
      if (!existing || version > existing.version) {
        latestVersions.set(baseId, { id: r.id, serializedDogConfig: r.serializedDogConfig, version });
      }
    });
    
    return Array.from(latestVersions.values());
  }
  
  /**
   * Prüft, ob eine ID eine Versions-ID ist (enthält -v\d+)
   */
  private isVersionedId(id: string): boolean {
    return /-v\d+$/.test(id);
  }

  /**
   * Extrahiert die Basis-ID aus einer Version-ID
   * z.B. "seed-serialized-1-v2" -> "seed-serialized-1"
   */
  private extractBaseId(id: string): string {
    const match = id.match(/^(.+)-v(\d+)$/);
    return match ? match[1] : id;
  }

  public async delete(id: string): Promise<void> {
    await this.prisma.dog.delete({ where: { id } });
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default PrismaStore;
