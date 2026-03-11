export interface ReadTrackingEntry {
  waveIndex: number;
  readerInstanceName: string;
  sourceInstanceName: string;
  propertyPath: string;
}

export interface DogEntry {
  id: string;
  name: string;
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
}

export type Waves = DogEntry[][];
