// The PrismaStore — our ship's hold, where all plundered data is locked away in the eldritch deep.
// Carrion hordes trill their profane accord with eldritch plans:
// this class is the sole keeper of persistence, and it answers to no one but Prisma.
import { PrismaClient } from '@prisma/client';
import { IStore } from './IStore';
import path from 'path';

export class PrismaStore implements IStore {
  private prisma: PrismaClient;

  /**
   * Provision the store with a connection string — or let the env scroll speak for itself.
   * Without a connectionString, Prisma reads DATABASE_URL from the void.
   */
  constructor(connectionString?: string) {
    if (connectionString) {
      this.prisma = new PrismaClient({ datasources: { db: { url: connectionString } } } as any);
    } else {
      this.prisma = new PrismaClient();
    }
  }

  public async init(): Promise<void> {
    // Migrations must be run outside this ship — we merely test the anchor holds fast.
    // Roiling, moaning: if the connection fails here, all is lost before the hunt begins.
    await this.prisma.$connect();
  }

  public async save(d: any): Promise<void> {
    // Name the plunder — if no ID is given, stamp it with the current timestamp like a dead man's mark.
    const id = d?.id ?? Date.now().toString();
    const type = d?.type ?? (d?.constructor?.name ?? 'unknown');

    // Assemble the cargo manifest — only fields that exist may be loaded.
    const updateData: any = {
      id,
      type
    };

    // SerializedDog carries its soul in serializedDogConfig — string or object, we accept both forms.
    if (d.serializedDogConfig !== undefined) {
      updateData.serializedDogConfig = typeof d.serializedDogConfig === 'string'
        ? d.serializedDogConfig
        : JSON.stringify(d.serializedDogConfig);
    }

    // KennelConfig fields sail as direct columns — name, description, emoji, the lot.
    if (d.name !== undefined) updateData.name = d.name;
    if (d.description !== undefined) updateData.description = d.description;
    // dogIds cannot survive as an array in SQLite's hold — bind them as a JSON-string.
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
    if (d.emoji !== undefined) updateData.emoji = d.emoji;
    if (d.createdAt !== undefined) updateData.createdAt = d.createdAt;
    if (d.updatedAt !== undefined) updateData.updatedAt = d.updatedAt;

    // Upsert: create or overwrite — the void shows no mercy to duplicates.
    await this.prisma.dog.upsert({
      where: { id },
      create: updateData,
      update: updateData
    });
  }

  public async load(id: string): Promise<any> {
    const row: any = await this.prisma.dog.findUnique({ where: { id } });
    if (!row) return null;

    // A KennelConfig reveals itself by its named fields — name, description, dogIds, or emoji shall betray it.
    // From brooding gulfs are we beheld: the type is inferred from what the row holds.
    if (row.name !== null || row.description !== null || row.dogIds !== null || row.emoji !== null) {
      return {
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        dogIds: row.dogIds, // Still a JSON-string — parseEntity() shall untangle it.
        defaultQuery: row.defaultQuery,
        defaultBody: row.defaultBody,
        emoji: row.emoji,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        serializedDogConfig: row.serializedDogConfig
      };
    }

    // A SerializedDog is but its soul — return only the config string and let it sail free.
    return row.serializedDogConfig;
  }

  public async findByType(type: string): Promise<Array<any>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });
    // Always return the full row — the id must survive for version tracking purposes.
    // In luminous space, the id is the star by which we navigate the dark.
    return rows.map((r: any) => {
      // KennelConfig betrays itself with name, description, dogIds, or emoji.
      if (r.name !== null || r.description !== null || r.dogIds !== null || r.emoji !== null) {
        return {
          id: r.id,
          type: r.type,
          name: r.name,
          description: r.description,
          dogIds: r.dogIds,
          defaultQuery: r.defaultQuery,
          defaultBody: r.defaultBody,
          emoji: r.emoji,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          serializedDogConfig: r.serializedDogConfig
        };
      }
      // SerializedDog returns only its id and its soul.
      return {
        id: r.id,
        serializedDogConfig: r.serializedDogConfig
      };
    });
  }

  public async findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<any>> {
    // Cast the net — haul up all entities of this type from the deep.
    let rows = await this.prisma.dog.findMany({ where: { type } });

    // If no specific IDs are given, retrieve the newest version of everything that lurks.
    if (!ids || ids.length === 0) {
      return this.getLatestVersionsForAll(rows);
    }

    // Strip the version suffix from each id — we seek the base creature, not its latest disguise.
    // To cosmic forms from tangent planes we end as we began: always track the original name.
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
            // If the config is beyond parsing, it has sunk into the void — skip it.
            return null;
          }

          const versionMatch = row.id.match(/-v(\d+)$/);
          const version = config.version || (versionMatch ? parseInt(versionMatch[1], 10) : 0);

          return { id: row.id, serializedDogConfig: row.serializedDogConfig, version };
        })
        .filter((v): v is { id: string; serializedDogConfig: string; version: number } => v !== null)
        .sort((a, b) => b.version - a.version); // Newest first — the past is carrion.

      if (versionsForBaseId.length > 0) {
        const latest = versionsForBaseId[0];
        // Retrieve the full row — we need every field, not just the soul.
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
          // The full row has sunk — use the latest summary as a fallback.
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
   * Sift through all rows and keep only the newest incarnation of each entity.
   * Roiling, moaning: many versions lurk in the deep — only the strongest survives.
   */
  private getLatestVersionsForAll(rows: any[]): Array<{ id: string; serializedDogConfig: string }> {
    const latestVersions = new Map<string, { id: string; serializedDogConfig: string; version: number }>();

    rows.forEach((r: any) => {
      // Parse the config to read the version number — the soul knows its own age.
      let config: any;
      try {
        config = typeof r.serializedDogConfig === 'string'
          ? JSON.parse(r.serializedDogConfig)
          : r.serializedDogConfig;
      } catch (e) {
        console.warn(`[PrismaStore.getLatestVersionsForAll] Fehler beim Parsen der Config für ${r.id}:`, e);
        return;
      }

      // Strip the version from the ID to find the base name — the entity's true face.
      const versionMatch = r.id.match(/-v(\d+)$/);
      const baseId = versionMatch ? this.extractBaseId(r.id) : r.id;

      // Trust the config's version; fall back to the ID suffix if the config is silent.
      const version = config.version || (versionMatch ? parseInt(versionMatch[1], 10) : 0);

      const existing = latestVersions.get(baseId);

      // Only the mightiest version endures — discard the weaker ones into the abyss.
      if (!existing || version > existing.version) {
        latestVersions.set(baseId, { id: r.id, serializedDogConfig: r.serializedDogConfig, version });
      }
    });

    return Array.from(latestVersions.values());
  }

  /**
   * Checks whether an ID carries the version mark — the -v\d+ brand of a seasoned entity.
   */
  private isVersionedId(id: string): boolean {
    return /-v\d+$/.test(id);
  }

  /**
   * Strips the version suffix from an ID and returns the bare base name.
   * e.g. "seed-serialized-1-v2" -> "seed-serialized-1"
   * Its heralds are the stars it fells: the base ID is the star, the version merely its light.
   */
  private extractBaseId(id: string): string {
    const match = id.match(/^(.+)-v(\d+)$/);
    return match ? match[1] : id;
  }

  public async findAllVersions(type: string, baseId: string): Promise<Array<{ id: string; version: number; serializedDogConfig: string }>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });

    // Find all versions that share this base ID — every life the entity has ever lived.
    // Through endless faces, countless forms, a multitude unfolds; sort newest first.
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
        } catch { /* If the config is lost to the void, version stays 0. */ }
        return { id: r.id, version, serializedDogConfig: r.serializedDogConfig };
      })
      .sort((a, b) => b.version - a.version);
  }

  /** Cast the entity overboard — banished to the void, irrecoverable. */
  public async delete(id: string): Promise<void> {
    await this.prisma.dog.delete({ where: { id } });
  }

  /** Sever the connection to the deep — the anchor is raised, the voyage is done. */
  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default PrismaStore;
