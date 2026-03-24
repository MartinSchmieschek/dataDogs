import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  trigger,
  transition,
  style,
  animate,
  type AnimationEvent,
} from '@angular/animations';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';

/**
 * Gemeinsames Comfort-Video-Dialog — Fehler, Easter-Egg, später beliebig via {@link ErrorVideoPopupService.openWithConfig}.
 */
@Component({
  selector: 'app-error-video-popup',
  standalone: true,
  animations: [
    /** Einmalig bei :enter; lange Haltephase, dann langsames Auslaufen (starker Ease-Out). */
    trigger('voidTopLid', [
      transition(':enter', [
        style({ transform: 'translateY(0)' }),
        animate(
          '2200ms 520ms cubic-bezier(0.14, 0.82, 0.22, 1)',
          style({ transform: 'translateY(-200%)' })
        ),
      ]),
    ]),
    trigger('voidBottomLid', [
      transition(':enter', [
        style({ transform: 'translateY(0)' }),
        animate(
          '2200ms 520ms cubic-bezier(0.14, 0.82, 0.22, 1)',
          style({ transform: 'translateY(200%)' })
        ),
      ]),
    ]),
  ],
  template: `
    @if (popup.open()) {
      <div
        class="evp-backdrop"
        [class.evp-backdrop--void]="popup.variant() === 'void'"
        (click)="close()"
        aria-hidden="true"></div>
      @if (popup.variant() === 'void') {
        <div
          class="evp-void-root"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="displayHeadLabel()"
          [attr.aria-describedby]="voidAriaDescribedBy()"
          (click)="close()">
          <span id="evp-void-dismiss-hint" class="evp-sr-only">
            Klick auf die Fläche oder Escape schließt das Fenster.
          </span>
          <div class="evp-void-cinema">
            <div class="evp-void-video-layer">
              <div class="evp-void-frame-scale-wrap">
                <iframe
                  class="evp-void-frame"
                  [src]="safeEmbed()"
                  title="YouTube"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen></iframe>
              </div>
            </div>
            <div class="evp-void-vignette" aria-hidden="true"></div>
            @if (hasVoidSubtitles()) {
              <div
                id="evp-void-subtitles"
                class="evp-void-subtitles"
                aria-live="polite">
                @for (line of voidLines(); track $index) {
                  <p class="evp-void-sub-line">{{ line }}</p>
                }
              </div>
            }
            <div
              class="evp-void-dismiss-sheet"
              aria-hidden="true"
              (click)="close(); $event.stopPropagation()"></div>
          </div>
          <div
            class="evp-void-lid evp-void-lid--top"
            [class.evp-void-lid--retired]="voidEyelidsRetired()"
            @voidTopLid
            (@voidTopLid.done)="onVoidEyelidsAnimationDone($event)"
            aria-hidden="true"></div>
          <div
            class="evp-void-lid evp-void-lid--bottom"
            [class.evp-void-lid--retired]="voidEyelidsRetired()"
            @voidBottomLid
            aria-hidden="true"></div>
        </div>
      } @else {
        <div
          class="evp-dialog"
          [class.evp-dialog--message]="showMessagePanel()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="popup.heading()?.trim() ? headingId : null"
          [attr.aria-label]="popup.heading()?.trim() ? null : displayHeadLabel()">
          <div class="evp-head">
            <span class="evp-head-label">{{ displayHeadLabel() }}</span>
            <button type="button" class="evp-close" (click)="close()" aria-label="Schließen">
              ×
            </button>
          </div>
          @if (showMessagePanel()) {
            <div class="evp-message-panel">
              @if (popup.heading()?.trim()) {
                <h2 [id]="headingId" class="evp-message-heading">{{ popup.heading() }}</h2>
              }
              @if (popup.message()?.trim()) {
                <pre class="evp-message-text">{{ popup.message() }}</pre>
              }
            </div>
          }
          <div class="evp-video-block">
            @if (showVideoCaption()) {
              <p class="evp-video-caption">{{ popup.videoCaption() }}</p>
            }
            <div class="evp-frame-wrap">
              <iframe
                class="evp-frame"
                [src]="safeEmbed()"
                title="YouTube"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen></iframe>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`

    .evp-backdrop {

      position: fixed;

      inset: 0;

      z-index: 200000;

      background: rgba(0, 0, 0, 0.72);

      backdrop-filter: blur(4px);

    }

    /* Volle Fläche: Transparenz/Blur hier, nicht am Iris-Button (sonst „locht“ das Video). */
    .evp-backdrop--void {

      background: rgba(0, 2, 8, 0.91);

      backdrop-filter: blur(16px) saturate(0.82);

      -webkit-backdrop-filter: blur(16px) saturate(0.82);

      animation: evp-void-backdrop-shock 1.05s cubic-bezier(0.22, 0.61, 0.36, 1) 1
        forwards;

    }

    @keyframes evp-void-backdrop-shock {

      0% {
        opacity: 0.35;
        filter: brightness(2.2);
      }

      10% {
        opacity: 1;
        filter: brightness(0.35) contrast(1.15);
      }

      28% {
        filter: brightness(1.08) contrast(1.02);
      }

      100% {
        opacity: 1;
        filter: brightness(1) contrast(1);
      }

    }

    /* ——— Void Kino ——— */

    .evp-void-root {

      position: fixed;

      z-index: 200001;

      inset: 0;

      padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
        env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0);

      box-sizing: border-box;

      display: flex;

      align-items: stretch;

      justify-content: stretch;

      pointer-events: auto;

      cursor: pointer;

      overflow: hidden;

      isolation: isolate;

      animation: evp-void-cinema-shock 1.15s cubic-bezier(0.2, 0.75, 0.35, 1) 1 forwards;

    }

    @keyframes evp-void-cinema-shock {

      0% {
        opacity: 0;
        transform: scale(1.04);
        filter: saturate(0) brightness(1.4);
      }

      12% {
        opacity: 1;
        transform: scale(0.992);
        filter: saturate(0.4) brightness(0.55);
      }

      35% {
        transform: scale(1);
        filter: saturate(0.95) brightness(1.05);
      }

      100% {
        opacity: 1;
        transform: scale(1);
        filter: saturate(1) brightness(1);
      }

    }

    .evp-sr-only {

      position: absolute;

      width: 1px;

      height: 1px;

      padding: 0;

      margin: -1px;

      overflow: hidden;

      clip: rect(0, 0, 0, 0);

      white-space: nowrap;

      border: 0;

    }

    .evp-void-dismiss-sheet {

      position: absolute;

      inset: 0;

      z-index: 15;

      background: transparent;

    }

    .evp-void-lid {

      position: absolute;

      left: 0;

      right: 0;

      height: 50.5vh;

      z-index: 10;

      pointer-events: none;

      will-change: transform;

      backface-visibility: hidden;

      background: linear-gradient(
        180deg,
        #010204 0%,
        #050810 40%,
        #020308 100%
      );

      box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.85);

    }

    .evp-void-lid--top {

      top: 0;

      transform-origin: 50% 0%;

    }

    .evp-void-lid--bottom {

      bottom: 0;

      transform-origin: 50% 100%;

    }

    .evp-void-lid--retired {

      display: none !important;

    }

    .evp-void-cinema {

      position: relative;

      flex: 1;

      z-index: 1;

      min-height: min(100vh, 100dvh);

      width: 100%;

      overflow: hidden;

      background: #000006;

      border: 1px solid rgba(60, 100, 140, 0.35);

      box-shadow:
        0 0 0 1px rgba(100, 160, 220, 0.08),
        0 24px 100px rgba(0, 12, 28, 0.75);

    }

    .evp-void-video-layer {

      position: absolute;

      inset: 0;

      z-index: 1;

    }

    .evp-void-frame-scale-wrap {

      position: absolute;

      inset: 0;

      overflow: hidden;

    }

    .evp-void-frame {

      position: absolute;

      left: 50%;

      top: 50%;

      width: 100vw;

      height: 56.25vw;

      min-height: 100%;

      min-width: 177.78vh;

      transform: translate(-50%, -50%) scale(1.1);

      border: 0;

    }

    .evp-void-vignette {

      position: absolute;

      inset: 0;

      z-index: 2;

      pointer-events: none;

      background:
        radial-gradient(ellipse 85% 70% at 50% 45%, transparent 30%, rgba(0, 0, 0, 0.55) 100%),
        linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, transparent 22%, transparent 62%, rgba(0, 0, 0, 0.75) 100%);

    }

    .evp-void-subtitles {

      position: absolute;

      left: 50%;

      bottom: max(1.25rem, env(safe-area-inset-bottom, 1.25rem));

      transform: translateX(-50%);

      z-index: 3;

      max-width: min(36rem, calc(100vw - 2.5rem));

      text-align: center;

      padding: 0 1rem;

    }

    .evp-void-sub-line {

      margin: 0;

      font-family: Georgia, 'Times New Roman', serif;

      font-size: clamp(0.8rem, 2.1vw, 1rem);

      font-style: italic;

      font-weight: 400;

      line-height: 1.55;

      letter-spacing: 0.04em;

      color: rgba(220, 232, 245, 0.88);

      text-shadow:
        0 0 20px rgba(0, 0, 0, 0.95),
        0 2px 12px rgba(0, 0, 0, 0.85),
        0 0 32px rgba(80, 130, 180, 0.18);

    }

    .evp-void-sub-line + .evp-void-sub-line {

      margin-top: 0.5rem;

    }

    /* ——— Fehler-Dialog (unverändertes Layout) ——— */

    .evp-dialog {

      position: fixed;

      z-index: 200001;

      left: 50%;

      top: 50%;

      transform: translate(-50%, -50%);

      width: min(92vw, 720px);

      max-height: min(92vh, 900px);

      display: flex;

      flex-direction: column;

      background: #0a0c10;

      border: 1px solid rgba(200, 80, 80, 0.45);

      border-radius: 8px;

      box-shadow:

        0 0 0 1px rgba(255, 100, 100, 0.12),

        0 24px 80px rgba(0, 0, 0, 0.75);

      overflow: hidden;

    }

    .evp-head {

      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 0.75rem;

      padding: 0.5rem 0.65rem 0.5rem 1rem;

      border-bottom: 1px solid rgba(180, 70, 70, 0.35);

      flex-shrink: 0;

      background: rgba(40, 12, 12, 0.55);

    }

    .evp-dialog:not(.evp-dialog--message) .evp-head {

      border-bottom-color: rgba(60, 70, 85, 0.35);

    }

    .evp-head-label {

      font-size: 0.75rem;

      font-weight: 600;

      letter-spacing: 0.14em;

      text-transform: uppercase;

      color: rgba(255, 160, 160, 0.9);

    }

    .evp-close {

      width: 2.25rem;

      height: 2.25rem;

      padding: 0;

      border: none;

      border-radius: 4px;

      background: rgba(60, 40, 40, 0.7);

      color: #f0e0e0;

      font-size: 1.35rem;

      line-height: 1;

      cursor: pointer;

    }

    .evp-close:hover {

      background: rgba(90, 50, 50, 0.85);

    }

    .evp-message-panel {

      flex: 0 1 auto;

      max-height: min(42vh, 320px);

      overflow: auto;

      padding: 1rem 1.15rem 1.1rem;

      background: linear-gradient(180deg, rgba(28, 10, 10, 0.98) 0%, rgba(14, 8, 10, 0.99) 100%);

      border-bottom: 1px solid rgba(120, 50, 50, 0.4);

    }

    .evp-message-heading {

      margin: 0 0 0.65rem;

      font-size: 0.7rem;

      font-weight: 600;

      letter-spacing: 0.12em;

      text-transform: uppercase;

      color: rgba(255, 130, 130, 0.75);

    }

    .evp-message-text {

      margin: 0;

      font-family: 'Courier New', ui-monospace, monospace;

      font-size: 0.95rem;

      line-height: 1.5;

      white-space: pre-wrap;

      word-break: break-word;

      color: #fff2f2;

      text-shadow: 0 0 20px rgba(255, 80, 80, 0.15);

    }

    .evp-video-block {

      flex: 0 0 auto;

      padding: 0.65rem 1rem 0.85rem;

      background: #050608;

    }

    .evp-video-caption {

      margin: 0 0 0.45rem;

      font-size: 0.65rem;

      letter-spacing: 0.1em;

      text-transform: uppercase;

      color: rgba(140, 160, 190, 0.45);

    }

    .evp-frame-wrap {

      position: relative;

      width: 100%;

      max-height: 32vh;

      aspect-ratio: 16 / 9;

      max-width: 100%;

      margin: 0 auto;

      background: #000;

      border-radius: 4px;

      overflow: hidden;

      opacity: 0.92;

      border: 1px solid rgba(60, 70, 90, 0.35);

    }

    .evp-frame {

      position: absolute;

      inset: 0;

      width: 100%;

      height: 100%;

      border: 0;

    }

  `],
})
export class ErrorVideoPopupComponent {
  readonly popup = inject(ErrorVideoPopupService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Nach Lider-Animation: DOM entfernen, damit nichts den iframe-Inhalt überdeckt oder Klicks frisst. */
  readonly voidEyelidsRetired = signal(false);

  constructor() {
    effect(() => {
      if (!this.popup.open()) {
        this.voidEyelidsRetired.set(false);
      }
    });
  }

  onVoidEyelidsAnimationDone(event: AnimationEvent): void {
    if (event.phaseName === 'done') {
      this.voidEyelidsRetired.set(true);
    }
  }

  readonly headingId = 'evp-message-heading';

  readonly safeEmbed = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.popup.embedUrl())
  );

  readonly displayHeadLabel = computed(() => {
    const raw = this.popup.headLabel()?.trim();
    if (raw) return raw;
    return this.popup.variant() === 'void' ? 'Fernes Signal' : 'Fehler';
  });

  readonly showMessagePanel = computed(() => {
    const m = this.popup.message()?.trim() ?? '';
    const h = this.popup.heading()?.trim() ?? '';
    return m.length > 0 || h.length > 0;
  });

  readonly showVideoCaption = computed(() => (this.popup.videoCaption()?.trim() ?? '').length > 0);

  readonly voidLines = computed(() => {
    const raw = this.popup.voidSubtitleLines();
    if (!raw?.length) return [] as string[];
    return raw.map((l) => l.trim()).filter((l) => l.length > 0);
  });

  readonly hasVoidSubtitles = computed(() => this.voidLines().length > 0);

  readonly voidAriaDescribedBy = computed(() => {
    const ids = ['evp-void-dismiss-hint'];
    if (this.hasVoidSubtitles()) ids.push('evp-void-subtitles');
    return ids.join(' ');
  });

  close(): void {
    this.popup.closePopup();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.popup.open()) {
      this.close();
    }
  }
}
