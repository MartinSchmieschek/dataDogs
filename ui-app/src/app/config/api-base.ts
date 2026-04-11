import { isDevMode } from '@angular/core';
import { API_ORIGIN_INJECTED } from './api-base.inject';

/**
 * Basis für absolute Links (Swagger, window.open). HttpClient nutzt weiter `/api/…` (Proxy bei `ng serve`).
 *
 * **Production- & Integration-Builds** (`ng build`, default „production“): `isDevMode()` ist false.
 * Dann gilt immer die **Auslieferungs-Origin** (`window.location.origin`), außer `PUBLIC_API_BASE_URL`
 * zeigt auf einen **anderen Hostnamen** (getrennte API-Domain).
 *
 * **Development** (`ng serve`, dev-Build): gleicher Hostname, aber **anderer Port** (UI :4300, API :3000)
 * → injizierte Backend-URL nutzen.
 */
function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function parseInjectedOrigin(raw: string): URL | null {
  try {
    return new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

export function getApiOrigin(): string {
  const raw = API_ORIGIN_INJECTED.trim();

  if (typeof window === 'undefined') {
    return raw ? stripTrailingSlashes(raw) : 'http://localhost:3000';
  }

  const pageUrl = new URL(window.location.href);
  const pageOrigin = stripTrailingSlashes(pageUrl.origin);

  // ── Integration & Production (optimierte Builds): Basis = Auslieferungs-URL ──
  if (!isDevMode()) {
    if (!raw) return pageOrigin;
    const injectedUrl = parseInjectedOrigin(raw);
    if (!injectedUrl) return pageOrigin;
    const injHost = injectedUrl.hostname;
    const pageHost = pageUrl.hostname;
    if (isLocalDevHostname(injHost) && !isLocalDevHostname(pageHost)) {
      return pageOrigin;
    }
    if (injHost !== pageHost) {
      return stripTrailingSlashes(injectedUrl.origin);
    }
    return pageOrigin;
  }

  // ── Development: ng serve vs Express (gleicher Host, anderer Port) ──
  if (!raw) {
    return pageOrigin;
  }

  const injectedUrl = parseInjectedOrigin(raw);
  if (!injectedUrl) {
    return pageOrigin;
  }

  const injHost = injectedUrl.hostname;
  const pageHost = pageUrl.hostname;

  if (isLocalDevHostname(injHost) && !isLocalDevHostname(pageHost)) {
    return pageOrigin;
  }

  if (injHost === pageHost) {
    return stripTrailingSlashes(injectedUrl.origin);
  }

  return stripTrailingSlashes(injectedUrl.origin);
}

export function apiAbsoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
