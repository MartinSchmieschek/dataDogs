import { publicKennelPath, type IKennelConfig } from '@slopdogs/core';
import type { Rune, SwaggridCast } from '@slopdogs/swaggrid';
import type { Waves } from './WavesConverter';
import { findLeadNodeEntry } from './WavesConverter';

/**
 * Mappt Kennel-Laufdaten auf das neutrale Swaggrid-Cast-Format.
 * `includeDefaults: false` laesst defaultQuery/defaultBody weg (leere Beispiele) —
 * die Defaults sind Konfiguration und gehen nur an Aufrufer mit Leserecht.
 */
export function toSwaggridCast(
    config: IKennelConfig,
    waves: Waves,
    options: { includeDefaults: boolean } = { includeDefaults: true },
): SwaggridCast {
    const lead = findLeadNodeEntry(waves, config);
    const heraldId = lead?.id ?? (config.dogIds?.[0] ?? '');
    const strata: Rune[][] = waves.map((wave) =>
        wave.map((n) => ({
            id: n.id,
            lineageId: n.lineageId,
            name: n.name,
            essence: n.result,
            sigil: n.icon,
            bound: Boolean(n.codeTs),
        })),
    );
    return {
        rift: config.id,
        publicPath: publicKennelPath((config as { lineageId?: string }).lineageId ?? config.id),
        title: config.name,
        scroll: config.description,
        heraldId,
        whispers: options.includeDefaults ? config.defaultQuery : undefined,
        offering: options.includeDefaults ? config.defaultBody : undefined,
        strata,
    };
}
