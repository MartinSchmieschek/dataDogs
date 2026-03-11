export interface BaseDogInfo {
  id: string;
  name: string;
  type: 'BaseDog';
}

export interface SerializedDogInfo {
  id: string;
  type?: string;
  theRun: string;
  version?: number;
  parentsRequired?: string[];
  parentsOptional?: string[];
}

export type DogInfo = BaseDogInfo | SerializedDogInfo;

export function isBaseDog(dog: DogInfo): dog is BaseDogInfo {
  return (dog as BaseDogInfo).type === 'BaseDog';
}
