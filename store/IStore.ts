export interface IStore {
  save(d: any): Promise<void>;
  load(id: string): Promise<any>;
  findByType(type: string): Promise<Array<{ id: string; serializedDogConfig: string }>>;
  /**
   * Findet die neuesten Versionen aller Entities eines Typs
   * Gruppiert nach Basis-ID und gibt nur die neueste Version zurück
   * @param type - Der Entity-Typ (z.B. SerializedDog.name)
   * @param ids - Optional: Array von IDs (kann Basis-IDs oder spezifische Version-IDs sein)
   *              - Wenn eine ID eine Version enthält (z.B. "seed-serialized-1-v2"), wird genau diese Version geladen
   *              - Wenn eine ID keine Version enthält (z.B. "seed-serialized-1"), wird die neueste Version geladen
   * @returns Array von Entities - spezifische Versionen wenn angegeben, sonst neueste Versionen
   */
  findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<{ id: string; serializedDogConfig: string }>>;
  delete(id: string): Promise<void>;
}
