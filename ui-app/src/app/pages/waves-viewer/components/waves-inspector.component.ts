import { Component, HostListener, input, output } from '@angular/core';

export interface InspectorTab {
  id: string;
  label: string;
  dirty?: boolean;
  badge?: string | number;
}

/**
 * Right-side drawer container. Presentational shell — content comes via <ng-content>.
 * On mobile: full-width bottom-sheet from below with rounded top corners.
 * On tablet+: 420 px right drawer slide-in.
 * Optional tab bar at top for sub-views (Aufgabe/Query/Body/Versions).
 */
@Component({
  selector: 'app-waves-inspector',
  standalone: true,
  templateUrl: './waves-inspector.component.html',
  styleUrls: ['./waves-inspector.component.scss'],
})
export class WavesInspectorComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('');
  readonly subtitle = input<string | null>(null);
  readonly tabs = input<InspectorTab[]>([]);
  readonly activeTab = input<string | null>(null);
  /** When true: backdrop click closes drawer. */
  readonly dismissOnBackdrop = input<boolean>(true);

  readonly closeRequested = output<void>();
  readonly tabSelected = output<string>();

  onBackdropClick(): void {
    if (this.dismissOnBackdrop()) this.closeRequested.emit();
  }

  onClose(): void {
    this.closeRequested.emit();
  }

  onTabClick(id: string): void {
    this.tabSelected.emit(id);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) this.closeRequested.emit();
  }
}
