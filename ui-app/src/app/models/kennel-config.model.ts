export interface IKennelConfig {
  id: string;
  name?: string;
  description?: string;
  dogIds: string[];
  defaultQuery?: Record<string, string>;
  defaultBody?: any;
  createdAt?: string;
  updatedAt?: string;
}
