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
  config: {
    theRun: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
    [key: string]: any;
  };
}

@Injectable({ providedIn: 'root' })
export class DogService {
  private http = inject(HttpClient);
  private baseUrl = '/api/nodes';

  getAll(): Observable<ApiResponse<DogInfo[]>> {
    return this.http.get<ApiResponse<DogInfo[]>>(this.baseUrl);
  }

  getById(id: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse>(`${this.baseUrl}/${id}`);
  }

  getVersions(id: string): Observable<ApiResponse<VersionEntry[]>> {
    const cleanId = encodeURIComponent(id);
    return this.http.get<ApiResponse<VersionEntry[]>>(`${this.baseUrl}/${cleanId}/versions`);
  }

  create(data: {
    baseId: string;
    tsCode: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.baseUrl, data);
  }

  save(id: string, data: {
    tsCode: string;
    icon?: string;
    parentsRequired?: string[];
    parentsOptional?: string[];
  }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`/save?id=${encodeURIComponent(id)}`, data);
  }

  delete(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/${id}`);
  }
}
