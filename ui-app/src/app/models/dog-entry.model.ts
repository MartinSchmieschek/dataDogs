export interface ReadTrackingEntry {
  waveIndex: number;
  readerInstanceName: string;
  sourceInstanceName: string;
  propertyPath: string;
}

export interface DogEntry {
  id: string;
  dogId?: string;
  displayName?: string;
  name: string;
  icon?: string;
  result: any;
  error?: string;
  codeTs?: string;
  vmContext?: Record<string, any>;
  vmContextTypeDef?: string;
  vmExpectedReturnTypeName?: string;
  parentsRequired?: string[];
  parentsOptional?: string[];
  /** Whether this node can be removed from the kennel */
  deletable: boolean;
  editable: boolean;
  mimic: boolean;
  serializedDogConfig?: {
    theRun: string;
    dogId?: string;
    parentId?: string | null;
    displayName?: string;
    version?: number;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  };
  readFrom?: ReadTrackingEntry[];
  readBy?: ReadTrackingEntry[];
}

export type Waves = DogEntry[][];
