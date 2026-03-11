import * as ts from 'typescript';
import * as path from 'path';

export interface IClassTypeResult {
    members: Record<string, string>;
    referencedInterfaces: string;
}

export class CompilerCache {

    private static createProgram(): { program: ts.Program; checker: ts.TypeChecker } {
        const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
        if (!configPath) throw new Error('tsconfig.json not found');
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        const parsed = ts.parseJsonConfigFileContent(
            configFile.config, ts.sys, path.dirname(configPath)
        );
        const program = ts.createProgram(parsed.fileNames, parsed.options);
        return { program, checker: program.getTypeChecker() };
    }

    private static isPublic(node: ts.Declaration): boolean {
        const flags = ts.getCombinedModifierFlags(node);
        return !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected));
    }

    private static collectReferencedTypes(
        checker: ts.TypeChecker,
        type: ts.Type,
        collected: Set<string>
    ): void {
        if (type.isUnion()) {
            for (const t of type.types) {
                this.collectReferencedTypes(checker, t, collected);
            }
            return;
        }

        if (type.isIntersection()) {
            for (const t of type.types) {
                this.collectReferencedTypes(checker, t, collected);
            }
            return;
        }

        const symbol = type.aliasSymbol ?? type.getSymbol();
        if (symbol) {
            const decls = symbol.getDeclarations();
            if (decls && decls.length > 0) {
                const decl = decls[0];
                const sourceFile = decl.getSourceFile();
                if (!sourceFile.isDeclarationFile && ts.isInterfaceDeclaration(decl)) {
                    const name = symbol.getName();
                    if (!collected.has(name)) {
                        collected.add(name);
                        for (const member of type.getProperties()) {
                            const memberType = checker.getTypeOfSymbol(member);
                            this.collectReferencedTypes(checker, memberType, collected);
                        }
                    }
                }
            }
        }

        const typeArgs = (type as ts.TypeReference).typeArguments;
        if (typeArgs) {
            for (const arg of typeArgs) {
                this.collectReferencedTypes(checker, arg, collected);
            }
        }

        if (checker.isArrayType(type)) {
            const elementType = (type as ts.TypeReference).typeArguments?.[0];
            if (elementType) {
                this.collectReferencedTypes(checker, elementType, collected);
            }
        }
    }

    private static emitInterfaceDefinition(
        checker: ts.TypeChecker,
        interfaceName: string,
        program: ts.Program
    ): string | null {
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) continue;
            const result = this.findInterfaceInFile(sourceFile, interfaceName);
            if (result) {
                return this.interfaceNodeToString(checker, result);
            }
        }
        return null;
    }

    private static findInterfaceInFile(
        sourceFile: ts.SourceFile,
        name: string
    ): ts.InterfaceDeclaration | null {
        let found: ts.InterfaceDeclaration | null = null;
        ts.forEachChild(sourceFile, (node) => {
            if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
                found = node;
            }
        });
        return found;
    }

    private static interfaceNodeToString(
        checker: ts.TypeChecker,
        node: ts.InterfaceDeclaration
    ): string {
        const name = node.name.text;
        const members: string[] = [];

        for (const member of node.members) {
            if (ts.isPropertySignature(member) && member.name) {
                const memberName = (member.name as ts.Identifier).text;
                const optional = member.questionToken ? '?' : '';
                const symbol = checker.getSymbolAtLocation(member.name);
                if (symbol) {
                    const memberType = checker.getTypeOfSymbol(symbol);
                    const typeStr = checker.typeToString(
                        memberType, node, ts.TypeFormatFlags.NoTruncation
                    );
                    members.push(`  ${memberName}${optional}: ${typeStr};`);
                }
            } else if (ts.isMethodSignature(member) && member.name) {
                const memberName = (member.name as ts.Identifier).text;
                const optional = member.questionToken ? '?' : '';
                const sig = checker.getSignatureFromDeclaration(member);
                if (sig) {
                    const returnType = checker.getReturnTypeOfSignature(sig);
                    const params = sig.parameters.map(p => {
                        const pType = checker.getTypeOfSymbol(p);
                        return `${p.name}: ${checker.typeToString(pType)}`;
                    });
                    const retStr = checker.typeToString(
                        returnType, node, ts.TypeFormatFlags.NoTruncation
                    );
                    members.push(`  ${memberName}${optional}(${params.join(', ')}): ${retStr};`);
                }
            } else if (ts.isIndexSignatureDeclaration(member)) {
                const indexSig = checker.getSignatureFromDeclaration(member);
                if (indexSig) {
                    const param = indexSig.parameters[0];
                    if (param) {
                        const keyType = checker.typeToString(checker.getTypeOfSymbol(param));
                        const valueType = checker.typeToString(
                            checker.getReturnTypeOfSignature(indexSig),
                            node,
                            ts.TypeFormatFlags.NoTruncation
                        );
                        members.push(`  [${param.name}: ${keyType}]: ${valueType};`);
                    }
                }
            }
        }

        return `interface ${name} {\n${members.join('\n')}\n}`;
    }

    static getClassType(className: string): IClassTypeResult | null {
        try {
            const { program, checker } = this.createProgram();
            const members: Record<string, string> = {};
            const referencedTypeNames = new Set<string>();
            let classNode: ts.ClassDeclaration | null = null;

            for (const sourceFile of program.getSourceFiles()) {
                if (sourceFile.isDeclarationFile) continue;
                ts.forEachChild(sourceFile, (node) => {
                    if (ts.isClassDeclaration(node) && node.name?.text === className) {
                        classNode = node;
                    }
                });
                if (classNode) break;
            }

            if (!classNode) return null;

            for (const member of (classNode as ts.ClassDeclaration).members) {
                if (!this.isPublic(member)) continue;

                if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const sig = checker.getSignatureFromDeclaration(member);
                    if (!sig) continue;

                    const returnType = checker.getReturnTypeOfSignature(sig);
                    const params = sig.parameters.map(p => {
                        const pType = checker.getTypeOfSymbol(p);
                        return `${p.name}: ${checker.typeToString(pType)}`;
                    });
                    const retStr = checker.typeToString(
                        returnType, member, ts.TypeFormatFlags.NoTruncation
                    );
                    members[name] = `(${params.join(', ')}) => ${retStr}`;

                    for (const p of sig.parameters) {
                        this.collectReferencedTypes(checker, checker.getTypeOfSymbol(p), referencedTypeNames);
                    }
                    this.collectReferencedTypes(checker, returnType, referencedTypeNames);
                }

                if (ts.isGetAccessorDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const sig = checker.getSignatureFromDeclaration(member);
                    if (sig) {
                        const returnType = checker.getReturnTypeOfSignature(sig);
                        members[name] = checker.typeToString(
                            returnType, member, ts.TypeFormatFlags.NoTruncation
                        );
                        this.collectReferencedTypes(checker, returnType, referencedTypeNames);
                    }
                }

                if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const symbol = checker.getSymbolAtLocation(member.name);
                    if (symbol) {
                        const propType = checker.getTypeOfSymbol(symbol);
                        members[name] = checker.typeToString(
                            propType, member, ts.TypeFormatFlags.NoTruncation
                        );
                        this.collectReferencedTypes(checker, propType, referencedTypeNames);
                    }
                }

                if (ts.isParameter(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const symbol = checker.getSymbolAtLocation(member.name);
                    if (symbol) {
                        const propType = checker.getTypeOfSymbol(symbol);
                        members[name] = checker.typeToString(
                            propType, member, ts.TypeFormatFlags.NoTruncation
                        );
                        this.collectReferencedTypes(checker, propType, referencedTypeNames);
                    }
                }
            }

            const ctor = (classNode as ts.ClassDeclaration).members.find(ts.isConstructorDeclaration);
            if (ctor) {
                for (const param of ctor.parameters) {
                    const modFlags = ts.getCombinedModifierFlags(param);
                    const isPromoted = modFlags & (ts.ModifierFlags.Public | ts.ModifierFlags.Readonly);
                    const isPrivateOrProtected = modFlags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected);
                    if (isPromoted && !isPrivateOrProtected && ts.isIdentifier(param.name)) {
                        const name = param.name.text;
                        if (members[name]) continue;
                        const symbol = checker.getSymbolAtLocation(param.name);
                        if (symbol) {
                            const propType = checker.getTypeOfSymbol(symbol);
                            members[name] = checker.typeToString(
                                propType, param, ts.TypeFormatFlags.NoTruncation
                            );
                            this.collectReferencedTypes(checker, propType, referencedTypeNames);
                        }
                    }
                }
            }

            const interfaceDefs: string[] = [];
            for (const typeName of referencedTypeNames) {
                const def = this.emitInterfaceDefinition(checker, typeName, program);
                if (def) interfaceDefs.push(def);
            }

            return {
                members,
                referencedInterfaces: interfaceDefs.join('\n\n')
            };
        } catch (e) {
            console.error('[CompilerCache] Error extracting class type:', e);
            return null;
        }
    }
}
