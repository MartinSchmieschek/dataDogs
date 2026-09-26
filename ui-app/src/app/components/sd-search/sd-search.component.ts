import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Search (6.5 `sd-search`): a typewriter field on desktop, an icon on mobile that opens the field over the
 * bar. Emits every keystroke; the page debounces and writes `?q=`.
 */
@Component({
  selector: 'sd-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open() || !!value()' },
  template: `
    <button type="button" class="sd-btn sd-btn--icon sd-btn--bare icon" [attr.aria-label]="label()"
      (click)="expand()">⌕</button>
    <div class="field">
      <label class="sd-sr-only" [attr.for]="id">{{ label() }}</label>
      <input #box class="sd-field" type="search" [id]="id" autocomplete="off" spellcheck="false"
        [placeholder]="placeholder()" [value]="value()"
        (input)="valueChange.emit($any($event.target).value)"
        (keydown.escape)="clear()" (blur)="onBlur()" />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 420px; }
    .icon { display: none; }
    .field .sd-field { min-height: 36px; padding-top: 6px; padding-bottom: 6px; }
    @media (max-width: 767px) {
      :host { display: flex; justify-content: flex-end; max-width: none; }
      .icon { display: inline-flex; }
      .field { display: none; }
      :host(.is-open) .icon { display: none; }
      :host(.is-open) .field { display: block; flex: 1; }
    }
  `],
})
export class SdSearchComponent {
  private static seq = 0;
  readonly id = `sd-search-${++SdSearchComponent.seq}`;

  readonly value = input('');
  readonly label = input('Search');
  readonly placeholder = input('Search');
  readonly valueChange = output<string>();

  readonly open = signal(false);
  private readonly injector = inject(Injector);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');

  expand(): void {
    this.open.set(true);
    // The field becomes visible with the next render; focus it then.
    afterNextRender(() => this.box()?.nativeElement.focus(), { injector: this.injector });
  }

  clear(): void {
    if (this.value()) this.valueChange.emit('');
    this.open.set(false);
  }

  onBlur(): void {
    if (!this.value()) this.open.set(false);
  }
}
