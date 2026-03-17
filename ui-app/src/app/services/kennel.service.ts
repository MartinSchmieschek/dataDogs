import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IKennelConfig } from '../models/kennel-config.model';
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
    return this.http.get<ApiResponse<IKennelConfig>>(`${this.baseUrl}/${id}`);
  }

  create(data: { id: string; name?: string; description?: string; dogIds?: string[] }): Observable<ApiResponse<IKennelConfig>> {
    return this.http.post<ApiResponse<IKennelConfig>>(this.baseUrl, data);
  }

  update(id: string, data: Partial<IKennelConfig>): Observable<ApiResponse<IKennelConfig>> {
    return this.http.put<ApiResponse<IKennelConfig>>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/${id}`);
  }

  run(id: string, body?: any, query?: Record<string, string>): Observable<RunResponse> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    if (body && Object.keys(body).length > 0) {
      return this.http.post<RunResponse>(`${this.baseUrl}/${id}/run`, body, { params });
    }
    return this.http.get<RunResponse>(`${this.baseUrl}/${id}/run`, { params });
  }

  execute(id: string, body?: any, query?: Record<string, string>): Observable<any> {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    if (body) {
      return this.http.post(`${this.baseUrl}/${id}/execute`, body, { params });
    }
    return this.http.get(`${this.baseUrl}/${id}/execute`, { params });
  }
}
