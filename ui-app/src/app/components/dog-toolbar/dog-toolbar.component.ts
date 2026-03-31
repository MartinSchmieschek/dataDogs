import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { DogDisplayComponent } from '../dog-display/dog-display.component';

@Component({
  selector: 'app-dog-toolbar',
  standalone: true,
  imports: [DogDisplayComponent],
  template: `
    <div class="toolbar">
      <div class="toolbar-header">Dogs</div>

      <div class="toolbar-section">
        <div class="section-label" (click)="baseCollapsed = !baseCollapsed">
          <span class="toggle">{{ baseCollapsed ? '▸' : '▾' }}</span>
          Base Dogs
        </div>
        @if (!baseCollapsed) {
          <div class="section-items">
            @for (dog of baseDogs; track dog.id) {
              <div
                class="toolbar-item base"
                draggable="true"
                (dragstart)="onDragStart($event, dog)">
                <div class="drag-handle">⠿</div>
                <app-dog-display
                  class="item-name"
                  [label]="getDogLabel(dog)"
                  [icon]="dog.icon"
                  variant="toolbar" />
              </div>
            } @empty {
              <div class="empty-hint">Keine BaseDogs</div>
            }
          </div>
        }
      </div>

      <div class="toolbar-section">
        <div class="section-label" (click)="serializedCollapsed = !serializedCollapsed">
          <span class="toggle">{{ serializedCollapsed ? '▸' : '▾' }}</span>
          Serialized Dogs
        </div>
        @if (!serializedCollapsed) {
          <div class="section-items">
            @for (dog of serializedDogs; track dog.id) {
              <div
                class="toolbar-item serialized"
                draggable="true"
                (dragstart)="onDragStart($event, dog)">
                <div class="drag-handle">⠿</div>
                <app-dog-display
                  class="item-name"
                  [label]="getSerializedLabel(dog)"
                  [icon]="dog.icon"
                  variant="toolbar" />
              </div>
            } @empty {
              <div class="empty-hint">Keine SerializedDogs</div>
            }
          </div>
        }
      </div>

      <div class="toolbar-footer">
        <button class="btn-new-dog" (click)="newDogRequested.emit()">+ Neuer Dog</button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0c0c0c;
      border-right: 1px solid #2a2a2a;
      overflow-y: auto;
      overflow-x: hidden;
      user-select: none;
    }

    .toolbar-header {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888;
      border-bottom: 1px solid #2a2a2a;
      flex-shrink: 0;
    }

    .toolbar-section {
      border-bottom: 1px solid #1a1a1a;
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #777;
      cursor: pointer;
      background: #0e0e0e;

      &:hover {
        background: #151515;
        color: #999;
      }
    }

    .toggle {
      font-size: 9px;
      color: #555;
      width: 10px;
    }

    .section-items {
      padding: 4px 0;
    }

    .toolbar-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      margin: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      cursor: grab;
      transition: background 0.15s, border-color 0.15s;
      border: 1px solid transparent;

      &:active { cursor: grabbing; }

      &.base {
        color: #aaa;
        background: #1a1a1a;
        &:hover {
          background: #252525;
          border-color: #444;
        }
      }

      &.serialized {
        color: #8cb4e0;
        background: #111828;
        &:hover {
          background: #182440;
          border-color: #1a3a5c;
        }
      }
    }

    .drag-handle {
      color: #444;
      font-size: 12px;
      line-height: 1;
      flex-shrink: 0;
    }

    .item-name {
      min-width: 0;
      flex: 1;
    }

    .empty-hint {
      padding: 8px 12px;
      font-size: 10px;
      color: #444;
      font-style: italic;
    }

    .toolbar-footer {
      margin-top: auto;
      padding: 10px 8px;
      border-top: 1px solid #2a2a2a;
      flex-shrink: 0;
    }

    .btn-new-dog {
      width: 100%;
      padding: 7px 10px;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      background: #111;
      color: #0c6;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;

      &:hover {
        background: #1a1a1a;
        border-color: #0c6;
      }
    }
  `]
})
export class DogToolbarComponent {
  @Input() availableDogs: DogInfo[] = [];
  @Output() newDogRequested = new EventEmitter<void>();

  baseCollapsed = false;
  serializedCollapsed = false;

  get baseDogs(): DogInfo[] {
    return this.availableDogs.filter(d => isBaseDog(d));
  }

  get serializedDogs(): DogInfo[] {
    return this.availableDogs.filter(d => !isBaseDog(d));
  }

  getDogLabel(dog: DogInfo): string {
    return isBaseDog(dog) ? dog.name : dog.id;
  }

  getSerializedLabel(dog: DogInfo): string {
    const sd = dog as SerializedDogInfo;
    return sd.displayName || sd.id;
  }

  onDragStart(event: DragEvent, dog: DogInfo) {
    // For serialized dogs, drag the dogId (lineage GUID) so the kennel tracks "latest".
    const dragId = !isBaseDog(dog) && (dog as SerializedDogInfo).dogId
      ? (dog as SerializedDogInfo).dogId!
      : dog.id;
    event.dataTransfer?.setData('application/dog-id', dragId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
}
