import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { DogDisplayComponent } from '../../components/dog-display/dog-display.component';
import { VisNetworkComponent } from '../../components/vis-network/vis-network.component';
import { DogSidePanelComponent } from '../../components/dog-side-panel/dog-side-panel.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { DogToolbarComponent } from '../../components/dog-toolbar/dog-toolbar.component';
import { findKennelDogIndex } from '../../utils/kennel-dog-id-match';

@Component({
  selector: 'app-waves-viewer',
  standalone: true,
  imports: [
    RouterLink, FormsModule,
    VisNetworkComponent, DogSidePanelComponent,
    LoadingIndicatorComponent, DogToolbarComponent, DogDisplayComponent
  ],
  templateUrl: './waves-viewer.component.html',
  styleUrls: ['./waves-viewer.component.scss']
})
export class WavesViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private kennelService = inject(KennelService);
  private dogService = inject(DogService);

  kennelId = '';
  waves = signal<Waves | null>(null);
  kennelConfig = signal<IKennelConfig | null>(null);
  selectedDog = signal<DogEntry | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  availableDogs = signal<DogInfo[]>([]);
  isDragOver = false;
  isDragging = false;
  private dragEndTimer: any = null;

  paramsOpen = false;
  queryParams = signal<Array<{ key: string; value: string }>>([]);
  bodyJson = signal('{}');
  newQueryKey = '';
  newQueryValue = '';
  paramsSaving = signal(false);
  paramsDirty = signal(false);

  flatDogList = computed(() => {
    const w = this.waves();
    if (!w) return [];
    return w.flat();
  });

  ngOnInit() {
    this.kennelId = this.route.snapshot.params['id'];
    this.loadWaves();
    this.loadAvailableDogs();
  }

  loadWaves() {
    this.loading.set(true);
    this.error.set(null);

    const query = this.buildQueryRecord();
    let body: any = undefined;
    try {
      const raw = this.bodyJson().trim();
      if (raw && raw !== '{}') body = JSON.parse(raw);
    } catch { /* invalid JSON - ignore, send without body */ }

    this.kennelService.run(this.kennelId, body, query).subscribe({
      next: (res) => {
        if (res.ok) {
          this.waves.set(res.waves);
          this.kennelConfig.set(res.kennelConfig);
          this.syncParamsFromConfig(res.kennelConfig);

          const sel = this.selectedDog();
          if (sel) {
            const updated = this.flatDogList().find(d => d.id === sel.id);
            this.selectedDog.set(updated ?? null);
          }
        } else {
          this.error.set(res.error ?? 'Fehler beim Laden');
          this.kennelConfig.set(res.kennelConfig ?? null);
          if (res.kennelConfig) this.syncParamsFromConfig(res.kennelConfig);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? err.message);
        this.loading.set(false);
      }
    });
  }

  private syncParamsFromConfig(config: IKennelConfig) {
    if (!this.paramsDirty()) {
      if (config.defaultQuery) {
        this.queryParams.set(
          Object.entries(config.defaultQuery).map(([key, value]) => ({ key, value }))
        );
      } else {
        this.queryParams.set([]);
      }
      this.bodyJson.set(config.defaultBody ? JSON.stringify(config.defaultBody, null, 2) : '{}');
    }
  }

  private buildQueryRecord(): Record<string, string> {
    const result: Record<string, string> = {};
    this.queryParams().forEach(p => {
      if (p.key.trim()) result[p.key] = p.value;
    });
    return result;
  }

  addQueryParam() {
    if (this.newQueryKey.trim()) {
      this.queryParams.set([...this.queryParams(), { key: this.newQueryKey, value: this.newQueryValue }]);
      this.newQueryKey = '';
      this.newQueryValue = '';
      this.paramsDirty.set(true);
    }
  }

  removeQueryParam(index: number) {
    const params = [...this.queryParams()];
    params.splice(index, 1);
    this.queryParams.set(params);
    this.paramsDirty.set(true);
  }

  onQueryParamChange() {
    this.paramsDirty.set(true);
  }

  onBodyJsonChange() {
    this.paramsDirty.set(true);
  }

  saveParams() {
    this.paramsSaving.set(true);
    const defaultQuery: Record<string, string> = {};
    this.queryParams().forEach(p => {
      if (p.key.trim()) defaultQuery[p.key] = p.value;
    });

    let defaultBody: any = undefined;
    try {
      const raw = this.bodyJson().trim();
      if (raw) defaultBody = JSON.parse(raw);
    } catch {
      this.error.set('Body ist kein gültiges JSON');
      this.paramsSaving.set(false);
      return;
    }

    this.kennelService.update(this.kennelId, {
      defaultQuery: Object.keys(defaultQuery).length > 0 ? defaultQuery : undefined,
      defaultBody,
    }).subscribe({
      next: () => {
        this.paramsSaving.set(false);
        this.paramsDirty.set(false);
        this.loadWaves();
      },
      error: (err) => {
        this.paramsSaving.set(false);
        this.error.set(err.message);
      }
    });
  }

  private loadAvailableDogs() {
    this.dogService.getAll().subscribe({
      next: (res) => this.availableDogs.set(res.data ?? []),
    });
  }

  onDogSelected(dog: DogEntry) {
    this.selectedDog.set(dog);
  }

  onDogDeleted(dogId: string) {
    this.selectedDog.set(null);
    this.loadWaves();
  }

  onDogMovedToFirst(dogId: string) {
    this.reorderKennelDogIds(ids => {
      const idx = findKennelDogIndex(ids, dogId);
      if (idx <= 0) return ids;
      const copy = [...ids];
      const [entry] = copy.splice(idx, 1);
      return [entry, ...copy];
    });
  }

  /** Dropdown: gewählter Kennel-dogIds-Eintrag wird Lead (Index 0). */
  onLeadDropdownChange(leadKennelId: string) {
    this.reorderKennelDogIds(ids => {
      const idx = ids.indexOf(leadKennelId);
      if (idx <= 0) return ids;
      const copy = [...ids];
      const [entry] = copy.splice(idx, 1);
      return [entry, ...copy];
    });
  }

  /** Reihenfolge in der Config ändern und neu laden */
  private reorderKennelDogIds(mutate: (ids: string[]) => string[]) {
    const config = this.kennelConfig();
    if (!config) return;
    const before = [...(config.dogIds ?? [])];
    const after = mutate(before);
    if (after.length === before.length && after.every((id, i) => id === before[i])) {
      return;
    }
    this.kennelService.update(this.kennelId, { dogIds: after }).subscribe({
      next: () => this.loadWaves(),
    });
  }

  kennelDogLabel(dogId: string): string {
    return dogId.startsWith('base:') ? dogId.slice('base:'.length) : dogId;
  }

  iconForKennelDogId(dogId: string): string | undefined {
    const dogs = this.availableDogs();
    if (dogId.startsWith('base:')) {
      const name = dogId.slice('base:'.length);
      const d = dogs.find((x): x is BaseDogInfo => isBaseDog(x) && x.name === name);
      return d?.icon;
    }
    const d = dogs.find((x): x is SerializedDogInfo => !isBaseDog(x) && x.id === dogId);
    return d?.icon;
  }

  closeSidePanel() {
    this.selectedDog.set(null);
  }

  onGlobalDragOver() {
    clearTimeout(this.dragEndTimer);
    this.isDragging = true;
  }

  onGlobalDragEnd() {
    clearTimeout(this.dragEndTimer);
    this.dragEndTimer = setTimeout(() => {
      this.isDragging = false;
      this.isDragOver = false;
    }, 100);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (!related || !target.contains(related)) {
      this.isDragOver = false;
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    this.isDragging = false;

    const dogId = event.dataTransfer?.getData('application/dog-id');
    if (!dogId) return;

    const config = this.kennelConfig();
    if (!config) return;

    const dogIds = [...(config.dogIds ?? []), dogId];
    this.kennelService.update(this.kennelId, { dogIds }).subscribe({
      next: () => {
        this.loadWaves();
        this.loadAvailableDogs();
      },
    });
  }

  createNewDog() {
    const baseId = `dog-${Date.now()}`;
    this.dogService.create({
      baseId,
      tsCode: '// Neuer Dog\nreturn {};',
    }).subscribe({
      next: (res) => {
        if (res.ok && res.id) {
          const config = this.kennelConfig();
          if (config) {
            const dogIds = [...(config.dogIds ?? []), res.id];
            this.kennelService.update(this.kennelId, { dogIds }).subscribe({
              next: () => this.loadWaves(),
            });
          }
        }
      },
    });
  }
}
