/**
 * Einheitliche Auflösung von Kennel-ID und Anzeigename beim Import-Export-Bundle
 * (Phase 1: Kollision mit bestehender Kennel-ID, Phase 2: belegter Anzeigename).
 * Wird von API-Import und der UI-Dialogvorschau genutzt (API hier; die Angular-App
 * spiegelt in `ui-app/src/app/utils/kennel-import-target.ts` wegen Vite-Subpath-Auflösung).
 */

export type KennelIdNameListEntry = {
  lineageId?: string;
  id: string;
  name?: string;
};

export function kennelListRef(entry: KennelIdNameListEntry): string {
  return (entry.lineageId || entry.id || '').trim();
}

function nameNorm(name: string): string {
  return name.trim().toLowerCase();
}

export function isKennelIdTakenInList(kennelId: string, existing: KennelIdNameListEntry[]): boolean {
  const t = kennelId.trim();
  if (!t) return true;
  return existing.some((e) => kennelListRef(e) === t);
}

export function isKennelNameTakenInList(
  displayName: string,
  existing: KennelIdNameListEntry[]
): boolean {
  const t = nameNorm(displayName);
  if (!t) return false;
  return existing.some((e) => nameNorm(e.name || '') === t);
}

/**
 * Liefert den ersten freien (id, name)-Vorschlag, analog zur Server-Import-Logik.
 * `bundle.kennel` muss kennelId und optionales name tragen; wie in Export.
 */
export function suggestKennelImportTarget(
  bundle: { kennel: { kennelId: string; name?: string } },
  existing: KennelIdNameListEntry[]
): { kennelId: string; name: string; initial: { kennelId: string; name: string } } {
  const originalId = (bundle.kennel.kennelId || '').trim();
  if (!originalId) {
    throw new Error('Bundle: kennel.kennelId fehlt');
  }
  const baseName0 = (bundle.kennel.name && bundle.kennel.name.trim()) || originalId;

  const initial = { kennelId: originalId, name: baseName0 };

  // Phase 1: Kennel-IDs, die kollidieren — im Lockstep ID + Paar-Name, wie bisher
  let kennelId = originalId;
  let kennelName = baseName0;
  let copyIndex = 0;
  while (isKennelIdTakenInList(kennelId, existing)) {
    copyIndex++;
    kennelId = `${originalId}-copy${copyIndex > 1 ? '-' + copyIndex : ''}`;
    kennelName = `${baseName0} (Kopie${copyIndex > 1 ? ' ' + copyIndex : ''})`;
  }

  // Phase 2: Anzeigename, der (noch) von einem bestehenden Kennel belegt ist
  for (let t = 0; t < 500; t++) {
    const candidate =
      t === 0 ? baseName0 : t === 1 ? `${baseName0} (Kopie)` : `${baseName0} (Kopie ${t})`;
    if (!isKennelNameTakenInList(candidate, existing)) {
      kennelName = candidate;
      break;
    }
  }
  if (isKennelNameTakenInList(kennelName, existing)) {
    kennelName = `${baseName0} (Import ${Date.now()})`;
  }

  return { kennelId, name: kennelName, initial };
}

/** Erforderlich, wenn zuerst derselbe (Id|Name) im System schon belegt ist. */
export function kennelImportNeedsUserChoice(
  bundle: { kennel: { kennelId: string; name?: string } },
  existing: KennelIdNameListEntry[]
): boolean {
  const i = bundle.kennel;
  const kennelId0 = (i.kennelId || '').trim();
  const name0 = (i.name && i.name.trim()) || kennelId0;
  if (!kennelId0) return true;
  if (isKennelIdTakenInList(kennelId0, existing)) return true;
  if (isKennelNameTakenInList(name0, existing)) return true;
  return false;
}
