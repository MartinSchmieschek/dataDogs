import { NgStyle } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { REQUIEM_LOADING_QUOTES } from '../../data/requiem-loading';
import { BackdropDriveService } from '../../services/backdrop-drive.service';
import { LastVoidTongueService } from '../../services/last-void-tongue.service';
import { VoidRequiemGlyphWatermarkComponent } from '../void-requiem-glyph-watermark/void-requiem-glyph-watermark.component';

/**
 * Kosmischer Hintergrund + Requiem-Glyphe (Watermark), ohne Text.
 * Leichte Bewegung über {@link BackdropDriveService} (scroll01, compass01, tilt01).
 */
@Component({
  selector: 'app-void-mythic-backdrop',
  standalone: true,
  imports: [VoidRequiemGlyphWatermarkComponent, NgStyle],
  template: `
    <div class="vmb" aria-hidden="true">
      <div class="vmb-layer vmb-layer--abyss" [ngStyle]="abyssStyle()"></div>
      <div class="vmb-layer vmb-layer--nebula" [ngStyle]="nebulaStyle()"></div>
      <app-void-requiem-glyph-watermark [iconSrc]="glyphUrl()" />
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
  `],
})
export class VoidMythicBackdropComponent {
  readonly lastVoid = inject(LastVoidTongueService);
  private readonly drive = inject(BackdropDriveService);

  private readonly fallbackIconSrc = REQUIEM_LOADING_QUOTES[0].iconSrc;

  readonly glyphUrl = computed(
    () => this.lastVoid.snapshot()?.iconSrc ?? this.fallbackIconSrc
  );

  readonly abyssStyle = computed(() => {
    const s = this.drive.scroll01();
    const pan =
      (this.drive.compass01() - 0.5) * 0.42 +
      (this.drive.tilt01() - 0.5) * 0.28 +
      (this.drive.screenAngle01() - 0.5) * 0.22;
    return {
      transform: `translate3d(${pan * 8}px, ${-s * 8}px, 0) scale(1.16)`,
      transformOrigin: '50% 55%',
    };
  });

  readonly nebulaStyle = computed(() => {
    const s = this.drive.scroll01();
    const pan =
      (this.drive.compass01() - 0.5) * 0.42 +
      (this.drive.tilt01() - 0.5) * 0.28 +
      (this.drive.screenAngle01() - 0.5) * 0.22;
    return {
      transform: `translate3d(${pan * 14}px, ${-s * 14}px, 0) scale(1.22)`,
      transformOrigin: '48% 42%',
    };
  });
}
