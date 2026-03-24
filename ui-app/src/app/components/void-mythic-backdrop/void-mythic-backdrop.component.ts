import { Component, computed, inject } from '@angular/core';
import { REQUIEM_LOADING_QUOTES } from '../../data/requiem-loading';
import { LastVoidTongueService } from '../../services/last-void-tongue.service';

/**
 * Kosmischer Hintergrund + Requiem-Glyphe (scale + rotate3d gemeinsam, blur am Wrap).
 */
@Component({
  selector: 'app-void-mythic-backdrop',
  standalone: true,
  template: `
    <div class="vmb" aria-hidden="true">
      <div class="vmb-layer vmb-layer--abyss"></div>
      <div class="vmb-layer vmb-layer--nebula"></div>
      <div class="vmb-glyph-wrap">
        <img
          class="vmb-requiem-glyph"
          [src]="glyphUrl()"
          alt=""
          draggable="false"
          loading="lazy"
          decoding="async" />
      </div>
      @if (lastVoid.snapshot(); as t) {
        <div class="vmb-tongue">
          <span class="vmb-tongue-kw">{{ t.keyword }}</span>
          <p class="vmb-tongue-line">{{ t.line1 }}</p>
          <p class="vmb-tongue-line">{{ t.line2 }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .vmb {
      position: absolute;
      inset: 0;
    }

    .vmb-layer--abyss {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 130% 110% at 50% 100%, #0a121c 0%, #060d18 38%, #03060c 100%),
        radial-gradient(ellipse 95% 75% at 68% 18%, rgba(40, 65, 110, 0.42) 0%, transparent 58%),
        radial-gradient(ellipse 70% 55% at 22% 72%, rgba(25, 38, 72, 0.35) 0%, transparent 55%),
        linear-gradient(185deg, #0e1624 0%, #070b12 45%, #04060c 100%);
    }

    .vmb-layer--nebula {
      position: absolute;
      inset: 0;
      opacity: 0.45;
      background:
        radial-gradient(ellipse 100% 85% at 10% 90%, rgba(40, 50, 110, 0.28) 0%, transparent 52%),
        radial-gradient(ellipse 95% 75% at 90% 35%, rgba(60, 35, 85, 0.14) 0%, transparent 50%);
      filter: saturate(1.08);
    }

    /* Eine transform-Zeile: scale + rotate3d wirken gemeinsam; blur separat (filter) */
    .vmb-glyph-wrap {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transform-origin: center center;
      transform: scale(2.5) rotate3d(2, 1, 1, 333deg);
      filter: blur(9px);
    }

    .vmb-requiem-glyph {
      display: block;
      width: min(86vmin, 190%);
      height: min(86vmin, 190%);
      max-width: none;
      max-height: none;
      object-fit: contain;
      /* Noch halb so stark wie zuvor (~3 %) */
      opacity: 0.03;
      /* Nach invert gezielt abdunkeln — weniger grell */
      filter:
        invert(1)
        brightness(0.45)
        contrast(0.88)
        saturate(1.05)
        drop-shadow(0 0 18px rgba(80, 120, 170, 0.12));
      user-select: none;
      -webkit-user-drag: none;
    }

    .vmb-tongue {
      position: absolute;
      left: 50%;
      bottom: 7%;
      z-index: 3;
      transform: translateX(-50%) rotate(-2deg);
      width: min(94%, 46rem);
      text-align: center;
      opacity: 0.11;
      font-family: 'Courier New', ui-monospace, monospace;
      font-style: italic;
      letter-spacing: 0.05em;
      line-height: 1.45;
      color: rgba(160, 188, 220, 0.95);
      text-shadow: 0 0 28px rgba(15, 30, 55, 0.75);
      user-select: none;
    }

    .vmb-tongue-kw {
      display: block;
      font-style: normal;
      font-size: clamp(0.48rem, 0.95vw, 0.64rem);
      letter-spacing: 0.42em;
      text-transform: uppercase;
      margin: 0 0 0.45rem;
      opacity: 0.9;
    }

    .vmb-tongue-line {
      margin: 0;
      font-size: clamp(0.5rem, 0.95vw, 0.68rem);
    }

    .vmb-tongue-line + .vmb-tongue-line {
      margin-top: 0.28rem;
    }
  `],
})
export class VoidMythicBackdropComponent {
  readonly lastVoid = inject(LastVoidTongueService);

  private readonly fallbackIconSrc = REQUIEM_LOADING_QUOTES[0].iconSrc;

  readonly glyphUrl = computed(
    () => this.lastVoid.snapshot()?.iconSrc ?? this.fallbackIconSrc
  );
}
