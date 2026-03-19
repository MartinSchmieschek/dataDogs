import { CompilerCache } from './CompilerCache';
import { MimicDog } from 'datadogs';

export class TypeDefBuilder {

    private static pactReturnTypes: Map<string, string> = new Map();

    /**
     * Registriert den erwarteten Return-Type fuer einen Pact-Namen.
     * Wird von aussen aufgerufen, z.B. beim Startup.
     */
    public static registerPactReturnType(pactName: string, typeDefinition: string): void {
        this.pactReturnTypes.set(pactName, typeDefinition);
    }

    /**
     * Registriert alle Pact-Klassen: liest name und __pactReturnTypeDef von jeder Klasse
     * und uebernimmt die Typ-Definition aus dem Pact (Single Source of Truth im Interface).
     */
    public static registerPacts(pactClasses: (new () => { name: string })[]): void {
        for (const PactClass of pactClasses) {
            const instance = new PactClass();
            const typeDef = (PactClass as any).__pactReturnTypeDef as string | undefined;
            if (typeDef) this.pactReturnTypes.set(instance.name, typeDef);
        }
    }

    public static buildContextLib(rawName: string, ctx: any, dog?: any): string {
        const typeName = this.safeTypeName(rawName);
        let interfaceDefs = "";

        for (const value of Object.values(ctx)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const proto = Object.getPrototypeOf(value);
                if (proto && proto !== Object.prototype) {
                    const className = value.constructor?.name;
                    if (className && className !== 'Object') {
                        const classType = CompilerCache.getClassType(className);
                        if (classType?.referencedInterfaces) {
                            interfaceDefs += classType.referencedInterfaces + "\n";
                        }
                    }
                }
            }
        }

        const typeBody = this.valueToType(ctx, 1);

        let globalVars = "";
        Object.keys(ctx).forEach(key => {
            globalVars += `
            declare global {
            type ${key} = ${this.valueToType(ctx[key], 2) };

            const ${key}: ${key};
          }
      `;
        });

        let mimicReturnDefs = '';
        let expectedReturnAlias = 'type __ExpectedReturn = any;';
        if (dog && dog instanceof MimicDog && (dog as MimicDog<unknown>).imitatesName) {
            const pactType = this.pactReturnTypes.get((dog as MimicDog<unknown>).imitatesName);
            if (pactType) {
                mimicReturnDefs = pactType;
                const lastTypeLine = pactType.trim().split('\n').pop()?.trim() ?? '';
                const match = lastTypeLine.match(/^type\s+(\w+)\s*=/);
                if (match) {
                    expectedReturnAlias = `type __ExpectedReturn = ${match[1]};`;
                }
            }
        }

        const mimicGlobalBlock = `declare global {\n${mimicReturnDefs}\n${expectedReturnAlias}\n}`;

        return `
${interfaceDefs}
${mimicGlobalBlock}
${globalVars}

export type ${typeName} = ${typeBody};

${this.buildGlobals(typeName, ctx)}

`;
    }

    private static safeTypeName(name: string): string {
        return (
            "Node_" +
            name
                .replace(/[^a-zA-Z0-9_]/g, "_")
                .replace(/^[^a-zA-Z_]/, "_")
        );
    }

    private static buildGlobals(typeName: string, ctx: any): string {
        return Object.keys(ctx)
            .map(
                key =>
                    `declare global {\n  const ${key}: ${typeName}["${key}"];\n}`
            )
            .join("\n");
    }

    private static valueToType(value: any, indent: number): string {
        const pad = (n: number) => "  ".repeat(n);

        if (value === null) return "null";

        if (Array.isArray(value)) {
            if (value.length === 0) return "any[]";
            return `${this.valueToType(value[0], indent)}[]`;
        }

        switch (typeof value) {
            case "string": return "string";
            case "number": return "number";
            case "boolean": return "boolean";

            case "function": {
                const args = Array.from(
                    { length: value.length },
                    (_, i) => `arg${i}: any`
                ).join(", ");
                const isAsync = value.constructor?.name === 'AsyncFunction';
                const returnType = isAsync ? 'Promise<any>' : 'any';
                return `(${args}) => ${returnType}`;
            }

            case "object": {
                const proto = Object.getPrototypeOf(value);

                if (proto && proto !== Object.prototype) {
                    const className = value.constructor?.name;
                    if (className && className !== 'Object') {
                        const classType = CompilerCache.getClassType(className);
                        if (classType) {
                            const lines = Object.entries(classType.members).map(
                                ([k, v]) => `${pad(indent)}${k}: ${v};`
                            );
                            if (!lines.length) return "{}";
                            return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
                        }
                    }

                    const entries: [string, any][] = Object.entries(value);
                    for (const key of Object.getOwnPropertyNames(proto)) {
                        if (key === 'constructor') continue;
                        const desc = Object.getOwnPropertyDescriptor(proto, key);
                        if (!desc) continue;

                        if (desc.get) {
                            try {
                                entries.push([key, desc.get.call(value)]);
                            } catch {
                                entries.push([key, undefined]);
                            }
                        } else if (typeof desc.value === 'function') {
                            entries.push([key, desc.value]);
                        }
                    }

                    if (!entries.length) return "{}";
                    const lines = entries.map(
                        ([k, v]) => `${pad(indent)}${k}: ${this.valueToType(v, indent + 1)};`
                    );
                    return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
                }

                const entries: [string, any][] = Object.entries(value);
                if (!entries.length) return "{}";

                const lines = entries.map(
                    ([k, v]) =>
                        `${pad(indent)}${k}: ${this.valueToType(v, indent + 1)};`
                );

                return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
            }

            default:
                return "any";
        }
    }
}
