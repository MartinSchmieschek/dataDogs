/**
 * =========================================================================
 *  DB API CLIENT — summoning iron serpents from the eldritch network
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of v6.db.transport.rest,
 *  a public HAFAS gateway to the Deutsche Bahn's cursed rail network.
 *  Through its endpoints we summon nearby stations and their departures
 *  from the brooding gulfs of the Fahrplan-void.
 *
 *  No API key required — the void grants passage freely, matey.
 * =========================================================================
 */

import type { DbStation, DbDeparture } from "./interfaces/dbTypes";

const DB_API_BASE = "https://v6.db.transport.rest";

/**
 * Fetch nearby stops/stations from the DB HAFAS API.
 * Arr, the hound sniffs the coordinates and the void returns what lurks nearby.
 */
export async function fetchNearbyStations(
    lat: number,
    lng: number,
    distance: number = 1000,
    results: number = 8
): Promise<DbStation[]> {
    const url = `${DB_API_BASE}/stops/nearby?latitude=${lat}&longitude=${lng}&distance=${distance}&results=${results}`;

    const response = await fetch(url, {
        headers: { "Accept": "application/json", "User-Agent": "dataDogs/0.1" }
    });

    if (!response.ok) {
        throw new Error(`DB API /stops/nearby failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any[];

    return data.map((stop: any) => ({
        id: stop.id,
        name: stop.name,
        distance: stop.distance ?? 0,
        latitude: stop.location?.latitude ?? lat,
        longitude: stop.location?.longitude ?? lng,
    }));
}

/**
 * Fetch departures for a given station ID.
 * Each departure reveals a direction (Zielort) — the destination whispered by the void.
 */
export async function fetchDepartures(
    stationId: string,
    durationMinutes: number = 30
): Promise<DbDeparture[]> {
    const url = `${DB_API_BASE}/stops/${encodeURIComponent(stationId)}/departures?duration=${durationMinutes}`;

    const response = await fetch(url, {
        headers: { "Accept": "application/json", "User-Agent": "dataDogs/0.1" }
    });

    if (!response.ok) {
        throw new Error(`DB API /departures failed for ${stationId}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const departures: any[] = Array.isArray(data) ? data : (data.departures ?? []);

    return departures.map((dep: any) => ({
        line: dep.line?.name ?? dep.line?.fahrtNr ?? "unknown",
        direction: dep.direction ?? dep.destination?.name ?? "unknown",
        plannedWhen: dep.plannedWhen ?? null,
        when: dep.when ?? null,
        delay: dep.delay ?? null,
        platform: dep.platform ?? null,
    }));
}
