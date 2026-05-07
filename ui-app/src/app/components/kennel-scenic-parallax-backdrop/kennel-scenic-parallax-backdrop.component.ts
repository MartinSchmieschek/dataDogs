import { NgStyle } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BackdropDriveService } from '../../services/backdrop-drive.service';

/**
 * Retro-„Desktop-Hügel“-Look: Vektor-Schichten, angetrieben von {@link BackdropDriveService}.
 */
@Component({
  selector: 'app-kennel-scenic-parallax-backdrop',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './kennel-scenic-parallax-backdrop.component.html',
  styleUrls: ['./kennel-scenic-parallax-backdrop.component.scss'],
})
export class KennelScenicParallaxBackdropComponent {
  private readonly drive = inject(BackdropDriveService);

  /** Vertikaler Parallax bei scroll01 === 1 (Listenanfang). */
  private readonly maxParallaxY = 200;
  /** Horizontaler Parallax (Ausrichtung relativ zur Baseline). */
  private readonly maxParallaxX = 48;

  /**
   * @param scrollWeight Stärke vertikal (0…1 Skala relativ zu anderen Layern)
   * @param panWeight Stärke für Kompass/Neigung (nähere Layer oft höher)
   */
  layerParallax(scrollWeight: number, panWeight: number): { transform: string } {
    const s = this.drive.scroll01();
    const c = this.drive.compass01();
    const t = this.drive.tilt01();
    const r = this.drive.screenAngle01();
    const pan =
      (c - 0.5) * 0.42 + (t - 0.5) * 0.28 + (r - 0.5) * 0.22;
    const dy = -s * this.maxParallaxY * scrollWeight;
    const dx = pan * this.maxParallaxX * panWeight;
    return { transform: `translate3d(${dx}px, ${dy}px, 0)` };
  }
}
