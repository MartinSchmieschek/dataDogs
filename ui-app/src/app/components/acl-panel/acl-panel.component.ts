import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AclService } from '../../services/acl.service';
import { AuthService } from '../../services/auth.service';
import type { AclRole, ICollaborators, IUser } from '../../models/user.model';
import { VisibilityBadgeComponent } from '../visibility-badge/visibility-badge.component';

/**
 * Panel for an entity (kennel or node): shows owner + editors + viewers and lets
 * the owner manage them. Loads on mount and on each id/entityType change.
 */
@Component({
    selector: 'app-acl-panel',
    standalone: true,
    imports: [CommonModule, FormsModule, VisibilityBadgeComponent],
    templateUrl: './acl-panel.component.html',
    styleUrls: ['./acl-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AclPanelComponent {
    private acl = inject(AclService);
    private auth = inject(AuthService);

    readonly entityType = input.required<'kennel' | 'node'>();
    readonly id = input.required<string>();

    readonly state = signal<ICollaborators | null>(null);
    readonly loading = signal(false);
    readonly busy = signal(false);
    readonly error = signal<string | null>(null);
    /** Transient info messages for non-error responses (redundant grants, already_owner, etc). */
    readonly info = signal<string | null>(null);

    readonly newUser = signal('');
    readonly newRole = signal<AclRole>('editor');

    /** Only the current owner (or super-user) may release ownership — this drives the button visibility. */
    readonly canRelease = computed(() => {
        const s = this.state();
        const me = this.auth.user();
        if (!s || !me || !s.owner) return false;
        return s.owner.id === me.id;
    });

    constructor() {
        effect(() => {
            const id = this.id();
            const t = this.entityType();
            if (!id || !t) return;
            void this.refresh(t, id);
        });
    }

    async refresh(entityType?: 'kennel' | 'node', id?: string): Promise<void> {
        const et = entityType ?? this.entityType();
        const eid = id ?? this.id();
        if (!et || !eid) return;
        this.loading.set(true);
        this.error.set(null);
        try {
            const data = await this.acl.listCollaborators(et, eid);
            this.state.set(data);
        } catch (err: any) {
            this.error.set(err?.message ?? 'failed to load collaborators');
        } finally {
            this.loading.set(false);
        }
    }

    trackUser = (_: number, u: IUser) => u.id;

    /** Translate API action codes (redundant_*, already_*) into human-readable hints. */
    private translateAction(action: string | undefined): string | null {
        switch (action) {
            case 'already_editor':           return 'User is already an editor.';
            case 'already_viewer':           return 'User is already a viewer.';
            case 'already_owner':            return 'User is already the owner.';
            case 'already_community':        return 'Already a community entity (no owner).';
            case 'redundant_owner_is_editor':  return 'The owner already has full edit rights.';
            case 'redundant_owner_is_viewer':  return 'The owner already has full read rights.';
            case 'redundant_editor_is_viewer': return 'Editor already includes read access — viewer role is implicit.';
            case 'not_present':              return 'User was not in this list.';
            default:                         return null;
        }
    }

    async onGrant(): Promise<void> {
        const user = this.newUser().trim();
        if (!user) return;
        this.busy.set(true);
        this.error.set(null);
        this.info.set(null);
        const r = await this.acl.grantAccess(this.entityType(), this.id(), user, this.newRole());
        if (!r.ok) {
            this.error.set(r.error ?? 'grant failed');
        } else {
            const hint = this.translateAction(r.action);
            if (hint) this.info.set(hint);
        }
        this.newUser.set('');
        this.busy.set(false);
        await this.refresh();
    }

    async onRevoke(role: 'editor' | 'viewer', userId: string): Promise<void> {
        this.busy.set(true);
        this.error.set(null);
        this.info.set(null);
        const r = await this.acl.revokeAccess(this.entityType(), this.id(), userId, role);
        if (!r.ok) {
            this.error.set(r.error ?? 'revoke failed');
        } else {
            const hint = this.translateAction(r.action);
            if (hint) this.info.set(hint);
        }
        this.busy.set(false);
        await this.refresh();
    }

    async onReleaseOwnership(): Promise<void> {
        if (!this.canRelease()) return;
        if (!confirm(
            'Release ownership? This sets the entity back to community-mode — any logged-in user will be able to read and modify it.',
        )) return;
        this.busy.set(true);
        this.error.set(null);
        this.info.set(null);
        const r = await this.acl.releaseOwnership(this.entityType(), this.id());
        if (!r.ok) {
            this.error.set(r.error ?? 'release failed');
        } else {
            const hint = this.translateAction(r.action);
            this.info.set(hint ?? 'Ownership released — entity is now community-editable.');
        }
        this.busy.set(false);
        await this.refresh();
    }
}
