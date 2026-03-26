import { DogEntry } from '../models/dog-entry.model';

export type DogPanelSectionId = 'code' | 'vm' | 'result' | 'parents';

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
  return out;
}

/** Standard-Bereich beim Öffnen des Panels (wenn nichts anderes vorgegeben). */
export const DEFAULT_PANEL_SECTION: DogPanelSectionId = 'result';

const FAN_R_BASE = 54;

/** Magnetischer Pol: 1:30 Uhr = 45° (von 12 Uhr im Uhrzeigersinn). */
const PHI_CENTER_DEG = 45;

/** Bogen 11h–3h entspricht 120°; alle Buttons in diesem Segment um PHI_CENTER symmetrisch (bei n≥2). */
const ARC_SPAN_MAX = 120;

function fanRadius(total: number): number {
  if (total <= 6) return FAN_R_BASE;
  return FAN_R_BASE * Math.min(1.85, 1 + (total - 6) * 0.11);
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

/**
 * Action-Fächer: Polarkoordinaten vom Anker oben rechts der Node.
 * Kein Spezialfall nach Anzahl: immer auf einem Kreisbogen (bzw. vollem Kreis bei vielen Buttons).
 * „Pol“ bei 45° / 1:30 Uhr — bei mehreren Einträgen liegt der Mittelpunkt des Bogens dort
 * (zwei Buttons: symmetrisch mit/im gegen den Uhrzeigersinn um 1:30).
 * φ = 0° = 12 Uhr (oben), im Uhrzeigersinn.
 */
export function fanTransform(index: number, total: number): string {
  if (total <= 0) return '';

  const r = fanRadius(total);
  let phiDeg: number;

  if (total === 1) {
    phiDeg = PHI_CENTER_DEG;
  } else if (total > 6) {
    /** Voller Kreis; erster Index bei 1:30, gleichmäßig verteilt */
    phiDeg = normDeg(PHI_CENTER_DEG + (index * 360) / total);
  } else {
    /** Bogen zentriert bei PHI_CENTER, gleichmäßig von φ_start … φ_end */
    const half = ARC_SPAN_MAX / 2;
    phiDeg = normDeg(PHI_CENTER_DEG - half + (index / (total - 1)) * ARC_SPAN_MAX);
  }

  const rad = (phiDeg * Math.PI) / 180;
  const x = Math.sin(rad) * r;
  const y = -Math.cos(rad) * r;
  return `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}
