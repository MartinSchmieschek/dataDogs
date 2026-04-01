import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DogInfo } from '../models/dog.model';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  id?: string;
}

export interface VersionEntry {
  id: string;
  version: number;
  /** The lineage GUID — binds all incarnations across branches */
  lineageId?: string;
  /** The ancestor from which this incarnation was born */
  parentId?: string | null;
  /** When this incarnation was forged */
  createdAt?: string;
  config: {
    theRun: string;
    lineageId?: string;
    parentId?: string | null;
    displayName?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
    [key: string]: any;
  };
}

@Injectable({ providedIn: 'root' })
export class DogService {
  private http = inject(HttpClient);
  private baseUrl = '/api/nodes';

  getAll(kennelId?: string): Observable<ApiResponse<DogInfo[]>> {
    const params = kennelId ? `?kennelId=${encodeURIComponent(kennelId)}` : '';
    return this.http.get<ApiResponse<DogInfo[]>>(`${this.baseUrl}${params}`);
  }

  getById(id: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  getVersions(id: string): Observable<ApiResponse<VersionEntry[]>> {
    return this.http.get<ApiResponse<VersionEntry[]>>(`${this.baseUrl}/${encodeURIComponent(id)}/versions`);
  }

  create(data: {
    displayName?: string;
    baseId?: string;
    tsCode: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.baseUrl, {
      ...data,
      displayName: data.displayName || data.baseId,
    });
  }

  save(id: string, data: {
    tsCode: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`/save?id=${encodeURIComponent(id)}`, data);
  }

  rename(lineageId: string, displayName: string): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(lineageId)}/rename`, { displayName });
  }

  delete(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
