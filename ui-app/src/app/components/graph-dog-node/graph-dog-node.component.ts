import { Component, Input, Output, EventEmitter, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { DogEntry } from '../../models/dog-entry.model';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';

/**
 * Graph node — icon + name. Click on the surrounding slot opens the inspector;
 * there is no separate edit button. Errors surface as a corner badge and as a
 * one-line message under the name when the node is selected.
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
        <span class="lead-star" title="Lead-Hund (API-Antwort)" aria-hidden="true">★</span>
      }

      @if (hasError) {
        <span class="error-badge" [title]="errorText || 'Fehler'" aria-label="Fehler">!</span>
      }

      <div class="graph-node-stack">
        <div class="node-hub" aria-hidden="true">
          <div class="node-icon-port" [class.node-icon-port--placeholder]="!icon?.trim()">
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
          @if (selected && hasError && errorText) {
            <span class="node-error-text" [title]="errorText">{{ errorText }}</span>
          }
        </div>
      </div>

      @if (isLead && (leadRunUrl || leadSwaggerUrl)) {
        <div class="lead-links" (pointerdown)="$event.stopPropagation()">
          @if (leadRunUrl) {
            <a class="lead-link lead-link--run"
               [href]="leadRunUrl"
               target="_blank"
               rel="noopener"
               title="Antwort (Server)"
               aria-label="Antwort öffnen">▶</a>
          }
          @if (leadSwaggerUrl) {
            <a class="lead-link lead-link--swagger"
               [href]="leadSwaggerUrl"
               target="_blank"
               rel="noopener"
               title="Swagger UI"
               aria-label="Swagger UI öffnen">📖</a>
          }
        </div>
      }
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
      transition: opacity 0.12s ease;
    }
    .graph-node-root.has-lead-actions { padding-bottom: 22px; }

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
        rgba(82, 92, 118, 0.55) 0%,
        rgba(32, 38, 56, 0.92) 62%,
        rgba(18, 22, 36, 0.96) 100%
      );
      border: 1px solid rgba(140, 160, 195, 0.38);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.30) inset,
        0 2px 10px rgba(0, 0, 0, 0.30);
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .node-icon-port--placeholder {
      border-color: rgba(130, 145, 175, 0.32);
      background: radial-gradient(
        120% 120% at 35% 28%,
        rgba(70, 78, 98, 0.5) 0%,
        rgba(26, 30, 44, 0.9) 55%,
        rgba(16, 20, 32, 0.95) 100%
      );
    }

    .graph-node-root.selected .node-icon-port {
      border-color: rgba(255, 168, 110, 0.7);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.30) inset,
        0 0 0 2px rgba(234, 88, 12, 0.35),
        0 2px 14px rgba(234, 88, 12, 0.20);
    }
    .graph-node-root.error .node-icon-port {
      border-color: rgba(244, 100, 100, 0.65);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.30) inset,
        0 0 0 2px rgba(220, 38, 38, 0.35),
        0 2px 14px rgba(220, 38, 38, 0.22);
    }

    .node-glyph {
      font-size: 2.15rem;
      line-height: 1;
      user-select: none;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
    }
    .node-glyph--placeholder { font-size: 1.85rem; opacity: 0.72; }

    .node-name-under {
      margin-top: 4px;
      width: 100%;
      max-width: 12rem;
      z-index: 1;
      text-align: center;
      pointer-events: none;
    }
    .graph-node-root.selected .node-name-under {
      max-width: min(22rem, 92vw);
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
    .graph-node-root.selected .node-name {
      color: #ffd9b8;
      text-shadow: 0 0 12px rgba(255, 170, 110, 0.30);
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      word-break: break-word;
      font-size: 11px;
      line-height: 1.3;
    }
    .graph-node-root.error .node-name { color: #ffb0b0; }
    .graph-node-root.mimic .node-name { font-style: italic; opacity: 0.92; }

    .node-desc-expanded {
      display: block;
      margin-top: 5px;
      font-size: 9.5px;
      font-weight: 400;
      line-height: 1.35;
      color: rgba(195, 208, 230, 0.92);
      word-break: break-word;
      white-space: pre-wrap;
      max-width: 100%;
      text-align: center;
    }
    .graph-node-root.selected.error .node-desc-expanded {
      color: rgba(255, 210, 210, 0.85);
    }

    .node-error-text {
      display: block;
      margin-top: 4px;
      padding: 3px 6px;
      font-size: 9.5px;
      font-weight: 500;
      line-height: 1.3;
      color: #ffd1d1;
      background: rgba(220, 38, 38, 0.22);
      border: 1px solid rgba(220, 38, 38, 0.45);
      border-radius: 4px;
      max-width: 100%;
      word-break: break-word;
      white-space: pre-wrap;
      text-align: left;
    }

    .lead-star {
      position: absolute;
      top: -2px;
      left: -2px;
      font-size: 11px;
      line-height: 1;
      color: #f5c542;
      text-shadow: 0 0 8px rgba(245, 197, 66, 0.45);
      pointer-events: none;
      user-select: none;
      z-index: 4;
    }

    .error-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #dc2626;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      line-height: 14px;
      text-align: center;
      box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25), 0 0 6px rgba(220, 38, 38, 0.4);
      pointer-events: none;
      user-select: none;
      z-index: 5;
    }

    .lead-links {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      z-index: 4;
      pointer-events: auto;
      opacity: 0.78;
      transition: opacity 0.15s ease;
    }
    .graph-node-root:hover .lead-links,
    .graph-node-root.selected .lead-links { opacity: 1; }

    .lead-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 18px;
      padding: 0 4px;
      font-size: 10px;
      line-height: 1;
      text-decoration: none;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid rgba(120, 130, 150, 0.45);
      color: rgba(235, 238, 248, 0.92);
    }
    .lead-link:hover { background: rgba(255, 255, 255, 0.08); }

    .lead-link--run {
      background: rgba(234, 88, 12, 0.22);
      border-color: rgba(234, 88, 12, 0.55);
    }
    .lead-link--swagger {
      background: rgba(46, 70, 46, 0.65);
      border-color: rgba(80, 120, 80, 0.55);
    }
  `],
})
export class GraphDogNodeComponent implements OnChanges {
  @Input({ required: true }) label!: string;
  @Input() icon?: string;
  @Input() selected = false;
  @Input() hasError = false;
  @Input() errorText: string | null = null;
  @Input() isSerialized = false;
  @Input() isMimic = false;
  @Input() isLead = false;
  @Input({ required: true }) dog!: DogEntry;
  @Input() leadRunUrl: string | null = null;
  @Input() leadSwaggerUrl: string | null = null;

  /** Kept for compatibility — parent still listens; no internal trigger remains. */
  @Output() sectionEditRequested = new EventEmitter<DogPanelSectionId>();

  private readonly dogRef = signal<DogEntry | null>(null);

  readonly displayName = computed(() => {
    const d = this.dogRef();
    if (d?.displayName?.trim()) return d.displayName.trim();
    if (d?.name) return d.name;
    return this.label ?? '';
  });

  readonly descriptionFull = computed(() => this.dogRef()?.description?.trim() ?? '');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dog'] && this.dog) {
      this.dogRef.set(this.dog);
    }
  }
}
