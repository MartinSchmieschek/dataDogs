import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig, KennelVersionEntry } from '../../models/kennel-config.model';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { DogDisplayComponent } from '../../components/dog-display/dog-display.component';
import { KennelEmojiPickerComponent } from '../../components/kennel-emoji-picker/kennel-emoji-picker.component';
import { VersionTimelineComponent, TimelineVersion } from '../../components/version-timeline/version-timeline.component';
import { kennelDisplayNameBlockedReason } from '../../config/kennel-reserved-names';

declare const monaco: any;

const BASE_DOG_TYPES = [
  'RandomRecipesRetriever',
  'CountryFlagBlackLab',
  'DishFlagBlackLab',
  'RandomEveryThingRetriever',
  'TalkingDog',
  'QueryRetriever',
  'BodyRetriever',
  'WarframeAlertsRetriever',
  'BloodhoundRouteRetriever',
  'BloodhoundIsochroneRetriever',
  'OsmLandmarksRetriever',
  'OsmTracksRetriever',
  'OsmVegetationRetriever',
  'OsmFastRoadsRetriever',
  'HueBridgeEnvRetriever',
  'HuePlaygroundRetriever',
];

@Component({
  selector: 'app-kennel-config',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LoadingIndicatorComponent,
    DogDisplayComponent,
    KennelEmojiPickerComponent,
    VersionTimelineComponent,
  ],
  templateUrl: './kennel-config.component.html',
  styleUrls: ['./kennel-config.component.scss']
})
export class KennelConfigComponent implements OnInit, OnDestroy {
  private errorVideoPopup = inject(ErrorVideoPopupService);

  @ViewChild('bodyEditorContainer') bodyEditorContainer!: ElementRef;

  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private kennelService = inject(KennelService);
  private dogService = inject(DogService);

  kennelId = '';
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  config = signal<IKennelConfig | null>(null);
  name = '';
  description = '';
  emoji = '';
  task = '';
  /** Eine Liste: Reihenfolge = Ausführungsreihenfolge; Index 0 = API-Ergebnis-Hund */
  orderedDogIds = signal<string[]>([]);
  availableDogs = signal<DogInfo[]>([]);
  queryParams = signal<Array<{ key: string; value: string }>>([]);
  newQueryKey = '';
  newQueryValue = '';

  baseDogTypes = BASE_DOG_TYPES;
  private bodyEditor: any = null;

  // --- Kennel version timeline ---
  kennelVersions = signal<KennelVersionEntry[]>([]);
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

  /** The current (latest) version ID of this kennel */
  get currentKennelVersionId(): string {
    return this.config()?.id ?? '';
  }

  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      const id = pm.get('id');
      if (!id) return;
      this.bodyEditor?.dispose();
      this.bodyEditor = null;
      this.kennelId = id;
      this.selectedKennelVersionId.set(null);
      this.loadData();
    });
  }

  ngOnDestroy() {
    this.bodyEditor?.dispose();
  }

  onComfortVideoClick(): void {
    this.errorVideoPopup.openPopup(this.error());
  }

  private loadData() {
    this.loading.set(true);

    this.kennelService.getById(this.kennelId).subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          this.applyConfig(res.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });

    this.dogService.getAll().subscribe({
      next: (res) => {
        this.availableDogs.set(res.data ?? []);
      }
    });

    this.loadKennelVersions();
  }

  private applyConfig(cfg: IKennelConfig) {
    this.config.set(cfg);
    this.name = cfg.name ?? '';
    this.description = cfg.description ?? '';
    this.emoji = cfg.emoji ?? '';
    this.task = cfg.task ?? '';

    this.orderedDogIds.set([...(cfg.dogIds ?? [])]);

    if (cfg.defaultQuery) {
      this.queryParams.set(
        Object.entries(cfg.defaultQuery).map(([key, value]) => ({ key, value }))
      );
    } else {
      this.queryParams.set([]);
    }

    this.initBodyEditor(cfg.defaultBody);
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
    // Load the selected version's config to display it
    const version = this.kennelVersions().find(v => v.id === versionId);
    if (version?.config) {
      this.applyConfig(version.config);
    }
  }

  private initBodyEditor(defaultBody: any) {
    this.bodyEditor?.dispose();
    this.bodyEditor = null;

    const tryInit = () => {
      const container = this.bodyEditorContainer?.nativeElement;
      if (!container) {
        setTimeout(tryInit, 100);
        return;
      }
      if (typeof monaco !== 'undefined') {
        const text =
          defaultBody !== undefined && defaultBody !== null
            ? JSON.stringify(defaultBody, null, 2)
            : '{}';
        this.bodyEditor = monaco.editor.create(container, {
          value: text,
          language: 'json',
          theme: 'vs-dark',
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          fontSize: 13,
        });
      }
    };
    setTimeout(tryInit, 200);
  }

  toggleBaseDog(dogName: string) {
    const id = `base:${dogName}`;
    const cur = this.orderedDogIds();
    if (cur.includes(id)) {
      this.orderedDogIds.set(cur.filter(x => x !== id));
    } else {
      this.orderedDogIds.set([...cur, id]);
    }
  }

  isBaseDogSelected(dogName: string): boolean {
    return this.orderedDogIds().includes(`base:${dogName}`);
  }

  addDogId(dogId: string) {
    const cur = this.orderedDogIds();
    if (!cur.includes(dogId)) {
      this.orderedDogIds.set([...cur, dogId]);
    }
  }

  removeKennelDogId(dogId: string) {
    this.orderedDogIds.set(this.orderedDogIds().filter(id => id !== dogId));
  }

  moveDogToFirst(dogId: string) {
    const cur = this.orderedDogIds();
    const idx = cur.indexOf(dogId);
    if (idx > 0) {
      const copy = cur.filter(id => id !== dogId);
      this.orderedDogIds.set([dogId, ...copy]);
    }
  }

  moveDogUp(dogId: string) {
    const cur = [...this.orderedDogIds()];
    const idx = cur.indexOf(dogId);
    if (idx <= 0) return;
    [cur[idx - 1], cur[idx]] = [cur[idx], cur[idx - 1]];
    this.orderedDogIds.set(cur);
  }

  moveDogDown(dogId: string) {
    const cur = [...this.orderedDogIds()];
    const idx = cur.indexOf(dogId);
    if (idx < 0 || idx >= cur.length - 1) return;
    [cur[idx + 1], cur[idx]] = [cur[idx], cur[idx + 1]];
    this.orderedDogIds.set(cur);
  }

  getAvailableSerializedDogs(): DogInfo[] {
    return this.availableDogs().filter(d => !isBaseDog(d));
  }

  iconForBaseType(dogType: string): string | undefined {
    const d = this.availableDogs().find((x): x is BaseDogInfo => isBaseDog(x) && x.name === dogType);
    return d?.icon;
  }

  iconForSerializedId(id: string): string | undefined {
    const d = this.availableDogs().find((x): x is SerializedDogInfo => !isBaseDog(x) && x.id === id);
    return d?.icon;
  }

  kennelDogLabel(dogId: string): string {
    return dogId.startsWith('base:') ? dogId.slice('base:'.length) : dogId;
  }

  iconForKennelDogId(dogId: string): string | undefined {
    if (dogId.startsWith('base:')) {
      return this.iconForBaseType(dogId.slice('base:'.length));
    }
    return this.iconForSerializedId(dogId);
  }

  addQueryParam() {
    if (this.newQueryKey.trim()) {
      this.queryParams.set([...this.queryParams(), { key: this.newQueryKey, value: this.newQueryValue }]);
      this.newQueryKey = '';
      this.newQueryValue = '';
    }
  }

  removeQueryParam(index: number) {
    const params = [...this.queryParams()];
    params.splice(index, 1);
    this.queryParams.set(params);
  }

  save() {
    this.saving.set(true);
    this.error.set(null);

    if (this.name.trim()) {
      const nameErr = kennelDisplayNameBlockedReason(this.name);
      if (nameErr) {
        this.error.set(nameErr);
        this.saving.set(false);
        return;
      }
    }

    const dogIds = [...this.orderedDogIds()];

    if (this.newQueryKey.trim()) {
      this.queryParams.set([...this.queryParams(), { key: this.newQueryKey, value: this.newQueryValue }]);
      this.newQueryKey = '';
      this.newQueryValue = '';
    }

    const defaultQuery: Record<string, string> = {};
    this.queryParams().forEach(p => {
      if (p.key) defaultQuery[p.key.toLowerCase()] = p.value.toLowerCase();
    });

    let defaultBody: any = undefined;
    if (this.bodyEditor) {
      try {
        const val = this.bodyEditor.getValue();
        defaultBody = val.trim() ? JSON.parse(val) : undefined;
      } catch {
        this.error.set('Default Body ist kein gültiges JSON');
        this.saving.set(false);
        return;
      }
    }

    const data: Partial<IKennelConfig> = {
      name: this.name,
      description: this.description,
      emoji: this.emoji.trim(),
      dogIds,
      defaultQuery: Object.keys(defaultQuery).length > 0 ? defaultQuery : undefined,
      defaultBody,
      task: this.task.trim() || undefined,
    };

    this.kennelService.update(this.kennelId, data).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (!res.ok) {
          this.error.set(res.error ?? 'Fehler beim Speichern');
        } else {
          // Reload versions after save — the new incarnation must appear in the timeline.
          this.loadKennelVersions();
          this.selectedKennelVersionId.set(null);
        }
      },
      error: (err) => {
        this.error.set(err.message);
        this.saving.set(false);
      }
    });
  }
}
