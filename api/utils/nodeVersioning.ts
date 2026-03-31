// Node versioning — the dark rite that births a new incarnation from a save input.
// The old linear lineage is broken; now each save forges a GUID in the void,
// and the spirit's parentId traces the branch back to its ancestor.
import { IStore } from '../../store/IStore';
import { ISerializedDogConfig } from '@datadogs/core';
import { generateVersionId, generateDogId } from './versioning';

/**
 * Births a new ISerializedDogConfig from a save input — the branching rite.
 * If the spirit already exists, the new incarnation inherits its dogId and sets parentId
 * to the ancestor it was forged from. If it be a new spirit, a fresh dogId is conjured.
 */
export async function createNodeConfigFromSaveInput(
    input: {
        id: string;
        tsCode?: string;
        code?: string;
        icon?: string;
        parentsRequired?: string[];
        parentsOptional?: string[];
        serializedDogConfig?: ISerializedDogConfig;
    },
    store: IStore
): Promise<{ config: ISerializedDogConfig; nextVersionId: string }> {
    const id = input.id;
    const tsCode = input.tsCode || input.code || '';
    const parentsRequired = input.parentsRequired || [];
    const parentsOptional = input.parentsOptional || [];
    const serializedDogConfig = input.serializedDogConfig;

    // The new incarnation's GUID — unique across all realms
    const nextVersionId = generateVersionId();

    // Seek the ancestor in the deep — the spirit from which this incarnation descends
    let existing: any = null;
    const existingData = await store.load(id);
    if (existingData) {
        existing = typeof existingData === 'string' ? JSON.parse(existingData) : existingData;
        if (existing.serializedDogConfig) {
            existing = typeof existing.serializedDogConfig === 'string'
                ? JSON.parse(existing.serializedDogConfig)
                : existing.serializedDogConfig;
        }
    }

    // Inherit the lineage mark from the ancestor, or forge a new one fer a firstborn
    const dogId = existing?.dogId || serializedDogConfig?.dogId || generateDogId();
    const parentId = id; // The ancestor from which this incarnation was born
    const displayName = existing?.displayName || serializedDogConfig?.displayName || id;

    let config: ISerializedDogConfig;
    if (serializedDogConfig) {
        config = {
            ...serializedDogConfig,
            theRun: tsCode,
            dogId,
            parentId,
            displayName: serializedDogConfig.displayName || displayName,
            parentsRequired: parentsRequired || serializedDogConfig.parentsRequired || [],
            parentsOptional: parentsOptional || serializedDogConfig.parentsOptional || [],
        };
    } else {
        config = existing
            ? { ...existing }
            : { theRun: '', parentsRequired: [], parentsOptional: [], dogId, parentId: null, displayName };

        config.theRun = tsCode;
        config.dogId = dogId;
        config.parentId = parentId;
        config.displayName = displayName;
        config.parentsRequired = parentsRequired || [];
        config.parentsOptional = parentsOptional || [];
    }

    if (input.icon !== undefined) {
        config.icon = input.icon;
    }

    return { config, nextVersionId };
}
