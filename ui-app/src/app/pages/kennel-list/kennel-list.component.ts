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
import { Router } from '@angular/router';
import { KennelService } from '../../services/kennel.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { KennelFormComponent, KennelFormData } from '../../components/kennel-form/kennel-form.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { BackdropDriveService } from '../../services/backdrop-drive.service';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { KennelScenicParallaxBackdropComponent } from '../../components/kennel-scenic-parallax-backdrop/kennel-scenic-parallax-backdrop.component';
import { VoidMythicBackdropComponent } from '../../components/void-mythic-backdrop/void-mythic-backdrop.component';
import { KennelActionFanComponent, type KennelFanAction } from '../../components/kennel-action-fan/kennel-action-fan.component';
import { apiAbsoluteUrl } from '../../config/api-base';
import { KennelCardMotionDirective } from '../../directives/kennel-card-motion.directive';

const KENNEL_LIST_SORT_STORAGE_KEY = 'datadogs.kennelList.sort.v1';

type KennelListSortKey = 'name' | 'id' | 'updated';
type KennelListSortDir = 'asc' | 'desc';

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
    const keys: KennelListSortKey[] = ['name', 'id', 'updated'];
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
  ],
  templateUrl: './kennel-list.component.html',
  styleUrls: ['./kennel-list.component.scss']
})
export class KennelListComponent implements OnInit, OnDestroy {
  private kennelService = inject(KennelService);
  private router = inject(Router);
  private errorVideoPopup = inject(ErrorVideoPopupService);
  private backdropDrive = inject(BackdropDriveService);

  /** iOS: Hinweis ausgeblendet ohne Erlaubnis. */
  compassPromptDismissed = signal(false);

  showCompassPrompt = computed(
    () =>
      this.backdropDrive.iosOrientationRequiresUserGesture() &&
      !this.backdropDrive.deviceOrientationUnlocked() &&
      !this.compassPromptDismissed()
  );

  private kennelScrollRef = viewChild<ElementRef<HTMLElement>>('kennelScroll');

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
  }

  ngOnDestroy(): void {
    this.backdropDrive.detachScrollElement();
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

  kennels = signal<IKennelConfig[]>([]);
  loading = signal(false);
  showCreateForm = signal(false);
  error = signal<string | null>(null);

  searchQuery = signal('');
  sortKey = signal<KennelListSortKey>(initialKennelListSort.sortKey);
  sortDir = signal<KennelListSortDir>(initialKennelListSort.sortDir);

  /** Sort-Buttons neben der Suche ausblenden, solange gefiltert wird (nichtleerer Suchtext). */
  hideSortBesideSearch = computed(() => this.searchQuery().trim().length > 0);

  /** Erhöhen bei Sortwechsel → @for-Track ändert sich, Karten-Animationen laufen erneut. */
  listOrderEpoch = signal(0);

  filteredKennels = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    let list = [...this.kennels()];
    if (q) {
      list = list.filter((k) => {
        const ref = this.kennelRef(k).toLowerCase();
        const name = (k.name || '').toLowerCase();
        const desc = (k.description || '').toLowerCase();
        return ref.includes(q) || name.includes(q) || desc.includes(q);
      });
    }
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (key === 'name') {
        const na = (a.name || this.kennelRef(a)).toLowerCase();
        const nb = (b.name || this.kennelRef(b)).toLowerCase();
        cmp = na.localeCompare(nb, 'de');
      } else if (key === 'id') {
        cmp = this.kennelRef(a).localeCompare(this.kennelRef(b), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      } else {
        const ta = a.updatedAt || a.createdAt || '';
        const tb = b.updatedAt || b.createdAt || '';
        cmp = ta.localeCompare(tb);
      }
      return cmp * dir;
    });
    return list;
  });

  ngOnInit() {
    this.loadKennels();
  }

  onComfortVideoClick(): void {
    this.errorVideoPopup.openPopup(this.error());
  }

  /** Sortierfeld per Klick durchschalten: Name → ID → Zuletzt geändert. */
  cycleSortKey(): void {
    const order: Array<'name' | 'id' | 'updated'> = ['name', 'id', 'updated'];
    const i = order.indexOf(this.sortKey());
    this.sortKey.set(order[(i + 1) % order.length]);
    this.listOrderEpoch.update((n) => n + 1);
  }

  sortKeyLabel(): string {
    switch (this.sortKey()) {
      case 'id':
        return 'ID';
      case 'updated':
        return 'Geändert';
      default:
        return 'Name';
    }
  }

  toggleSortDir(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    this.listOrderEpoch.update((n) => n + 1);
  }

  loadKennels() {
    this.loading.set(true);
    this.error.set(null);
    this.kennelService.getAll().subscribe({
      next: (res) => {
        this.kennels.set(res.data ?? []);
        this.loading.set(false);
        /* Track-Fragment ändern → @for neu aufbauen, Karten-Animation erneut */
        this.listOrderEpoch.update((n) => n + 1);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  /** Anzeige-Emoji; ohne DB-Wert: 🐕 (nur UI, nicht gespeichert). */
  kennelEmojiForList(k: IKennelConfig): string {
    const e = k.emoji?.trim();
    return e || '🐕';
  }

  /** The stable kennel identifier — lineageId for versioned kennels, fallback to id. */
  kennelRef(kennel: IKennelConfig): string {
    return kennel.lineageId || kennel.id;
  }

  /** `/:kennelId` plus gespeicherte `defaultQuery` (für Anzeige und `window.open`). */
  private listPublicExecutePath(kennel: IKennelConfig): string {
    const path = `/${encodeURIComponent(this.kennelRef(kennel))}`;
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
      void this.router.navigate(['/kennel', ref, 'edit']);
      return;
    }
    if (action === 'share') {
      const url = new URL(`/kennel/${encodeURIComponent(ref)}`, window.location.origin).href;
      const title = kennel.name || ref;
      const payload = { title, text: `${title} – DataDogs`, url };
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
      window.open(apiAbsoluteUrl(`/api/kennels/${ref}/docs`), '_blank', 'noopener');
      return;
    }
    if (action === 'swaggerJson') {
      window.open(apiAbsoluteUrl(`/api/kennels/${ref}/swagger.json`), '_blank', 'noopener');
      return;
    }
    if (action === 'waves') {
      void this.router.navigate(['/kennel', ref]);
      return;
    }
    if (action === 'delete') {
      if (!confirm(`Kennel "${kennel.name || ref}" wirklich löschen? Alle Versionen werden entfernt.`)) return;
      this.kennelService.delete(ref).subscribe({
        next: (res) => {
          if (res.ok) {
            this.loadKennels();
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
              this.loadKennels();
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
        dogIds: [],
      })
      .subscribe({
      next: (res) => {
        if (res.ok) {
          // After create, the returned id is the lineageId (user-chosen kennel ID).
          const ref = res.data?.lineageId || res.id || data.id;
          this.router.navigate(['/kennel', ref, 'edit']);
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
