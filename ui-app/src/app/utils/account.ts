/** The tabs of `/account` (6.4 S9). */
export type AccountTab = 'profile' | 'tokens' | 'keys';

export const ACCOUNT_TABS: readonly AccountTab[] = ['profile', 'tokens', 'keys'];

/** `?tab=` to a tab; anything else is the profile. */
export function accountTabOf(raw: string | null | undefined): AccountTab {
  return (ACCOUNT_TABS as readonly string[]).includes(raw ?? '') ? (raw as AccountTab) : 'profile';
}

/**
 * Where `/login?returnTo=` may send someone back: a path on this site, never another host
 * (`//evil.example`, `https://…`). Everything else goes to the kennels.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/kennels';
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login/')) return '/kennels';
  return raw;
}
