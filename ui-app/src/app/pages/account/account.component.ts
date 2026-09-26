import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { TokenService, type INewPersonalToken, type IPersonalToken } from '../../services/token.service';
import { UserKeyService } from '../../services/user-key.service';
import type { IUserKey } from '../../models/user-key.model';
import { ACCOUNT_TABS, accountTabOf, type AccountTab } from '../../utils/account';
import { KEYS_NOTICE, KEYSTORE_OFF, keyErrorText } from '../../utils/user-keys';
import { SdTopBarComponent } from '../../components/sd-top-bar/sd-top-bar.component';
import { SdChapterCardComponent } from '../../components/sd-chapter-card/sd-chapter-card.component';
import { SdBannerComponent } from '../../components/sd-banner/sd-banner.component';
import { SdUrlChipComponent } from '../../components/sd-url-chip/sd-url-chip.component';
import { SdTokenRowComponent } from '../../components/sd-token-row/sd-token-row.component';
import { SdKeyRowComponent } from '../../components/sd-key-row/sd-key-row.component';
import { SdKeyFormComponent } from '../../components/sd-key-form/sd-key-form.component';
import { SdTrackSkeletonComponent } from '../../components/sd-track-skeleton/sd-track-skeleton.component';

type ListState = 'idle' | 'loading' | 'ready' | 'error' | 'disabled';

/**
 * S9 Account (P6 U7, 6.4): chapter card `ACCOUNT`, tabs profile · tokens · keys (`?tab=`), max 720.
 * profile: who you are, sign out, the `claude mcp add` box. tokens: personal access tokens over the
 * JSON face of `/auth/tokens` — a new one shows its value once in an ink box. keys: the key store
 * (P4c) — masked rows, the add sheet, delete with a question, the notice that a database reset takes
 * them, and `The key store is off on this server.` without a master key. Signed out: `/login?returnTo=`.
 */
@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    SdTopBarComponent, SdChapterCardComponent, SdBannerComponent, SdUrlChipComponent,
    SdTokenRowComponent, SdKeyRowComponent, SdKeyFormComponent, SdTrackSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tokensApi = inject(TokenService);
  private readonly keysApi = inject(UserKeyService);
  readonly auth = inject(AuthService);

  readonly tabs = ACCOUNT_TABS;
  readonly keysNotice = KEYS_NOTICE;
  readonly keystoreOff = KEYSTORE_OFF;
  readonly tab = signal<AccountTab>('profile');
  readonly user = this.auth.user;
  readonly initial = computed(() => {
    const u = this.user();
    return ((u?.name?.trim() || u?.email || '?').charAt(0) || '?').toUpperCase();
  });
  readonly mcpCommand = `claude mcp add --transport http slopdogs ${typeof window !== 'undefined' ? window.location.origin : ''}/mcp`;

  readonly tokens = signal<IPersonalToken[]>([]);
  readonly tokensState = signal<ListState>('idle');
  readonly freshToken = signal<INewPersonalToken | null>(null);
  readonly tokenBusy = signal<string | null>(null);
  readonly tokenError = signal<string | null>(null);

  readonly keys = signal<IUserKey[]>([]);
  readonly keysState = signal<ListState>('idle');
  readonly keyBusy = signal<string | null>(null);
  readonly keyError = signal<string | null>(null);
  readonly keyFormOpen = signal(false);
  readonly status = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((q) => {
      this.tab.set(accountTabOf(q.get('tab')));
    });
    // Signed out: to the login with the way back. Signed in: load what the open tab shows, once.
    effect(() => {
      if (!this.auth.isReady()) return;
      const user = this.user();
      const tab = this.tab();
      untracked(() => {
        if (!user) {
          void this.router.navigate(['/login'], { queryParams: { returnTo: `/account?tab=${tab}` }, replaceUrl: true });
          return;
        }
        if (tab === 'tokens' && this.tokensState() === 'idle') this.loadTokens();
        if (tab === 'keys' && this.keysState() === 'idle') this.loadKeys();
      });
    }, { allowSignalWrites: true });
  }

  select(tab: AccountTab): void {
    this.status.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
  }

  async signOut(): Promise<void> {
    await this.auth.logout();
    void this.router.navigate(['/kennels']);
  }

  // === Tokens ===

  loadTokens(): void {
    this.tokensState.set('loading');
    this.tokensApi.list().subscribe({
      next: (r) => {
        this.tokens.set(r.tokens ?? []);
        this.tokensState.set('ready');
      },
      error: (err: HttpErrorResponse) => this.failed(err, this.tokensState, this.tokenError, 'tokens'),
    });
  }

  newToken(): void {
    if (this.tokenBusy()) return;
    this.tokenBusy.set('new');
    this.tokenError.set(null);
    this.tokensApi.create().subscribe({
      next: (r) => {
        this.tokenBusy.set(null);
        this.freshToken.set(r.token);
        const { jwt: _value, ...listed } = r.token;
        this.tokens.update((list) => [listed, ...list]);
      },
      error: (err: HttpErrorResponse) => {
        this.tokenBusy.set(null);
        this.tokenError.set(`Couldn't make a token (${err.status || 'network'}).`);
      },
    });
  }

  /** The value leaves the page for good. */
  dismissFresh(): void {
    this.freshToken.set(null);
  }

  revokeToken(t: IPersonalToken): void {
    this.tokenBusy.set(t.jti);
    this.tokenError.set(null);
    this.tokensApi.revoke(t.jti).subscribe({
      next: () => {
        this.tokenBusy.set(null);
        this.tokens.update((list) => list.map((x) => (x.jti === t.jti ? { ...x, status: 'revoked', revokedAt: new Date().toISOString() } : x)));
        if (this.freshToken()?.jti === t.jti) this.freshToken.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.tokenBusy.set(null);
        this.tokenError.set(`Couldn't revoke ${t.jti.slice(0, 8)} (${err.status || 'network'}).`);
      },
    });
  }

  // === Keys ===

  loadKeys(): void {
    this.keysState.set('loading');
    this.keysApi.list().subscribe({
      next: (r) => {
        this.keys.set(r.keys ?? []);
        this.keysState.set('ready');
      },
      error: (err: HttpErrorResponse) => this.failed(err, this.keysState, this.keyError, 'keys'),
    });
  }

  onKeySaved(key: IUserKey): void {
    this.keyFormOpen.set(false);
    this.keys.update((list) => [key, ...list.filter((k) => k.alias !== key.alias)]);
    this.status.set(`Saved ${key.alias}. Its value is not shown again.`);
  }

  deleteKey(key: IUserKey): void {
    this.keyBusy.set(key.alias);
    this.keyError.set(null);
    this.keysApi.remove(key.alias).subscribe({
      next: () => {
        this.keyBusy.set(null);
        this.keys.update((list) => list.filter((k) => k.alias !== key.alias));
        this.status.set(`Deleted ${key.alias}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.keyBusy.set(null);
        this.keyError.set(`Couldn't delete ${key.alias} (${err.status || 'network'}).`);
      },
    });
  }

  /** 401 means the session ended: back to the login. 503 on keys: the store is off. */
  private failed(
    err: HttpErrorResponse,
    state: WritableSignal<ListState>,
    message: WritableSignal<string | null>,
    what: 'tokens' | 'keys',
  ): void {
    if (err.status === 401) {
      void this.router.navigate(['/login'], { queryParams: { returnTo: `/account?tab=${what}` } });
      return;
    }
    if (what === 'keys' && (err.status === 503 || err.error?.error === 'keystore_disabled')) {
      state.set('disabled');
      return;
    }
    // no_identity: the dev super-user has no user of its own — say so instead of a bare 403.
    message.set(what === 'keys' && err.error?.error === 'no_identity'
      ? keyErrorText(err.status, 'no_identity').text
      : `Couldn't load your ${what} (${err.status || 'network'}).`);
    state.set('error');
  }
}
