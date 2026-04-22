import type { IKennelConfig } from '@datadogs/core';
import type { Rune, SwaggridCast } from '@datadogs/swaggrid';
import type { Waves } from './WavesConverter';
import { findLeadNodeEntry } from './WavesConverter';

/** Mappt Kennel-Laufdaten auf das neutrale Swaggrid-Cast-Format. */
export function toSwaggridCast(config: IKennelConfig, waves: Waves): SwaggridCast {
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
        title: config.name,
        scroll: config.description,
        heraldId,
        whispers: config.defaultQuery,
        offering: config.defaultBody,
        strata,
    };
}
