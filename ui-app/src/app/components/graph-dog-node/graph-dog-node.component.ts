import { Component, Input, Output, EventEmitter, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { DogDisplayComponent } from '../dog-display/dog-display.component';
import { GraphNodeFrameComponent } from '../graph-node-frame/graph-node-frame.component';
import { GraphActionFanComponent } from '../graph-action-fan/graph-action-fan.component';
import { DogEntry } from '../../models/dog-entry.model';
import {
  DogPanelSectionId,
  buildDogPanelSections,
} from '../../utils/dog-panel-sections';

/**
 * Ein Hund im Graph — gleiche visuelle Sprache wie überall (DogDisplay stacked), mit Graph-Zuständen.
 * Am selektierten Knoten: Action-Fächer öffnen den Edit-View für die jeweilige Section.
 */
@Component({
  selector: 'app-graph-dog-node',
  standalone: true,
  imports: [DogDisplayComponent, GraphNodeFrameComponent, GraphActionFanComponent],
  template: `
    <app-graph-node-frame
      [selected]="selected"
      [hasError]="hasError"
      [serialized]="isSerialized">
      @if (isLead) {
        <span class="lead-star" title="Lead-Hund (API-Antwort)">★</span>
      }
      <app-dog-display
        [label]="label"
        [icon]="icon"
        variant="graphVis" />
      @if (showSectionFan && sections().length > 0) {
        <app-graph-action-fan
          [sections]="sections()"
          (action)="onFanClick($event)" />
      }
    </app-graph-node-frame>
  `,
  styles: [`
    .lead-star {
      position: absolute;
      top: 4px;
      left: 6px;
      font-size: 13px;
      line-height: 1;
      color: #e6b800;
      text-shadow: 0 0 8px rgba(230, 184, 0, 0.45);
      pointer-events: none;
      user-select: none;
      z-index: 2;
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
  /** Nur am ausgewählten Knoten: Action-Fächer. */
  @Input() showSectionFan = false;

  @Output() sectionEditRequested = new EventEmitter<DogPanelSectionId>();

  private readonly dogRef = signal<DogEntry | null>(null);

  readonly sections = computed(() => {
    const d = this.dogRef();
    return d ? buildDogPanelSections(d) : [];
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dog'] && this.dog) {
      this.dogRef.set(this.dog);
    }
  }

  onFanClick(id: DogPanelSectionId): void {
    this.sectionEditRequested.emit(id);
  }
}
