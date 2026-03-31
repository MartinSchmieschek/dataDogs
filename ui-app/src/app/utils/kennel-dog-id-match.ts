/**
 * Graph-Knoten-id (Laufzeit) mit Kennel-dogIds-Eintrag abgleichen.
 * Matches by exact version ID, dogId (lineage GUID), or base-dog name.
 */
export function graphNodeIdMatchesKennelDogId(
  graphNodeId: string,
  kennelDogId: string,
  graphNodeDogId?: string
): boolean {
  if (kennelDogId.startsWith('base:')) {
    const baseName = kennelDogId.slice('base:'.length);
    return graphNodeId === baseName;
  }
  // Match by exact version ID, or by dogId (lineage GUID)
  return graphNodeId === kennelDogId ||
    (!!graphNodeDogId && graphNodeDogId === kennelDogId);
}

/** Index in dogIds für einen Graph-Knoten (oder emitierten id), sonst -1 */
export function findKennelDogIndex(
  dogIds: string[],
  graphOrEmittedId: string,
  graphNodeDogId?: string
): number {
  return dogIds.findIndex(kid =>
    graphNodeIdMatchesKennelDogId(graphOrEmittedId, kid, graphNodeDogId)
  );
}
