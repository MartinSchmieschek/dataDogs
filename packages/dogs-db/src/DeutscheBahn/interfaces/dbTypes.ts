/**
 * =========================================================================
 *  DEUTSCHE BAHN TYPES — forms dredged from the iron abyss
 * =========================================================================
 */

/** Eine Haltestelle / Station in der Naehe */
export interface DbStation {
    /** ID der Haltestelle (HAFAS/EVA-Nummer) */
    id: string;
    /** Name der Haltestelle */
    name: string;
    /** Entfernung in Metern vom Suchpunkt */
    distance: number;
    /** Breitengrad */
    latitude: number;
    /** Laengengrad */
    longitude: number;
}

/** Eine einzelne Abfahrt von einer Haltestelle */
export interface DbDeparture {
    /** Zugnummer / Linienname (z.B. "RE 1", "S3", "ICE 579") */
    line: string;
    /** Richtung / Zielort */
    direction: string;
    /** Geplante Abfahrtszeit (ISO string) */
    plannedWhen: string | null;
    /** Tatsaechliche Abfahrtszeit mit Verspaetung (ISO string) */
    when: string | null;
    /** Verspaetung in Sekunden */
    delay: number | null;
    /** Gleis / Plattform */
    platform: string | null;
}

/** Ergebnis fuer eine Haltestelle mit ihren Abfahrten */
export interface DbStationDepartures {
    /** Die Haltestelle selbst */
    station: DbStation;
    /** Naechste Abfahrten von dieser Haltestelle */
    departures: DbDeparture[];
}

/** Gesamtergebnis des DB Nearby Retrievers */
export interface DbNearbyResult {
    /** Liste nahegelegener Haltestellen mit Abfahrten */
    stations: DbStationDepartures[];
    /** Anzahl gefundener Stationen */
    stationCount: number;
    /** Suchkoordinaten */
    searchLocation: { lat: number; lng: number };
}
