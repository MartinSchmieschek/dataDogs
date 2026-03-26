import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  fanTransform,
  type DogPanelSectionId,
  type DogPanelSectionItem,
} from '../../utils/dog-panel-sections';

@Component({
  selector: 'app-graph-action-fan',
  standalone: true,
  template: `
    <div class="graph-fan" (pointerdown)="$event.stopPropagation()">
      @for (s of sections; track s.id) {
        <button
          type="button"
          class="graph-fan-btn"
          [style.transform]="fanTransform($index, sections.length)"
          (click)="onClick(s.id, $event)"
          [attr.aria-label]="s.label"
          [attr.title]="s.label">
          <span class="graph-fan-icon" aria-hidden="true">{{ s.icon }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
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
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid #e85555;
      background: linear-gradient(165deg, #c41e1e 0%, #8b1010 100%);
      color: #fff;
      cursor: pointer;
      box-shadow:
        0 0 12px rgba(200, 40, 40, 0.35),
        0 2px 8px rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s ease, filter 0.1s ease;
    }
    .graph-fan-btn:hover {
      filter: brightness(1.12);
      border-color: #ff8888;
    }
    .graph-fan-btn:active {
      filter: brightness(0.92);
    }
    .graph-fan-icon {
      font-size: 12px;
      line-height: 1;
    }
  `],
})
export class GraphActionFanComponent {
  @Input({ required: true }) sections: DogPanelSectionItem[] = [];

  @Output() action = new EventEmitter<DogPanelSectionId>();

  readonly fanTransform = fanTransform;

  onClick(id: DogPanelSectionId, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.action.emit(id);
  }
}
