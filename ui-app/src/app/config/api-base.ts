import { API_ORIGIN_INJECTED } from './api-base.inject';

/**
 * Express-Backend (nicht der Angular-Dev-Server).
 * Für `window.open` / absolute Links zu Swagger & Co., damit neue Tabs nicht auf die falsche Origin landen.
 * HttpClient nutzt weiterhin relative Pfade `/api/…` (Proxy bei `ng serve`).
 *
 * Basis-URL: Repo-Root `.env` → `PUBLIC_API_BASE_URL` (wird vor `ng serve` / `ng build` injiziert).
 */
function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

export function getApiOrigin(): string {
  const raw = API_ORIGIN_INJECTED.trim();
  if (raw) return stripTrailingSlashes(raw);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlashes(window.location.origin);
  }
  return 'http://localhost:3000';
}

export function apiAbsoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
