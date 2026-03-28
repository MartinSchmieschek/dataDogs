/** API-Datumsformat: { "$date": { "$numberLong": "1773090601400" } } */
interface RawDateField {
    $date: { $numberLong: string };
}

function isRawDateField(value: unknown): value is RawDateField {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    if (typeof obj.$date !== 'object' || obj.$date === null) return false;
    const dateObj = obj.$date as Record<string, unknown>;
    return typeof dateObj.$numberLong === 'string';
}

function rawDateToMs(value: RawDateField): number {
    return parseInt(value.$date.$numberLong, 10);
}

/**
 * Durchläuft ein Objekt rekursiv und ersetzt API-Datumsfelder durch
 * aufbereitete Objekte mit `date` (Date), `timestamp` (number) und `isExpired` (() => boolean).
 */
export function enrichDateFields<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        return data.map((item) => enrichDateFields(item)) as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (isRawDateField(value)) {
            const timestamp = rawDateToMs(value);
            const date = new Date(timestamp);
            result[key] = {
                date,
                timestamp,
                isExpired: () => Date.now() > timestamp,
            };
        } else if (typeof value === 'object' && value !== null) {
            result[key] = enrichDateFields(value);
        } else {
            result[key] = value;
        }
    }
    return result as T;
}
