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
import { AclPanelComponent } from '../acl-panel/acl-panel.component';

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
    AclPanelComponent,
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
  /** The kennel's reference for this dog — lineageId means "latest", version-ID means "pinned". */
  @Input() kennelDogRef: string | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();
  @Output() movedToFirst = new EventEmitter<string>();
  /** Emits { lineageId, versionId } — parent updates the kennel's dogIds entry accordingly. */
  @Output() pinChanged = new EventEmitter<{ lineageId: string; versionId: string | null }>();
  @Output() renamed = new EventEmitter<void>();
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
  renaming = signal(false);

  versions = signal<VersionEntry[]>([]);
  selectedVersionId = signal<string | null>(null);
  editorDog = signal<DogEntry | null>(null);

  timelineVersions = computed<TimelineVersion[]>(() => {
    return this.versions().map(v => ({
      id: v.id,
      version: v.version,
      parentId: v.parentId,
      createdAt: v.createdAt,
      displayName: v.config?.displayName,
    }));
  });

  get isSerialized(): boolean {
    return !!this.dog?.codeTs;
  }

  get isCurrentLead(): boolean {
    if (!this.kennelLeadControlsEnabled || !this.kennelLeadDogIdsSlot || !this.dog) {
      return false;
    }
    return graphNodeIdMatchesKennelDogId(this.dog.id, this.kennelLeadDogIdsSlot, this.dog.lineageId);
  }

  get availableParents(): DogEntry[] {
    return this.allDogs.filter(d => d.id !== this.dog?.id);
  }

  get currentVersion(): number {
    return this.dog?.serializedDogConfig?.version ?? 0;
  }

  /**
   * The version ID currently pinned in the kennel, or null if set to "always latest".
   * Derived from kennelDogRef: if it matches the lineageId → not pinned; if it matches a version → pinned.
   */
  get pinnedVersionId(): string | null {
    if (!this.kennelDogRef || !this.dog) return null;
    // If the kennel ref equals the lineageId (lineage), nothing is pinned (= latest).
    if (this.kennelDogRef === this.dog.lineageId) return null;
    // Otherwise the kennel ref is a specific version ID → that version is pinned.
    return this.kennelDogRef;
  }

  /** Forwarded from the version graph — the user pinned or unpinned a version node. */
  onPinToggled(versionId: string | null) {
    if (!this.dog?.lineageId) return;
    this.pinChanged.emit({ lineageId: this.dog.lineageId, versionId });
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
    // Use lineageId (lineage GUID) to fetch all incarnations across branches — the id is just one incarnation.
    const lookupId = this.dog.lineageId || this.dog.serializedDogConfig?.lineageId || this.dog.id;
    this.dogService.getVersions(lookupId).subscribe({
      next: (res) => {
        if (res.ok && res.data) {
          this.versions.set(res.data);
        }
      }
    });
  }

  onVersionSelected(versionId: string) {
    if (!versionId) {
      this.selectedVersionId.set(null);
      this.editorDog.set(this.dog);
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
    } else if (versionId === this.dog.id) {
      // Selecting the current version — keep it selected (for pin/unpin) but load current code.
      this.selectedVersionId.set(versionId);
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

    // If an old version is selected, use ITS id as the save target —
    // the Controller sets parentId to this id, forking a branch from the old incarnation.
    // If no old version selected, save from the current version (linear continuation).
    const saveId = this.selectedVersionId() || this.dog.id;

    this.dogService.save(saveId, {
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
          this.loadVersions(); // Reload the branching tree after save — the new incarnation must appear
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

  commitRename(event: Event) {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    this.renaming.set(false);
    if (!newName || !this.dog?.lineageId || newName === this.dog.displayName) return;
    this.dogService.rename(this.dog.lineageId, newName).subscribe({
      next: () => {
        this.renamed.emit();
        this.saved.emit(); // reload waves to reflect new name
      },
    });
  }

  deleteDog() {
    if (!this.dog) return;
    // Just tell the parent to remove this dog from the kennel — no DB deletion here.
    this.deleted.emit(this.dog.id);
  }

  moveToFirst() {
    this.movedToFirst.emit(this.dog.id);
  }
}
