import { IHuntingSeason, IWaveEntry, IHuntingDog, SerializedDog } from 'datadogs';
import { TypeDefBuilder } from './TypeDefBuilder';

export type ReadTrackingEntry = {
    waveIndex: number;
    readerInstanceName: string;
    sourceInstanceName: string;
    propertyPath: string;
};

export type NodeEntry = {
    id: string;
    name: string;
    icon?: string;
    result: any;
    error?: string;
    codeTs?: string;
    vmContext?: Record<string, any>;
    vmContextTypeDef?: string;
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

export type Waves = NodeEntry[][];

function resolveInstanceId(instance: any): string {
    return (instance instanceof SerializedDog)
        ? (instance as SerializedDog<unknown>).storageId
        : instance.name;
}

export function convertSeasonToWaves(theHunt: IHuntingSeason): Waves {
    const waves: Waves = [];

    theHunt.wave.forEach((wave: IWaveEntry[]) => {
        waves.push(wave.map((entry: IWaveEntry) => {
            const instance = entry.instance;
            const instanceId = resolveInstanceId(instance);
            const instanceName = instance.name;

            const readFrom: any[] = [];
            const readBy: any[] = [];

            theHunt.readTracking.forEach((trackingEntry: any) => {
                const readerName = trackingEntry.readerInstance.name;
                const sourceName = trackingEntry.sourceInstance.name;
                const readerId = resolveInstanceId(trackingEntry.readerInstance);
                const sourceId = resolveInstanceId(trackingEntry.sourceInstance);

                if (readerId === instanceId || readerName === instanceName) {
                    readFrom.push({
                        waveIndex: trackingEntry.waveIndex,
                        readerInstanceName: readerName,
                        sourceInstanceName: sourceName,
                        propertyPath: trackingEntry.propertyPath
                    });
                }

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
                const seDog = entry.instance as SerializedDog<unknown>;
                nodeEntry.codeTs = seDog.instanceConfig.theRun;
                const vmCtx = seDog.simpleVmContext || {};
                nodeEntry.vmContext = vmCtx;
                nodeEntry.vmContextTypeDef = TypeDefBuilder.buildContextLib(seDog.name, vmCtx, entry.instance);
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
