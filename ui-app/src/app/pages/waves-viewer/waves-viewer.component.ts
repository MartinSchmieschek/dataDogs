import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { KennelService } from '../../services/kennel.service';
import { DogService } from '../../services/dog.service';
import { IKennelConfig } from '../../models/kennel-config.model';
import { DogEntry, Waves } from '../../models/dog-entry.model';
import { DogInfo } from '../../models/dog.model';
import { VisNetworkComponent } from '../../components/vis-network/vis-network.component';
import { DogSidePanelComponent } from '../../components/dog-side-panel/dog-side-panel.component';
import { LoadingIndicatorComponent } from '../../components/loading-indicator/loading-indicator.component';
import { DogToolbarComponent } from '../../components/dog-toolbar/dog-toolbar.component';

@Component({
  selector: 'app-waves-viewer',
  standalone: true,
  imports: [
    RouterLink,
    VisNetworkComponent, DogSidePanelComponent,
    LoadingIndicatorComponent, DogToolbarComponent
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

    this.kennelService.run(this.kennelId).subscribe({
      next: (res) => {
        if (res.ok) {
          this.waves.set(res.waves);
          this.kennelConfig.set(res.kennelConfig);

          const sel = this.selectedDog();
          if (sel) {
            const updated = this.flatDogList().find(d => d.id === sel.id);
            this.selectedDog.set(updated ?? null);
          }
        } else {
          this.error.set(res.error ?? 'Fehler beim Laden');
          this.kennelConfig.set(res.kennelConfig ?? null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? err.message);
        this.loading.set(false);
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
    const config = this.kennelConfig();
    if (!config) return;

    const currentDogIds = [...(config.dogIds ?? [])];
    const baseId = dogId.replace(/-v\d+$/, '');
    const idx = currentDogIds.findIndex(id => id.replace(/-v\d+$/, '') === baseId);
    if (idx > 0) {
      const [entry] = currentDogIds.splice(idx, 1);
      currentDogIds.unshift(entry);
      this.kennelService.update(this.kennelId, { dogIds: currentDogIds }).subscribe({
        next: () => this.loadWaves(),
      });
    }
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
