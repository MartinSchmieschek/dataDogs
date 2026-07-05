// The PrismaStore — our ship's hold, where all plundered data is locked away in the eldritch deep.
// Carrion hordes trill their profane accord with eldritch plans:
// this class is the sole keeper of persistence, and it answers to no one but Prisma.
// Now the lineage branches like cursed coral — lineageId binds incarnations, parentId traces ancestry.
import { PrismaClient, Prisma } from '@prisma/client';
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
    try {
      await this.prisma.dog.findFirst({ take: 1 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
        const nodeEnv = (process.env.NODE_ENV || '').trim();
        const syncHint =
          nodeEnv === 'integration'
            ? 'npm run prisma:sync:integration'
            : nodeEnv === 'production'
              ? 'npm run prisma:sync:prod'
              : 'npm run prisma:sync';
        throw new Error(
          `[PrismaStore] Datenbank-Schema fehlt (Tabelle Dog nicht gefunden). ` +
            `Zuerst ${syncHint} ausfuehren, um Tabellen anzulegen. ` +
            `Bei gehosteter Postgres: DB-User braucht Rechte fuer CREATE/Schema. ` +
            `(${e.message})`,
        );
      }
      throw e;
    }
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

    // The spirit's lineage marks — lineageId, parentId, displayName sail as direct columns.
    if (d.lineageId !== undefined) updateData.lineageId = d.lineageId;
    if (d.parentId !== undefined) updateData.parentId = d.parentId;
    if (d.displayName !== undefined) updateData.displayName = d.displayName;

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
    if (d.task !== undefined) updateData.task = d.task;
    if (d.nodes !== undefined) {
      updateData.nodes = typeof d.nodes === 'string'
        ? d.nodes
        : JSON.stringify(d.nodes);
    }
    if (d.edges !== undefined) {
      updateData.edges = typeof d.edges === 'string'
        ? d.edges
        : JSON.stringify(d.edges);
    }
    if (d.visibility !== undefined) updateData.visibility = d.visibility;
    if (d.ownerId !== undefined) updateData.ownerId = d.ownerId;
    if (d.editors !== undefined) {
      updateData.editors = Array.isArray(d.editors)
        ? (d.editors.length ? d.editors.join(',') : null)
        : d.editors;
    }
    if (d.viewers !== undefined) {
      updateData.viewers = Array.isArray(d.viewers)
        ? (d.viewers.length ? d.viewers.join(',') : null)
        : d.viewers;
    }
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
    if (row.name !== null || row.description !== null || row.dogIds !== null || row.emoji !== null
        || row.task !== null || row.nodes !== null || row.edges !== null) {
      return {
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        dogIds: row.dogIds, // Still a JSON-string — parseEntity() shall untangle it.
        defaultQuery: row.defaultQuery,
        defaultBody: row.defaultBody,
        emoji: row.emoji,
        task: row.task,
        nodes: row.nodes,
        edges: row.edges,
        visibility: row.visibility,
        ownerId: row.ownerId,
        editors: row.editors,
        viewers: row.viewers,
        lineageId: row.lineageId,
        parentId: row.parentId,
        displayName: row.displayName,
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
      if (r.name !== null || r.description !== null || r.dogIds !== null || r.emoji !== null
          || r.task !== null || r.nodes !== null || r.edges !== null) {
        return {
          id: r.id,
          type: r.type,
          name: r.name,
          description: r.description,
          dogIds: r.dogIds,
          defaultQuery: r.defaultQuery,
          defaultBody: r.defaultBody,
          emoji: r.emoji,
          task: r.task,
          nodes: r.nodes,
          edges: r.edges,
          visibility: r.visibility,
          ownerId: r.ownerId,
          editors: r.editors,
          viewers: r.viewers,
          lineageId: r.lineageId,
          parentId: r.parentId,
          displayName: r.displayName,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          serializedDogConfig: r.serializedDogConfig
        };
      }
      // SerializedDog returns its id, lineage marks, and its soul.
      return {
        id: r.id,
        lineageId: r.lineageId,
        parentId: r.parentId,
        displayName: r.displayName,
        createdAt: r.createdAt,
        serializedDogConfig: r.serializedDogConfig
      };
    });
  }

  /**
   * From the many incarnations that drift through branching time, retrieve only the newest.
   * If IDs be given, each is resolved: first as a version ID (exact incarnation),
   * then as a lineageId (latest incarnation of that lineage by createdAt).
   * If no IDs be given, the latest incarnation of every lineage surfaces.
   */
  public async findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<any>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });

    // No specific IDs — surface the newest incarnation of every lineage.
    if (!ids || ids.length === 0) {
      return this.getLatestVersionsForAll(rows);
    }

    const result: Array<any> = [];

    for (const requestedId of ids) {
      // First: try exact match by version ID — the spirit's unique incarnation.
      const exactMatch = rows.find((r: any) => r.id === requestedId);
      if (exactMatch) {
        result.push(this.formatRow(exactMatch));
        continue;
      }

      // Second: treat as lineageId — summon the latest incarnation of that lineage.
      const lineageRows = rows
        .filter((r: any) => r.lineageId === requestedId)
        .sort((a: any, b: any) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime; // Newest first — the past is carrion.
        });

      if (lineageRows.length > 0) {
        result.push(this.formatRow(lineageRows[0]));
        continue;
      }

      // Third: treat as displayName — fer auto-mimics and other spirits known by name, not GUID.
      const nameRows = rows
        .filter((r: any) => r.displayName === requestedId)
        .sort((a: any, b: any) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      if (nameRows.length > 0) {
        result.push(this.formatRow(nameRows[0]));
      }
    }

    return result;
  }

  /**
   * Sift through all rows and keep only the newest incarnation of each lineage.
   * Roiling, moaning: many incarnations lurk in the deep — only the strongest survives.
   * Groups by lineageId; fer rows without lineageId, each stands alone.
   */
  private getLatestVersionsForAll(rows: any[]): Array<{ id: string; serializedDogConfig: string }> {
    const latestByLineageId = new Map<string, any>();

    rows.forEach((r: any) => {
      // Resolve lineageId: DB column first, then fall back to parsing the serialized config.
      let lineageId = r.lineageId;
      if (!lineageId && r.serializedDogConfig) {
        try {
          const cfg = typeof r.serializedDogConfig === 'string'
            ? JSON.parse(r.serializedDogConfig) : r.serializedDogConfig;
          lineageId = cfg.lineageId;
        } catch { /* void swallowed the config */ }
      }
      const groupKey = lineageId || r.id;
      const existing = latestByLineageId.get(groupKey);
      const rTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;

      if (!existing) {
        latestByLineageId.set(groupKey, r);
      } else {
        const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
        if (rTime > existingTime) {
          latestByLineageId.set(groupKey, r);
        }
      }
    });

    return Array.from(latestByLineageId.values()).map((r: any) => this.formatRow(r));
  }

  /**
   * Format a row fer the surface world — strip the barnacles and expose the cargo.
   */
  private formatRow(r: any): any {
    return {
      id: r.id,
      type: r.type,
      lineageId: r.lineageId ?? null,
      parentId: r.parentId ?? null,
      displayName: r.displayName ?? null,
      name: r.name ?? null,
      description: r.description ?? null,
      dogIds: r.dogIds ?? null,
      defaultQuery: r.defaultQuery ?? null,
      defaultBody: r.defaultBody ?? null,
      emoji: r.emoji ?? null,
      task: r.task ?? null,
      nodes: r.nodes ?? null,
      edges: r.edges ?? null,
      visibility: r.visibility ?? null,
      ownerId: r.ownerId ?? null,
      editors: r.editors ?? null,
      viewers: r.viewers ?? null,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
      serializedDogConfig: r.serializedDogConfig
    };
  }

  /**
   * Summon all incarnations of a spirit — every branch, every form, newest first by createdAt.
   * The lineageId binds them all, across branches and time.
   */
  public async findAllVersions(
    type: string,
    lineageId: string
  ): Promise<Array<{ id: string; version: number; serializedDogConfig: string; parentId?: string | null; createdAt?: Date }>> {
    // lineageId is unique across types — no type filter needed, so MimicDog versions are found too.
    const rows = await this.prisma.dog.findMany({ where: { lineageId } });

    // Sort by createdAt — newest incarnation first, the past sinks into the deep.
    return rows
      .map((r: any) => {
        let version = 0;
        try {
          const config = typeof r.serializedDogConfig === 'string'
            ? JSON.parse(r.serializedDogConfig)
            : r.serializedDogConfig;
          version = config.version || 0;
        } catch { /* If the config is lost to the void, version stays 0. */ }
        return {
          id: r.id,
          version,
          serializedDogConfig: r.serializedDogConfig,
          parentId: r.parentId ?? null,
          createdAt: r.createdAt ?? null,
          displayName: r.displayName ?? null,
          lineageId: r.lineageId ?? null,
          // Kennel-specific fields (null for SerializedDogs, populated for KennelConfigs)
          name: r.name ?? null,
          description: r.description ?? null,
          dogIds: r.dogIds ?? null,
          defaultQuery: r.defaultQuery ?? null,
          defaultBody: r.defaultBody ?? null,
          emoji: r.emoji ?? null,
          task: r.task ?? null,
          nodes: r.nodes ?? null,
          edges: r.edges ?? null,
          visibility: r.visibility ?? null,
          ownerId: r.ownerId ?? null,
          editors: r.editors ?? null,
          viewers: r.viewers ?? null,
          updatedAt: r.updatedAt ?? null,
        };
      })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  /**
   * Summon all incarnations that share a lineage — every branch, every form.
   * Arr, the lineageId be the thread that binds them across time and branches.
   */
  public async findByLineageId(
    lineageId: string
  ): Promise<Array<{ id: string; serializedDogConfig: string; parentId?: string | null; createdAt?: Date }>> {
    const rows = await this.prisma.dog.findMany({ where: { lineageId } });

    return rows
      .map((r: any) => ({
        id: r.id,
        serializedDogConfig: r.serializedDogConfig,
        parentId: r.parentId ?? null,
        createdAt: r.createdAt ?? null,
        displayName: r.displayName ?? null,
        lineageId: r.lineageId ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
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
