import { Component, computed, input, output, signal } from '@angular/core';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../models/dog.model';
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
      <div class="toolbar-header">
        <div class="toolbar-title">Dogs</div>
        @if (showCloseButton()) {
          <button type="button" class="btn-close" (click)="closeRequested.emit()" aria-label="Schließen">×</button>
        }
      </div>

      <div class="toolbar-new-row">
        <button type="button" class="btn-new-dog" (click)="newDogRequested.emit()">
          <span class="plus">+</span> Neuer Dog
        </button>
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

      <div class="toolbar-scroll">
        <div class="toolbar-section">
          <button type="button" class="section-label" (click)="baseCollapsed = !baseCollapsed">
            <span class="toggle">{{ baseCollapsed ? '▸' : '▾' }}</span>
            Base Dogs
            <span class="count">{{ filteredBaseDogs().length }}</span>
          </button>
          @if (!baseCollapsed) {
            <div class="section-items">
              @for (dog of filteredBaseDogs(); track dog.id) {
                <div
                  class="toolbar-item base"
                  draggable="true"
                  (dragstart)="onDragStart($event, dog)">
                  <span class="drag-handle" aria-hidden="true">⠿</span>
                  <div class="item-body">
                    <app-dog-display
                      class="item-name"
                      [label]="getDogLabel(dog)"
                      [icon]="dog.icon"
                      variant="toolbar" />
                    @if (dog.description) {
                      <div class="item-desc">{{ dog.description }}</div>
                    }
                  </div>
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
          <button type="button" class="section-label" (click)="serializedCollapsed = !serializedCollapsed">
            <span class="toggle">{{ serializedCollapsed ? '▸' : '▾' }}</span>
            Serialized Dogs
            <span class="count">{{ filteredSerializedDogs().length }}</span>
          </button>
          @if (!serializedCollapsed) {
            <div class="section-items">
              @for (dog of filteredSerializedDogs(); track dog.id) {
                <div
                  class="toolbar-item serialized"
                  draggable="true"
                  (dragstart)="onDragStart($event, dog)">
                  <span class="drag-handle" aria-hidden="true">⠿</span>
                  <div class="item-body">
                    <app-dog-display
                      class="item-name"
                      [label]="getSerializedLabel(dog)"
                      [icon]="dog.icon"
                      variant="toolbar" />
                    @if (getSerializedDescription(dog); as desc) {
                      <div class="item-desc">{{ desc }}</div>
                    }
                  </div>
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
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .toolbar {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #ffffff;
      color: #1a2236;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      user-select: none;
    }

    .toolbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      flex-shrink: 0;
    }

    .toolbar-title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #5a6378;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #5a6378;
      font-size: 28px;
      line-height: 1;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s;

      &:hover { background: #f1f3f7; color: #1a2236; }
    }

    .toolbar-new-row {
      flex-shrink: 0;
      padding: 0 16px 10px;
    }

    .toolbar-search-wrap {
      position: relative;
      flex-shrink: 0;
      padding: 0 16px 12px;
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
      left: 28px;
      top: 50%;
      transform: translateY(calc(-50% - 6px));
      font-size: 14px;
      color: #8a93a4;
      pointer-events: none;
    }

    .toolbar-search {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px 10px 34px;
      border: 1px solid #e4e8ef;
      border-radius: 10px;
      background: #f7f8fa;
      color: #1a2236;
      font-family: inherit;
      font-size: 14px;

      &::placeholder { color: #8a93a4; }

      &:focus {
        outline: none;
        border-color: #2563eb;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }
    }

    .toolbar-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding-bottom: 16px;
    }

    .toolbar-section {
      margin-top: 4px;
    }

    .section-label {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #5a6378;
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: inherit;

      &:hover { background: #f4f6fa; color: #1a2236; }
    }

    .toggle {
      font-size: 10px;
      color: #8a93a4;
      width: 12px;
      flex-shrink: 0;
    }

    .count {
      margin-left: auto;
      font-size: 11px;
      color: #8a93a4;
      background: #f1f3f7;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 500;
    }

    .section-items {
      padding: 4px 8px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .toolbar-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: grab;
      transition: background 0.15s, box-shadow 0.15s, transform 0.05s;
      border: 1px solid transparent;
      background: #ffffff;
      min-height: 44px;

      &:active {
        cursor: grabbing;
        transform: scale(0.99);
      }

      &.base {
        background: #f7f8fa;
        &:hover {
          background: #eef1f7;
          border-color: #d8dde6;
        }
      }

      &.serialized {
        background: #eef4ff;
        &:hover {
          background: #e3edff;
          border-color: #bcd2f8;
        }
      }
    }

    .drag-handle {
      color: #c0c6d2;
      font-size: 14px;
      line-height: 1.4;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .item-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .item-name {
      min-width: 0;
      font-size: 14px;
      color: #1a2236;
      font-weight: 500;
    }

    .item-desc {
      font-size: 12px;
      line-height: 1.4;
      color: #5a6378;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }

    .empty-hint {
      padding: 12px 16px;
      font-size: 13px;
      color: #8a93a4;
      font-style: italic;
    }

    .btn-new-dog {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #d8dde6;
      border-radius: 10px;
      background: #ffffff;
      color: #1a2236;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;

      .plus {
        color: #2563eb;
        font-weight: 700;
        font-size: 16px;
      }

      &:hover {
        background: #f4f6fa;
        border-color: #2563eb;
        color: #2563eb;
      }
    }
  `]
})
export class DogToolbarComponent {
  /** Signal-Input: damit `computed`-Filter bei Daten vom Parent zuverlässig neu laufen. */
  readonly availableDogs = input<DogInfo[]>([]);
  /** Wenn true: Schließen-Button im Header zeigen (für Popover/Sheet-Kontext). */
  readonly showCloseButton = input<boolean>(false);

  readonly newDogRequested = output<void>();
  readonly closeRequested = output<void>();

  readonly searchQuery = signal('');

  baseCollapsed = false;
  serializedCollapsed = false;

  readonly filteredBaseDogs = computed<BaseDogInfo[]>(() => {
    const q = normalizeDogSearch(this.searchQuery());
    const list = this.availableDogs().filter(isBaseDog);
    if (!q) return list;
    return list.filter(d => this.dogMatchesSearch(d, q));
  });

  readonly filteredSerializedDogs = computed<SerializedDogInfo[]>(() => {
    const q = normalizeDogSearch(this.searchQuery());
    const list = this.availableDogs().filter((d): d is SerializedDogInfo => !isBaseDog(d));
    if (!q) return list;
    return list.filter(d => this.dogMatchesSearch(d, q));
  });

  private dogMatchesSearch(dog: DogInfo, q: string): boolean {
    if (isBaseDog(dog)) {
      return dog.name.toLowerCase().includes(q)
        || dog.id.toLowerCase().includes(q)
        || (dog.description?.toLowerCase().includes(q) ?? false);
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

  /** Pulls a short, single-line preview from the dog's `theRun` source — used as fallback description. */
  getSerializedDescription(dog: DogInfo): string | null {
    if (isBaseDog(dog)) return null;
    const sd = dog as SerializedDogInfo;
    const code = sd.theRun?.trim();
    if (!code) return null;
    const firstLine = code.split('\n').find(l => l.trim().length > 0)?.trim() ?? '';
    if (!firstLine) return null;
    return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
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
