/**
 * The eldritch contract of the Store — a pact sealed between our ship and the deep.
 * All who dare persist data in this realm must honour these rites.
 * Corporeal laws are unwritten as suns and love retreat;
 * yet these methods hold the line between order and the void.
 */
export interface IStore {
  /** Cast the plunder into the abyss — create or overwrite, for the store shows no mercy. */
  save(d: any): Promise<void>;

  /** Dredge a single entity from the deep by its name. Returns null if the void swallowed it. */
  load(id: string): Promise<any>;

  /** Haul up all entities of a given type — a net cast wide into brooding waters. */
  findByType(type: string): Promise<Array<{ id: string; serializedDogConfig: string }>>;

  /**
   * From the many versions that drift through time, retrieve only the newest —
   * for the past is carrion, and we hunt only what still breathes.
   * Always extracts the base-ID and returns the latest version.
   * @param type - The entity type (e.g. SerializedDog.name)
   * @param ids - Optional crew list of IDs; base-IDs are extracted, newest versions fetched.
   */
  findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<{ id: string; serializedDogConfig: string }>>;

  /**
   * Summon all versions of an entity — every form it has ever worn, newest first.
   * To cosmic forms from tangent planes we end as we began: all versions preserved in the deep.
   * @param type - The entity type
   * @param baseId - The base-ID without the version suffix
   */
  findAllVersions(type: string, baseId: string): Promise<Array<{ id: string; version: number; serializedDogConfig: string }>>;

  /** Cast the entity overboard — gone into the void, never to be seen again. */
  delete(id: string): Promise<void>;
}
