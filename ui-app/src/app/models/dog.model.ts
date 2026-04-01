export interface BaseDogInfo {
  id: string;
  name: string;
  type: 'BaseDog';
  icon?: string;
}

export interface SerializedDogInfo {
  id: string;
  lineageId?: string;
  parentId?: string | null;
  displayName?: string;
  type?: string;
  theRun: string;
  version?: number;
  icon?: string;
  parentsRequired?: string[];
  parentsOptional?: string[];
}

export type DogInfo = BaseDogInfo | SerializedDogInfo;

export function isBaseDog(dog: DogInfo): dog is BaseDogInfo {
  return (dog as BaseDogInfo).type === 'BaseDog';
}
