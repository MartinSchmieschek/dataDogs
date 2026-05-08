import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AclRole, ICollaborators } from '../models/user.model';

/**
 * ACL operations against the gateway's /actions/* REST endpoints — same backend
 * tools that MCP exposes, just over plain HTTP. Cookie session authenticates;
 * no Bearer token needed from the UI.
 */
@Injectable({ providedIn: 'root' })
export class AclService {
    private http = inject(HttpClient);

    async listCollaborators(entityType: 'kennel' | 'node', id: string): Promise<ICollaborators | null> {
        const resp = await firstValueFrom(
            this.http.post<{ result?: ICollaborators; error?: unknown }>(
                '/actions/list_collaborators',
                { entity_type: entityType, id },
            ),
        );
        return resp?.result ?? null;
    }

    async grantAccess(
        entityType: 'kennel' | 'node',
        id: string,
        user: string,
        role: AclRole,
    ): Promise<{ ok: boolean; error?: string; action?: string }> {
        try {
            const resp = await firstValueFrom(
                this.http.post<{ result?: any; error?: any }>('/actions/grant_access', {
                    entity_type: entityType,
                    id,
                    user,
                    role,
                }),
            );
            if (resp?.error) return { ok: false, error: typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error) };
            return { ok: true, action: resp?.result?.action };
        } catch (err: any) {
            return { ok: false, error: err?.error?.error ?? err?.message ?? 'grant failed' };
        }
    }

    async revokeAccess(
        entityType: 'kennel' | 'node',
        id: string,
        user: string,
        role: 'editor' | 'viewer',
    ): Promise<{ ok: boolean; error?: string; action?: string }> {
        try {
            const resp = await firstValueFrom(
                this.http.post<{ result?: any; error?: any }>('/actions/revoke_access', {
                    entity_type: entityType,
                    id,
                    user,
                    role,
                }),
            );
            if (resp?.error) return { ok: false, error: typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error) };
            return { ok: true, action: resp?.result?.action };
        } catch (err: any) {
            return { ok: false, error: err?.error?.error ?? err?.message ?? 'revoke failed' };
        }
    }

    async releaseOwnership(
        entityType: 'kennel' | 'node',
        id: string,
    ): Promise<{ ok: boolean; error?: string; action?: string }> {
        try {
            const resp = await firstValueFrom(
                this.http.post<{ result?: any; error?: any }>('/actions/release_ownership', {
                    entity_type: entityType,
                    id,
                }),
            );
            if (resp?.error) return { ok: false, error: typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error) };
            return { ok: true, action: resp?.result?.action };
        } catch (err: any) {
            return { ok: false, error: err?.error?.error ?? err?.message ?? 'release failed' };
        }
    }
}
