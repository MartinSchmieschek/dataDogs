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
  createdAt?: string;
  updatedAt?: string;
}

export interface KennelVersionEntry {
  id: string;
  version: number;
  parentId?: string | null;
  createdAt?: string;
  config: IKennelConfig;
}
