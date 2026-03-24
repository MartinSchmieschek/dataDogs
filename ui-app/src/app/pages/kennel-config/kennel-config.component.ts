import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { DogDisplayComponent } from '../../components/dog-display/dog-display.component';

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
];

@Component({
  selector: 'app-kennel-config',
  standalone: true,
  imports: [FormsModule, RouterLink, LoadingIndicatorComponent, DogDisplayComponent],
  templateUrl: './kennel-config.component.html',
  styleUrls: ['./kennel-config.component.scss']
})
export class KennelConfigComponent implements OnInit, OnDestroy {
  private errorVideoPopup = inject(ErrorVideoPopupService);

  @ViewChild('bodyEditorContainer') bodyEditorContainer!: ElementRef;

  private route = inject(ActivatedRoute);
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
  /** Eine Liste: Reihenfolge = Ausführungsreihenfolge; Index 0 = API-Ergebnis-Hund */
  orderedDogIds = signal<string[]>([]);
  availableDogs = signal<DogInfo[]>([]);
  queryParams = signal<Array<{ key: string; value: string }>>([]);
  newQueryKey = '';
  newQueryValue = '';

  baseDogTypes = BASE_DOG_TYPES;
  private bodyEditor: any = null;

  ngOnInit() {
    this.kennelId = this.route.snapshot.params['id'];
    this.loadData();
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
          const cfg = res.data;
          this.config.set(cfg);
          this.name = cfg.name ?? '';
          this.description = cfg.description ?? '';

          this.orderedDogIds.set([...(cfg.dogIds ?? [])]);

          if (cfg.defaultQuery) {
            this.queryParams.set(
              Object.entries(cfg.defaultQuery).map(([key, value]) => ({ key, value }))
            );
          }

          this.initBodyEditor(cfg.defaultBody);
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
  }

  private initBodyEditor(defaultBody: any) {
    const tryInit = () => {
      const container = this.bodyEditorContainer?.nativeElement;
      if (!container) {
        setTimeout(tryInit, 100);
        return;
      }
      if (typeof monaco !== 'undefined') {
        this.bodyEditor = monaco.editor.create(container, {
          value: defaultBody ? JSON.stringify(defaultBody, null, 2) : '{}',
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

    const dogIds = [...this.orderedDogIds()];

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
      dogIds,
      defaultQuery: Object.keys(defaultQuery).length > 0 ? defaultQuery : undefined,
      defaultBody,
    };

    this.kennelService.update(this.kennelId, data).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (!res.ok) {
          this.error.set(res.error ?? 'Fehler beim Speichern');
        }
      },
      error: (err) => {
        this.error.set(err.message);
        this.saving.set(false);
      }
    });
  }
}
