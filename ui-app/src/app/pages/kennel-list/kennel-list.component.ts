import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { KennelService } from '../../services/kennel.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { KennelFormComponent, KennelFormData } from '../../components/kennel-form/kennel-form.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { VoidMythicBackdropComponent } from '../../components/void-mythic-backdrop/void-mythic-backdrop.component';
import {
  KennelActionFanComponent,
  type KennelFanAction,
} from '../../components/kennel-action-fan/kennel-action-fan.component';
import { apiAbsoluteUrl } from '../../config/api-base';

@Component({
  selector: 'app-kennel-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    KennelFormComponent,
    LoadingIndicatorComponent,
    VoidMythicBackdropComponent,
    KennelActionFanComponent,
  ],
  templateUrl: './kennel-list.component.html',
  styleUrls: ['./kennel-list.component.scss']
})
export class KennelListComponent implements OnInit {
  private kennelService = inject(KennelService);
  private router = inject(Router);
  private errorVideoPopup = inject(ErrorVideoPopupService);

  kennels = signal<IKennelConfig[]>([]);
  loading = signal(false);
  showCreateForm = signal(false);
  error = signal<string | null>(null);

  searchQuery = signal('');
  sortKey = signal<'name' | 'id' | 'updated'>('name');
  sortDir = signal<'asc' | 'desc'>('asc');

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

  onSortKeyChange(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === 'name' || v === 'id' || v === 'updated') {
      this.sortKey.set(v);
    }
  }

  toggleSortDir(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
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

  /** Anzeige-Emoji; ohne DB-Wert: 🐕 (nur UI, nicht gespeichert). */
  kennelEmojiForList(k: IKennelConfig): string {
    const e = k.emoji?.trim();
    return e || '🐕';
  }

  hasEmojiStored(k: IKennelConfig): boolean {
    return !!k.emoji?.trim();
  }

  /** The stable kennel identifier — lineageId for versioned kennels, fallback to id. */
  kennelRef(kennel: IKennelConfig): string {
    return kennel.lineageId || kennel.id;
  }

  onFanAction(kennel: IKennelConfig, action: KennelFanAction): void {
    const ref = this.kennelRef(kennel);
    if (action === 'execute') {
      if (this.hasBody(kennel)) {
        this.executeWithBody(kennel);
      } else {
        window.open(this.getExecuteUrl(kennel), '_blank', 'noopener');
      }
      return;
    }
    if (action === 'edit') {
      void this.router.navigate(['/kennel', ref, 'edit']);
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

  /** Neuer Tab → direkt Express (:3000), nicht Angular-Dev-Server. */
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

  hasBody(kennel: IKennelConfig): boolean {
    return kennel.defaultBody !== null && kennel.defaultBody !== undefined;
  }

  executeWithBody(kennel: IKennelConfig) {
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) return;

    const ref = this.kennelRef(kennel);
    let url = `/api/kennels/${ref}/execute`;
    if (kennel.defaultQuery) {
      const params = new URLSearchParams();
      Object.entries(kennel.defaultQuery).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const qs = params.toString();
      if (qs) url += '?' + qs;
    }

    this.kennelService.execute(ref, kennel.defaultBody, kennel.defaultQuery).subscribe({
      next: (result) => {
        if (typeof result === 'string') {
          newWindow.document.write(result);
          newWindow.document.close();
        } else {
          newWindow.document.write('<pre>' + JSON.stringify(result, null, 2) + '</pre>');
          newWindow.document.close();
        }
      },
      error: () => {
        newWindow.close();
      }
    });
  }
}
