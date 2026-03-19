import { Component, Input, Output, EventEmitter, signal, inject, ViewChild, OnChanges, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { DogEntry } from '../../models/dog-entry.model';
import { DogEditorComponent } from '../dog-editor/dog-editor.component';
import { DogDisplayComponent } from '../dog-display/dog-display.component';
import { EditSectionComponent } from '../edit-section/edit-section.component';
import { VersionTimelineComponent, TimelineVersion } from '../version-timeline/version-timeline.component';
import { DogService, VersionEntry } from '../../services/dog.service';
import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';

@Component({
  selector: 'app-dog-side-panel',
  standalone: true,
  imports: [FormsModule, JsonPipe, DogEditorComponent, DogDisplayComponent, EditSectionComponent, VersionTimelineComponent],
  templateUrl: './dog-side-panel.component.html',
  styleUrls: ['./dog-side-panel.component.scss']
})
export class DogSidePanelComponent implements OnChanges {
  @ViewChild(DogEditorComponent) dogEditor?: DogEditorComponent;

  @Input() dog!: DogEntry;
  @Input() allDogs: DogEntry[] = [];
  /** Erster Eintrag in `kennelConfig.dogIds` (Lead-Slot); für Stern/Strip-Matching. */
  @Input() kennelLeadDogIdsSlot: string | null = null;
  /** Wenn true: Lead-Strip oben; Save-Bar versteckt den doppelten Lead-Button. */
  @Input() kennelLeadControlsEnabled = false;
  @Output() saved = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();
  @Output() movedToFirst = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  private dogService = inject(DogService);

  resultViewMode = signal<'auto' | 'html' | 'raw'>('auto');
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

  ngOnChanges() {
    if (this.dog) {
      this.parentsRequired.set([...(this.dog.parentsRequired ?? [])]);
      this.parentsOptional.set([...(this.dog.parentsOptional ?? [])]);
      this.editorDog.set(this.dog);
      this.selectedVersionId.set(null);
      if (this.isSerialized) {
        this.loadVersions();
      }
    }
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

    const code = this.dogEditor?.getCurrentCode();
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
      this.dogService.delete(this.dog.id).subscribe({
        next: () => this.deleted.emit(this.dog.id),
      });
    }
  }

  moveToFirst() {
    this.movedToFirst.emit(this.dog.id);
  }

  get resultIsHtml(): boolean {
    const r = this.dog?.result;
    if (typeof r !== 'string') return false;
    const trimmed = r.trim();
    return trimmed.startsWith('<html') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<!doctype') ||
      (trimmed.startsWith('<') && trimmed.includes('</'));
  }

  get showHtmlPreview(): boolean {
    const mode = this.resultViewMode();
    if (mode === 'html') return true;
    if (mode === 'raw') return false;
    return this.resultIsHtml;
  }

  get resultHtmlSrc(): string {
    if (!this.resultIsHtml) return '';
    return this.dog.result;
  }

  cycleResultView() {
    const current = this.resultViewMode();
    if (current === 'auto') this.resultViewMode.set('raw');
    else if (current === 'raw') this.resultViewMode.set('html');
    else this.resultViewMode.set('auto');
  }

  get resultViewLabel(): string {
    const mode = this.resultViewMode();
    if (mode === 'raw') return 'Raw';
    if (mode === 'html') return 'HTML';
    return 'Auto';
  }
}
