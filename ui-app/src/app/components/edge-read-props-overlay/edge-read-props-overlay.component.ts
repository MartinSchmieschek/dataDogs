import { Component, Input } from '@angular/core';
import { DogReadPropsDisplayComponent } from '../dog-read-props-display/dog-read-props-display.component';

/**
 * Kompakte Karte für Property-Pfade entlang einer Kante (Spur / Track zum Parent).
 */
@Component({
  selector: 'app-edge-read-props-overlay',
  standalone: true,
  imports: [DogReadPropsDisplayComponent],
  template: `
    <div class="edge-read-card">
      <div class="edge-read-label">Spur · {{ parentName }}</div>
      <app-dog-read-props-display [paths]="paths" />
    </div>
  `,
  styles: [`
    .edge-read-card {
      background: rgba(12, 16, 22, 0.94);
      border: 1px solid #3a5070;
      border-radius: 6px;
      padding: 6px 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      max-width: 240px;
    }
    .edge-read-label {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #8ab;
      margin-bottom: 4px;
    }
  `]
})
export class EdgeReadPropsOverlayComponent {
  @Input({ required: true }) parentName!: string;
  @Input() paths: string[] = [];
}
