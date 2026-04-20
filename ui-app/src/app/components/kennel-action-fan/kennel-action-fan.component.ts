import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';

export type KennelFanAction = 'edit' | 'share' | 'copy' | 'waves' | 'swagger' | 'swaggerJson' | 'delete';

interface KennelMenuItem {
  id: KennelFanAction;
  label: string;
  icon: string;
  danger?: boolean;
  /** Nur schmale Viewports (Teilen / Web Share API) */
  mobileOnly?: boolean;
}

/**
 * Sekundäre Aktionen für eine Kennel-Zeile.
 * Ein Bearbeiten-Button öffnet das Menü (Bearbeiten, Waves, Swagger, JSON, Löschen).
 * Execute liegt beim Parent.
 */
@Component({
  selector: 'app-kennel-action-fan',
  standalone: true,
  template: `
    <div class="kennel-actions-row" (pointerdown)="$event.stopPropagation()">
      <div class="kennel-more-wrap" [class.kennel-more-wrap--open]="moreOpen">
        <button
          type="button"
          class="kennel-row-btn kennel-more-btn"
          [class.is-open]="moreOpen"
          [attr.aria-expanded]="moreOpen"
          aria-haspopup="menu"
          (click)="toggleMore($event)"
          aria-label="Bearbeiten"
          title="Bearbeiten">
          <span class="kennel-row-icon" aria-hidden="true">✎</span>
        </button>

        @if (moreOpen) {
          <div class="kennel-more-menu" role="menu">
            @for (item of menuItems; track item.id) {
              @if (item.danger) {
                <div class="kennel-more-sep" aria-hidden="true"></div>
              }
              <button
                type="button"
                role="menuitem"
                class="kennel-more-item"
                [class.kennel-more-item--danger]="item.danger"
                [class.kennel-more-item--mobile-only]="item.mobileOnly"
                (click)="menuAction(item.id, $event)">
                <span class="kennel-more-icon" aria-hidden="true">{{ item.icon }}</span>
                <span class="kennel-more-label">{{ item.label }}</span>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .kennel-actions-row {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .kennel-row-btn {
      width: var(--kennel-fan-btn-size, 34px);
      height: var(--kennel-fan-btn-size, 34px);
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
    .kennel-row-btn:hover {
      border-color: rgba(160, 180, 210, 0.7);
      background: linear-gradient(165deg, rgba(52, 62, 78, 0.95) 0%, rgba(28, 34, 44, 0.98) 100%);
    }
    .kennel-row-btn:active {
      transform: scale(0.96);
    }
    .kennel-row-btn:focus-visible {
      outline: 2px solid rgba(110, 150, 200, 0.75);
      outline-offset: 2px;
    }
    .kennel-row-btn.is-open {
      border-color: rgba(160, 180, 210, 0.85);
      background: linear-gradient(165deg, rgba(58, 70, 90, 0.98) 0%, rgba(32, 38, 50, 0.99) 100%);
    }
    .kennel-row-icon {
      font-size: 14px;
      line-height: 1;
    }

    .kennel-more-wrap {
      position: relative;
      z-index: 0;
    }

    .kennel-more-wrap--open {
      z-index: 480;
    }
    .kennel-more-menu {
      /* Immer LTR: Icon links, Label rechts — unabhängig von Seiten-RTL / Bidi */
      direction: ltr;
      unicode-bidi: isolate;
      position: absolute;
      left: 0;
      right: auto;
      top: calc(100% + 6px);
      z-index: 500;
      min-width: 11.5rem;
      display: flex;
      flex-direction: column;
      padding: 0.3rem;
      border: 1px solid rgba(140, 160, 190, 0.35);
      border-radius: 8px;
      background: linear-gradient(170deg, rgba(28, 36, 50, 1) 0%, rgba(16, 20, 30, 1) 100%);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
      animation: kennel-more-in 0.12s ease-out;
      isolation: isolate;
    }

    :host(.kennel-action-fan--menu-end) .kennel-more-menu {
      left: auto;
      right: 0;
    }
    @keyframes kennel-more-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .kennel-more-item {
      direction: ltr;
      unicode-bidi: isolate;
      box-sizing: border-box;
      margin: 0;
      width: 100%;
      border: none;
      font: inherit;
      text-align: start;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 0.65rem;
      padding: 0.5rem 0.65rem;
      border-radius: 5px;
      font-size: 0.825rem;
      color: rgba(220, 228, 240, 0.96);
      background: rgba(12, 16, 24, 0.55);
      cursor: pointer;
      transition: background 0.1s ease, color 0.1s ease;
    }
    .kennel-more-item:hover,
    .kennel-more-item:focus-visible {
      background: rgba(80, 110, 160, 0.25);
      color: rgba(240, 246, 255, 1);
      outline: none;
    }
    .kennel-more-item--danger {
      color: rgba(230, 160, 160, 0.95);
    }
    .kennel-more-item--danger:hover,
    .kennel-more-item--danger:focus-visible {
      background: rgba(140, 50, 50, 0.28);
      color: rgba(255, 210, 210, 1);
    }
    .kennel-more-icon {
      font-size: 14px;
      line-height: 1;
      width: 1.1rem;
      text-align: center;
      opacity: 0.9;
    }
    .kennel-more-sep {
      height: 1px;
      margin: 0.25rem 0.3rem;
      background: rgba(255, 255, 255, 0.08);
    }

    .kennel-more-item--mobile-only {
      display: none;
    }

    @media (max-width: 640px) {
      .kennel-more-item--mobile-only {
        display: flex;
      }
    }

    @media (max-width: 560px) {
      .kennel-actions-row {
        gap: 10px;
      }
      .kennel-row-btn {
        width: var(--kennel-fan-btn-size, 40px);
        height: var(--kennel-fan-btn-size, 40px);
      }
      .kennel-row-icon {
        font-size: 16px;
      }
      .kennel-more-menu {
        min-width: 13rem;
      }
      .kennel-more-item {
        padding: 0.65rem 0.75rem;
        font-size: 0.9rem;
      }
    }
  `],
})
export class KennelActionFanComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Menü rechts am Text: Dropdown nach links öffnen */
  @Input() alignMenuToEnd = false;

  @Output() action = new EventEmitter<KennelFanAction>();

  moreOpen = false;

  @HostBinding('class.kennel-action-fan--open')
  get fanMenuOpen(): boolean {
    return this.moreOpen;
  }

  @HostBinding('class.kennel-action-fan--menu-end')
  get menuEndHost(): boolean {
    return this.alignMenuToEnd;
  }

  readonly menuItems: KennelMenuItem[] = [
    { id: 'edit', label: 'Bearbeiten', icon: '✎' },
    { id: 'share', label: 'Teilen', icon: '↗', mobileOnly: true },
    { id: 'copy', label: 'Kopieren', icon: '⎘' },
    { id: 'waves', label: 'Waves', icon: '≋' },
    { id: 'swagger', label: 'Swagger UI', icon: '📖' },
    { id: 'swaggerJson', label: 'OpenAPI JSON', icon: '📄' },
    { id: 'delete', label: 'Löschen', icon: '🗑', danger: true },
  ];

  toggleMore(ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.moreOpen = !this.moreOpen;
  }

  menuAction(id: KennelFanAction, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.moreOpen = false;
    this.action.emit(id);
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMousedown(ev: MouseEvent): void {
    if (!this.moreOpen) return;
    if (this.host.nativeElement.contains(ev.target as Node)) return;
    this.moreOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.moreOpen) this.moreOpen = false;
  }
}
