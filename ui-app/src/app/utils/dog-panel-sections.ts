import { DogEntry } from '../models/dog-entry.model';

export type DogPanelSectionId = 'code' | 'vm' | 'result' | 'parents' | 'acl';

export interface DogPanelSectionItem {
  id: DogPanelSectionId;
  label: string;
  icon: string;
}

/** Kleine Icons pro Bereich (Edit-View / Graph-Fächer). Read-Tracking nur am Graph (Kanten-Overlay). */
export const SECTION_ICON: Record<DogPanelSectionId, string> = {
  code: '⌨',
  vm: '📐',
  result: '📄',
  parents: '🔗',
  acl: '🔑',
};

export function buildDogPanelSections(dog: DogEntry): DogPanelSectionItem[] {
  const out: DogPanelSectionItem[] = [];
  if (dog.codeTs) {
    out.push({ id: 'code', label: 'Code', icon: SECTION_ICON.code });
  }
  out.push({ id: 'vm', label: 'VM-Kontext', icon: SECTION_ICON.vm });
  out.push({ id: 'result', label: 'Result', icon: SECTION_ICON.result });
  if (dog.codeTs) {
    out.push({ id: 'parents', label: 'Parents', icon: SECTION_ICON.parents });
  }
  // SerializedDogs and MimicDogs have a lineageId — only those have an ACL.
  // Hunters (BaseDogs) are project-wide, no ACL.
  if (dog.lineageId) {
    out.push({ id: 'acl', label: 'Access', icon: SECTION_ICON.acl });
  }
  return out;
}

/**
 * Legacy-Fallback (z. B. wenn kein Dog-Kontext): Result.
 * Bevorzugt {@link getDefaultPanelSection} — mit Code → `code`, sonst `result`.
 */
export const DEFAULT_PANEL_SECTION: DogPanelSectionId = 'result';

/** Standard-Bereich beim Öffnen: Code-Ansicht wenn der Dog TS-Code hat, sonst Result. */
export function getDefaultPanelSection(dog: DogEntry): DogPanelSectionId {
  return dog.codeTs ? 'code' : 'result';
}
