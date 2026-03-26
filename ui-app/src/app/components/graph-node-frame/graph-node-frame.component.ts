import { Component, Input } from '@angular/core';

/** Nur Rahmen/Schatten für Graph-Knoten — Inhalt per Projektion. */
@Component({
  selector: 'app-graph-node-frame',
  standalone: true,
  template: `
    <div
      class="graph-node-frame"
      [class.selected]="selected"
      [class.error]="hasError"
      [class.serialized]="serialized">
      <ng-content />
    </div>
  `,
  styles: [`
    .graph-node-frame {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 8px 8px;
      border-radius: 4px;
      border: 1px solid #4a4a4e;
      background: #252528;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.04) inset,
        0 2px 8px rgba(0, 0, 0, 0.45);
      transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
      overflow: visible;
    }
    .graph-node-frame.serialized {
      background: #2a2d32;
      border-color: #5a6a78;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.05) inset,
        0 2px 10px rgba(0, 0, 0, 0.4);
    }
    .graph-node-frame.error {
      background: #cc0000;
      border-color: #ff0000;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.12) inset,
        0 2px 8px rgba(0, 0, 0, 0.45);
    }
    .graph-node-frame.selected {
      background: #2c3038;
      border-color: #7eb8e8;
      box-shadow:
        0 0 0 1px rgba(130, 190, 240, 0.45),
        0 2px 14px rgba(0, 0, 0, 0.35);
    }
    .graph-node-frame.error.selected {
      background: #cc0000;
      border-color: #ff6666;
      box-shadow:
        0 0 0 1px rgba(255, 100, 100, 0.6),
        0 2px 10px rgba(0, 0, 0, 0.45);
    }
  `],
})
export class GraphNodeFrameComponent {
  @Input() selected = false;
  @Input() hasError = false;
  @Input() serialized = false;
}
