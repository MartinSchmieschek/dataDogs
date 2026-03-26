import { Component, Input } from '@angular/core';

/**
 * Große, weich gezeichnete Requiem-Glyphe (Watermark) — gleiche Optik wie im
 * {@link VoidMythicBackdropComponent}: zentriert, skaliert, rotate3d, Blur, sehr niedrige Opacity.
 */
@Component({
  selector: 'app-void-requiem-glyph-watermark',
  standalone: true,
  template: `
    <div class="vrgw-wrap" aria-hidden="true">
      <img
        class="vrgw-img"
        [src]="iconSrc"
        alt=""
        draggable="false"
        loading="lazy"
        decoding="async" />
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

    .vrgw-wrap {
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

    .vrgw-img {
      display: block;
      width: min(86vmin, 190%);
      height: min(86vmin, 190%);
      max-width: none;
      max-height: none;
      object-fit: contain;
      opacity: 0.03;
      filter:
        invert(1)
        brightness(0.45)
        contrast(0.88)
        saturate(1.05)
        drop-shadow(0 0 18px rgba(80, 120, 170, 0.12));
      user-select: none;
      -webkit-user-drag: none;
    }
  `],
})
export class VoidRequiemGlyphWatermarkComponent {
  @Input({ required: true }) iconSrc!: string;
}
