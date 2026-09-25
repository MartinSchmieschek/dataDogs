import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IKennelConfig, KennelVersionEntry } from '../models/kennel-config.model';
import { Waves } from '../models/dog-entry.model';
import { apiAbsoluteUrl } from '../config/api-base';
import { publicKennelPath } from '../config/public-paths';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  id?: string;
}

/**
 * Antwort der seitenweisen Listung. `total`/`limit`/`offset` liefert der Server nur,
 * wenn `limit` mitgeschickt wurde — ältere Stände antworten weiter wie `ApiResponse`.
 */
export interface PagedApiResponse<T> extends ApiResponse<T[]> {
  total?: number;
  limit?: number;
  offset?: number;
}

/** calls/calls30d = Aufrufe (ranked), rating = Bayes-Score (P4). */
export type KennelSortKey = 'name' | 'createdAt' | 'updatedAt' | 'calls' | 'calls30d' | 'rating';
export type KennelSortDir = 'asc' | 'desc';

export interface KennelPageQuery {
  /** Seitengröße, serverseitig auf 200 gedeckelt. */
  limit: number;
  offset?: number;
  /** Teilstring-Suche über name, displayName, description. */
  q?: string;
  /** Nur eigene Einträge; ohne Anmeldung leer. */
  mine?: boolean;
  sort?: KennelSortKey;
  dir?: KennelSortDir;
  /** Nur Kennels mit Rohschnitt >= minStars (1..5). */
  minStars?: number;
  /** Nur Kennels mit mindestens so vielen gezaehlten Aufrufen. */
  minCalls?: number;
}

/** Antwort von GET/PUT/DELETE /api/kennels/:id/rating (P4). `mine` ist null anonym oder unbewertet. */
export interface IRatingView {
  ok: boolean;
  lineageId: string;
  avg: number | null;
  count: number;
  score: number;
  histogram: { 1: number; 2: number; 3: number; 4: number; 5: number };
  mine: number | null;
}

export interface RunResponse {
  ok: boolean;
  waves: Waves;
  kennelConfig: IKennelConfig;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class KennelService {
  private http = inject(HttpClient);
  private baseUrl = '/api/kennels';

  getAll(): Observable<ApiResponse<IKennelConfig[]>> {
    return this.http.get<ApiResponse<IKennelConfig[]>>(this.baseUrl);
  }

  /**
   * Seitenweise Listung — Suche, Sortierung und „nur meine" laufen auf dem Server.
   * Nur gesetzte Parameter werden gesendet; ohne `limit` verhielte sich die API wie `getAll()`.
   */
  getPage(query: KennelPageQuery): Observable<PagedApiResponse<IKennelConfig>> {
    let params = new HttpParams().set('limit', String(query.limit));
    if (query.offset) params = params.set('offset', String(query.offset));
    const q = query.q?.trim();
    if (q) params = params.set('q', q);
    if (query.mine) params = params.set('mine', '1');
    if (query.sort) params = params.set('sort', query.sort);
    if (query.dir) params = params.set('dir', query.dir);
    if (query.minStars !== undefined) params = params.set('minStars', String(query.minStars));
    if (query.minCalls !== undefined) params = params.set('minCalls', String(query.minCalls));
    return this.http.get<PagedApiResponse<IKennelConfig>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<ApiResponse<IKennelConfig>> {
    return this.http.get<ApiResponse<IKennelConfig>>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  create(data: {
    id: string;
    name?: string;
    description?: string;
    emoji?: string;
    dogIds?: string[];
    visibility?: 'public' | 'private';
  }): Observable<ApiResponse<IKennelConfig>> {
    return this.http.post<ApiResponse<IKennelConfig>>(this.baseUrl, data);
  }

  update(id: string, data: Partial<IKennelConfig>): Observable<ApiResponse<IKennelConfig>> {
    return this.http.put<ApiResponse<IKennelConfig>>(`${this.baseUrl}/${encodeURIComponent(id)}`, data);
  }

  delete(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  /** Sterne (P4): Aggregat, Verteilung, eigene Bewertung. Relativ — laeuft ueber den Dev-Proxy. */
  getRating(id: string): Observable<IRatingView> {
    return this.http.get<IRatingView>(`${this.baseUrl}/${encodeURIComponent(id)}/rating`);
  }

  setRating(id: string, stars: number): Observable<IRatingView> {
    return this.http.put<IRatingView>(`${this.baseUrl}/${encodeURIComponent(id)}/rating`, { stars });
  }

  deleteRating(id: string): Observable<IRatingView> {
    return this.http.delete<IRatingView>(`${this.baseUrl}/${encodeURIComponent(id)}/rating`);
  }

  getVersions(id: string): Observable<ApiResponse<KennelVersionEntry[]>> {
    return this.http.get<ApiResponse<KennelVersionEntry[]>>(`${this.baseUrl}/${encodeURIComponent(id)}/versions`);
  }

  run(id: string, body?: any, query?: Record<string, string>, version?: string): Observable<RunResponse> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    if (version) {
      params = params.set('version', version);
    }
    // Auch {} ist ein gültiger Body (z. B. BodyRetriever); nicht nur "keys.length > 0".
    const hasBody = body !== undefined && body !== null;
    if (hasBody) {
      return this.http.post<RunResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/run`, body, { params });
    }
    return this.http.get<RunResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/run`, { params });
  }

  exportBundle(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(id)}/export`);
  }

  importBundle(bundle: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/import`, bundle);
  }

  /**
   * Lead-Yield: JSON-Objekt oder String (HTML / Markdown / sonstiger Text).
   * Content-Type steuert die Auswertung (application/json vs. text/*).
   *
   * Kennel-Ausführung geht immer über den öffentlichen Endpoint `/k/:kennelId` auf Express —
   * nicht über `/api/kennels/.../run|execute`. Deshalb absolute URL (apiAbsoluteUrl),
   * damit der Request am Angular-Dev-Proxy (`/api`, `/save`) vorbei direkt ans Backend geht.
   */
  execute(id: string, body?: any, query?: Record<string, string>): Observable<string | unknown> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    const hasBody = body !== undefined && body !== null;
    const url = apiAbsoluteUrl(publicKennelPath(id));
    const opts = {
      params,
      observe: 'response' as const,
      responseType: 'text' as const,
    };
    const mapBody = map((resp: HttpResponse<string>) => {
      const raw = resp.body ?? '';
      const ct = resp.headers.get('Content-Type') ?? '';
      if (ct.includes('application/json')) {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return raw;
        }
      }
      return raw;
    });
    if (hasBody) {
      return this.http.post(url, body, opts).pipe(mapBody);
    }
    return this.http.get(url, opts).pipe(mapBody);
  }
}
