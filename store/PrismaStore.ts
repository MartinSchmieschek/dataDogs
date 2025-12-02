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
    // 1) { serilizedDogConfig: {...}, id?:..., type?:... }
    // 2) raw config object (the config itself)
    let cfg: any;
    if (d && d.serilizedDogConfig !== undefined) {
      // accept either string or object; normalize to object for manipulation
      cfg = typeof d.serilizedDogConfig === 'string' ? JSON.parse(d.serilizedDogConfig) : d.serilizedDogConfig;
    } else {
      cfg = typeof d === 'string' ? JSON.parse(d) : d;
    }

    // Persist as string because SQLite schema uses String for serilizedDogConfig
    const dbValue = typeof cfg === 'string' ? cfg : JSON.stringify(cfg);

    await this.prisma.dog.upsert({
      where: { id },
      create: { id, type, serilizedDogConfig: dbValue },
      update: { type, serilizedDogConfig: dbValue }
    });
  }

  public async load(id: string): Promise<any> {
    const row = await this.prisma.dog.findUnique({ where: { id } });
    return row ? row.serilizedDogConfig : null;
  }

  public async findByType(type: string): Promise<Array<{ id: string; serilizedDogConfig: string }>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });
    // stored value is a string (JSON text). Return as-is.
    return rows.map((r: any) => ({ id: r.id, serilizedDogConfig: r.serilizedDogConfig }));
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default PrismaStore;
