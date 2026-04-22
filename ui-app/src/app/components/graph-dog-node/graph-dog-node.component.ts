import { Component, Input, Output, EventEmitter, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { DogEntry } from '../../models/dog-entry.model';
import { DogPanelSectionId, getDefaultPanelSection } from '../../utils/dog-panel-sections';

/**
 * Graph-Knoten: Icon oben, Name zentriert darunter. Ausgewählt: voller Name + Beschreibung; sonst eine Zeile mit Ellipsis.
 */
@Component({
  selector: 'app-graph-dog-node',
  standalone: true,
  imports: [],
  template: `
    <div
      class="graph-node-root"
      [class.selected]="selected"
      [class.error]="hasError"
      [class.serialized]="isSerialized"
      [class.mimic]="isMimic"
      [class.has-lead-actions]="isLead && !!(leadRunUrl || leadSwaggerUrl)">
      @if (isLead) {
        <span class="lead-star" title="Lead-Hund (API-Antwort)">★</span>
      }
      <div class="graph-node-stack">
        <div class="node-hub" aria-hidden="true">
          <div
            class="node-icon-port"
            [class.node-icon-port--placeholder]="!icon?.trim()">
            @if (icon?.trim()) {
              <span class="node-glyph">{{ icon }}</span>
            } @else {
              <span class="node-glyph node-glyph--placeholder" title="Kein Icon">🐕</span>
            }
          </div>
        </div>
        <div class="node-name-under">
          <span class="node-name">{{ displayName() }}</span>
          @if (selected && descriptionFull()) {
            <span class="node-desc-expanded">{{ descriptionFull() }}</span>
          }
        </div>
      </div>
      @if (isLead && (leadRunUrl || leadSwaggerUrl)) {
        <div class="lead-links" (pointerdown)="$event.stopPropagation()">
          @if (leadRunUrl) {
            <a
              class="lead-link lead-link--run"
              [href]="leadRunUrl"
              target="_blank"
              rel="noopener"
              title="Antwort (Server) — öffentlicher Kennel-Endpunkt">▶</a>
          }
          @if (leadSwaggerUrl) {
            <a
              class="lead-link lead-link--swagger"
              [href]="leadSwaggerUrl"
              target="_blank"
              rel="noopener"
              title="Swagger UI">📖</a>
          }
        </div>
      }
      <div class="graph-edit-fan-wrap" (pointerdown)="$event.stopPropagation()">
        <button
          type="button"
          class="graph-edit-btn"
          aria-label="Bearbeiten"
          title="Bearbeiten — Panel mit Standard-Bereich öffnen"
          (click)="onEditButtonClick($event)">
          <span class="graph-edit-icon" aria-hidden="true">✎</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .graph-node-root {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: visible;
      background: transparent;
      border: none;
      border-radius: 0;
      transition: opacity 0.12s ease;
    }
    .graph-node-root.has-lead-actions {
      padding-bottom: 22px;
    }
    .graph-node-root.selected .node-name-under {
      max-width: min(22rem, 92vw);
    }
    .graph-node-root.selected .node-name {
      color: #b8dcff;
      text-shadow: 0 0 12px rgba(120, 180, 255, 0.35);
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      word-break: break-word;
      font-size: 11px;
      line-height: 1.3;
    }
    .node-desc-expanded {
      display: block;
      margin-top: 5px;
      font-size: 9.5px;
      font-weight: 400;
      line-height: 1.35;
      color: rgba(185, 198, 220, 0.94);
      word-break: break-word;
      white-space: pre-wrap;
      max-width: 100%;
      text-align: center;
    }
    .graph-node-root.selected.error .node-desc-expanded {
      color: rgba(255, 210, 210, 0.88);
    }
    .graph-node-root.selected.mimic .node-desc-expanded {
      font-style: italic;
      opacity: 0.95;
    }
    .graph-node-root.error .node-name {
      color: #ffb0b0;
    }
    .graph-node-root.mimic .node-name {
      font-style: italic;
      opacity: 0.92;
    }
    .graph-node-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
      position: relative;
      padding-top: 2px;
      box-sizing: border-box;
    }
    .node-hub {
      position: relative;
      width: 52px;
      height: 52px;
      flex-shrink: 0;
      z-index: 2;
      pointer-events: none;
    }
    .node-icon-port {
      box-sizing: border-box;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(
        120% 120% at 35% 28%,
        rgba(72, 82, 102, 0.55) 0%,
        rgba(28, 32, 44, 0.92) 62%,
        rgba(14, 16, 24, 0.96) 100%
      );
      border: 1px solid rgba(130, 150, 185, 0.38);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.35) inset,
        0 2px 10px rgba(0, 0, 0, 0.35);
    }
    .node-icon-port--placeholder {
      border-color: rgba(120, 135, 165, 0.32);
      background: radial-gradient(
        120% 120% at 35% 28%,
        rgba(60, 68, 88, 0.5) 0%,
        rgba(22, 26, 36, 0.9) 55%,
        rgba(12, 14, 22, 0.95) 100%
      );
    }
    .node-glyph {
      font-size: 2.15rem;
      line-height: 1;
      user-select: none;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
    }
    .node-glyph--placeholder {
      font-size: 1.85rem;
      opacity: 0.72;
    }
    .node-name-under {
      margin-top: 4px;
      width: 100%;
      max-width: 12rem;
      z-index: 1;
      text-align: center;
      pointer-events: none;
    }
    .node-name {
      pointer-events: auto;
      display: block;
      font-size: 10px;
      font-weight: 600;
      color: #f2f4f8;
      line-height: 1.2;
      max-width: 100%;
      margin: 0 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lead-star {
      position: absolute;
      top: 0;
      left: 0;
      font-size: 11px;
      line-height: 1;
      color: #e6b800;
      text-shadow: 0 0 8px rgba(230, 184, 0, 0.45);
      pointer-events: none;
      user-select: none;
      z-index: 4;
    }
    .lead-links {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
      z-index: 4;
      pointer-events: auto;
    }
    .lead-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 20px;
      padding: 0 5px;
      font-size: 11px;
      line-height: 1;
      text-decoration: none;
      border-radius: 4px;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid rgba(120, 130, 150, 0.45);
      color: rgba(235, 238, 248, 0.95);
      opacity: 0.88;
    }
    .lead-link:hover {
      opacity: 1;
    }
    .lead-link--run {
      background: rgba(58, 48, 80, 0.92);
      border-color: rgba(120, 100, 160, 0.55);
    }
    .lead-link--swagger {
      background: rgba(36, 58, 36, 0.92);
      border-color: rgba(70, 110, 70, 0.55);
    }
    .graph-edit-fan-wrap {
      --graph-edit-btn-size: 24px;
      position: absolute;
      top: -6px;
      right: -6px;
      z-index: 5;
      pointer-events: auto;
    }

    .graph-edit-btn {
      width: var(--graph-edit-btn-size);
      height: var(--graph-edit-btn-size);
      padding: 0;
      border-radius: 50%;
      border: 1px solid rgba(110, 125, 145, 0.5);
      background: linear-gradient(165deg, rgba(42, 50, 62, 0.95) 0%, rgba(22, 26, 34, 0.98) 100%);
      color: rgba(210, 218, 230, 0.92);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.12s ease, background 0.12s ease, transform 0.12s ease;
    }

    .graph-edit-btn:hover {
      border-color: rgba(160, 180, 210, 0.7);
      background: linear-gradient(165deg, rgba(52, 62, 78, 0.95) 0%, rgba(28, 34, 44, 0.98) 100%);
    }

    .graph-edit-btn:active {
      transform: scale(0.96);
    }

    .graph-edit-btn:focus-visible {
      outline: 2px solid rgba(110, 150, 200, 0.75);
      outline-offset: 2px;
    }

    .graph-edit-icon {
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
  @Input() isMimic = false;
  @Input() isLead = false;
  @Input({ required: true }) dog!: DogEntry;
  @Input() leadRunUrl: string | null = null;
  @Input() leadSwaggerUrl: string | null = null;

  @Output() sectionEditRequested = new EventEmitter<DogPanelSectionId>();

  private readonly dogRef = signal<DogEntry | null>(null);

  readonly displayName = computed(() => {
    const d = this.dogRef();
    if (d?.displayName?.trim()) return d.displayName.trim();
    if (d?.name) return d.name;
    return this.label ?? '';
  });

  /** Volle Beschreibung (nur bei Auswahl im Graph sichtbar). */
  readonly descriptionFull = computed(() => this.dogRef()?.description?.trim() ?? '');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dog'] && this.dog) {
      this.dogRef.set(this.dog);
    }
  }

  onEditButtonClick(ev: MouseEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.sectionEditRequested.emit(getDefaultPanelSection(this.dog));
  }
}
