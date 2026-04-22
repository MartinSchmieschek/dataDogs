import { Component, computed, input, output, signal } from '@angular/core';
import { DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
import { DogDisplayComponent } from '../dog-display/dog-display.component';

function normalizeDogSearch(q: string): string {
  return q.trim().toLowerCase();
}

@Component({
  selector: 'app-dog-toolbar',
  standalone: true,
  imports: [DogDisplayComponent],
  template: `
    <div class="toolbar">
      <div class="toolbar-header">Dogs</div>

      <div class="toolbar-new-row">
        <button type="button" class="btn-new-dog" (click)="newDogRequested.emit()">+ Neuer Dog</button>
      </div>

      <div class="toolbar-search-wrap">
        <label class="toolbar-search-sr" for="dog-toolbar-search">Dogs durchsuchen</label>
        <span class="toolbar-search-icon" aria-hidden="true">⌕</span>
        <input
          id="dog-toolbar-search"
          type="search"
          class="toolbar-search"
          autocomplete="off"
          placeholder="Suchen …"
          [value]="searchQuery()"
          (input)="searchQuery.set($any($event.target).value)" />
      </div>

      <div class="toolbar-section">
        <div class="section-label" (click)="baseCollapsed = !baseCollapsed">
          <span class="toggle">{{ baseCollapsed ? '▸' : '▾' }}</span>
          Base Dogs
        </div>
        @if (!baseCollapsed) {
          <div class="section-items">
            @for (dog of filteredBaseDogs(); track dog.id) {
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
              <div class="empty-hint">
                {{ searchQuery().trim() ? 'Keine Treffer' : 'Keine BaseDogs' }}
              </div>
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
            @for (dog of filteredSerializedDogs(); track dog.id) {
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
              <div class="empty-hint">
                {{ searchQuery().trim() ? 'Keine Treffer' : 'Keine SerializedDogs' }}
              </div>
            }
          </div>
        }
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

    .toolbar-new-row {
      flex-shrink: 0;
      padding: 8px 10px 6px;
      border-bottom: 1px solid #1f1f1f;
    }

    .toolbar-search-wrap {
      position: relative;
      flex-shrink: 0;
      padding: 8px 10px 10px;
      border-bottom: 1px solid #2a2a2a;
    }

    .toolbar-search-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .toolbar-search-icon {
      position: absolute;
      left: 1.15rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.85rem;
      opacity: 0.45;
      pointer-events: none;
    }

    .toolbar-search {
      width: 100%;
      box-sizing: border-box;
      padding: 0.45rem 0.5rem 0.45rem 1.85rem;
      border: 1px solid #333;
      border-radius: 6px;
      background: #111;
      color: #ddd;
      font-family: inherit;
      font-size: 11px;

      &::placeholder {
        color: #666;
      }

      &:focus {
        outline: none;
        border-color: #4a7a9e;
        box-shadow: 0 0 0 1px rgba(80, 140, 200, 0.2);
      }
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
        background: transparent;
        border: none;
        &:hover {
          background: transparent;
          border: none;
          color: #c8c8c8;
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
  /** Signal-Input: damit `computed`-Filter bei Daten vom Parent zuverlässig neu laufen. */
  readonly availableDogs = input<DogInfo[]>([]);

  readonly newDogRequested = output<void>();

  readonly searchQuery = signal('');

  baseCollapsed = false;
  serializedCollapsed = false;

  readonly filteredBaseDogs = computed(() => {
    const q = normalizeDogSearch(this.searchQuery());
    const list = this.availableDogs().filter(d => isBaseDog(d));
    if (!q) return list;
    return list.filter(d => this.dogMatchesSearch(d, q));
  });

  readonly filteredSerializedDogs = computed(() => {
    const q = normalizeDogSearch(this.searchQuery());
    const list = this.availableDogs().filter(d => !isBaseDog(d));
    if (!q) return list;
    return list.filter(d => this.dogMatchesSearch(d, q));
  });

  private dogMatchesSearch(dog: DogInfo, q: string): boolean {
    if (isBaseDog(dog)) {
      return dog.name.toLowerCase().includes(q) || dog.id.toLowerCase().includes(q);
    }
    const s = dog as SerializedDogInfo;
    const hay = [
      s.displayName,
      s.id,
      s.lineageId,
      s.parentId ?? undefined,
      s.theRun,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }

  getDogLabel(dog: DogInfo): string {
    return isBaseDog(dog) ? dog.name : dog.id;
  }

  getSerializedLabel(dog: DogInfo): string {
    const sd = dog as SerializedDogInfo;
    return sd.displayName || sd.id;
  }

  onDragStart(event: DragEvent, dog: DogInfo) {
    // For serialized dogs, drag the lineageId (lineage GUID) so the kennel tracks "latest".
    const dragId = !isBaseDog(dog) && (dog as SerializedDogInfo).lineageId
      ? (dog as SerializedDogInfo).lineageId!
      : dog.id;
    event.dataTransfer?.setData('application/dog-id', dragId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
}
