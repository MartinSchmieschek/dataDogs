import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig, KennelVersionEntry } from '../../models/kennel-config.model';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { VersionTimelineComponent, TimelineVersion } from '../../components/version-timeline/version-timeline.component';
import { DogDisplayComponent } from '../../components/dog-display/dog-display.component';
import { VisNetworkComponent } from '../../components/vis-network/vis-network.component';
import { VoidMythicBackdropComponent } from '../../components/void-mythic-backdrop/void-mythic-backdrop.component';
import { GraphCanvasScaleComponent } from '../../components/graph-canvas-scale/graph-canvas-scale.component';
import { DogSidePanelComponent } from '../../components/dog-side-panel/dog-side-panel.component';
import { FloatingPanelWindowComponent } from '../../components/floating-panel-window/floating-panel-window.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { DogToolbarComponent } from '../../components/dog-toolbar/dog-toolbar.component';
import { findKennelDogIndex, graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import { collectDescendantBranchNodeIds } from '../../components/vis-network/graph-layout';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { apiAbsoluteUrl } from '../../config/api-base';

@Component({
  selector: 'app-waves-viewer',
  standalone: true,
  imports: [
    RouterLink, FormsModule,
    GraphCanvasScaleComponent, VoidMythicBackdropComponent, VisNetworkComponent, DogSidePanelComponent,
    FloatingPanelWindowComponent,
    LoadingIndicatorComponent, DogToolbarComponent, DogDisplayComponent, VersionTimelineComponent
  ],
  templateUrl: './waves-viewer.component.html',
  styleUrls: ['./waves-viewer.component.scss']
})
export class WavesViewerComponent implements OnInit {
  /** Skalierung des Dependency-Graphen (Wrapper = „neuer Canvas“). */
  readonly graphCanvasScale = 0.5;

  private route = inject(ActivatedRoute);
  private kennelService = inject(KennelService);
  private dogService = inject(DogService);
  private errorVideoPopup = inject(ErrorVideoPopupService);

  kennelId = '';
  waves = signal<Waves | null>(null);
  kennelConfig = signal<IKennelConfig | null>(null);
  selectedDog = signal<DogEntry | null>(null);
  /** Vom Graph-Fächer: welche Section im Side-Panel aktiv starten soll. */
  panelInitialSection = signal<DogPanelSectionId | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  availableDogs = signal<DogInfo[]>([]);
  isDragOver = false;
  isDragging = false;
  private dragEndTimer: any = null;

  // --- Kennel version timeline ---
  kennelVersions = signal<KennelVersionEntry[]>([]);
  /** The version GUID currently viewed — null means "latest". */
  activeKennelVersionId = signal<string | null>(null);
  selectedKennelVersionId = signal<string | null>(null);

  timelineVersions = computed<TimelineVersion[]>(() => {
    return this.kennelVersions().map(v => ({
      id: v.id,
      version: v.version,
      parentId: v.parentId,
      createdAt: v.createdAt,
      displayName: v.config?.name,
    }));
  });

  get currentKennelVersionId(): string {
    return this.activeKennelVersionId() || this.kennelConfig()?.id || '';
  }

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

  /** Titel der schwebenden Node-Bearbeiten-Fensters. */
  nodePanelTitle = computed(() => {
    const d = this.selectedDog();
    return d ? `Node: ${d.displayName || d.name}` : '';
  });

  /** Append ?version=... to a URL if a specific kennel version is selected. */
  private appendVersionParam(url: string): string {
    const v = this.activeKennelVersionId();
    if (!v) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}version=${encodeURIComponent(v)}`;
  }

  /** Swagger UI & OpenAPI — direkt Express :3000 (neuer Tab, kein Angular-Origin). */
  get swaggerDocsUrl(): string {
    return this.appendVersionParam(apiAbsoluteUrl(`/api/kennels/${this.kennelId}/docs`));
  }

  get swaggerJsonUrl(): string {
    return this.appendVersionParam(apiAbsoluteUrl(`/api/kennels/${this.kennelId}/swagger.json`));
  }

  /**
   * Öffentlicher Kennel-Endpunkt (Lead-Yield): GET `/:kennelId` auf dem Express-Server —
   * nicht `/api/kennels/.../run`. Query-Parameter aus dem Panel werden angehängt.
   */
  get kennelRunBrowserUrl(): string {
    const base = apiAbsoluteUrl(`/${this.kennelId}`);
    const q = this.buildQueryRecord();
    const keys = Object.keys(q).filter((k) => k.trim());
    const params = new URLSearchParams();
    keys.forEach((k) => params.set(k, q[k]));
    const v = this.activeKennelVersionId();
    if (v) params.set('version', v);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  ngOnInit() {
    this.kennelId = this.route.snapshot.params['id'];
    this.loadWaves();
    this.loadAvailableDogs();
    this.loadKennelVersions();
  }

  onComfortVideoClick(): void {
    this.errorVideoPopup.openPopup(this.error());
  }

  loadWaves() {
    this.loading.set(true);
    this.error.set(null);

    const query = this.buildQueryRecord();
    let body: any = undefined;
    try {
      const raw = this.bodyJson().trim();
      // Auch "{}" ist gültig (BodyRetriever / leeres JSON-Objekt).
      if (raw) body = JSON.parse(raw);
    } catch { /* invalid JSON - ignore, send without body */ }

    const version = this.activeKennelVersionId() ?? undefined;
    this.kennelService.run(this.kennelId, body, query, version).subscribe({
      next: (res) => {
        if (res.ok) {
          this.waves.set(res.waves);
          this.kennelConfig.set(res.kennelConfig);
          this.syncParamsFromConfig(res.kennelConfig);
          this.loadKennelVersions();

          const sel = this.selectedDog();
          if (sel) {
            // After re-run, the dog might have a new version ID — match by lineageId first, then by id.
            const updated = this.flatDogList().find(d =>
              d.id === sel.id ||
              (d.lineageId && d.lineageId === sel.lineageId)
            );
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

  loadAvailableDogs() {
    this.dogService.getAll(this.kennelId).subscribe({
      next: (res) => this.availableDogs.set(res.data ?? []),
    });
  }

  private loadKennelVersions() {
    this.kennelService.getVersions(this.kennelId).subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          this.kennelVersions.set(res.data);
        }
      }
    });
  }

  onKennelVersionSelected(versionId: string) {
    this.selectedKennelVersionId.set(versionId);
    // If the selected version is the newest, clear the override so URLs stay clean.
    const versions = this.kennelVersions();
    const newest = versions.length > 0 ? versions[0] : null;
    this.activeKennelVersionId.set(newest?.id === versionId ? null : versionId);
    this.loadWaves();
  }

  onDogSelected(dog: DogEntry) {
    this.panelInitialSection.set(null);
    this.selectedDog.set(dog);
  }

  onDogSectionEdit(ev: { dog: DogEntry; section: DogPanelSectionId }) {
    this.panelInitialSection.set(ev.section);
    this.selectedDog.set(ev.dog);
  }

  onDogDeleted(lineageId: string) {
    this.selectedDog.set(null);
    const config = this.kennelConfig();
    if (!config) return;
    const dog = this.flatDogList().find(d => d.id === lineageId);
    // Remove from kennel dogIds — match version ID, lineageId (lineage), or base:Name.
    const ids = (config.dogIds ?? []).filter(kid =>
      kid !== lineageId &&
      kid !== dog?.lineageId &&
      kid !== `base:${lineageId}` &&
      kid !== `base:${dog?.name}`
    );
    this.kennelService.update(this.kennelId, { dogIds: ids }).subscribe({
      next: () => this.loadWaves(),
    });
  }

  /**
   * B1: Kante Parent→Kind — transitiven Teilbaum ab dem Kind-Knoten aus `dogIds` entfernen, neu laden (ohne Dialog).
   */
  onBranchCutRequested(ev: { fromId: string; toId: string }) {
    const config = this.kennelConfig();
    const waves = this.waves();
    if (!config || !waves?.length) return;

    const branchIds = collectDescendantBranchNodeIds(waves, ev.toId);
    const flat = this.flatDogList();

    const before = [...(config.dogIds ?? [])];
    const nextIds = before.filter(kid => {
      for (const nodeId of branchIds) {
        const dog = flat.find(d => d.id === nodeId);
        if (graphNodeIdMatchesKennelDogId(nodeId, kid, dog?.lineageId)) {
          return false;
        }
      }
      return true;
    });

    if (nextIds.length === before.length) {
      this.error.set('Kein passender dogIds-Eintrag zum Entfernen (ID-Abgleich).');
      return;
    }

    this.kennelService.update(this.kennelId, { dogIds: nextIds }).subscribe({
      next: () => {
        this.selectedDog.set(null);
        this.loadWaves();
        this.loadAvailableDogs();
      },
      error: (err) => this.error.set(err.error?.error ?? err.message ?? 'Kennel-Update fehlgeschlagen'),
    });
  }

  onDogMovedToFirst(lineageId: string) {
    this.reorderKennelDogIds(ids => {
      const idx = findKennelDogIndex(ids, lineageId);
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

  kennelDogLabel(lineageId: string): string {
    if (lineageId.startsWith('base:')) return lineageId.slice('base:'.length);
    // For GUIDs, try to find a matching dog's display name
    const dogs = this.flatDogList();
    const match = dogs.find(d => d.id === lineageId || d.lineageId === lineageId);
    return match?.displayName || match?.name || lineageId.substring(0, 8) + '…';
  }

  iconForKennelDogId(lineageId: string): string | undefined {
    const dogs = this.availableDogs();
    if (lineageId.startsWith('base:')) {
      const name = lineageId.slice('base:'.length);
      const d = dogs.find((x): x is BaseDogInfo => isBaseDog(x) && x.name === name);
      return d?.icon;
    }
    // Match by version ID or lineageId (lineage GUID)
    const d = dogs.find((x): x is SerializedDogInfo => !isBaseDog(x) && (x.id === lineageId || x.lineageId === lineageId));
    return d?.icon;
  }

  /** Find the kennel's dogIds entry that corresponds to this dog (by id or lineageId). */
  getKennelRefForDog(dog: DogEntry): string | null {
    const ids = this.kennelConfig()?.dogIds ?? [];
    // Exact version match
    if (ids.includes(dog.id)) return dog.id;
    // lineageId (latest) match
    if (dog.lineageId && ids.includes(dog.lineageId)) return dog.lineageId;
    return null;
  }

  /** Toggle pin: switch a kennel dogIds entry between lineageId (latest) and version-ID (pinned). */
  onPinChanged(ev: { lineageId: string; versionId: string | null }) {
    const config = this.kennelConfig();
    if (!config) return;
    const ids = [...(config.dogIds ?? [])];
    // Find the entry that currently references this dog (by lineageId or any version of it)
    const idx = ids.findIndex(id => id === ev.lineageId || id === this.selectedDog()?.id);
    if (idx < 0) return;
    // Replace: null versionId → use lineageId (latest); otherwise → use versionId (pinned)
    ids[idx] = ev.versionId ?? ev.lineageId;
    this.kennelService.update(this.kennelId, { dogIds: ids }).subscribe({
      next: () => this.loadWaves(),
    });
  }

  closeSidePanel() {
    this.panelInitialSection.set(null);
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

    const lineageId = event.dataTransfer?.getData('application/dog-id');
    if (!lineageId) return;

    const config = this.kennelConfig();
    if (!config) return;

    const dogIds = [...(config.dogIds ?? []), lineageId];
    this.kennelService.update(this.kennelId, { dogIds }).subscribe({
      next: () => {
        this.loadWaves();
        this.loadAvailableDogs();
      },
    });
  }

  createNewDog() {
    const displayName = `dog-${Date.now()}`;
    this.dogService.create({
      displayName,
      tsCode: '// Neuer Dog\nreturn {};',
    }).subscribe({
      next: (res) => {
        if (res.ok) {
          const config = this.kennelConfig();
          if (config) {
            // Use the lineageId (lineage GUID) so the kennel always loads the latest incarnation.
            const newDogRef = res.data?.lineageId || res.id;
            const dogIds = [...(config.dogIds ?? []), newDogRef];
            this.kennelService.update(this.kennelId, { dogIds }).subscribe({
              next: () => this.loadWaves(),
            });
          }
        }
      },
    });
  }
}
