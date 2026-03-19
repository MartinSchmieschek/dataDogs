import { Component, Input } from '@angular/core';
import { DogDisplayComponent } from '../dog-display/dog-display.component';

/**
 * Ein Hund im Graph — gleiche visuelle Sprache wie überall (DogDisplay stacked), mit Graph-Zuständen.
 */
@Component({
  selector: 'app-graph-dog-node',
  standalone: true,
  imports: [DogDisplayComponent],
  template: `
    <div
      class="graph-dog-node"
      [class.selected]="selected"
      [class.error]="hasError"
      [class.serialized]="isSerialized"
      role="presentation">
      @if (isLead) {
        <span class="lead-star" title="Lead-Hund (API-Antwort)">★</span>
      }
      <app-dog-display
        [label]="label"
        [icon]="icon"
        variant="graphVis" />
    </div>
  `,
  styles: [`
    /* An vis-network „box“-Knoten angelehnt (früheres vis-Theme im Projekt) */
    .graph-dog-node {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 10px 10px;
      border-radius: 2px;
      border: 1px solid #555555;
      background: #2a2a2a;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.05) inset,
        0 2px 8px rgba(0, 0, 0, 0.5);
      transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    }
    .graph-dog-node.serialized {
      background: #1a3a5c;
      border-color: #0066cc;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 2px 10px rgba(0, 40, 80, 0.45);
    }
    .graph-dog-node.error {
      background: #cc0000;
      border-color: #ff0000;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.12) inset,
        0 2px 8px rgba(0, 0, 0, 0.45);
    }
    .graph-dog-node.selected {
      background: #003366;
      border-color: #0099ff;
      box-shadow:
        0 0 0 1px rgba(0, 153, 255, 0.55),
        0 2px 14px rgba(0, 80, 160, 0.35);
    }
    .graph-dog-node.error.selected {
      background: #cc0000;
      border-color: #ff6666;
      box-shadow:
        0 0 0 1px rgba(255, 100, 100, 0.6),
        0 2px 10px rgba(0, 0, 0, 0.45);
    }
    .lead-star {
      position: absolute;
      top: 4px;
      left: 6px;
      font-size: 14px;
      line-height: 1;
      color: #e6b800;
      text-shadow: 0 0 8px rgba(230, 184, 0, 0.45);
      pointer-events: none;
      user-select: none;
      z-index: 2;
    }
  `]
})
export class GraphDogNodeComponent {
  @Input({ required: true }) label!: string;
  @Input() icon?: string;
  @Input() selected = false;
  @Input() hasError = false;
  @Input() isSerialized = false;
  @Input() isLead = false;
}
