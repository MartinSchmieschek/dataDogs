import { Component, inject, signal, OnInit, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig, KennelVersionEntry, IKennelNodeAnnotation, IKennelEdgeAnnotation } from '../../models/kennel-config.model';
import { kennelRefForDog } from '../../utils/kennel-ref-for-dog';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { VersionTimelineComponent, TimelineVersion } from '../../components/version-timeline/version-timeline.component';
import { VisNetworkComponent } from '../../components/vis-network/vis-network.component';
import { VoidMythicBackdropComponent } from '../../components/void-mythic-backdrop/void-mythic-backdrop.component';
import { GraphCanvasScaleComponent } from '../../components/graph-canvas-scale/graph-canvas-scale.component';
import { DogSidePanelComponent } from '../../components/dog-side-panel/dog-side-panel.component';
import { findKennelDogIndex, graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import { collectDescendantBranchNodeIds } from '../../components/vis-network/graph-layout';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { apiAbsoluteUrl } from '../../config/api-base';
import { WavesAppBarComponent, AppBarStatus, OverflowItem } from './components/waves-app-bar.component';
import { WavesInspectorComponent, InspectorTab } from './components/waves-inspector.component';
import { WavesJsonEditorComponent } from './components/waves-json-editor.component';
import { WavesDogPaletteComponent } from './components/waves-dog-palette.component';
import { WavesConfirmDialogComponent } from './components/waves-confirm-dialog.component';

type KennelTab = 'kennel' | 'versions';

@Component({
  selector: 'app-waves-viewer',
  standalone: true,
  imports: [
    FormsModule,
    GraphCanvasScaleComponent, VoidMythicBackdropComponent, VisNetworkComponent, DogSidePanelComponent,
    VersionTimelineComponent,
    WavesAppBarComponent, WavesInspectorComponent, WavesJsonEditorComponent, WavesDogPaletteComponent, WavesConfirmDialogComponent,
  ],
  templateUrl: './waves-viewer.component.html',
  styleUrls: ['./waves-viewer.component.scss']
})
export class WavesViewerComponent implements OnInit {
  /** Skalierung des Dependency-Graphen (Wrapper = „neuer Canvas“). */
  readonly graphCanvasScale = 0.5;

  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
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

  queryParams = signal<Array<{ key: string; value: string }>>([]);
  bodyJson = signal('{}');
  newQueryKey = '';
  newQueryValue = '';
  paramsSaving = signal(false);
  paramsDirty = signal(false);

  // --- Layout / annotations / task state ---
  /** Layout-Map keyed by kennel-dogIds-Ref (lineageId, base:Name, or version ID). */
  layoutNodes = signal<IKennelNodeAnnotation[]>([]);
  /** Edge-Kommentare keyed by (fromRef, toRef) — same identity rules as nodes. */
  layoutEdges = signal<IKennelEdgeAnnotation[]>([]);
  /** Global kennel-task text (markdown-fähig). */
  taskText = signal('');
  /** True if any layout/comment/task change is unsaved. */
  layoutDirty = signal(false);
  layoutSaving = signal(false);
  /** Edge whose comment editor is currently open in the canvas. */
  editingEdgeKey = signal<{ fromId: string; toId: string } | null>(null);
  edgeCommentDraft = '';

  // === Inspector / Palette UI state ===
  /** Kennel-inspector drawer (Aufgabe/Query/Body/Versions). */
  readonly kennelInspectorOpen = signal(false);
  /** Active tab inside the kennel inspector. */
  readonly kennelInspectorTab = signal<KennelTab>('kennel');
  /** Dog-palette drawer / side-rail visible? */
  readonly paletteOpen = signal(false);
  /** Edge-cut staged but not confirmed yet — drives confirm dialog. */
  readonly pendingCut = signal<{ fromId: string; toId: string } | null>(null);

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

  // === App-bar derived state ===

  readonly appBarStatus = computed<AppBarStatus>(() => {
    if (this.error()) return { kind: 'error', label: 'Fehler beim letzten Run' };
    if (this.layoutDirty() || this.paramsDirty()) return { kind: 'dirty', label: 'Ungespeicherte Änderungen' };
    return { kind: 'ok', label: 'Aktuell' };
  });

  readonly appBarSubtitle = computed<string | null>(() => {
    const dogs = this.flatDogList();
    const cfg = this.kennelConfig();
    const parts: string[] = [];
    if (cfg?.dogIds?.length) parts.push(`${cfg.dogIds.length} Dogs`);
    else if (dogs.length) parts.push(`${dogs.length} Dogs`);
    const v = this.kennelVersions()[0]?.version;
    if (typeof v === 'number') parts.push(`v${v}`);
    return parts.length ? parts.join(' · ') : null;
  });

  readonly appBarChips = computed(() => ([
    {
      id: 'kennel',
      label: 'Kennel',
      dirty: this.layoutDirty() || this.paramsDirty(),
      active: this.kennelInspectorOpen() && this.kennelInspectorTab() === 'kennel',
    },
  ]));

  readonly overflowItems = computed<OverflowItem[]>(() => {
    const items: OverflowItem[] = [];
    items.push({
      id: 'open-kennel',
      label: 'Kennel bearbeiten',
      dirty: this.layoutDirty() || this.paramsDirty(),
    });
    if (this.timelineVersions().length > 1) {
      items.push({ id: 'open-versions', label: 'Versionen' });
    }
    if (this.layoutDirty() || this.paramsDirty()) {
      items.push({
        id: 'save-kennel',
        label: this.layoutSaving() || this.paramsSaving() ? 'Speichert…' : 'Alles speichern',
        enabled: !this.layoutSaving() && !this.paramsSaving(),
      });
    }
    items.push({ id: 'palette', label: 'Dogs hinzufügen' });
    items.push({ id: 'open-swagger', label: 'Swagger JSON', href: this.swaggerJsonUrl, external: true });
    items.push({ id: 'export', label: 'Als JSON exportieren' });
    return items;
  });

  readonly kennelInspectorTabs = computed<InspectorTab[]>(() => {
    // Tab bar only shown when there's more than one tab (Versions).
    if (this.timelineVersions().length <= 1) return [];
    return [
      { id: 'kennel', label: 'Bearbeiten', dirty: this.layoutDirty() || this.paramsDirty() },
      { id: 'versions', label: 'Versionen', badge: this.timelineVersions().length },
    ];
  });

  openKennelInspector(tab: KennelTab): void {
    this.kennelInspectorTab.set(tab);
    this.kennelInspectorOpen.set(true);
  }

  onAppBarChip(id: string): void {
    if (id === 'kennel' || id === 'versions') {
      this.openKennelInspector(id);
    }
  }

  onOverflowAction(id: string): void {
    switch (id) {
      case 'open-kennel': this.openKennelInspector('kennel'); return;
      case 'open-versions': this.openKennelInspector('versions'); return;
      case 'save-kennel': this.saveKennel(); return;
      case 'palette': this.paletteOpen.set(true); return;
      case 'export': this.exportKennel(); return;
    }
  }

  /** Save both task/layout and query/body in one go — one button, one signal. */
  saveKennel(): void {
    if (this.paramsDirty()) this.saveParams();
    if (this.layoutDirty()) this.saveLayout();
  }

  onPaletteAdd(dogRef: string): void {
    const cfg = this.kennelConfig();
    if (!cfg) return;
    const dogIds = [...(cfg.dogIds ?? []), dogRef];
    this.kennelService.update(this.kennelId, { dogIds }).subscribe({
      next: () => {
        this.loadWaves();
        this.loadAvailableDogs();
      },
    });
  }

  /** Auto-close kennel inspector if there's nothing relevant to show on the active tab. */
  closeKennelInspector(): void {
    this.kennelInspectorOpen.set(false);
  }

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
    const base = apiAbsoluteUrl(`/${encodeURIComponent(this.kennelId)}`);
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
    // Route-Reuse: bei Wechsel /kennel/A → /kennel/B bleibt dieselbe Component-Instanz —
    // snapshot.params wäre sonst stale und PUT/GET würden den falschen Kennel treffen.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      const id = pm.get('id');
      if (!id) return;
      this.kennelId = id;
      this.selectedDog.set(null);
      this.panelInitialSection.set(null);
      this.activeKennelVersionId.set(null);
      this.selectedKennelVersionId.set(null);
      this.paramsDirty.set(false);
      this.layoutDirty.set(false);
      this.editingEdgeKey.set(null);
      this.edgeCommentDraft = '';
      this.error.set(null);
      this.loadWaves();
      this.loadAvailableDogs();
      this.loadKennelVersions();
    });
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
    if (!this.layoutDirty()) {
      this.layoutNodes.set(Array.isArray(config.nodes) ? config.nodes.map(n => ({ ...n })) : []);
      this.layoutEdges.set(Array.isArray(config.edges) ? config.edges.map(e => ({ ...e })) : []);
      this.taskText.set(config.task ?? '');
    }
  }

  /** Compute a stable kennel-ref for a DogEntry (lineageId, base:Name, or version ID). */
  kennelRefForDog(dog: DogEntry): string {
    return kennelRefForDog(dog, this.kennelConfig()?.dogIds ?? []);
  }

  /** Current node comment (if any) for the selected dog — fed into the side panel. */
  commentForSelectedDog = computed<string | null>(() => {
    const dog = this.selectedDog();
    if (!dog) return null;
    const ref = kennelRefForDog(dog, this.kennelConfig()?.dogIds ?? []);
    return this.layoutNodes().find(n => n.id === ref)?.comment ?? null;
  });

  /** Map of layout positions keyed by current Wave-DogEntry instance ID — feeds vis-network. */
  nodePositionsForGraph = computed<Map<string, { x: number; y: number }>>(() => {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    const out = new Map<string, { x: number; y: number }>();
    if (!cfg || dogs.length === 0) return out;
    for (const ann of this.layoutNodes()) {
      if (ann.x == null || ann.y == null) continue;
      const dog = dogs.find(d => kennelRefForDog(d, cfg.dogIds ?? []) === ann.id);
      if (dog) out.set(dog.id, { x: ann.x, y: ann.y });
    }
    return out;
  });

  /** Map of node comments keyed by current Wave-DogEntry instance ID. */
  nodeCommentsForGraph = computed<Map<string, string>>(() => {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    const out = new Map<string, string>();
    if (!cfg || dogs.length === 0) return out;
    for (const ann of this.layoutNodes()) {
      if (!ann.comment) continue;
      const dog = dogs.find(d => kennelRefForDog(d, cfg.dogIds ?? []) === ann.id);
      if (dog) out.set(dog.id, ann.comment);
    }
    return out;
  });

  /** Edge comments keyed as "fromInstanceId|toInstanceId" for the current waves. */
  edgeCommentsForGraph = computed<Map<string, string>>(() => {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    const out = new Map<string, string>();
    if (!cfg || dogs.length === 0) return out;
    const refToInstanceIds = new Map<string, string[]>();
    for (const dog of dogs) {
      const ref = kennelRefForDog(dog, cfg.dogIds ?? []);
      const arr = refToInstanceIds.get(ref) ?? [];
      arr.push(dog.id);
      refToInstanceIds.set(ref, arr);
    }
    for (const ann of this.layoutEdges()) {
      if (!ann.comment) continue;
      const fromIds = refToInstanceIds.get(ann.fromId) ?? [];
      const toIds = refToInstanceIds.get(ann.toId) ?? [];
      for (const fId of fromIds) {
        for (const tId of toIds) {
          out.set(`${fId}|${tId}`, ann.comment);
        }
      }
    }
    return out;
  });

  onNodePositionsChanged(positions: Map<string, { x: number; y: number }>) {
    const cfg = this.kennelConfig();
    const dogs = this.flatDogList();
    if (!cfg) return;
    const byRef = new Map<string, { x: number; y: number }>();
    for (const [instId, pos] of positions) {
      const dog = dogs.find(d => d.id === instId);
      if (!dog) continue;
      byRef.set(kennelRefForDog(dog, cfg.dogIds ?? []), pos);
    }
    const existing = this.layoutNodes();
    const seenRefs = new Set<string>();
    const next: IKennelNodeAnnotation[] = existing.map(ann => {
      const pos = byRef.get(ann.id);
      seenRefs.add(ann.id);
      if (pos) return { ...ann, x: pos.x, y: pos.y };
      return ann;
    });
    for (const [ref, pos] of byRef) {
      if (!seenRefs.has(ref)) next.push({ id: ref, x: pos.x, y: pos.y });
    }
    this.layoutNodes.set(next);
    this.layoutDirty.set(true);
  }

  onNodeCommentChanged(ev: { kennelRef: string; comment: string }) {
    const trimmed = ev.comment.trim();
    const existing = this.layoutNodes();
    const idx = existing.findIndex(n => n.id === ev.kennelRef);
    if (idx >= 0) {
      const ann = existing[idx];
      const next = [...existing];
      if (!trimmed && ann.x == null && ann.y == null) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...ann, comment: trimmed || undefined };
      }
      this.layoutNodes.set(next);
    } else if (trimmed) {
      this.layoutNodes.set([...existing, { id: ev.kennelRef, comment: trimmed }]);
    }
    this.layoutDirty.set(true);
  }

  /** Open the inline edge-comment editor for the given (from, to) instance IDs. */
  startEdgeComment(ev: { fromId: string; toId: string }) {
    const cfg = this.kennelConfig();
    if (!cfg) return;
    const dogs = this.flatDogList();
    const fromDog = dogs.find(d => d.id === ev.fromId);
    const toDog = dogs.find(d => d.id === ev.toId);
    if (!fromDog || !toDog) return;
    const fromRef = kennelRefForDog(fromDog, cfg.dogIds ?? []);
    const toRef = kennelRefForDog(toDog, cfg.dogIds ?? []);
    const cur = this.layoutEdges().find(e => e.fromId === fromRef && e.toId === toRef);
    this.editingEdgeKey.set({ fromId: ev.fromId, toId: ev.toId });
    this.edgeCommentDraft = cur?.comment ?? '';
  }

  commitEdgeComment() {
    const slot = this.editingEdgeKey();
    if (!slot) return;
    const cfg = this.kennelConfig();
    if (!cfg) {
      this.editingEdgeKey.set(null);
      return;
    }
    const dogs = this.flatDogList();
    const fromDog = dogs.find(d => d.id === slot.fromId);
    const toDog = dogs.find(d => d.id === slot.toId);
    if (!fromDog || !toDog) {
      this.editingEdgeKey.set(null);
      return;
    }
    const fromRef = kennelRefForDog(fromDog, cfg.dogIds ?? []);
    const toRef = kennelRefForDog(toDog, cfg.dogIds ?? []);
    const trimmed = this.edgeCommentDraft.trim();
    const existing = this.layoutEdges();
    const idx = existing.findIndex(e => e.fromId === fromRef && e.toId === toRef);
    let changed = false;
    if (idx >= 0) {
      const next = [...existing];
      if (!trimmed) {
        next.splice(idx, 1);
      } else {
        next[idx] = { fromId: fromRef, toId: toRef, comment: trimmed };
      }
      this.layoutEdges.set(next);
      changed = true;
    } else if (trimmed) {
      this.layoutEdges.set([...existing, { fromId: fromRef, toId: toRef, comment: trimmed }]);
      changed = true;
    }
    if (changed) this.layoutDirty.set(true);
    this.editingEdgeKey.set(null);
    this.edgeCommentDraft = '';
  }

  cancelEdgeComment() {
    this.editingEdgeKey.set(null);
    this.edgeCommentDraft = '';
  }

  onTaskTextChange(value: string) {
    this.taskText.set(value);
    this.layoutDirty.set(true);
  }

  saveLayout() {
    if (this.layoutSaving()) return;
    this.layoutSaving.set(true);
    const cfg = this.kennelConfig();
    const payload: Partial<IKennelConfig> = {
      task: this.taskText().trim() || undefined,
      nodes: this.layoutNodes(),
      edges: this.layoutEdges(),
    };
    // Preserve other fields the backend merges by undefined.
    if (cfg) {
      payload.dogIds = cfg.dogIds;
      payload.name = cfg.name;
      payload.description = cfg.description;
      payload.emoji = cfg.emoji;
      payload.defaultQuery = cfg.defaultQuery;
      payload.defaultBody = cfg.defaultBody;
    }
    this.kennelService.update(this.kennelId, payload).subscribe({
      next: (res) => {
        this.layoutSaving.set(false);
        if (!res.ok) {
          this.error.set(res.error ?? 'Speichern fehlgeschlagen');
          return;
        }
        this.layoutDirty.set(false);
        this.loadWaves();
      },
      error: (err) => {
        this.layoutSaving.set(false);
        this.error.set(err.error?.error ?? err.message);
      }
    });
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

  /**
   * Query-Zeilen immutabel ins Signal schreiben — `[(ngModel)]` auf Objekten innerhalb
   * eines Signal-Arrays mutiert nur in-place; Signal/CD und Speichern können dadurch auseinanderlaufen.
   */
  setQueryParamAt(index: number, field: 'key' | 'value', value: string) {
    const cur = this.queryParams();
    if (index < 0 || index >= cur.length) return;
    const next = cur.map((p, i) =>
      i === index
        ? { key: field === 'key' ? value : p.key, value: field === 'value' ? value : p.value }
        : p
    );
    this.queryParams.set(next);
    this.paramsDirty.set(true);
  }

  onBodyJsonChange() {
    this.paramsDirty.set(true);
  }

  saveParams() {
    this.paramsSaving.set(true);
    // Ausstehende Add-Zeile mitzählen (viele tragen Key/Value ein und speichern ohne "+").
    if (this.newQueryKey.trim()) {
      this.queryParams.set([...this.queryParams(), { key: this.newQueryKey, value: this.newQueryValue }]);
      this.newQueryKey = '';
      this.newQueryValue = '';
      this.paramsDirty.set(true);
    }

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

    // Full-Config senden: alle bekannten Felder des aktuellen Kennels mitschicken,
    // damit der Merge im Backend keine Felder aus einem (möglicherweise zurückfallenden)
    // existing-Load verliert.
    const current = this.kennelConfig();
    this.kennelService.update(this.kennelId, {
      name: current?.name,
      description: current?.description,
      emoji: current?.emoji,
      dogIds: current?.dogIds ?? [],
      defaultQuery: Object.keys(defaultQuery).length > 0 ? defaultQuery : undefined,
      defaultBody,
    }).subscribe({
      next: (res) => {
        this.paramsSaving.set(false);
        if (!res.ok) {
          this.error.set(res.error ?? 'Speichern der Query/Body-Defaults fehlgeschlagen');
          return;
        }
        this.paramsDirty.set(false);
        this.loadWaves();
      },
      error: (err) => {
        this.paramsSaving.set(false);
        this.error.set(err.error?.error ?? err.message);
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
   * Stage a branch-cut request — actual removal is gated through the confirm dialog.
   */
  onBranchCutRequested(ev: { fromId: string; toId: string }) {
    this.pendingCut.set(ev);
  }

  cancelBranchCut(): void {
    this.pendingCut.set(null);
  }

  /** Compute a short label for the confirm dialog: "<from> → <to>". */
  cutLabel(): string | null {
    const ev = this.pendingCut();
    if (!ev) return null;
    const dogs = this.flatDogList();
    const from = dogs.find(d => d.id === ev.fromId);
    const to = dogs.find(d => d.id === ev.toId);
    const fromLabel = from?.displayName || from?.name || ev.fromId;
    const toLabel = to?.displayName || to?.name || ev.toId;
    return `${fromLabel} → ${toLabel}`;
  }

  /**
   * Confirmed branch-cut — transitive sub-tree below the child node is removed.
   */
  confirmBranchCut() {
    const ev = this.pendingCut();
    this.pendingCut.set(null);
    if (!ev) return;
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

  onDogMovedToFirst(_emitId: string) {
    const dog = this.selectedDog();
    if (!dog) return;
    this.reorderKennelDogIds(ids => {
      const idx = findKennelDogIndex(ids, dog.id, dog.lineageId);
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

  exportKennel() {
    this.kennelService.exportBundle(this.kennelId).subscribe({
      next: (bundle: any) => {
        const json = JSON.stringify(bundle, null, 2);
        navigator.clipboard.writeText(json).then(() => {
          console.log('Kennel bundle copied to clipboard');
        }).catch(() => {
          // Fallback: download as file
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.kennelId}.kennel.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
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
