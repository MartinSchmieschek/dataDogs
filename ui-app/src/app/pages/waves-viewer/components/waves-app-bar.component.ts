import { Component, computed, ElementRef, HostListener, input, output, signal, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface AppBarStatus {
  /** 'ok' | 'dirty' | 'error' — drives the status dot color. */
  kind: 'ok' | 'dirty' | 'error';
  label: string;
}

export interface OverflowItem {
  id: string;
  label: string;
  href?: string;
  external?: boolean;
  routerLink?: any[];
  /** When set, item shows a tiny dirty-dot. */
  dirty?: boolean;
  /** When false, item is rendered but disabled. */
  enabled?: boolean;
}

/**
 * Compact sticky app-bar for the waves-viewer.
 * Pattern: ONE primary action (Run), title-block with status, overflow menu for everything else.
 * No competing buttons in the bar — secondary actions go to the overflow.
 */
@Component({
  selector: 'app-waves-app-bar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './waves-app-bar.component.html',
  styleUrls: ['./waves-app-bar.component.scss'],
})
export class WavesAppBarComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string | null>(null);
  readonly emoji = input<string | null>(null);
  readonly status = input<AppBarStatus | null>(null);
  readonly running = input<boolean>(false);
  readonly overflowItems = input<OverflowItem[]>([]);
  /** Persistent context-action chips shown next to title (e.g. open inspector tabs). */
  readonly chips = input<{ id: string; label: string; active?: boolean; dirty?: boolean }[]>([]);

  readonly runRequested = output<void>();
  readonly chipClicked = output<string>();
  readonly overflowSelected = output<string>();

  readonly menuOpen = signal(false);

  @ViewChild('menuWrap') menuWrap?: ElementRef<HTMLElement>;

  readonly statusClass = computed(() => `status-dot--${this.status()?.kind ?? 'ok'}`);

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onChipClick(id: string): void {
    this.chipClicked.emit(id);
  }

  onOverflowClick(item: OverflowItem): void {
    if (item.enabled === false) return;
    this.overflowSelected.emit(item.id);
    this.closeMenu();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(event: Event): void {
    if (!this.menuOpen()) return;
    const el = this.menuWrap?.nativeElement;
    if (!el) return;
    if (!el.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.menuOpen()) this.closeMenu();
  }
}
