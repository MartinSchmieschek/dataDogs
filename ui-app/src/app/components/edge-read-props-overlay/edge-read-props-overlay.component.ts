import { Component, Input } from '@angular/core';

/**
 * Kompakte Karte für Property-Pfade, die entlang einer Kante (Pfeil) vom Parent zum selektierten Node gelesen werden.
 */
@Component({
  selector: 'app-edge-read-props-overlay',
  standalone: true,
  template: `
    <div class="edge-read-card">
      <div class="edge-read-label">Liest von · {{ parentName }}</div>
      @if (paths.length > 0) {
        <ul class="edge-read-list">
          @for (p of paths; track p) {
            <li><code>{{ p }}</code></li>
          }
        </ul>
      } @else {
        <div class="edge-read-empty">Keine getrackten Property-Zugriffe</div>
      }
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
    .edge-read-list {
      margin: 0;
      padding: 0 0 0 14px;
      font-size: 10px;
      color: #c8d8e8;
      line-height: 1.35;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: #9df;
      word-break: break-all;
    }
    .edge-read-empty {
      font-size: 10px;
      color: #666;
      font-style: italic;
    }
  `]
})
export class EdgeReadPropsOverlayComponent {
  @Input({ required: true }) parentName!: string;
  @Input() paths: string[] = [];
}
