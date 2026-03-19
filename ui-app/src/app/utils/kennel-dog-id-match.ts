/** Versionssuffix von SerializedDog-IDs entfernen */
export function stripDogIdVersion(id: string): string {
  return id.replace(/-v\d+$/, '');
}

/**
 * Graph-Knoten-id (Laufzeit) mit Kennel-dogIds-Eintrag abgleichen
 * (z. B. QueryRetriever ↔ base:QueryRetriever, mydog-v2 ↔ mydog).
 */
export function graphNodeIdMatchesKennelDogId(
  graphNodeId: string,
  kennelDogId: string
): boolean {
  const g = stripDogIdVersion(graphNodeId);
  if (kennelDogId.startsWith('base:')) {
    const baseName = stripDogIdVersion(kennelDogId.slice('base:'.length));
    return g === baseName;
  }
  const k = stripDogIdVersion(kennelDogId);
  return g === k || graphNodeId === kennelDogId;
}

/** Index in dogIds für einen Graph-Knoten (oder emitierten id), sonst -1 */
export function findKennelDogIndex(dogIds: string[], graphOrEmittedId: string): number {
  return dogIds.findIndex(kid =>
    graphNodeIdMatchesKennelDogId(graphOrEmittedId, kid)
  );
}
