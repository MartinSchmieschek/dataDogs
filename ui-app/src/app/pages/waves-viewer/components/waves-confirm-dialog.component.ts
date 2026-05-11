import { Component, HostListener, input, output } from '@angular/core';

/**
 * Small modal confirm dialog for destructive actions.
 * Renders nothing when [open] is false. Esc + backdrop click both cancel.
 */
@Component({
  selector: 'app-waves-confirm-dialog',
  standalone: true,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="onCancel()"></div>
      <div class="dialog" role="alertdialog" [attr.aria-label]="title()">
        <div class="head">
          @if (icon() === 'danger') {
            <div class="icon icon--danger" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          }
          <div class="head-text">
            <div class="title">{{ title() }}</div>
            @if (message(); as m) { <div class="message">{{ m }}</div> }
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn-cancel" (click)="onCancel()">{{ cancelLabel() }}</button>
          <button type="button"
                  class="btn-confirm"
                  [class.is-danger]="variant() === 'danger'"
                  (click)="onConfirm()">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrls: ['./waves-confirm-dialog.component.scss'],
})
export class WavesConfirmDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Sicher?');
  readonly message = input<string | null>(null);
  readonly confirmLabel = input<string>('Bestätigen');
  readonly cancelLabel = input<string>('Abbrechen');
  readonly variant = input<'default' | 'danger'>('default');
  readonly icon = input<'danger' | null>(null);

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  onConfirm(): void { this.confirmed.emit(); }
  onCancel(): void { this.dismissed.emit(); }

  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.open()) this.onCancel(); }
}
