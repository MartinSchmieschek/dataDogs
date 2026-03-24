import { Component, inject, OnInit } from '@angular/core';
import { ErrorVideoPopupService } from '../../services/error-video-popup.service';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  pickRandomRequiemQuote,
  type RequiemLoadingQuote,
} from '../../data/requiem-loading';
import { LastVoidTongueService } from '../../services/last-void-tongue.service';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
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
    trigger('copyFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate(
          '480ms 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
      </div>
      <div class="void-stage">
        <div class="void-hero tilt-3d" [@heroFade]>
          <div class="void-hero-inner">
            <div class="void-requiem-orbit">
              <div class="spinner-ring" aria-hidden="true"></div>
              <img
                class="void-requiem-icon"
                [src]="quote.iconSrc"
                [alt]="quote.name + ', Requiem'"
                width="52"
                height="52"
                loading="eager"
                decoding="async" />
            </div>
            <div class="void-egg">
              <div class="void-egg-glow" aria-hidden="true"></div>
              <button
                type="button"
                class="void-eye-link"
                aria-label="Fernes Signal (Popup)"
                (click)="onVoidIrisClick($event)"></button>
            </div>
            <h1 class="void-name">{{ quote.name }}</h1>
          </div>
        </div>
        <div class="void-copy tilt-3d" [@copyFade]>
          <p class="void-keyword">{{ quote.keyword }}</p>
          <div class="void-tongue">
            <p class="void-line">{{ quote.line1 }}</p>
            <p class="void-line">{{ quote.line2 }}</p>
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
    /* Iris-Fleck: links unter der Glyphe, sehr dezent (Easter Egg). */
    .void-egg {
      position: absolute;
      left: 0;
      top: 2.35rem;
      width: 3.75rem;
      height: 1.65rem;
      transform: translate(-48%, 18%);
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
    /* Über dem Hero stacken, nach oben ziehen: Zunge/Keyword überlagern das Iris-Auge. */
    .void-copy {
      position: absolute;
      left: 50%;
      bottom: clamp(0.35rem, 3vh, 1.75rem);
      z-index: 5;
      pointer-events: none;
      width: min(22rem, calc(100% - 2rem));
      transform: translateX(-50%)
        translateY(calc(-1 * clamp(4.5rem, 19vh, 9.5rem)))
        rotateX(9deg)
        rotateY(-8deg);
      transform-origin: 50% 100%;
      text-align: center;
      padding: 0 1.5rem;
    }
    .void-requiem-orbit {
      position: relative;
      width: 3.35rem;
      height: 3.35rem;
      margin: 0 auto 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spinner-ring {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      border: 3px solid rgba(45, 55, 72, 0.55);
      border-top-color: rgba(0, 102, 204, 0.5);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .void-requiem-icon {
      position: relative;
      z-index: 1;
      width: 2.65rem;
      height: 2.65rem;
      object-fit: contain;
      display: block;
      filter: drop-shadow(0 0 10px rgba(80, 120, 160, 0.2));
      animation: void-pulse 3.2s ease-in-out infinite;
    }
    .void-name {
      margin: 0;
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 1.35rem;
      font-weight: 400;
      letter-spacing: 0.55em;
      text-indent: 0.55em;
      text-transform: uppercase;
      color: rgba(195, 212, 228, 0.42);
      text-shadow: 0 0 24px rgba(100, 140, 180, 0.12);
    }
    .void-keyword {
      margin: 0 0 0.65rem;
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 0.65rem;
      letter-spacing: 0.45em;
      text-transform: uppercase;
      color: rgba(120, 145, 170, 0.34);
      text-shadow: 0 0 18px rgba(0, 8, 20, 0.85);
    }
    .void-tongue {
      border-top: 1px solid rgba(80, 110, 140, 0.14);
      padding-top: 0.65rem;
      margin-top: 0.15rem;
    }
    .void-line {
      margin: 0;
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 0.72rem;
      line-height: 1.55;
      font-style: italic;
      font-weight: 400;
      letter-spacing: 0.06em;
      color: rgba(105, 130, 155, 0.44);
      text-shadow:
        0 0 14px rgba(0, 6, 16, 0.9),
        0 1px 2px rgba(0, 0, 0, 0.55);
    }
    .void-line + .void-line {
      margin-top: 0.35rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes void-pulse {
      0%, 100% { opacity: 0.78; }
      50% { opacity: 0.98; }
    }
  `],
})
export class LoadingIndicatorComponent implements OnInit {
  private errorVideoPopup = inject(ErrorVideoPopupService);
  private lastVoidTongue = inject(LastVoidTongueService);

  ngOnInit(): void {
    this.lastVoidTongue.remember(this.quote);
  }

  /** Iris-Easter-Egg: gleicher Dialog wie beim Fehler-Popup, eigenes Video (s. video-popup.ts). */
  onVoidIrisClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.errorVideoPopup.openLoadingEasterEgg();
  }

  /** Pro Mount ein zufälliges Fragment — jedes Mal frisch, wenn @if loading neu rendert. */
  readonly quote: RequiemLoadingQuote = pickRandomRequiemQuote();
}
