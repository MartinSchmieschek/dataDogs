import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IKennelConfig, KennelVersionEntry } from '../models/kennel-config.model';
import { Waves } from '../models/dog-entry.model';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  id?: string;
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

  getById(id: string): Observable<ApiResponse<IKennelConfig>> {
    return this.http.get<ApiResponse<IKennelConfig>>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  create(data: {
    id: string;
    name?: string;
    description?: string;
    emoji?: string;
    dogIds?: string[];
  }): Observable<ApiResponse<IKennelConfig>> {
    return this.http.post<ApiResponse<IKennelConfig>>(this.baseUrl, data);
  }

  update(id: string, data: Partial<IKennelConfig>): Observable<ApiResponse<IKennelConfig>> {
    return this.http.put<ApiResponse<IKennelConfig>>(`${this.baseUrl}/${encodeURIComponent(id)}`, data);
  }

  delete(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  getVersions(id: string): Observable<ApiResponse<KennelVersionEntry[]>> {
    return this.http.get<ApiResponse<KennelVersionEntry[]>>(`${this.baseUrl}/${encodeURIComponent(id)}/versions`);
  }

  run(id: string, body?: any, query?: Record<string, string>): Observable<RunResponse> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    // Auch {} ist ein gültiger Body (z. B. BodyRetriever); nicht nur "keys.length > 0".
    const hasBody = body !== undefined && body !== null;
    if (hasBody) {
      return this.http.post<RunResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/run`, body, { params });
    }
    return this.http.get<RunResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/run`, { params });
  }

  execute(id: string, body?: any, query?: Record<string, string>): Observable<any> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    const hasBody = body !== undefined && body !== null;
    if (hasBody) {
      return this.http.post(`${this.baseUrl}/${encodeURIComponent(id)}/execute`, body, { params });
    }
    return this.http.get(`${this.baseUrl}/${encodeURIComponent(id)}/execute`, { params });
  }
}
