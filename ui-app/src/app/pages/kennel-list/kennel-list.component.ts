import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, input, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  kennelImportNeedsUserChoice,
  isKennelIdTakenInList,
  isKennelNameTakenInList,
  suggestKennelImportTarget,
  type KennelIdNameListEntry,
} from '../../utils/kennel-import-target';
import { KennelService } from '../../services/kennel.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { KennelFormComponent, KennelFormData } from '../../components/kennel-form/kennel-form.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { VoidMythicBackdropComponent } from '../../components/void-mythic-backdrop/void-mythic-backdrop.component';
import { KennelActionFanComponent, type KennelFanAction } from '../../components/kennel-action-fan/kennel-action-fan.component';
import { apiAbsoluteUrl } from '../../config/api-base';
import { KennelCardMotionDirective } from '../../directives/kennel-card-motion.directive';

@Component({
  selector: 'app-kennel-list',
  standalone: true,
  imports: [
    DatePipe,
    KennelFormComponent,
    LoadingIndicatorComponent,
    VoidMythicBackdropComponent,
    KennelCardMotionDirective,
    KennelActionFanComponent,
  ],
  templateUrl: './kennel-list.component.html',
  styleUrls: ['./kennel-list.component.scss']
})
export class KennelListComponent implements OnInit {
  private kennelService = inject(KennelService);
  private router = inject(Router);
  private errorVideoPopup = inject(ErrorVideoPopupService);

  /** Show the execute path line on each card (default: on). */
  showExecutePath = input(true);

  /**
   * Also show a mirrored path line: path segments reversed (e.g. /execute/ref/kennels/api/…).
   * Display only; the real endpoint is unchanged.
   */
  mirrorExecutePath = input(false);

  kennels = signal<IKennelConfig[]>([]);
  loading = signal(false);
  showCreateForm = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  importDialogOpen = signal(false);
  importDialogBundle = signal<Record<string, unknown> | null>(null);
  importDialogKennelId = signal('');
  importDialogName = signal('');
  importDialogHint = signal('');

  searchQuery = signal('');
  sortKey = signal<'name' | 'id' | 'updated'>('name');
  sortDir = signal<'asc' | 'desc'>('asc');

  /** Hide sort controls beside search while a filter is active (non-empty search). */
  hideSortBesideSearch = computed(() => this.searchQuery().trim().length > 0);

  /** Bumped on sort change so @for track changes and card motion replays. */
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
        cmp = na.localeCompare(nb, 'en');
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

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.importDialogOpen()) {
      e.preventDefault();
      this.closeImportDialog();
    }
  }

  /** Cycle sort field on click: Name → ID → Updated. */
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
        return 'Updated';
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
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  /** List emoji; when missing in DB: 🐕 (UI only, not persisted). */
  kennelEmojiForList(k: IKennelConfig): string {
    const e = k.emoji?.trim();
    return e || '🐕';
  }

  /** The stable kennel identifier — lineageId for versioned kennels, fallback to id. */
  kennelRef(kennel: IKennelConfig): string {
    return kennel.lineageId || kennel.id;
  }

  /** Relative execute path for display (same idea as the reference endpoint line). */
  executePathForDisplay(kennel: IKennelConfig): string {
    const ref = this.kennelRef(kennel);
    let path = `/api/kennels/${ref}/execute`;
    if (kennel.defaultQuery) {
      const params = new URLSearchParams();
      Object.entries(kennel.defaultQuery).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const qs = params.toString();
      if (qs) path += '?' + qs;
    }
    return path;
  }

  /**
   * Same path with segment order reversed (“mirrored”).
   * Query string is kept as a suffix.
   */
  executePathMirroredSegments(kennel: IKennelConfig): string {
    const full = this.executePathForDisplay(kennel);
    const q = full.includes('?') ? full.slice(full.indexOf('?')) : '';
    const pathOnly = q ? full.slice(0, full.indexOf('?')) : full;
    const segments = pathOnly.split('/').filter((s) => s.length > 0);
    const reversed = '/' + segments.slice().reverse().join('/');
    return reversed + q;
  }

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
      if (!confirm(`Delete kennel "${kennel.name || ref}"? All versions will be removed.`)) return;
      this.kennelService.delete(ref).subscribe({
        next: (res) => {
          if (res.ok) {
            this.loadKennels();
          } else {
            this.error.set(res.error ?? 'Delete failed');
          }
        },
        error: (err) => this.error.set(err.error?.error ?? err.message),
      });
    }
  }

  importFromClipboard() {
    this.successMessage.set(null);
    this.error.set(null);
    navigator.clipboard
      .readText()
      .then((text) => {
        let bundle: Record<string, unknown>;
        try {
          bundle = JSON.parse(text) as Record<string, unknown>;
        } catch {
          this.error.set('Clipboard does not contain valid JSON');
          return;
        }
        const kennel = bundle['kennel'] as { kennelId?: string; name?: string } | undefined;
        if (!kennel || !Array.isArray(bundle['dogs'])) {
          this.error.set('Invalid kennel bundle: kennel and dogs[] are required');
          return;
        }
        if (!kennel.kennelId || typeof kennel.kennelId !== 'string' || !kennel.kennelId.trim()) {
          this.error.set('Invalid kennel bundle: kennel.kennelId is required');
          return;
        }
        this.kennelService.getAll().subscribe({
          next: (r) => {
            if (r.data) {
              this.kennels.set(r.data);
            }
            const list = (r.data ?? this.kennels()).map(
              (k) =>
                ({
                  lineageId: k.lineageId,
                  id: k.id,
                  name: k.name,
                }) as KennelIdNameListEntry
            );
            this.proceedWithBundleCheck(bundle, list);
          },
          error: (err) => this.error.set(err.error?.error ?? err.message),
        });
      })
      .catch(() => {
        this.error.set('No clipboard access — grant permission in the browser');
      });
  }

  private setImportDialogConflictHint(
    bundle: { kennel: { kennelId: string; name?: string } },
    existing: KennelIdNameListEntry[]
  ): void {
    const kid = (bundle.kennel.kennelId || '').trim();
    const nm = (bundle.kennel.name && bundle.kennel.name.trim()) || kid;
    const idTaken = isKennelIdTakenInList(kid, existing);
    const nameTaken = isKennelNameTakenInList(nm, existing);
    const parts: string[] = [];
    if (idTaken) {
      parts.push('This kennel id is already in use.');
    }
    if (nameTaken) {
      parts.push('This display name is already taken by another kennel.');
    }
    this.importDialogHint.set(
      parts.length > 0
        ? parts.join(' ') + ' Adjust the fields or accept the suggestions below.'
        : 'Suggestion — edit if needed, then import.'
    );
  }

  private proceedWithBundleCheck(
    bundle: Record<string, unknown>,
    existing: KennelIdNameListEntry[]
  ): void {
    const b = bundle as { kennel: { kennelId: string; name?: string } };
    const s = suggestKennelImportTarget(b, existing);
    if (kennelImportNeedsUserChoice(b, existing)) {
      this.importDialogBundle.set(bundle);
      this.importDialogKennelId.set(s.kennelId);
      this.importDialogName.set(s.name);
      this.setImportDialogConflictHint(b, existing);
      this.importDialogOpen.set(true);
      return;
    }
    this.executeImport(bundle, { kennelId: s.kennelId, name: s.name });
  }

  closeImportDialog(): void {
    this.importDialogOpen.set(false);
    this.importDialogBundle.set(null);
    this.importDialogHint.set('');
  }

  confirmImportDialog(): void {
    const bundle = this.importDialogBundle();
    if (!bundle) return;
    const kennelId = this.importDialogKennelId().trim();
    const name = this.importDialogName().trim() || kennelId;
    this.closeImportDialog();
    this.executeImport(bundle, { kennelId, name });
  }

  private executeImport(
    bundle: Record<string, unknown>,
    target: { kennelId: string; name: string }
  ): void {
    this.error.set(null);
    this.successMessage.set(null);
    this.kennelService.importBundle(bundle, target).subscribe({
      next: (res) => {
        if (res.ok) {
          const displayName = res.name ?? target.name;
          this.loadKennels();
          this.searchQuery.set(displayName);
          this.successMessage.set(
            `Import succeeded. Kennel "${displayName}" (id: ${res.kennelId ?? target.kennelId}) was created.`
          );
        } else {
          this.error.set(res.error ?? 'Import failed');
        }
      },
      error: (err) => this.error.set(err.error?.error ?? err.message),
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

  /** New tab → hit Express (:3000) directly, not the Angular dev server. */
  getExecuteUrl(kennel: IKennelConfig): string {
    const ref = this.kennelRef(kennel);
    let path = `/api/kennels/${ref}/execute`;
    if (kennel.defaultQuery) {
      const params = new URLSearchParams();
      Object.entries(kennel.defaultQuery).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const qs = params.toString();
      if (qs) path += '?' + qs;
    }
    return apiAbsoluteUrl(path);
  }

}
