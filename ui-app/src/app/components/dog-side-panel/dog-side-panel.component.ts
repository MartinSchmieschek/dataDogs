import {
  Component, Input, Output, EventEmitter, signal, inject, ViewChild, OnChanges, SimpleChanges, computed,
} from '@angular/core';
import { DogEntry } from '../../models/dog-entry.model';
import { DogDisplayComponent } from '../dog-display/dog-display.component';
import { VersionTimelineComponent, TimelineVersion } from '../version-timeline/version-timeline.component';
import { DogService, VersionEntry } from '../../services/dog.service';
import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import {
  DogPanelSectionId,
  buildDogPanelSections,
  DEFAULT_PANEL_SECTION,
  getDefaultPanelSection,
} from '../../utils/dog-panel-sections';
import { DogSidePanelCodeArtifactComponent } from './artifacts/dog-side-panel-code-artifact.component';
import { DogSidePanelVmTypedefArtifactComponent } from './artifacts/dog-side-panel-vm-typedef-artifact.component';
import { DogSidePanelResultArtifactComponent } from './artifacts/dog-side-panel-result-artifact.component';
import { DogSidePanelParentsArtifactComponent } from './artifacts/dog-side-panel-parents-artifact.component';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';

export type { DogPanelSectionId } from '../../utils/dog-panel-sections';
export { DEFAULT_PANEL_SECTION, getDefaultPanelSection } from '../../utils/dog-panel-sections';

@Component({
  selector: 'app-dog-side-panel',
  standalone: true,
  imports: [
    DogDisplayComponent,
    VersionTimelineComponent,
    DogSidePanelCodeArtifactComponent,
    DogSidePanelVmTypedefArtifactComponent,
    DogSidePanelResultArtifactComponent,
    DogSidePanelParentsArtifactComponent,
  ],
  templateUrl: './dog-side-panel.component.html',
  styleUrls: ['../../styles/dog-node-card.scss', './dog-side-panel.component.scss'],
})
export class DogSidePanelComponent implements OnChanges {
  private errorVideoPopup = inject(ErrorVideoPopupService);

  @ViewChild(DogSidePanelCodeArtifactComponent) codeArtifact?: DogSidePanelCodeArtifactComponent;

  @Input() dog!: DogEntry;
  @Input() allDogs: DogEntry[] = [];
  /** Erster Eintrag in `kennelConfig.dogIds` (Lead-Slot); für Stern/Strip-Matching. */
  @Input() kennelLeadDogIdsSlot: string | null = null;
  /** Wenn true: Lead-Strip oben; Save-Bar versteckt den doppelten Lead-Button. */
  @Input() kennelLeadControlsEnabled = false;
  /** Vom Graph-Fächer gesetzt: diese Section sofort aktiv. */
  @Input() initialSection: DogPanelSectionId | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();
  @Output() movedToFirst = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  private dogService = inject(DogService);

  private readonly dogSignal = signal<DogEntry | null>(null);

  /** Welche Edit-Section unten sichtbar ist (Kreis-Buttons am Dog-Hub). */
  readonly activeSection = signal<DogPanelSectionId | null>(null);

  readonly availableSections = computed(() => {
    const d = this.dogSignal();
    return d ? buildDogPanelSections(d) : [];
  });

  parentsRequired = signal<string[]>([]);
  parentsOptional = signal<string[]>([]);
  saving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);

  versions = signal<VersionEntry[]>([]);
  selectedVersionId = signal<string | null>(null);
  editorDog = signal<DogEntry | null>(null);

  timelineVersions = computed<TimelineVersion[]>(() => {
    return this.versions().map(v => ({ id: v.id, version: v.version }));
  });

  get isSerialized(): boolean {
    return !!this.dog?.codeTs;
  }

  get isCurrentLead(): boolean {
    if (!this.kennelLeadControlsEnabled || !this.kennelLeadDogIdsSlot || !this.dog) {
      return false;
    }
    return graphNodeIdMatchesKennelDogId(this.dog.id, this.kennelLeadDogIdsSlot);
  }

  get availableParents(): DogEntry[] {
    return this.allDogs.filter(d => d.id !== this.dog?.id);
  }

  get currentVersion(): number {
    const match = this.dog?.id?.match(/-v(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  onComfortVideoClick(message: string): void {
    this.errorVideoPopup.openPopup(message);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['dog'] && this.dog) {
      this.dogSignal.set(this.dog);
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
      this.editorDog.set(this.dog);
      this.selectedVersionId.set(null);
      if (this.isSerialized) {
        this.loadVersions();
      }
      this.syncActiveSection();
    }
    if (changes['initialSection'] && this.initialSection != null) {
      const ids = this.availableSections().map((s) => s.id);
      if (ids.includes(this.initialSection)) {
        this.activeSection.set(this.initialSection);
      }
    }
  }

  private syncActiveSection(): void {
    const d = this.dogSignal();
    const ids = this.availableSections().map((s) => s.id);
    const cur = this.activeSection();
    const preferred = d ? getDefaultPanelSection(d) : DEFAULT_PANEL_SECTION;
    if (cur === null || !ids.includes(cur)) {
      const next = ids.includes(preferred) ? preferred : (ids[0] ?? null);
      this.activeSection.set(next);
    }
  }

  selectSection(id: DogPanelSectionId): void {
    this.activeSection.set(id);
  }

  isSectionActive(id: DogPanelSectionId): boolean {
    return this.activeSection() === id;
  }

  private loadVersions() {
    this.dogService.getVersions(this.dog.id).subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          this.versions.set(res.data);
        }
      }
    });
  }

  onVersionSelected(versionId: string) {
    if (!versionId || versionId === this.dog.id) {
      this.selectedVersionId.set(null);
      this.editorDog.set(this.dog);
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
    } else {
      this.selectedVersionId.set(versionId);
      const version = this.versions().find(v => v.id === versionId);
      if (version) {
        this.editorDog.set({
          ...this.dog,
          codeTs: version.config.theRun,
        });
        this.parentsRequired.set([...(version.config.parentsRequired ?? [])]);
        this.parentsOptional.set([...(version.config.parentsOptional ?? [])]);
      }
    }
  }

  toggleParentRequired(parentId: string) {
    const current = this.parentsRequired();
    if (current.includes(parentId)) {
      this.parentsRequired.set(current.filter(id => id !== parentId));
    } else {
      this.parentsOptional.set(this.parentsOptional().filter(id => id !== parentId));
      this.parentsRequired.set([...current, parentId]);
    }
  }

  toggleParentOptional(parentId: string) {
    const current = this.parentsOptional();
    if (current.includes(parentId)) {
      this.parentsOptional.set(current.filter(id => id !== parentId));
    } else {
      this.parentsRequired.set(this.parentsRequired().filter(id => id !== parentId));
      this.parentsOptional.set([...current, parentId]);
    }
  }

  isParentRequired(parentId: string): boolean {
    return this.parentsRequired().includes(parentId);
  }

  isParentOptional(parentId: string): boolean {
    return this.parentsOptional().includes(parentId);
  }

  saveCode() {
    if (!this.dog) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const code = this.codeArtifact?.getCurrentCode();
    if (code == null) {
      this.saving.set(false);
      this.saveError.set('Editor nicht bereit');
      return;
    }

    this.dogService.save(this.dog.id, {
      tsCode: code,
      icon: this.dog.icon,
      parentsRequired: this.parentsRequired(),
      parentsOptional: this.parentsOptional(),
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.ok) {
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 2000);
          this.saved.emit();
        } else {
          this.saveError.set(res.error ?? 'Fehler beim Speichern');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.message);
      }
    });
  }

  deleteDog() {
    if (!this.dog) return;
    if (confirm(`Dog "${this.dog.name}" wirklich löschen?`)) {
      this.saveError.set(null);
      this.dogService.delete(this.dog.id).subscribe({
        next: (res) => {
          if (res?.ok) {
            this.deleted.emit(this.dog.id);
          } else {
            this.saveError.set(res?.error ?? 'Löschen fehlgeschlagen');
          }
        },
        error: (err) => {
          this.saveError.set(err.error?.error ?? err.message ?? 'Löschen fehlgeschlagen');
        },
      });
    }
  }

  moveToFirst() {
    this.movedToFirst.emit(this.dog.id);
  }
}
