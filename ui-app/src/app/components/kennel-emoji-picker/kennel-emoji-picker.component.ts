import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { KENNEL_EMOJI_PRESETS } from '../../data/kennel-emoji-presets';

@Component({
  selector: 'app-kennel-emoji-picker',
  standalone: true,
  template: `
    <div class="kep">
      <div class="kep-row">
        <span class="kep-preview" aria-hidden="true">{{ displayEmoji() }}</span>
        <button
          type="button"
          class="kep-toggle"
          (click)="toggle($event)"
          [attr.aria-expanded]="pickerOpen()"
          aria-haspopup="dialog">
          {{ pickerOpen() ? 'Schließen' : 'Auswählen' }}
        </button>
      </div>
      @if (pickerOpen()) {
        <div class="kep-panel" role="dialog" aria-label="Emoji auswählen" (click)="$event.stopPropagation()">
          <div class="kep-grid">
            @for (e of presets; track e) {
              <button
                type="button"
                class="kep-cell"
                [class.kep-cell--active]="isActive(e)"
                (click)="pick(e)"
                [attr.aria-label]="'Emoji ' + e">
                {{ e }}
              </button>
            }
          </div>
          <div class="kep-footer">
            <button type="button" class="kep-clear" (click)="clear()">Kein Emoji</button>
          </div>
          <label class="kep-custom-label" for="kep-custom-input">Oder eigene Zeichen (max. 8)</label>
          <input
            id="kep-custom-input"
            class="kep-custom"
            type="text"
            maxlength="8"
            [value]="emoji"
            (input)="onCustomInput($event)"
            placeholder="…"
            autocomplete="off"
            spellcheck="false" />
        </div>
      }
    </div>
  `,
  styles: [`
    .kep {
      position: relative;
      max-width: 22rem;
    }
    .kep-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .kep-preview {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.75rem;
      height: 2.75rem;
      padding: 0 6px;
      font-size: 1.75rem;
      line-height: 1;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(90, 100, 115, 0.55);
      border-radius: 6px;
      user-select: none;
    }
    .kep-toggle {
      padding: 6px 12px;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      border-radius: 5px;
      border: 1px solid rgba(100, 110, 125, 0.65);
      background: rgba(40, 44, 52, 0.95);
      color: rgba(230, 235, 245, 0.92);
    }
    .kep-toggle:hover {
      border-color: rgba(130, 145, 165, 0.75);
      background: rgba(50, 54, 64, 0.98);
    }
    .kep-panel {
      position: absolute;
      z-index: 50;
      left: 0;
      top: calc(100% + 6px);
      width: min(100%, 20rem);
      padding: 10px;
      border-radius: 8px;
      border: 1px solid rgba(80, 90, 105, 0.55);
      background: rgba(16, 18, 24, 0.98);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
    }
    .kep-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
    }
    @media (max-width: 480px) {
      .kep-grid {
        grid-template-columns: repeat(6, 1fr);
      }
    }
    .kep-cell {
      margin: 0;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      font-size: 1.35rem;
      line-height: 1.2;
      cursor: pointer;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .kep-cell:hover {
      background: rgba(100, 140, 200, 0.15);
      border-color: rgba(100, 130, 170, 0.35);
    }
    .kep-cell--active {
      border-color: rgba(120, 170, 220, 0.55);
      background: rgba(60, 90, 130, 0.25);
    }
    .kep-footer {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(70, 80, 95, 0.45);
    }
    .kep-clear {
      width: 100%;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
      border-radius: 5px;
      border: 1px solid rgba(90, 100, 115, 0.5);
      background: rgba(35, 38, 46, 0.95);
      color: rgba(200, 205, 215, 0.9);
    }
    .kep-clear:hover {
      background: rgba(45, 48, 58, 0.98);
    }
    .kep-custom-label {
      display: block;
      margin-top: 10px;
      margin-bottom: 4px;
      font-size: 11px;
      letter-spacing: 0.04em;
      color: rgba(150, 160, 175, 0.85);
    }
    .kep-custom {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      font-size: 1.1rem;
      border-radius: 5px;
      border: 1px solid rgba(80, 90, 105, 0.55);
      background: rgba(0, 0, 0, 0.35);
      color: #fff;
    }
  `],
})
export class KennelEmojiPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly presets = KENNEL_EMOJI_PRESETS;

  @Input() emoji = '';
  @Output() emojiChange = new EventEmitter<string>();

  readonly pickerOpen = signal(false);

  displayEmoji(): string {
    const e = this.emoji?.trim();
    return e ? e : '—';
  }

  isActive(e: string): boolean {
    return this.emoji?.trim() === e;
  }

  toggle(ev: Event): void {
    ev.stopPropagation();
    this.pickerOpen.update((o) => !o);
  }

  pick(e: string): void {
    this.emojiChange.emit(e);
    this.pickerOpen.set(false);
  }

  clear(): void {
    this.emojiChange.emit('');
    this.pickerOpen.set(false);
  }

  onCustomInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.emojiChange.emit(v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.pickerOpen()) return;
    const t = ev.target as Node;
    if (this.host.nativeElement.contains(t)) return;
    this.pickerOpen.set(false);
  }
}
