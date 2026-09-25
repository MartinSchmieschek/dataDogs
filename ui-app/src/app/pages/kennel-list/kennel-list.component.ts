import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import {
  KennelService,
  type KennelSortDir,
  type KennelSortKey,
  type PagedApiResponse,
} from '../../services/kennel.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { KennelFormComponent, KennelFormData } from '../../components/kennel-form/kennel-form.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { BackdropDriveService } from '../../services/backdrop-drive.service';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { KennelScenicParallaxBackdropComponent } from '../../components/kennel-scenic-parallax-backdrop/kennel-scenic-parallax-backdrop.component';
import { VoidMythicBackdropComponent } from '../../components/void-mythic-backdrop/void-mythic-backdrop.component';
import { KennelActionFanComponent, type KennelFanAction } from '../../components/kennel-action-fan/kennel-action-fan.component';
import { apiAbsoluteUrl } from '../../config/api-base';
import { publicKennelDocsPath, publicKennelOpenApiPath, publicKennelPath } from '../../config/public-paths';
import { KennelCardMotionDirective } from '../../directives/kennel-card-motion.directive';
import { VisibilityBadgeComponent } from '../../components/visibility-badge/visibility-badge.component';
import { AuthService } from '../../services/auth.service';

/** v2: Sortierschlüssel folgen dem Server-Vertrag (`name` | `createdAt` | `updatedAt`). */
const KENNEL_LIST_SORT_STORAGE_KEY = 'slopdogs.kennelList.sort.v2';

/** Seitengröße der Nachlade-Liste. */
const KENNEL_PAGE_SIZE = 20;

type KennelListSortKey = KennelSortKey;
type KennelListSortDir = KennelSortDir;

function readPersistedKennelListSort(): { sortKey: KennelListSortKey; sortDir: KennelListSortDir } {
  const fallback: { sortKey: KennelListSortKey; sortDir: KennelListSortDir } = {
    sortKey: 'name',
    sortDir: 'asc',
  };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(KENNEL_LIST_SORT_STORAGE_KEY);
    if (!raw) return fallback;
    const o = JSON.parse(raw) as { sortKey?: unknown; sortDir?: unknown };
    const keys: KennelListSortKey[] = ['name', 'createdAt', 'updatedAt'];
    const dirs: KennelListSortDir[] = ['asc', 'desc'];
    const sortKey = o.sortKey;
    const sortDir = o.sortDir;
    if (typeof sortKey !== 'string' || !keys.includes(sortKey as KennelListSortKey)) return fallback;
    if (typeof sortDir !== 'string' || !dirs.includes(sortDir as KennelListSortDir)) return fallback;
    return { sortKey: sortKey as KennelListSortKey, sortDir: sortDir as KennelListSortDir };
  } catch {
    return fallback;
  }
}

const initialKennelListSort = readPersistedKennelListSort();

/** Grenzen verschieben sich, wenn sich der Bestand zwischen zwei Seiten ändert — erste Fassung gewinnt. */
function dedupeKennelsById(list: IKennelConfig[]): IKennelConfig[] {
  const seen = new Set<string>();
  return list.filter((k) => (seen.has(k.id) ? false : (seen.add(k.id), true)));
}

type KennelDescHighlightPart = { text: string; match: boolean };

/** Case-insensitive Treffer-Segmente für `<mark>` — kein HTML, nur Fließtext. */
function splitKennelDescForHighlight(text: string, query: string): KennelDescHighlightPart[] {
  const q = query.trim();
  if (!q || !text) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: KennelDescHighlightPart[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }
  return parts;
}

@Component({
  selector: 'app-kennel-list',
  standalone: true,
  imports: [
    DatePipe,
    KennelFormComponent,
    LoadingIndicatorComponent,
    VoidMythicBackdropComponent,
    KennelScenicParallaxBackdropComponent,
    KennelCardMotionDirective,
    KennelActionFanComponent,
    VisibilityBadgeComponent,
  ],
  templateUrl: './kennel-list.component.html',
  styleUrls: ['./kennel-list.component.scss']
})
export class KennelListComponent implements OnInit, OnDestroy {
  private kennelService = inject(KennelService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorVideoPopup = inject(ErrorVideoPopupService);
  private backdropDrive = inject(BackdropDriveService);
  private auth = inject(AuthService);

  /** Authenticated user — exposed so the template can hide owner-only filters when anonymous. */
  readonly authUser = this.auth.user;
  /** When true, only show kennels owned by the current user. Hidden when not logged in. */
  readonly onlyMine = signal(false);

  /** Skip the first auth-effect trigger so we don't double-load alongside ngOnInit. */
  private skipFirstAuthEffect = true;

  /** Skip the first queryParamMap emission — its `q` is already applied before ngOnInit's reload(). */
  private skipFirstQueryParamsEffect = true;
  /** `?new=1` seen but auth state not ready yet — resolved by the auth-gated effect below. */
  private pendingNewFromQuery = signal(false);

  /** iOS: Hinweis ausgeblendet ohne Erlaubnis. */
  compassPromptDismissed = signal(false);

  showCompassPrompt = computed(
    () =>
      this.backdropDrive.iosOrientationRequiresUserGesture() &&
      !this.backdropDrive.deviceOrientationUnlocked() &&
      !this.compassPromptDismissed()
  );

  private kennelScrollRef = viewChild<ElementRef<HTMLElement>>('kennelScroll');
  private loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  /** Rohe Tastatureingaben der Suche — entprellt, bevor daraus eine Abfrage wird. */
  private readonly searchInput = new Subject<string>();
  /** Seitenabrufe; `switchMap` verwirft eine laufende Antwort, sobald eine neue startet. */
  private readonly pageRequests = new Subject<{ offset: number; append: boolean }>();
  private sentinelObserver: IntersectionObserver | null = null;
  /** Letzter abgeschickter Seitenabruf — Grundlage für „Nochmal versuchen". */
  private lastRequest: { offset: number; append: boolean } = { offset: 0, append: false };

  constructor() {
    effect(() => {
      const sortKey = this.sortKey();
      const sortDir = this.sortDir();
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(
          KENNEL_LIST_SORT_STORAGE_KEY,
          JSON.stringify({ sortKey, sortDir })
        );
      } catch {
        /* private mode / quota */
      }
    });

    afterNextRender(() => {
      const host = this.kennelScrollRef()?.nativeElement;
      if (!host) return;
      this.backdropDrive.bindScrollElement(host, { scrollRangePx: 560 });
    });

    // Auth-reactive reload: when login/logout flips the user signal, refresh the list
    // so the visibility filters on the backend kick in for the new identity.
    effect(() => {
      if (!this.auth.isReady()) return;
      const _u = this.auth.user(); // tracked
      if (this.skipFirstAuthEffect) {
        this.skipFirstAuthEffect = false;
        return;
      }
      // Reset onlyMine when logging out — there's no "mine" without a user.
      if (!_u) this.onlyMine.set(false);
      this.reload();
    }, { allowSignalWrites: true });

    // `?new=1` in der URL öffnet das Anlegen-Formular — angemeldet direkt, sonst erst nach Login.
    // Auth-gated, weil `auth.isReady()` beim ersten Tick noch false sein kann.
    effect(() => {
      if (!this.pendingNewFromQuery()) return;
      if (!this.auth.isReady()) return;
      this.pendingNewFromQuery.set(false);
      if (this.auth.user()) {
        this.showCreateForm.set(true);
      } else {
        this.auth.login('/kennels?new=1');
      }
    }, { allowSignalWrites: true });

    // `?q=` in der URL übernimmt die Suche; ngOnInit's reload() lädt danach die erste Seite,
    // deshalb ruft nur eine spätere (nicht die erste) Emission reload() selbst auf.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const isFirst = this.skipFirstQueryParamsEffect;
      this.skipFirstQueryParamsEffect = false;
      const q = params.get('q');
      if (q !== null) {
        this.searchQuery.set(q);
        this.appliedQuery.set(q);
        if (!isFirst) this.reload();
      }
      if (params.get('new') === '1') {
        this.pendingNewFromQuery.set(true);
      }
    });

    // Sentinel am Listenende beobachten. Läuft neu, sobald das Element erscheint
    // oder verschwindet (alles geladen / Fehler); die Registrierung endet mit der Komponente.
    effect((onCleanup) => {
      const sentinel = this.loadMoreSentinel()?.nativeElement;
      if (!sentinel || typeof IntersectionObserver === 'undefined') return;
      const root = this.kennelScrollRef()?.nativeElement ?? null;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) this.loadMore();
        },
        { root, rootMargin: '240px' }
      );
      observer.observe(sentinel);
      this.sentinelObserver = observer;
      onCleanup(() => {
        observer.disconnect();
        if (this.sentinelObserver === observer) this.sentinelObserver = null;
      });
    });

    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.appliedQuery.set(value.trim());
        this.reload();
      });

    this.pageRequests
      .pipe(
        tap((req) => {
          this.lastRequest = req;
          this.error.set(null);
          if (req.append) this.loadingMore.set(true);
          else this.loading.set(true);
        }),
        switchMap((req) =>
          this.kennelService
            .getPage({
              limit: KENNEL_PAGE_SIZE,
              offset: req.offset,
              q: this.appliedQuery(),
              mine: this.onlyMine(),
              sort: this.sortKey(),
              dir: this.sortDir(),
            })
            .pipe(
              map((res) => ({ req, res, failure: null as string | null })),
              catchError((err) =>
                of({
                  req,
                  res: null as PagedApiResponse<IKennelConfig> | null,
                  failure: (err?.error?.error ?? err?.message ?? 'Laden fehlgeschlagen') as string,
                })
              )
            )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ req, res, failure }) => this.applyPage(req, res, failure));
  }

  ngOnDestroy(): void {
    this.backdropDrive.detachScrollElement();
    this.sentinelObserver?.disconnect();
    this.sentinelObserver = null;
  }

  async onCompassAllow(): Promise<void> {
    const ok = await this.backdropDrive.requestDeviceOrientationPermission();
    if (!ok) {
      this.compassPromptDismissed.set(true);
    }
  }

  onCompassDismiss(): void {
    this.compassPromptDismissed.set(true);
  }

  /** Execute-Pfad-Zeile in der Karte anzeigen (Standard: ja). */
  showExecutePath = input(true);

  /**
   * Zusätzlich eine gespiegelte Pfad-Zeile: URL-Pfadsegmente in umgekehrter Reihenfolge.
   * Nur Optik / Lesbarkeit; der tatsächliche Endpoint bleibt unverändert.
   */
  mirrorExecutePath = input(false);

  /** Die bereits geladenen Seiten, in Serverreihenfolge. */
  kennels = signal<IKennelConfig[]>([]);
  /** Treffer insgesamt (nach `q`/`mine`, vor der Seitenbildung) — Quelle für „n von m". */
  total = signal(0);
  /** Offset der nächsten Seite; zählt die tatsächlich gelieferten Einträge, nicht die entdoppelten. */
  private nextOffset = signal(0);
  loading = signal(false);
  loadingMore = signal(false);
  showCreateForm = signal(false);
  error = signal<string | null>(null);

  /** Rohwert des Eingabefelds (sofortige Anzeige). */
  searchQuery = signal('');
  /** Der entprellte Suchtext, mit dem der Server tatsächlich gefragt wurde. */
  appliedQuery = signal('');
  sortKey = signal<KennelListSortKey>(initialKennelListSort.sortKey);
  sortDir = signal<KennelListSortDir>(initialKennelListSort.sortDir);

  /** Sort-Buttons neben der Suche ausblenden, solange gefiltert wird (nichtleerer Suchtext). */
  hideSortBesideSearch = computed(() => this.searchQuery().trim().length > 0);

  /** Erhöhen bei Sortwechsel → @for-Track ändert sich, Karten-Animationen laufen erneut. */
  listOrderEpoch = signal(0);

  /** Volllast-Schleier nur beim allerersten Laden — sonst flackert jede Suche. */
  showInitialLoading = computed(() => this.loading() && this.kennels().length === 0);
  /** Ersetzender Ladevorgang über einer schon gefüllten Liste. */
  showRefreshing = computed(() => this.loading() && this.kennels().length > 0);
  hasMore = computed(() => this.nextOffset() < this.total());
  /** Suche oder „nur meine" ist aktiv — unterscheidet „keine Treffer" von „gar nichts da". */
  isFiltered = computed(() => this.appliedQuery().length > 0 || this.onlyMine());

  ngOnInit() {
    this.reload();
  }

  /** Erste Seite neu holen und die Liste ersetzen. */
  reload(): void {
    this.pageRequests.next({ offset: 0, append: false });
  }

  /** Nächste Seite anhängen — no-op, solange etwas läuft oder alles geladen ist. */
  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.pageRequests.next({ offset: this.nextOffset(), append: true });
  }

  /** Nach einem Fehler genau den gescheiterten Abruf wiederholen. */
  retry(): void {
    this.pageRequests.next(this.lastRequest);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchInput.next(value);
  }

  onOnlyMineToggle(): void {
    this.onlyMine.set(!this.onlyMine());
    this.reload();
  }

  private applyPage(
    req: { offset: number; append: boolean },
    res: PagedApiResponse<IKennelConfig> | null,
    failure: string | null
  ): void {
    this.loading.set(false);
    this.loadingMore.set(false);
    if (failure !== null || !res) {
      this.error.set(failure ?? 'Laden fehlgeschlagen');
      return;
    }
    const page = res.data ?? [];
    if (req.append && page.length === 0) {
      // Nichts mehr da, obwohl `total` mehr versprach (Bestand hat sich verschoben):
      // Liste als vollständig markieren, sonst feuert das Sentinel endlos.
      this.total.set(this.nextOffset());
      return;
    }
    // Ohne `total` hat der Server die Seitenparameter ignoriert (älterer Stand):
    // dann ist die Antwort bereits die vollständige Liste.
    const total = res.total ?? (req.append ? this.total() : page.length);
    this.kennels.update((current) =>
      req.append ? dedupeKennelsById([...current, ...page]) : dedupeKennelsById(page)
    );
    this.total.set(total);
    this.nextOffset.set(req.offset + page.length);
    if (!req.append) {
      // Nach oben, sonst steht das Sentinel sofort wieder im Bild und zieht ungefragt Seite 2.
      this.kennelScrollRef()?.nativeElement.scrollTo({ top: 0 });
      /* Track-Fragment ändern → @for neu aufbauen, Karten-Animation erneut */
      this.listOrderEpoch.update((n) => n + 1);
    }
  }

  onComfortVideoClick(): void {
    this.errorVideoPopup.openPopup(this.error());
  }

  /** Sortierfeld per Klick durchschalten: Name → Erstellt → Geändert (Server-Vertrag). */
  cycleSortKey(): void {
    const order: KennelListSortKey[] = ['name', 'createdAt', 'updatedAt'];
    const i = order.indexOf(this.sortKey());
    this.sortKey.set(order[(i + 1) % order.length]);
    this.reload();
  }

  sortKeyLabel(): string {
    switch (this.sortKey()) {
      case 'createdAt':
        return 'Erstellt';
      case 'updatedAt':
        return 'Geändert';
      default:
        return 'Name';
    }
  }

  toggleSortDir(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    this.reload();
  }

  /** Anzeige-Emoji; ohne DB-Wert: 🐕 (nur UI, nicht gespeichert). */
  kennelEmojiForList(k: IKennelConfig): string {
    const e = k.emoji?.trim();
    return e || '🐕';
  }

  /** Suchtext trifft die Beschreibung — Karte klappt Beschreibung auf + Highlight. */
  descriptionMatchesSearch(k: IKennelConfig): boolean {
    const q = this.appliedQuery().toLowerCase();
    if (!q) return false;
    return (k.description || '').toLowerCase().includes(q);
  }

  descriptionHighlightParts(k: IKennelConfig): KennelDescHighlightPart[] {
    return splitKennelDescForHighlight(k.description || '', this.appliedQuery());
  }

  /** The stable kennel identifier — lineageId for versioned kennels, fallback to id. */
  kennelRef(kennel: IKennelConfig): string {
    return kennel.lineageId || kennel.id;
  }

  /** `/k/:kennelId` plus gespeicherte `defaultQuery` (für Anzeige und `window.open`). */
  private listPublicExecutePath(kennel: IKennelConfig): string {
    const path = publicKennelPath(this.kennelRef(kennel));
    const dq = kennel.defaultQuery;
    if (!dq || typeof dq !== 'object') return path;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(dq)) {
      if (!k.trim()) continue;
      params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  /**
   * Angezeigter Aufruf-Pfad — gleiche Logik wie der Play-Tab (`defaultQuery` in der URL, `defaultBody` nur serverseitig).
   */
  executePathForDisplay(kennel: IKennelConfig): string {
    return this.listPublicExecutePath(kennel);
  }

  /**
   * Derselbe Pfad mit umgekehrter Segmentreihenfolge (Pfad „gespiegelt“).
   * Query-String bleibt angehängt.
   */
  executePathMirroredSegments(kennel: IKennelConfig): string {
    const full = this.executePathForDisplay(kennel);
    const q = full.includes('?') ? full.slice(full.indexOf('?')) : '';
    const pathOnly = q ? full.slice(0, full.indexOf('?')) : full;
    const segments = pathOnly.split('/').filter((s) => s.length > 0);
    const reversed = '/' + segments.slice().reverse().join('/');
    return reversed + q;
  }

  /** Neuer Tab: öffentlicher GET — URL enthält gespeicherte `defaultQuery`; `defaultBody` kommt aus der Config (Server). */
  onExecute(kennel: IKennelConfig): void {
    window.open(this.getExecuteUrl(kennel), '_blank', 'noopener');
  }

  onFanAction(kennel: IKennelConfig, action: KennelFanAction): void {
    const ref = this.kennelRef(kennel);
    if (action === 'edit') {
      void this.router.navigate(['/kennels', ref, 'edit']);
      return;
    }
    if (action === 'share') {
      const url = apiAbsoluteUrl(this.listPublicExecutePath(kennel));
      const title = kennel.name || ref;
      const payload = { title, text: `${title} – SlopDogs`, url };
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        void navigator.share(payload).catch(() => {
          void navigator.clipboard?.writeText(url);
        });
      } else {
        void navigator.clipboard?.writeText(url).catch(() => {});
      }
      return;
    }
    if (action === 'copy') {
      this.copyKennelBundle(kennel);
      return;
    }
    if (action === 'swagger') {
      window.open(apiAbsoluteUrl(publicKennelDocsPath(ref)), '_blank', 'noopener');
      return;
    }
    if (action === 'swaggerJson') {
      window.open(apiAbsoluteUrl(publicKennelOpenApiPath(ref)), '_blank', 'noopener');
      return;
    }
    if (action === 'waves') {
      void this.router.navigate(['/kennels', ref]);
      return;
    }
    if (action === 'delete') {
      if (!confirm(`Kennel "${kennel.name || ref}" wirklich löschen? Alle Versionen werden entfernt.`)) return;
      this.kennelService.delete(ref).subscribe({
        next: (res) => {
          if (res.ok) {
            this.reload();
          } else {
            this.error.set(res.error ?? 'Löschen fehlgeschlagen');
          }
        },
        error: (err) => this.error.set(err.error?.error ?? err.message),
      });
    }
  }

  /** Kennel-Bundle (Config + Dogs) als JSON in die Zwischenablage kopieren. */
  copyKennelBundle(kennel: IKennelConfig) {
    const ref = this.kennelRef(kennel);
    this.kennelService.exportBundle(ref).subscribe({
      next: (bundle: any) => {
        const json = JSON.stringify(bundle, null, 2);
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(json).catch(() => {
            this.downloadJsonFallback(json, ref);
          });
        } else {
          this.downloadJsonFallback(json, ref);
        }
      },
      error: (err) => this.error.set(err.error?.error ?? err.message ?? 'Export fehlgeschlagen'),
    });
  }

  private downloadJsonFallback(json: string, ref: string) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ref}.kennel.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importFromClipboard() {
    navigator.clipboard.readText().then(text => {
      try {
        const bundle = JSON.parse(text);
        this.kennelService.importBundle(bundle).subscribe({
          next: (res) => {
            if (res.ok) {
              this.reload();
            } else {
              this.error.set(res.error ?? 'Import fehlgeschlagen');
            }
          },
          error: (err) => this.error.set(err.error?.error ?? err.message),
        });
      } catch {
        this.error.set('Clipboard enthält kein gültiges JSON');
      }
    }).catch(() => {
      this.error.set('Kein Zugriff auf Clipboard — bitte Berechtigung erteilen');
    });
  }

  onCreateKennel(data: KennelFormData) {
    this.kennelService
      .create({
        id: data.id,
        name: data.name,
        description: data.description,
        emoji: data.emoji.trim() || undefined,
        visibility: data.visibility,
        dogIds: [],
      })
      .subscribe({
      next: (res) => {
        if (res.ok) {
          // After create, the returned id is the lineageId (user-chosen kennel ID).
          const ref = res.data?.lineageId || res.id || data.id;
          this.router.navigate(['/kennels', ref, 'edit']);
        }
      },
      error: (err) => {
        this.error.set(err.message);
      }
    });
  }

  /** Absoluter Tab-URL zum öffentlichen Kennel-GET (inkl. `defaultQuery` aus der Liste). */
  getExecuteUrl(kennel: IKennelConfig): string {
    return apiAbsoluteUrl(this.listPublicExecutePath(kennel));
  }
}
