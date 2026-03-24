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

const FAN_R = 54;
/** Bogen 10 Uhr → 15 Uhr (3 Uhr) im Uhrzeigersinn = 150° */
const ARC_START = 300;
const ARC_SPAN = 150;
/** Unter diesem Winkel (°) zwischen zwei Buttons → voller Kreis */
const MIN_ARC_DEG_PER_BTN = 24;

/**
 * Polarkoordinaten vom Eck oben rechts der Node.
 * Bevorzugt Bogen 10–15 Uhr; bei vielen Buttons oder zu wenig Winkel → volle 360°.
 * φ = 0° = 12 Uhr (oben), im Uhrzeigersinn.
 */
export function fanTransform(index: number, total: number): string {
  if (total <= 0) return '';

  let phiDeg: number;

  if (total === 1) {
    phiDeg = ARC_START + ARC_SPAN / 2;
  } else {
    const spacingInArc = ARC_SPAN / (total - 1);
    const useFullCircle = spacingInArc < MIN_ARC_DEG_PER_BTN || total > 6;

    if (useFullCircle) {
      phiDeg = (ARC_START + (360 * index) / total) % 360;
    } else {
      phiDeg = ARC_START + (ARC_SPAN * index) / (total - 1);
      if (phiDeg >= 360) {
        phiDeg -= 360;
      }
    }
  }

  const rad = (phiDeg * Math.PI) / 180;
  const x = Math.sin(rad) * FAN_R;
  const y = -Math.cos(rad) * FAN_R;
  return `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}
