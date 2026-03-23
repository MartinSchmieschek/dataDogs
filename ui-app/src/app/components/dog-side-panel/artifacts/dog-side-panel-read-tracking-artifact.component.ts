import { Component, Input } from '@angular/core';
import { ReadTrackingEntry } from '../../../models/dog-entry.model';
import { EditSectionComponent } from '../../edit-section/edit-section.component';
import { DogReadPropsDisplayComponent } from '../../dog-read-props-display/dog-read-props-display.component';

export type DogSidePanelReadTrackingMode = 'readFrom' | 'readBy';

@Component({
  selector: 'app-dog-side-panel-read-tracking-artifact',
  standalone: true,
  imports: [EditSectionComponent, DogReadPropsDisplayComponent],
  template: `
    <app-edit-section [title]="title" [collapsed]="collapsed" [hideHeader]="hideHeader">
      <app-dog-read-props-display [mode]="mode" [entries]="entries" />
    </app-edit-section>
  `,
})
export class DogSidePanelReadTrackingArtifactComponent {
  @Input({ required: true }) title!: string;
  @Input() mode: DogSidePanelReadTrackingMode = 'readFrom';
  @Input() entries: ReadTrackingEntry[] = [];
  @Input() collapsed = true;
  @Input() hideHeader = false;
}
