/**
 * =========================================================================
 *  DEUTSCHE BAHN PACTS — eldritch accords with the iron serpents
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hounds to the
 *  Deutsche Bahn's iron network. Through endless rails, countless
 *  stations, a multitude unfolds — from brooding platforms
 *  are we beheld, by that which bears no name.
 *
 *  The GPS coordinates anchor us to the mortal plane,
 *  while the trains thunder through the void above and below.
 * =========================================================================
 */

import { createPact } from "@datadogs/core";

/** GPS-Koordinaten fuer die Suche nach nahegelegenen Haltestellen */
export interface DbNearbyQuery {
    /** Breitengrad — the latitude where the hound sniffs for stations in the void */
    lat: string;
    /** Laengengrad — the longitude from which iron serpents are summoned */
    lng: string;
    /** Suchradius in Metern (default: 1000) — how far the hound dares venture from the anchor */
    distance?: string;
    /** Max. Anzahl Ergebnisse (default: 8) — how many stations the void shall reveal */
    results?: string;
}

/** Arr, the GPS query pact — an anchor binding the hound to its earthly coordinates */
export const DbNearbyQueryPact = createPact<DbNearbyQuery>(
    "DbNearbyQueryProvider",
    { fromSourceType: "DbNearbyQuery" }
);
