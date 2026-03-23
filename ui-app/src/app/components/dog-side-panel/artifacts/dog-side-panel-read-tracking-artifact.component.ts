import { Component, Input } from '@angular/core';
import { ReadTrackingEntry } from '../../../models/dog-entry.model';
import { EditSectionComponent } from '../../edit-section/edit-section.component';

export type DogSidePanelReadTrackingMode = 'readFrom' | 'readBy';

@Component({
  selector: 'app-dog-side-panel-read-tracking-artifact',
  standalone: true,
  imports: [EditSectionComponent],
  template: `
    @if (entries.length > 0) {
      <app-edit-section [title]="title" [collapsed]="collapsed">
        @for (entry of entries; track $index) {
          <div class="tracking-entry">
            @if (mode === 'readFrom') {
              {{ entry.sourceInstanceName }}.{{ entry.propertyPath }}
            } @else {
              {{ entry.readerInstanceName }} → .{{ entry.propertyPath }}
            }
          </div>
        }
      </app-edit-section>
    }
  `,
  styleUrls: ['./dog-side-panel-read-tracking-artifact.component.scss'],
})
export class DogSidePanelReadTrackingArtifactComponent {
  @Input({ required: true }) title!: string;
  @Input() mode: DogSidePanelReadTrackingMode = 'readFrom';
  @Input() entries: ReadTrackingEntry[] = [];
  @Input() collapsed = true;
}
