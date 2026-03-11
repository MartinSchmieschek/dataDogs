import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { DogInfo, isBaseDog } from '../../models/dog.model';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';

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
];

@Component({
  selector: 'app-kennel-config',
  standalone: true,
  imports: [FormsModule, RouterLink, LoadingIndicatorComponent],
  templateUrl: './kennel-config.component.html',
  styleUrls: ['./kennel-config.component.scss']
})
export class KennelConfigComponent implements OnInit, OnDestroy {
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
  selectedBaseDogs = signal<Set<string>>(new Set());
  selectedDogIds = signal<string[]>([]);
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

  private loadData() {
    this.loading.set(true);

    this.kennelService.getById(this.kennelId).subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          const cfg = res.data;
          this.config.set(cfg);
          this.name = cfg.name ?? '';
          this.description = cfg.description ?? '';

          const baseDogs = new Set<string>();
          const serializedIds: string[] = [];
          (cfg.dogIds ?? []).forEach(id => {
            if (id.startsWith('base:')) {
              baseDogs.add(id.replace('base:', ''));
            } else {
              serializedIds.push(id);
            }
          });
          this.selectedBaseDogs.set(baseDogs);
          this.selectedDogIds.set(serializedIds);

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
    const current = new Set(this.selectedBaseDogs());
    if (current.has(dogName)) {
      current.delete(dogName);
    } else {
      current.add(dogName);
    }
    this.selectedBaseDogs.set(current);
  }

  isBaseDogSelected(dogName: string): boolean {
    return this.selectedBaseDogs().has(dogName);
  }

  addDogId(dogId: string) {
    const current = this.selectedDogIds();
    if (!current.includes(dogId)) {
      this.selectedDogIds.set([...current, dogId]);
    }
  }

  removeDogId(dogId: string) {
    this.selectedDogIds.set(this.selectedDogIds().filter(id => id !== dogId));
  }

  moveDogToFirst(dogId: string) {
    const current = this.selectedDogIds();
    const idx = current.indexOf(dogId);
    if (idx > 0) {
      const updated = [dogId, ...current.filter(id => id !== dogId)];
      this.selectedDogIds.set(updated);
    }
  }

  getAvailableSerializedDogs(): DogInfo[] {
    return this.availableDogs().filter(d => !isBaseDog(d));
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

    const dogIds = [
      ...Array.from(this.selectedBaseDogs()).map(name => `base:${name}`),
      ...this.selectedDogIds(),
    ];

    const defaultQuery: Record<string, string> = {};
    this.queryParams().forEach(p => {
      if (p.key) defaultQuery[p.key.toLowerCase()] = p.value;
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
