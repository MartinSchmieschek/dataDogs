/**
 * Laeufe, Wiederverwendung und "Bewaehrt" eines Dogs (P4b) — traegt jeder Eintrag von GET /api/nodes
 * und GET /api/nodes/:id. Fehlt bei aelteren Serverstaenden.
 */
export interface IDogStats {
  calls: {
    total: number;
    last30d: number;
    /** Nur echte Nutzung (public, execute) — die Zahl, nach der gerankt wird. */
    ranked30d: number;
    failures30d: number;
    cached30d: number;
    avgDurationMs: number | null;
    maxDurationMs: number;
    kennelsRun30d: number;
  };
  reuse: {
    kennelsDirect: number;
    kennelsTransitive: number;
    kennelsForeign: number;
    owners: number;
    dependents: number;
  };
  proven: { score: number; badge: boolean; reliability: number };
}

/** GET /api/nodes/:id/usage — wo der Dog laeuft; Kennels nur, die der Aufrufer ausfuehren darf. */
export interface IDogUsage {
  ok: boolean;
  dogKey: string;
  kennels: Array<{
    lineageId: string;
    name: string | null;
    visibility: string;
    ownerId: string | null;
    via: 'crew' | 'transitive';
    count30d: number;
    failures30d: number;
    /** `/k/<lineageId>` — ein Verweis, kein Teilen-Link. */
    url: string;
  }>;
  hiddenKennels: number;
  dependents: Array<{ lineageId: string; displayName: string | null; kind: 'required' | 'optional' }>;
  dependencies: { required: string[]; optional: string[] };
  byOwner: Array<{ ownerId: string | null; kennels: number }>;
}

export interface BaseDogInfo {
  id: string;
  name: string;
  type: 'BaseDog';
  icon?: string;
  description?: string;
  stats?: IDogStats;
}

export interface SerializedDogInfo {
  id: string;
  lineageId?: string;
  parentId?: string | null;
  displayName?: string;
  /** Freitext-Beschreibung des Dogs (seit list_nodes/get_node — Commit 592442c). */
  description?: string;
  type?: string;
  /**
   * Name, unter dem dieser Dog als Elternteil im VM-Kontext gebunden wird
   * (z. B. `mdReportData` -> `Mdreportdata`). Kommt vom Server; nie selbst ableiten.
   * Fehlt bei aelteren Serverstaenden und bei BaseDogs.
   */
  contextName?: string;
  theRun: string;
  version?: number;
  icon?: string;
  parentsRequired?: string[];
  parentsOptional?: string[];
  stats?: IDogStats;
}

export type DogInfo = BaseDogInfo | SerializedDogInfo;

export function isBaseDog(dog: DogInfo): dog is BaseDogInfo {
  return (dog as BaseDogInfo).type === 'BaseDog';
}
