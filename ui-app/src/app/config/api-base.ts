/**
 * Express-Backend (nicht der Angular-Dev-Server).
 * Für `window.open` / `<a target="_blank">` zu Swagger & Co., damit neue Tabs nicht auf :4200 landen.
 * HttpClient-Aufrufe bleiben relativ `/api/...` (Proxy beim `ng serve`).
 */
export const API_ORIGIN = 'http://localhost:3000';

export function apiAbsoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${p}`;
}
