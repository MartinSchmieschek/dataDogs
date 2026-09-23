export interface BaseDogInfo {
  id: string;
  name: string;
  type: 'BaseDog';
  icon?: string;
  description?: string;
}

export interface SerializedDogInfo {
  id: string;
  lineageId?: string;
  parentId?: string | null;
  displayName?: string;
  /** Freitext-Beschreibung des Dogs (seit list_nodes/get_node — Commit 592442c). */
  description?: string;
  type?: string;
  /**
   * Name, unter dem dieser Dog als Elternteil im VM-Kontext gebunden wird
   * (z. B. `mdReportData` -> `Mdreportdata`). Kommt vom Server; nie selbst ableiten.
   * Fehlt bei aelteren Serverstaenden und bei BaseDogs.
   */
  contextName?: string;
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
