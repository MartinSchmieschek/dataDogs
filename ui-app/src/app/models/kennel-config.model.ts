export interface IKennelConfig {
  id: string;
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
