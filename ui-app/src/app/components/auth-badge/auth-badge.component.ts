import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

/**
 * Top-right floating pill: shows current user (or a login button) plus a logout/menu.
 * Polls /auth/me once on init via the AuthService signals.
 */
@Component({
    selector: 'app-auth-badge',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './auth-badge.component.html',
    styleUrls: ['./auth-badge.component.scss'],
})
export class AuthBadgeComponent implements OnInit {
    private auth = inject(AuthService);

    readonly user = this.auth.user;
    readonly isReady = this.auth.isReady;
    readonly menuOpen = signal(false);

    readonly initial = computed(() => {
        const u = this.user();
        if (!u) return '?';
        const src = (u.name?.trim() || u.email).trim();
        return src.charAt(0).toUpperCase();
    });

    async ngOnInit(): Promise<void> {
        await this.auth.refresh();
    }

    toggleMenu(): void {
        this.menuOpen.update((v) => !v);
    }

    closeMenu(): void {
        this.menuOpen.set(false);
    }

    onLogin(): void {
        this.auth.login();
    }

    async onLogout(): Promise<void> {
        await this.auth.logout();
        this.menuOpen.set(false);
    }
}
