import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { pickRandomRequiemQuote } from '../../data/requiem-loading';
import { safeReturnTo } from '../../utils/account';

/**
 * S10 Login (P6 U7, 6.4): centred emblem and `SLOPDOGS` in Bebas 28, one quiet 44 px button
 * `[CONTINUE WITH GOOGLE]`, one random verse (small italic, its name as a teal label). `?returnTo=`
 * takes you back after Google — only to a path on this site. Already signed in: straight there.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="card">
        <p class="mark">
          <svg viewBox="0 0 28 28" width="40" height="40" aria-hidden="true">
            <circle cx="14" cy="14" r="14" fill="var(--ink)" />
            <text x="14" y="19.5" text-anchor="middle" font-family="Pirata One, serif" font-size="16" fill="var(--paper)">SD</text>
          </svg>
          <span class="word">SlopDogs</span>
        </p>
        <h1 class="sd-sr-only">Sign in</h1>
        <p class="sd-small sd-muted lead">Sign in to build kennels, rate them and keep your keys.</p>
        <button type="button" class="sd-btn sd-btn--lg go" [disabled]="!auth.isReady()" (click)="continue()">Continue with Google</button>
        <figure class="verse">
          <blockquote class="sd-small">{{ verse.line1 }}<br />{{ verse.line2 }}</blockquote>
          <figcaption><span class="sd-chip sd-chip--live">{{ verse.name }}</span></figcaption>
        </figure>
        <a class="back sd-small" routerLink="/kennels">‹ back to the kennels</a>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100dvh; background: var(--paper); }
    .wrap { display: grid; place-items: center; min-height: 100dvh; padding: var(--s5) var(--gutter); }
    .card { display: flex; flex-direction: column; align-items: center; gap: var(--s4); width: min(400px, 100%); text-align: center; }
    .mark { display: flex; align-items: center; gap: var(--s3); margin: 0; }
    .word { font: 400 28px/1 var(--font-display); letter-spacing: .03em; text-transform: uppercase; padding-top: 3px; }
    .lead { margin: 0; }
    .go { width: 100%; }
    .verse { margin: var(--s3) 0 0; display: flex; flex-direction: column; align-items: center; gap: var(--s2); }
    blockquote { margin: 0; font-style: italic; color: var(--ink-2); }
    .back { color: var(--ink-2); text-decoration: none; border-bottom: 1px solid var(--line-strong); }
  `],
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Where Google sends you back to: a same-site path from `?returnTo=`, else the kennels. */
  readonly target = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => safeReturnTo(q.get('returnTo')))),
    { initialValue: '/kennels' },
  );

  readonly verse = pickRandomRequiemQuote();

  constructor() {
    effect(() => {
      if (!this.auth.isReady() || !this.auth.user()) return;
      const to = this.target();
      untracked(() => void this.router.navigateByUrl(to, { replaceUrl: true }));
    });
  }

  continue(): void {
    this.auth.login(this.target());
  }
}
