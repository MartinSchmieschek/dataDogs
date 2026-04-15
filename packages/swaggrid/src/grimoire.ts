import { isHtmlResultString, isMarkdownResultString } from './stringFormat';
import type { OpenApiGrimoire, Rune, SwaggridCast } from './types';

function inferEssence(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) return {};
    if (Array.isArray(value)) {
        return { type: 'array', items: value.length > 0 ? inferEssence(value[0]) : {} };
    }
    if (typeof value === 'object') {
        const properties: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            properties[k] = inferEssence(v);
        }
        return { type: 'object', properties };
    }
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { type: 'integer', example: value }
            : { type: 'number', example: value };
    }
    if (typeof value === 'boolean') return { type: 'boolean', example: value };
    return { type: 'string', example: value };
}

function hasMeaningfulOffering(body: unknown): boolean {
    if (body == null) return false;
    if (Array.isArray(body)) return body.length > 0;
    if (typeof body === 'object') return Object.keys(body as object).length > 0;
    return true;
}

function findHerald(heraldId: string, strata: Rune[][]): Rune | null {
    if (!heraldId) return null;
    const searchId = heraldId.startsWith('base:') ? heraldId.substring(5) : heraldId;

    for (const stratum of strata) {
        for (const rune of stratum) {
            if (
                rune.id === searchId ||
                rune.id === heraldId ||
                rune.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '')
            ) {
                return rune;
            }
        }
    }
    return null;
}

function buildResponseContent(herald: Rune | null): Record<string, unknown> {
    const r = herald?.essence;
    if (typeof r === 'string' && isHtmlResultString(r)) {
        return {
            'text/html': { schema: { type: 'string', example: '<html>…</html>' } },
        };
    }
    if (typeof r === 'string' && isMarkdownResultString(r)) {
        return {
            'text/markdown': {
                schema: { type: 'string', example: '# Ergebnis\n\n…' },
            },
        };
    }
    return {
        'application/json': { schema: { $ref: '#/components/schemas/Response' } },
    };
}

function buildGlyphsSummary(strata: Rune[][]): string[] {
    const lines: string[] = [];
    strata.forEach((stratum, si) => {
        for (const glyph of stratum) {
            const icon = glyph.sigil || '';
            const type = glyph.bound ? 'SerializedDog' : 'BaseDog';
            lines.push(`- Stratum ${si + 1}: ${icon} **${glyph.name}** (${type})`);
        }
    });
    return lines;
}

function buildQueryParams(whispers?: Record<string, string>): unknown[] {
    if (!whispers) return [];
    return Object.entries(whispers).map(([key, value]) => ({
        name: key,
        in: 'query' as const,
        required: false,
        schema: { type: 'string', default: value },
        description: `Default: "${value}"`,
    }));
}

function safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
}

function safeSchemaName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Wirft eine OpenAPI-3.0.3-Spezifikation aus einem Cast — ein Endpunkt pro Rift,
 * Response-Schema aus der Essenz des Heralds.
 */
export function castGrimoire(input: SwaggridCast): OpenApiGrimoire {
    const { rift, title, scroll, heraldId, whispers, offering, strata } = input;
    const riftTitle = title || rift;
    const herald = findHerald(heraldId, strata);

    const responseSchema =
        herald?.essence != null
            ? inferEssence(herald.essence)
            : { description: 'No result available' };

    const glyphsSummary = buildGlyphsSummary(strata);
    const description = [
        scroll || `API am Rift „${riftTitle}“`,
        '',
        '**Glyphs in den Strata:**',
        ...glyphsSummary,
        '',
        herald ? `**Herald:** ${herald.name} (${herald.id})` : '',
    ].join('\n');

    const queryParams = buildQueryParams(whispers);
    const meaningfulBody = hasMeaningfulOffering(offering);

    const schemas: Record<string, unknown> = {
        Response: {
            ...responseSchema,
            description: `Essenz des Heralds „${herald?.name || '?'}“`,
            ...(herald?.essence != null ? { example: herald.essence } : {}),
        },
    };

    if (meaningfulBody) {
        schemas.RequestBody = {
            ...inferEssence(offering),
            description: 'Request-Body (wird an BodyRetriever weitergegeben)',
            example: offering,
        };
    }

    for (const stratum of strata) {
        for (const glyph of stratum) {
            if (glyph.essence != null && glyph !== herald) {
                const schemaName = safeSchemaName(glyph.name);
                schemas[schemaName] = {
                    ...inferEssence(glyph.essence),
                    description: `Essenz von „${glyph.name}“ (${glyph.id})`,
                    example: glyph.essence,
                };
            }
        }
    }

    const getOp: Record<string, unknown> = {
        summary: riftTitle,
        description: `Ruft den Rift auf und liefert die Essenz des Heralds.`,
        operationId: `get_${safeId(rift)}`,
        parameters: [...queryParams],
        responses: {
            '200': {
                description: `Herald-Essenz (${herald?.name || 'unknown'})`,
                content: buildResponseContent(herald),
            },
            '404': { description: 'Rift nicht gefunden' },
            '500': { description: 'Ausführungsfehler' },
        },
    };

    const postOp: Record<string, unknown> = {
        summary: `${riftTitle} (POST mit Body)`,
        description: `Ruft den Rift mit JSON-Body auf (Default dient als Schema/Beispiel).`,
        operationId: `post_${safeId(rift)}`,
        parameters: [...queryParams],
        requestBody: {
            required: true,
            description: 'Request-Body (BodyRetriever)',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/RequestBody' },
                    example: offering,
                },
            },
        },
        responses: {
            '200': {
                description: `Herald-Essenz (${herald?.name || 'unknown'})`,
                content: buildResponseContent(herald),
            },
            '404': { description: 'Rift nicht gefunden' },
            '500': { description: 'Ausführungsfehler' },
        },
    };

    const pathMethods: Record<string, unknown> = {};
    if (meaningfulBody) {
        pathMethods.post = postOp;
    } else {
        pathMethods.get = getOp;
    }

    return {
        openapi: '3.0.3',
        info: {
            title: `${riftTitle} API`,
            description,
            version: '0.1.0-alpha.1',
        },
        servers: [{ url: '', description: 'Data Hunt Server' }],
        paths: {
            [`/${rift}`]: pathMethods,
        },
        components: { schemas },
    };
}
