// The WavesConverter — the chronicler of the hunt, who turns the raw season into Waves of plunder.
// After the dogs have hunted, their season must be charted in a form the crew can read.
// Carrion hordes trill their profane accord with eldritch plans: each wave is a tide of results.
import { IHuntingSeason, IWaveEntry, IHuntingDog, SerializedDog } from '@datadogs/core';
import { TypeDefBuilder } from './TypeDefBuilder';

/**
 * Records who read from whom during the hunt — the data lineage of the pack.
 * Its heralds are the stars it fells: we track every read as a star felled by another dog.
 */
export type ReadTrackingEntry = {
    waveIndex: number;
    readerInstanceName: string;
    sourceInstanceName: string;
    propertyPath: string;
};

/**
 * A single dog's entry in the wave — its plunder, its lineage, its code, and its context.
 * For SerializedDogs, the code and VM context are preserved so the crew may inspect the hunt.
 * The return-type alias is unique per instance to prevent eldritch type collisions in the VM.
 */
export type NodeEntry = {
    id: string;
    name: string;
    icon?: string;
    result: any;
    error?: string;
    codeTs?: string;
    vmContext?: Record<string, any>;
    vmContextTypeDef?: string;
    /** The unique return-type alias for this dog's instance in the context lib. */
    vmExpectedReturnTypeName?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
    serializedDogConfig?: {
        theRun: string;
        version?: number;
        parentsRequired?: string[];
        parentsOptional?: string[];
    };
    readFrom?: ReadTrackingEntry[];
    readBy?: ReadTrackingEntry[];
};

/**
 * The Waves — a 2D tide of NodeEntries, each wave a parallel surge of dog results.
 * To cosmic forms from tangent planes we end as we began: wave by wave, the hunt unfolds.
 */
export type Waves = NodeEntry[][];

/**
 * Resolve a dog instance's canonical ID.
 * SerializedDogs carry their own storageId; BaseDogs are known by their name.
 * From brooding gulfs are we beheld: every dog must be named before it can be tracked.
 */
function resolveInstanceId(instance: any): string {
    return (instance instanceof SerializedDog)
        ? (instance as SerializedDog<unknown>).storageId
        : instance.name;
}

/**
 * Convert the raw IHuntingSeason into Waves — the structured chronicle of the hunt.
 * Each wave is a parallel surge; each node entry is a dog's full account of what it seized.
 * ReadTracking is resolved bidirectionally: who fed this dog, and who did this dog feed.
 */
export function convertSeasonToWaves(theHunt: IHuntingSeason): Waves {
    const waves: Waves = [];

    theHunt.wave.forEach((wave: IWaveEntry[]) => {
        waves.push(wave.map((entry: IWaveEntry) => {
            const instance = entry.instance;
            const instanceId = resolveInstanceId(instance);
            const instanceName = instance.name;

            const readFrom: any[] = [];
            const readBy: any[] = [];

            // Walk the read-tracking log to discover this dog's place in the data lineage.
            // In luminous space, blackened stars: each tracking entry illuminates a connection.
            theHunt.readTracking.forEach((trackingEntry: any) => {
                const readerName = trackingEntry.readerInstance.name;
                const sourceName = trackingEntry.sourceInstance.name;
                const readerId = resolveInstanceId(trackingEntry.readerInstance);
                const sourceId = resolveInstanceId(trackingEntry.sourceInstance);

                // This dog was a reader — it drank from another dog's plunder.
                if (readerId === instanceId || readerName === instanceName) {
                    readFrom.push({
                        waveIndex: trackingEntry.waveIndex,
                        readerInstanceName: readerName,
                        sourceInstanceName: sourceName,
                        propertyPath: trackingEntry.propertyPath
                    });
                }

                // This dog was a source — others drank from its plunder.
                if (sourceId === instanceId || sourceName === instanceName) {
                    readBy.push({
                        waveIndex: trackingEntry.waveIndex,
                        readerInstanceName: readerName,
                        sourceInstanceName: sourceName,
                        propertyPath: trackingEntry.propertyPath
                    });
                }
            });

            const nodeEntry = {
                id: instanceId,
                name: instanceName,
                icon: (instance instanceof SerializedDog
                    ? (instance as SerializedDog<unknown>).icon
                    : (instance as IHuntingDog<unknown>).icon) ?? undefined,
                result: instance.collected,
                error: (instance as any).__error || undefined,
                parentsOptional: [],
                parentsRequired: [],
                readFrom: readFrom.length > 0 ? readFrom : undefined,
                readBy: readBy.length > 0 ? readBy : undefined,
            } as NodeEntry;

            if (entry.instance instanceof SerializedDog) {
                // SerializedDogs carry their own code and VM context — expose it all for the crew.
                // Through endless faces, countless forms: each SerializedDog may have unique typings.
                const seDog = entry.instance as SerializedDog<unknown>;
                nodeEntry.codeTs = seDog.instanceConfig.theRun;
                const vmCtx = seDog.simpleVmContext || {};
                nodeEntry.vmContext = vmCtx;
                nodeEntry.vmExpectedReturnTypeName = TypeDefBuilder.expectedReturnAliasTypeName(instanceId);
                nodeEntry.vmContextTypeDef = TypeDefBuilder.buildContextLib(
                    seDog.name,
                    vmCtx,
                    entry.instance,
                    instanceId
                );
                nodeEntry.serializedDogConfig = {
                    theRun: seDog.instanceConfig.theRun,
                    version: seDog.instanceConfig.version,
                    parentsRequired: seDog.instanceConfig.parentsRequired || [],
                    parentsOptional: seDog.instanceConfig.parentsOptional || [],
                    ...(typeof seDog.instanceConfig.icon === 'string'
                        ? { icon: seDog.instanceConfig.icon }
                        : {}),
                };
                nodeEntry.parentsRequired = seDog.instanceConfig.parentsRequired || [];
                nodeEntry.parentsOptional = seDog.instanceConfig.parentsOptional || [];
            } else {
                // BaseDogs derive their parents from the hunt's dependency graph — not from a stored config.
                nodeEntry.parentsOptional = [...entry.optionalRequiresFrom ? entry.optionalRequiresFrom.map((r: any) => {
                    return resolveInstanceId(r.instance);
                }) : []];
                nodeEntry.parentsRequired = [...entry.requiresFrom ? entry.requiresFrom.map((r: any) => {
                    return resolveInstanceId(r.instance);
                }) : []];
            }

            return nodeEntry;
        }));
    });

    return waves;
}
