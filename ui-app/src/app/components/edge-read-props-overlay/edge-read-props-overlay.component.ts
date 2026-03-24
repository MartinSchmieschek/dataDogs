import { Component, Input } from '@angular/core';
import { DogReadPropsDisplayComponent } from '../dog-read-props-display/dog-read-props-display.component';

/**
 * Read-Tracking am Knoten: eine Karte pro Datenrichtung (links eingehend, rechts ausgehend).
 */
@Component({
  selector: 'app-edge-read-props-overlay',
  standalone: true,
  imports: [DogReadPropsDisplayComponent],
  template: `
    <div class="edge-read-root">
      <div class="edge-read-label">{{ title }}</div>
      <app-dog-read-props-display [paths]="paths" />
    </div>
  `,
  styleUrls: ['./edge-read-props-overlay.component.scss'],
})
export class EdgeReadPropsOverlayComponent {
  @Input({ required: true }) title!: string;
  @Input() paths: string[] = [];
}
