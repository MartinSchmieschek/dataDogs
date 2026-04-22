import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IconMenuFanComponent,
  type IconMenuFanItem,
} from '../icon-menu-fan/icon-menu-fan.component';

export type KennelFanAction = 'edit' | 'share' | 'waves' | 'swagger' | 'swaggerJson' | 'delete';

/**
 * Sekundäre Aktionen für eine Kennel-Zeile — nutzt {@link IconMenuFanComponent}.
 */
@Component({
  selector: 'app-kennel-action-fan',
  standalone: true,
  imports: [IconMenuFanComponent],
  template: `
    <app-icon-menu-fan
      [items]="menuItems"
      [alignMenuToEnd]="alignMenuToEnd"
      toggleAriaLabel="Bearbeiten"
      toggleTitle="Bearbeiten"
      toggleIcon="✎"
      (itemSelect)="onItem($event)" />
  `,
})
export class KennelActionFanComponent {
  /** Menü rechts am Text: Dropdown nach links öffnen */
  @Input() alignMenuToEnd = false;

  @Output() action = new EventEmitter<KennelFanAction>();

  readonly menuItems: IconMenuFanItem[] = [
    { id: 'edit', label: 'Bearbeiten', icon: '✎' },
    { id: 'share', label: 'Teilen', icon: '↗', mobileOnly: true },
    { id: 'waves', label: 'Waves', icon: '≋' },
    { id: 'swagger', label: 'Swagger UI', icon: '📖' },
    { id: 'swaggerJson', label: 'OpenAPI JSON', icon: '📄' },
    { id: 'delete', label: 'Löschen', icon: '🗑', danger: true },
  ];

  onItem(id: string): void {
    this.action.emit(id as KennelFanAction);
  }
}
