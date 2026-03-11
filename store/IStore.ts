export interface IStore {
  save(d: any): Promise<void>;
  load(id: string): Promise<any>;
  findByType(type: string): Promise<Array<{ id: string; serializedDogConfig: string }>>;
  /**
   * Findet die neuesten Versionen aller Entities eines Typs.
   * Extrahiert immer die Basis-ID und gibt die neueste Version zurück.
   * @param type - Der Entity-Typ (z.B. SerializedDog.name)
   * @param ids - Optional: Array von IDs (Basis-IDs oder versionierte IDs).
   *              Die Basis-ID wird extrahiert und die neueste Version geladen.
   */
  findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<{ id: string; serializedDogConfig: string }>>;

  /**
   * Gibt alle Versionen einer Entity zurück, sortiert nach Version (neueste zuerst).
   * @param type - Der Entity-Typ
   * @param baseId - Basis-ID (ohne Versionssuffix)
   */
  findAllVersions(type: string, baseId: string): Promise<Array<{ id: string; version: number; serializedDogConfig: string }>>;

  delete(id: string): Promise<void>;
}
