import { Component, Input, Output, EventEmitter, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { DogDisplayComponent } from '../dog-display/dog-display.component';
import { DogEntry } from '../../models/dog-entry.model';
import {
  DogPanelSectionId,
  buildDogPanelSections,
  fanTransform,
} from '../../utils/dog-panel-sections';

/**
 * Ein Hund im Graph — gleiche visuelle Sprache wie überall (DogDisplay stacked), mit Graph-Zuständen.
 * Am selektierten Knoten: rote Kreis-Buttons (Fächer) öffnen den Edit-View für die jeweilige Section.
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
      @if (showSectionFan && sections().length > 0) {
        <div class="graph-fan" (pointerdown)="$event.stopPropagation()">
          @for (s of sections(); track s.id) {
            <button
              type="button"
              class="graph-fan-btn"
              [style.transform]="fanTransformFn($index, sections().length)"
              (click)="onFanClick(s.id, $event)"
              [attr.aria-label]="s.label"
              [attr.title]="s.label">
              <span class="graph-fan-icon" aria-hidden="true">{{ s.icon }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
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
      overflow: visible;
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
    .graph-fan {
      position: absolute;
      top: 0;
      right: 0;
      width: 0;
      height: 0;
      z-index: 4;
      pointer-events: none;
    }
    .graph-fan-btn {
      pointer-events: auto;
      position: absolute;
      left: 0;
      top: 0;
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid #ff6666;
      background: #cc0000;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s ease, filter 0.1s ease;
    }
    .graph-fan-btn:hover {
      filter: brightness(1.15);
      border-color: #ff9999;
    }
    .graph-fan-btn:active {
      filter: brightness(0.92);
    }
    .graph-fan-icon {
      font-size: 13px;
      line-height: 1;
    }
  `],
})
export class GraphDogNodeComponent implements OnChanges {
  @Input({ required: true }) label!: string;
  @Input() icon?: string;
  @Input() selected = false;
  @Input() hasError = false;
  @Input() isSerialized = false;
  @Input() isLead = false;
  /** Dog-Daten für Section-Liste (Code/VM/…). */
  @Input({ required: true }) dog!: DogEntry;
  /** Nur am ausgewählten Knoten: rote Fächer-Buttons. */
  @Input() showSectionFan = false;

  @Output() sectionEditRequested = new EventEmitter<DogPanelSectionId>();

  private readonly dogRef = signal<DogEntry | null>(null);

  readonly sections = computed(() => {
    const d = this.dogRef();
    return d ? buildDogPanelSections(d) : [];
  });

  /** Template: Polarkoordinaten für Fächer-Buttons. */
  fanTransformFn = fanTransform;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dog'] && this.dog) {
      this.dogRef.set(this.dog);
    }
  }

  onFanClick(id: DogPanelSectionId, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.sectionEditRequested.emit(id);
  }
}
