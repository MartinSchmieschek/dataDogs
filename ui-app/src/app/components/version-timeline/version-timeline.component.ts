import {
  Component, Input, Output, EventEmitter,
  ElementRef, ViewChild, OnDestroy
} from '@angular/core';

export interface TimelineVersion {
  id: string;
  version: number;
}

@Component({
  selector: 'app-version-timeline',
  standalone: true,
  template: `
    <div class="timeline-container">
      <div class="timeline-label">Versionen</div>
      <div
        class="timeline-track"
        #trackEl
        (mousedown)="onTrackMouseDown($event)"
        (mousemove)="onTrackMouseMove($event)">
        <div class="track-line"></div>
        @for (v of versions; track v.id; let i = $index) {
          <div
            class="version-point"
            [class.current]="v.id === currentVersionId"
            [class.selected]="v.id === selectedVersionId && v.id !== currentVersionId"
            [class.older]="v.id !== currentVersionId && v.id !== selectedVersionId"
            [style.left.%]="getPointPosition(i)"
            [title]="'v' + v.version + (v.id === currentVersionId ? ' (aktuell)' : '')"
            (click)="selectVersion(v.id)">
            <div class="point-dot"></div>
            <span class="point-label">v{{ v.version }}</span>
          </div>
        }
      </div>
      @if (activeVersionLabel) {
        <div class="timeline-info">{{ activeVersionLabel }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .timeline-container {
      padding: 10px 14px 8px;
      background: #0a0a0a;
      border-top: 1px solid #2a2a2a;
    }

    .timeline-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #555;
      margin-bottom: 10px;
    }

    .timeline-track {
      position: relative;
      height: 32px;
      cursor: pointer;
      margin: 0 8px;
    }

    .track-line {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 2px;
      background: #2a2a2a;
      transform: translateY(-50%);
      border-radius: 1px;
    }

    .version-point {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      z-index: 1;
      cursor: pointer;
    }

    .point-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #444;
      border: 2px solid #333;
      transition: all 0.2s ease;
    }

    .point-label {
      font-size: 8px;
      color: #555;
      white-space: nowrap;
      transition: color 0.2s ease;
      position: absolute;
      top: 100%;
      margin-top: 2px;
    }

    .version-point:hover .point-dot {
      transform: scale(1.3);
    }
    .version-point:hover .point-label {
      color: #aaa;
    }

    .version-point.current .point-dot {
      width: 12px;
      height: 12px;
      background: #0099ff;
      border-color: #0066cc;
      box-shadow: 0 0 8px rgba(0, 153, 255, 0.5);
      animation: pulse 2s ease-in-out infinite;
    }
    .version-point.current .point-label {
      color: #0099ff;
      font-weight: bold;
    }

    .version-point.selected .point-dot {
      width: 12px;
      height: 12px;
      background: #00cc66;
      border-color: #009944;
      box-shadow: 0 0 6px rgba(0, 204, 102, 0.4);
    }
    .version-point.selected .point-label {
      color: #00cc66;
    }

    .version-point.older .point-dot {
      background: #333;
      border-color: #444;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 8px rgba(0, 153, 255, 0.5); }
      50% { box-shadow: 0 0 14px rgba(0, 153, 255, 0.8); }
    }

    .timeline-info {
      margin-top: 8px;
      font-size: 10px;
      color: #666;
      text-align: center;
    }
  `]
})
export class VersionTimelineComponent implements OnDestroy {
  @Input() versions: TimelineVersion[] = [];
  @Input() currentVersionId = '';
  @Input() selectedVersionId: string | null = null;
  @Output() versionSelected = new EventEmitter<string>();

  @ViewChild('trackEl') trackEl!: ElementRef<HTMLElement>;

  private isScrubbing = false;
  private boundMouseUp = this.onDocumentMouseUp.bind(this);
  private boundMouseMove = this.onDocumentMouseMove.bind(this);

  get activeVersionLabel(): string {
    if (this.selectedVersionId && this.selectedVersionId !== this.currentVersionId) {
      const v = this.versions.find(ver => ver.id === this.selectedVersionId);
      return v ? `v${v.version} geladen – Speichern erstellt neue Version` : '';
    }
    return '';
  }

  getPointPosition(index: number): number {
    if (this.versions.length <= 1) return 50;
    return (index / (this.versions.length - 1)) * 100;
  }

  selectVersion(versionId: string) {
    this.versionSelected.emit(versionId);
  }

  onTrackMouseDown(event: MouseEvent) {
    this.isScrubbing = true;
    this.scrubToPosition(event);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('mousemove', this.boundMouseMove);
  }

  onTrackMouseMove(event: MouseEvent) {
    if (this.isScrubbing) {
      this.scrubToPosition(event);
    }
  }

  private onDocumentMouseMove(event: MouseEvent) {
    if (this.isScrubbing) {
      this.scrubToPosition(event);
    }
  }

  private onDocumentMouseUp() {
    this.isScrubbing = false;
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
  }

  private scrubToPosition(event: MouseEvent) {
    if (!this.trackEl || this.versions.length === 0) return;

    const rect = this.trackEl.nativeElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const ratio = x / rect.width;

    const index = Math.round(ratio * (this.versions.length - 1));
    const clamped = Math.max(0, Math.min(index, this.versions.length - 1));
    const version = this.versions[clamped];

    if (version && version.id !== this.selectedVersionId) {
      this.versionSelected.emit(version.id);
    }
  }

  ngOnDestroy() {
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
  }
}
