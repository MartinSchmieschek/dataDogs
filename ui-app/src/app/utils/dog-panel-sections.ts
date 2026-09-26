import { DogEntry } from '../models/dog-entry.model';

export type DogPanelSectionId = 'code' | 'vm' | 'result' | 'parents' | 'acl';

export interface DogPanelSectionItem {
  id: DogPanelSectionId;
  /** Kurzes Tab-Label (.sd-tab, uppercase per CSS). */
  label: string;
}

/** Tab-Labels pro Bereich (Edit-View). Read-Tracking nur am Graph (Kanten-Overlay). */
export const SECTION_LABEL: Record<DogPanelSectionId, string> = {
  code: 'code',
  vm: 'context',
  result: 'result',
  parents: 'parents',
  acl: 'access',
};

export function buildDogPanelSections(dog: DogEntry): DogPanelSectionItem[] {
  // P3.5 Redaction: fremder Dog ohne Leserecht — nur das Ergebnis, kein Code, kein Kontext, keine Rechte.
  if (dog.redacted) {
    return [{ id: 'result', label: SECTION_LABEL.result }];
  }
  const out: DogPanelSectionItem[] = [];
  if (dog.codeTs) {
    out.push({ id: 'code', label: SECTION_LABEL.code });
  }
  out.push({ id: 'vm', label: SECTION_LABEL.vm });
  out.push({ id: 'result', label: SECTION_LABEL.result });
  if (dog.codeTs) {
    out.push({ id: 'parents', label: SECTION_LABEL.parents });
  }
  // SerializedDogs and MimicDogs have a lineageId — only those have an ACL.
  // Hunters (BaseDogs) are project-wide, no ACL.
  if (dog.lineageId) {
    out.push({ id: 'acl', label: SECTION_LABEL.acl });
  }
  return out;
}

/**
 * Legacy-Fallback (z. B. wenn kein Dog-Kontext): Result.
 * Bevorzugt {@link getDefaultPanelSection} — mit Code → `code`, sonst `result`.
 */
export const DEFAULT_PANEL_SECTION: DogPanelSectionId = 'result';

/** Standard-Bereich beim Öffnen: Code-Ansicht wenn der Dog TS-Code hat, sonst Result; redacted immer Result. */
export function getDefaultPanelSection(dog: DogEntry): DogPanelSectionId {
  if (dog.redacted) return 'result';
  return dog.codeTs ? 'code' : 'result';
}
