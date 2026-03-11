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

    // Erstelle Update-Objekt mit allen Feldern
    const updateData: any = {
      id,
      type
    };

    // SerializedDog: speichere serializedDogConfig
    if (d.serializedDogConfig !== undefined) {
      updateData.serializedDogConfig = typeof d.serializedDogConfig === 'string' 
        ? d.serializedDogConfig 
        : JSON.stringify(d.serializedDogConfig);
    }

    // KennelConfig: speichere direkte Felder
    if (d.name !== undefined) updateData.name = d.name;
    if (d.description !== undefined) updateData.description = d.description;
    // dogIds als JSON-String speichern (SQLite unterstützt kein Array)
    if (d.dogIds !== undefined) {
      updateData.dogIds = JSON.stringify(d.dogIds);
    }
    if (d.defaultQuery !== undefined) {
      updateData.defaultQuery = typeof d.defaultQuery === 'string' 
        ? d.defaultQuery 
        : JSON.stringify(d.defaultQuery);
    }
    if (d.defaultBody !== undefined) {
      updateData.defaultBody = typeof d.defaultBody === 'string' 
        ? d.defaultBody 
        : JSON.stringify(d.defaultBody);
    }
    if (d.createdAt !== undefined) updateData.createdAt = d.createdAt;
    if (d.updatedAt !== undefined) updateData.updatedAt = d.updatedAt;

    await this.prisma.dog.upsert({
      where: { id },
      create: updateData,
      update: updateData
    });
  }

  public async load(id: string): Promise<any> {
    const row: any = await this.prisma.dog.findUnique({ where: { id } });
    if (!row) return null;
    
    // KennelConfig: Wenn direkte Felder vorhanden sind (name, description, dogIds)
    if (row.name !== null || row.description !== null || row.dogIds !== null) {
      return {
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        dogIds: row.dogIds, // JSON-String, wird in parseEntity() geparst
        defaultQuery: row.defaultQuery,
        defaultBody: row.defaultBody,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        serializedDogConfig: row.serializedDogConfig
      };
    }
    
    // SerializedDog: Gib nur serializedDogConfig zurück (String)
    return row.serializedDogConfig;
  }

  public async findByType(type: string): Promise<Array<any>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });
    // Gib immer vollständige Zeile zurück (mit id für Versionsverwaltung)
    // Für KennelConfig: alle Felder
    // Für SerializedDog: Objekt mit id und serializedDogConfig
    return rows.map((r: any) => {
      // Wenn direkte Felder vorhanden sind (KennelConfig), gib alle Felder zurück
      if (r.name !== null || r.description !== null || r.dogIds !== null) {
        return {
          id: r.id,
          type: r.type,
          name: r.name,
          description: r.description,
          dogIds: r.dogIds,
          defaultQuery: r.defaultQuery,
          defaultBody: r.defaultBody,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          serializedDogConfig: r.serializedDogConfig
        };
      }
      // Für SerializedDog: gib Objekt mit id und serializedDogConfig zurück
      return {
        id: r.id,
        serializedDogConfig: r.serializedDogConfig
      };
    });
  }

  public async findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<any>> {
    // Lade alle Entities des Typs
    let rows = await this.prisma.dog.findMany({ where: { type } });
    
    // Wenn keine ids angegeben sind, lade alle neuesten Versionen
    if (!ids || ids.length === 0) {
      return this.getLatestVersionsForAll(rows);
    }
    
    // Immer Basis-ID extrahieren und neueste Version laden
    const baseIdsForLatest = new Set<string>();
    ids.forEach(id => {
      baseIdsForLatest.add(this.extractBaseId(id));
    });
    
    const result: Array<any> = [];
    
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
          // Finde die vollständige Zeile aus rows
          const fullRow: any = rows.find((r: any) => r.id === latest.id);
          if (fullRow) {
            result.push({
              id: fullRow.id,
              type: fullRow.type,
              name: fullRow.name ?? null,
              description: fullRow.description ?? null,
              dogIds: fullRow.dogIds ?? null,
              defaultQuery: fullRow.defaultQuery ?? null,
              defaultBody: fullRow.defaultBody ?? null,
              createdAt: fullRow.createdAt ?? null,
              updatedAt: fullRow.updatedAt ?? null,
              serializedDogConfig: fullRow.serializedDogConfig
            });
          } else {
            // Fallback: verwende latest (für SerializedDogs)
            result.push({
              id: latest.id,
              type: '',
              name: null,
              description: null,
              dogIds: null,
              defaultQuery: null,
              defaultBody: null,
              createdAt: null,
              updatedAt: null,
              serializedDogConfig: latest.serializedDogConfig
            });
          }
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

  public async findAllVersions(type: string, baseId: string): Promise<Array<{ id: string; version: number; serializedDogConfig: string }>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });

    return rows
      .filter((r: any) => this.extractBaseId(r.id) === baseId)
      .map((r: any) => {
        let version = 0;
        try {
          const config = typeof r.serializedDogConfig === 'string'
            ? JSON.parse(r.serializedDogConfig)
            : r.serializedDogConfig;
          const match = r.id.match(/-v(\d+)$/);
          version = config.version || (match ? parseInt(match[1], 10) : 0);
        } catch { /* ignore */ }
        return { id: r.id, version, serializedDogConfig: r.serializedDogConfig };
      })
      .sort((a, b) => b.version - a.version);
  }

  public async delete(id: string): Promise<void> {
    await this.prisma.dog.delete({ where: { id } });
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default PrismaStore;
