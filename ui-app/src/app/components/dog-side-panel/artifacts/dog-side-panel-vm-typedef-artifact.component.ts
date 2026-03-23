import { Component, Input } from '@angular/core';
import { EditSectionComponent } from '../../edit-section/edit-section.component';

@Component({
  selector: 'app-dog-side-panel-vm-typedef-artifact',
  standalone: true,
  imports: [EditSectionComponent],
  template: `
    @if (typeDef?.trim()) {
      <app-edit-section title="VM-Kontext (Typen, Monaco)" [collapsed]="collapsed">
        <pre class="typedef-pre">{{ typeDef }}</pre>
      </app-edit-section>
    }
  `,
  styleUrls: ['./dog-side-panel-vm-typedef-artifact.component.scss'],
})
export class DogSidePanelVmTypedefArtifactComponent {
  @Input() typeDef: string | undefined;
  @Input() collapsed = true;
}
