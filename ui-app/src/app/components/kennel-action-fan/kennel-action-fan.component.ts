import { Component, EventEmitter, Input, Output } from '@angular/core';
import { fanTransform } from '../../utils/dog-panel-sections';

export type KennelFanAction =
  | 'execute'
  | 'edit'
  | 'waves'
  | 'swagger'
  | 'swaggerJson'
  | 'delete';

interface KennelFanItem {
  id: KennelFanAction;
  label: string;
  icon: string;
}

/**
 * Aktionen für eine Kennel-Zeile.
 * `row` (Standard): drei Buttons nebeneinander — überlappt keinen Text.
 * `fan`: Polar-Fächer wie am Graph (braucht viel freien Rand).
 */
@Component({
  selector: 'app-kennel-action-fan',
  standalone: true,
  template: `
    @if (layout === 'fan') {
      <div class="kennel-fan" (pointerdown)="$event.stopPropagation()">
        @for (s of items; track s.id) {
          <button
            type="button"
            class="kennel-fan-btn"
            [style.transform]="fanTransform($index, items.length)"
            (click)="onClick(s.id, $event)"
            [attr.aria-label]="s.label"
            [attr.title]="s.label">
            <span class="kennel-fan-icon" aria-hidden="true">{{ s.icon }}</span>
          </button>
        }
      </div>
    } @else {
      <div class="kennel-actions-row" (pointerdown)="$event.stopPropagation()">
        @for (s of items; track s.id) {
          <button
            type="button"
            class="kennel-row-btn"
            (click)="onClick(s.id, $event)"
            [attr.aria-label]="s.label"
            [attr.title]="s.label">
            <span class="kennel-row-icon" aria-hidden="true">{{ s.icon }}</span>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    .kennel-fan {
      position: relative;
      width: 0;
      height: 0;
      z-index: 2;
      pointer-events: none;
    }
    .kennel-fan-btn {
      pointer-events: auto;
      position: absolute;
      left: 0;
      top: 0;
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid rgba(110, 125, 145, 0.55);
      background: linear-gradient(165deg, rgba(38, 44, 54, 0.98) 0%, rgba(22, 26, 32, 0.99) 100%);
      color: rgba(210, 218, 230, 0.92);
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s ease, filter 0.1s ease, border-color 0.1s ease;
    }
    .kennel-fan-btn:hover {
      filter: brightness(1.08);
      border-color: rgba(140, 155, 175, 0.65);
    }
    .kennel-fan-btn:active {
      filter: brightness(0.95);
    }
    .kennel-fan-icon {
      font-size: 13px;
      line-height: 1;
    }
    .kennel-actions-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 5px;
      flex-shrink: 0;
      max-width: 12.5rem;
    }
    .kennel-row-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid rgba(110, 125, 145, 0.55);
      background: linear-gradient(165deg, rgba(38, 44, 54, 0.98) 0%, rgba(22, 26, 32, 0.99) 100%);
      color: rgba(210, 218, 230, 0.92);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: filter 0.12s ease, border-color 0.12s ease;
    }
    .kennel-row-btn:hover {
      filter: brightness(1.1);
      border-color: rgba(150, 165, 185, 0.65);
    }
    .kennel-row-btn:active {
      filter: brightness(0.95);
    }
    .kennel-row-icon {
      font-size: 13px;
      line-height: 1;
    }
  `],
})
export class KennelActionFanComponent {
  /** true = POST-Ausführung (Body), sonst GET-Link */
  @Input() executeUsesPost = false;

  /** `row`: nebeneinander (Kennel-Liste). `fan`: Kreisbogen (viel Platz nötig). */
  @Input() layout: 'row' | 'fan' = 'row';

  @Output() action = new EventEmitter<KennelFanAction>();

  readonly fanTransform = fanTransform;

  get items(): KennelFanItem[] {
    return [
      {
        id: 'execute',
        label: this.executeUsesPost ? 'Ausführen (POST)' : 'Ausführen (GET)',
        icon: '▶',
      },
      { id: 'edit', label: 'Bearbeiten', icon: '✎' },
      { id: 'waves', label: 'Waves', icon: '≋' },
      { id: 'swagger', label: 'Swagger UI (/docs)', icon: '📖' },
      { id: 'swaggerJson', label: 'OpenAPI JSON (swagger.json)', icon: '📄' },
      { id: 'delete', label: 'Löschen', icon: '🗑' },
    ];
  }

  onClick(id: KennelFanAction, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.action.emit(id);
  }
}
