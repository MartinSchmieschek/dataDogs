import { Component, inject, OnInit } from '@angular/core';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  pickRandomRequiemQuote,
  type RequiemLoadingQuote,
} from '../../data/requiem-loading';
import { LastVoidTongueService } from '../../services/last-void-tongue.service';
import { VoidRequiemGlyphWatermarkComponent } from '../void-requiem-glyph-watermark/void-requiem-glyph-watermark.component';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  imports: [VoidRequiemGlyphWatermarkComponent],
  animations: [
    trigger('backdropFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate(
          '980ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          style({ opacity: 1 })
        ),
      ]),
    ]),
    trigger('heroFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate(
          '420ms 120ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          style({ opacity: 1 })
        ),
      ]),
    ]),
  ],
  template: `
    <div
      class="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Lädt">
      <div class="loading-backdrop" [@backdropFade]>
        <div class="void-bg-void" aria-hidden="true"></div>
        <div class="void-bg-nebula" aria-hidden="true"></div>
        <div class="void-bg-scrim" aria-hidden="true"></div>
        <app-void-requiem-glyph-watermark [iconSrc]="quote.iconSrc" />
      </div>
      <div class="void-stage">
        <div class="void-hero tilt-3d" [@heroFade]>
          <div class="void-hero-inner">
            <div class="void-egg">
              <div class="void-egg-glow" aria-hidden="true"></div>
              <button
                type="button"
                class="void-eye-link"
                aria-label="Fernes Signal (Popup)"
                (click)="onVoidIrisClick($event)"></button>
            </div>
          </div>
        </div>
        <div class="loading-bar-wrap" aria-hidden="true">
          <div class="loading-bar-track">
            <div class="loading-bar-indeterminate"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 1000;
    }
    .loading-overlay {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .loading-backdrop {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    .void-bg-void {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 120% 100% at 50% 100%, #070a14 0%, #020308 45%, #000006 100%);
    }
    /* Nebula-Schichten: kühle Tiefen, warme Wolken, wie cinematic Space-Referenz. */
    .void-bg-nebula {
      position: absolute;
      inset: 0;
      /* ~55 % zurückgenommen (Easter-Egg-Hintergrund dezent) */
      opacity: 0.41;
      background:
        radial-gradient(ellipse 130% 95% at 10% 100%, rgba(36, 44, 98, 0.25) 0%, rgba(18, 22, 52, 0.1) 38%, transparent 58%),
        radial-gradient(ellipse 100% 80% at 92% 65%, rgba(52, 28, 72, 0.17) 0%, transparent 52%),
        radial-gradient(ellipse 85% 70% at 62% 38%, rgba(165, 48, 28, 0.14) 0%, rgba(95, 22, 38, 0.06) 42%, transparent 62%),
        radial-gradient(ellipse 50% 45% at 56% 36%, rgba(255, 120, 55, 0.05) 0%, transparent 48%);
      filter: saturate(1.04);
    }
    /* Lesbarkeit: etwas weicher als zuvor. */
    .void-bg-scrim {
      position: absolute;
      inset: 0;
      background:
        rgba(2, 4, 12, 0.32),
        radial-gradient(ellipse 95% 90% at 50% 48%, transparent 25%, rgba(0, 0, 0, 0.52) 100%);
    }
    .void-stage {
      position: absolute;
      inset: 0;
      z-index: 1;
      perspective: 1500px;
      perspective-origin: 50% 40%;
      pointer-events: none;
    }
    .void-eye-link:focus-visible {
      outline: 1px solid rgba(120, 170, 220, 0.35);
      outline-offset: 3px;
    }
    .tilt-3d {
      transform-style: preserve-3d;
      backface-visibility: hidden;
    }
    .void-hero {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 3;
      pointer-events: auto;
      transform: translate3d(-50%, -50%, 0) rotateX(8deg) rotateY(-9deg);
      text-align: center;
      max-width: 22rem;
      padding: 0 1.5rem;
    }
    .void-hero-inner {
      position: relative;
      display: inline-block;
      min-width: 11rem;
    }
    /* Iris-Fleck: zentriert, sehr dezent (Easter Egg). */
    .void-egg {
      position: relative;
      width: 3.75rem;
      height: 1.65rem;
      margin: 0 auto;
      pointer-events: none;
    }
    .void-egg-glow {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse 50% 80% at 50% 50%, rgba(255, 248, 228, 0.2) 0%, rgba(210, 195, 165, 0.06) 42%, transparent 68%),
        linear-gradient(90deg, transparent 12%, rgba(255, 240, 210, 0.04) 50%, transparent 88%);
      filter: blur(7px);
      opacity: 0.5;
    }
    .void-eye-link {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 2.85rem;
      height: 1.4rem;
      z-index: 1;
      pointer-events: auto;
      cursor: pointer;
      border-radius: 50%;
      border: none;
      padding: 0;
      margin: 0;
      background: transparent;
      appearance: none;
    }
    .loading-bar-wrap {
      position: absolute;
      left: 50%;
      bottom: clamp(0.75rem, 4vh, 2rem);
      z-index: 6;
      transform: translateX(-50%);
      width: min(22rem, calc(100% - 2.5rem));
      pointer-events: none;
    }
    .loading-bar-track {
      height: 3px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(20, 35, 55, 0.55);
      box-shadow: inset 0 0 0 1px rgba(80, 120, 170, 0.12);
    }
    .loading-bar-indeterminate {
      height: 100%;
      width: 40%;
      border-radius: inherit;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(60, 130, 200, 0.35),
        rgba(120, 175, 220, 0.55),
        rgba(60, 130, 200, 0.35),
        transparent
      );
      animation: loading-bar-slide 1.35s ease-in-out infinite;
    }
    @keyframes loading-bar-slide {
      0% {
        transform: translateX(-100%);
        opacity: 0.85;
      }
      50% {
        opacity: 1;
      }
      100% {
        transform: translateX(350%);
        opacity: 0.85;
      }
    }
  `],
})
export class LoadingIndicatorComponent implements OnInit {
  private errorVideoPopup = inject(ErrorVideoPopupService);
  private lastVoidTongue = inject(LastVoidTongueService);

  ngOnInit(): void {
    this.lastVoidTongue.remember(this.quote);
  }

  /** Iris-Easter-Egg: Void-Kino mit Lade-Video (nicht dasselbe wie Fehler-Klick; s. video-popup.ts). */
  onVoidIrisClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.errorVideoPopup.openLoadingEasterEgg();
  }

  /** Pro Mount ein zufälliges Fragment — jedes Mal frisch, wenn @if loading neu rendert. */
  readonly quote: RequiemLoadingQuote = pickRandomRequiemQuote();
}
