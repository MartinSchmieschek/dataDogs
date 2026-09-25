export interface IKennelConfig {
  id: string;
  /** The stable kennel identifier — stays the same across all versions */
  lineageId?: string;
  /** The ancestor version from which this version was born */
  parentId?: string | null;
  name?: string;
  description?: string;
  /** Ein Emoji (optional), in der DB mitgespeichert */
  emoji?: string;
  dogIds: string[];
  defaultQuery?: Record<string, string>;
  defaultBody?: any;
  /** Global mission briefing -- what the kennel is supposed to do */
  task?: string;
  /** Per-node layout + comment for the wave-view canvas */
  nodes?: IKennelNodeAnnotation[];
  /** Per-edge comment, keyed by (fromId, toId) */
  edges?: IKennelEdgeAnnotation[];
  /** ACL — public lets anyone read+run, private restricts to owner/editors/viewers. */
  visibility?: 'public' | 'private' | null;
  /** User.id of the creator. null = community-owned (legacy / system). */
  ownerId?: string | null;
  /** Comma-separated User.id list — additional users who may mutate. */
  editors?: string | null;
  /** Comma-separated User.id list — additional users who may read on private entities. */
  viewers?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Aufrufe und Sterne (P4) — fehlt bei einem Server vor P4. */
  stats?: IKennelStats;
}

/**
 * Aufrufe und Sterne eines Kennels (P4). Sichtbare Zahl ist `calls.ranked30d` (W3); `ranked*` zaehlt
 * nur echte Nutzung (/k/:id, execute). `rating.avg` ist null ohne Bewertung, `score` der Bayes-Rang.
 */
export interface IKennelStats {
  calls: { total: number; last30d: number; leadFailed: number; ranked: number; ranked30d: number };
  rating: { avg: number | null; count: number; score: number };
}

export interface IKennelNodeAnnotation {
  /** Kennel-dogIds entry (lineageId for SerializedDogs, "base:Name" for base-dogs) */
  id: string;
  x?: number;
  y?: number;
  comment?: string;
}

export interface IKennelEdgeAnnotation {
  fromId: string;
  toId: string;
  comment?: string;
}

export interface KennelVersionEntry {
  id: string;
  version: number;
  parentId?: string | null;
  createdAt?: string;
  config: IKennelConfig;
}
