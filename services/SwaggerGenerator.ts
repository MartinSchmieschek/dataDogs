import { IKennelConfig } from '@datadogs/core';
import { Waves, NodeEntry } from './WavesConverter';

/**
 * Arr, this be the sacred chart of the OpenAPI spec — a cartographic pact
 * drawn from brooding gulfs where corporeal laws unwritten govern the shape
 * of every endpoint the crew dares expose to the abyss beyond.
 */
export interface OpenApiSpec {
    /** The OpenAPI version string, a rune etched upon the hull of this eldritch vessel. */
    openapi: string;
    /** Metadata plundered from the void — title, description, and version of the API. */
    info: { title: string; description: string; version: string };
    /** The harbors from which this cursed API be served, each a portal into the deep. */
    servers: Array<{ url: string; description: string }>;
    /** The sea routes — each path a corridor through endless faces countless forms. */
    paths: Record<string, any>;
    /** The components hold schemas like carrion hordes hold their dead — tightly and without mercy. */
    components: { schemas: Record<string, any> };
}

/**
 * Generiert eine OpenAPI 3.0 Spec fuer einen Kennel
 * anhand eines echten Kennel-Runs (Waves) — wie die UI ihn ausfuehrt.
 *
 * Pro Kennel wird genau EIN Endpunkt dokumentiert: GET/POST /:kennelId
 * Das Response-Schema wird aus dem tatsaechlichen Lead-Dog-Result abgeleitet.
 */
export class SwaggerGenerator {

    /**
     * Arr, plunder the kennel config and its waves to forge an OpenAPI spec
     * from brooding gulfs of runtime data — through endless faces countless forms
     * the lead dog's result be divined and documented for all who dare invoke the void.
     * @param config - The kennel configuration, a cursed manifest from the deep.
     * @param waves - The waves of dog execution, each a tide of eldritch computation.
     * @returns An OpenAPI 3.0 spec conjured from the abyss of the kennel's actual run.
     */
    static generate(
        config: IKennelConfig,
        waves: Waves,
    ): OpenApiSpec {
        const kennelName = config.name || config.id;
        const leadDog = this.findLeadDog(config, waves);

        // Response-Schema aus echtem Result ableiten
        const responseSchema = leadDog?.result != null
            ? this.inferSchema(leadDog.result)
            : { description: 'No result available' };

        // Dogs-Uebersicht fuer die Beschreibung
        const dogsSummary = this.buildDogsSummary(waves);
        const description = [
            config.description || `API fuer Kennel "${kennelName}"`,
            '',
            '**Dogs in diesem Kennel:**',
            ...dogsSummary,
            '',
            leadDog ? `**Lead Dog:** ${leadDog.name} (${leadDog.id})` : '',
        ].join('\n');

        const queryParams = this.buildQueryParams(config.defaultQuery);
        const hasBody = config.defaultBody != null;

        const schemas: Record<string, any> = {
            Response: {
                ...responseSchema,
                description: `Result von Lead Dog "${leadDog?.name || '?'}"`,
                ...(leadDog?.result != null ? { example: leadDog.result } : {}),
            },
        };

        if (hasBody) {
            schemas.RequestBody = {
                ...this.inferSchema(config.defaultBody),
                description: 'Request-Body (wird an BodyRetriever Dogs weitergegeben)',
                example: config.defaultBody,
            };
        }

        // Schemas fuer alle Dog-Results im Kennel
        for (const wave of waves) {
            for (const dog of wave) {
                if (dog.result != null && dog !== leadDog) {
                    const schemaName = this.safeSchemaName(dog.name);
                    schemas[schemaName] = {
                        ...this.inferSchema(dog.result),
                        description: `Result von "${dog.name}" (${dog.id})`,
                        example: dog.result,
                    };
                }
            }
        }

        const getOp: any = {
            summary: kennelName,
            description: `Fuehrt den Kennel aus und gibt das Ergebnis des Lead Dogs zurueck.`,
            operationId: `get_${this.safeId(config.id)}`,
            parameters: [...queryParams],
            responses: {
                '200': {
                    description: `Lead Dog Result (${leadDog?.name || 'unknown'})`,
                    content: this.buildResponseContent(leadDog),
                },
                '404': { description: 'Kennel nicht gefunden' },
                '500': { description: 'Ausfuehrungsfehler' },
            },
        };

        const postOp: any = {
            ...getOp,
            summary: `${kennelName} (mit Body)`,
            operationId: `post_${this.safeId(config.id)}`,
            ...(hasBody ? {
                requestBody: {
                    required: false,
                    description: 'Request-Body Daten',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RequestBody' },
                            example: config.defaultBody,
                        },
                    },
                },
            } : {}),
        };

        return {
            openapi: '3.0.3',
            info: {
                title: `${kennelName} API`,
                description,
                version: '0.1.0-alpha.1',
            },
            servers: [{ url: '', description: 'Data Hunt Server' }],
            paths: {
                [`/${config.id}`]: {
                    get: getOp,
                    post: postOp,
                },
            },
            components: { schemas },
        };
    }

    /** Findet den Lead Dog (erster Eintrag in dogIds) in den Waves */
    private static findLeadDog(config: IKennelConfig, waves: Waves): NodeEntry | null {
        const leadId = config.dogIds?.[0];
        if (!leadId) return null;
        const searchId = leadId.startsWith('base:') ? leadId.substring(5) : leadId;

        for (const wave of waves) {
            for (const node of wave) {
                if (node.id === searchId ||
                    node.id === leadId ||
                    node.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '')) {
                    return node;
                }
            }
        }
        return null;
    }

    /**
     * Shapes the response content map, divining whether the lead dog's plunder
     * be HTML or JSON — for the void speaks in many tongues, and the crew must
     * discern the eldritch format lest the carrion hordes consume the response.
     * @param leadDog - The lead dog entry, or null if the abyss yielded nothing.
     * @returns A content-type map suitable for the OpenAPI response object.
     */
    private static buildResponseContent(leadDog: NodeEntry | null): Record<string, any> {
        const isHtml = typeof leadDog?.result === 'string' && (
            leadDog.result.trim().startsWith('<html') ||
            leadDog.result.trim().startsWith('<!DOCTYPE') ||
            (leadDog.result.trim().startsWith('<') && leadDog.result.includes('</'))
        );

        if (isHtml) {
            return {
                'text/html': { schema: { type: 'string', example: '&lt;html&gt;...&lt;/html&gt;' } },
            };
        }
        return {
            'application/json': { schema: { $ref: '#/components/schemas/Response' } },
        };
    }

    /**
     * Compiles a summary of all dogs across the waves — a roll call of the crew,
     * listing each hound by wave, icon, name, and type, as one would catalog
     * the carrion hordes marching through endless faces countless forms.
     * @param waves - The waves of executed dogs from the kennel run.
     * @returns An array of markdown-formatted summary lines for each dog.
     */
    private static buildDogsSummary(waves: Waves): string[] {
        const lines: string[] = [];
        waves.forEach((wave, wi) => {
            for (const dog of wave) {
                const icon = dog.icon || '';
                const type = dog.codeTs ? 'SerializedDog' : 'BaseDog';
                lines.push(`- Wave ${wi + 1}: ${icon} **${dog.name}** (${type})`);
            }
        });
        return lines;
    }

    /**
     * Arr, extract the query parameters from the default query map — each key-value
     * pair be a whispered secret from the void, forged into OpenAPI parameter objects
     * so that those who plunder the API know what incantations to pass.
     * @param defaultQuery - The default query parameters, if any lurk in the deep.
     * @returns An array of OpenAPI parameter objects for the GET endpoint.
     */
    private static buildQueryParams(defaultQuery?: Record<string, string>): any[] {
        if (!defaultQuery) return [];
        return Object.entries(defaultQuery).map(([key, value]) => ({
            name: key,
            in: 'query' as const,
            required: false,
            schema: { type: 'string', default: value },
            description: `Default: "${value}"`,
        }));
    }

    /** Leitet ein JSON-Schema aus einem konkreten Wert ab */
    static inferSchema(value: any): any {
        if (value === null || value === undefined) return {};
        if (Array.isArray(value)) {
            return { type: 'array', items: value.length > 0 ? this.inferSchema(value[0]) : {} };
        }
        if (typeof value === 'object') {
            const properties: Record<string, any> = {};
            for (const [k, v] of Object.entries(value)) {
                properties[k] = this.inferSchema(v);
            }
            return { type: 'object', properties };
        }
        if (typeof value === 'number') {
            return Number.isInteger(value) ? { type: 'integer', example: value } : { type: 'number', example: value };
        }
        if (typeof value === 'boolean') return { type: 'boolean', example: value };
        return { type: 'string', example: value };
    }

    /**
     * Sanitizes an ID into a form safe for the void's consumption — stripping away
     * all characters that corporeal laws unwritten deem unworthy of an operationId.
     * @param id - The raw kennel ID, possibly tainted by eldritch symbols.
     * @returns A sanitized string containing only alphanumeric characters and underscores.
     */
    private static safeId(id: string): string {
        return id.replace(/[^a-zA-Z0-9]/g, '_');
    }

    /**
     * Cleanses a dog's name so it may serve as a schema key in the OpenAPI components —
     * for the abyss rejects names bearing forbidden glyphs, and only the purified
     * may enter the schema registry without summoning the carrion hordes.
     * @param name - The raw dog name, fresh from the deep.
     * @returns A sanitized schema name safe for OpenAPI components.
     */
    private static safeSchemaName(name: string): string {
        return name.replace(/[^a-zA-Z0-9_]/g, '_');
    }
}
