import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Gemeinsame Ansteuerung für Hintergrund-Parallax.
 *
 * - **scroll01**: gelerpt 0…1 — **1 = Listenanfang (0 % gescrollt)**, **0 = unten (100 % im Messfenster)**.
 * - **compass01 / tilt01 / screenAngle01**: gelerpt 0…1, **0.5 = erste gemessene Ausrichtung (Baseline)**,
 *   Richtung 0/1 = Abweichung bis zu den konfigurierbaren Grad-Faktoren.
 */
@Injectable({ providedIn: 'root' })
export class BackdropDriveService {
  private readonly zone = inject(NgZone);

  /** 1 = ganz oben, 0 = unten (invertiert zum Roh-Scroll). */
  readonly scroll01 = signal(1);

  /** 0.5 = Baseline-Kompass, Abweichung über {@link compassSwingDeg}. */
  readonly compass01 = signal(0.5);

  /** 0.5 = Baseline-Neigung (gamma), Abweichung über {@link gammaSwingDeg}. */
  readonly tilt01 = signal(0.5);

  /** 0.5 = Baseline Bildschirmwinkel, Abweichung über {@link screenSwingDeg}. */
  readonly screenAngle01 = signal(0.5);

  /** Ab dieser Winkel-Differenz zur Baseline ist der Zielwert 0 oder 1 (zum Feintunen). */
  compassSwingDeg = 52;

  gammaSwingDeg = 40;

  screenSwingDeg = 45;

  private scrollRangePx = 560;

  private targetScroll01 = 1;
  private targetCompass01 = 0.5;
  private targetTilt01 = 0.5;
  private targetScreenAngle01 = 0.5;

  private curScroll01 = 1;
  private curCompass01 = 0.5;
  private curTilt01 = 0.5;
  private curScreenAngle01 = 0.5;

  private scrollEl: HTMLElement | null = null;
  private onScrollHandler: (() => void) | null = null;

  private rafId: number | null = null;
  private lastFrameTs = 0;

  private readonly smoothness = 12;

  private baseAlphaDeg: number | null = null;
  private baseGammaDeg: number | null = null;
  private baseScreenDeg: number | null = null;

  /**
   * true, wenn Sensor nutzbar ist (Desktop/Android sofort, iOS erst nach Erlaubnis).
   */
  readonly deviceOrientationUnlocked = signal(false);

  private readonly onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (BackdropDriveService.iosRequiresPermission() && !this.deviceOrientationUnlocked()) {
      return;
    }
    if (e.alpha != null && !Number.isNaN(e.alpha)) {
      const cur = ((e.alpha % 360) + 360) % 360;
      if (this.baseAlphaDeg == null) {
        this.baseAlphaDeg = cur;
      }
      const d = this.wrapDegDiff(cur, this.baseAlphaDeg);
      const c = Math.max(-this.compassSwingDeg, Math.min(this.compassSwingDeg, d));
      this.targetCompass01 = 0.5 + 0.5 * (c / this.compassSwingDeg);
    }
    if (e.gamma != null && !Number.isNaN(e.gamma)) {
      const g = Math.max(-60, Math.min(60, e.gamma));
      if (this.baseGammaDeg == null) {
        this.baseGammaDeg = g;
      }
      const d = Math.max(-this.gammaSwingDeg, Math.min(this.gammaSwingDeg, g - this.baseGammaDeg));
      this.targetTilt01 = 0.5 + 0.5 * (d / this.gammaSwingDeg);
    }
    this.ensureRafLoop();
  };

  private readonly onOrientationChange = () => this.refreshScreenAngle();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    this.deviceOrientationUnlocked.set(!BackdropDriveService.iosRequiresPermission());
    window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
    window.addEventListener('orientationchange', this.onOrientationChange, { passive: true });
    try {
      window.screen?.orientation?.addEventListener('change', this.onOrientationChange);
    } catch {
      /* ignore */
    }
    this.refreshScreenAngle();
    this.curScreenAngle01 = this.targetScreenAngle01;
    this.screenAngle01.set(this.curScreenAngle01);
  }

  /** Baseline für Kompass/Neigung neu setzen (z. B. nach Erlaubnis). */
  resetOrientationBaselines(): void {
    this.baseAlphaDeg = null;
    this.baseGammaDeg = null;
    this.baseScreenDeg = null;
    this.targetCompass01 = 0.5;
    this.targetTilt01 = 0.5;
    this.targetScreenAngle01 = 0.5;
    this.refreshScreenAngle();
    this.ensureRafLoop();
  }

  notifyDeviceOrientationUnlocked(): void {
    this.deviceOrientationUnlocked.set(true);
    this.resetOrientationBaselines();
  }

  /** iOS Safari: Kompass/Neigung nur nach Nutzer-Geste. */
  iosOrientationRequiresUserGesture(): boolean {
    return BackdropDriveService.iosRequiresPermission();
  }

  private static iosRequiresPermission(): boolean {
    return (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    );
  }

  private refreshScreenAngle(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const a = window.screen?.orientation?.angle;
    const deg = typeof a === 'number' && !Number.isNaN(a) ? (((a % 360) + 360) % 360) : 0;
    if (this.baseScreenDeg == null) {
      this.baseScreenDeg = deg;
      this.targetScreenAngle01 = 0.5;
    } else {
      const d = this.wrapDegDiff(deg, this.baseScreenDeg);
      const c = Math.max(-this.screenSwingDeg, Math.min(this.screenSwingDeg, d));
      this.targetScreenAngle01 = 0.5 + 0.5 * (c / this.screenSwingDeg);
    }
    this.ensureRafLoop();
  }

  private wrapDegDiff(fromDeg: number, baseDeg: number): number {
    let d = fromDeg - baseDeg;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  bindScrollElement(el: HTMLElement, options?: { scrollRangePx?: number }): void {
    this.detachScrollElement();
    if (options?.scrollRangePx != null && options.scrollRangePx > 0) {
      this.scrollRangePx = options.scrollRangePx;
    }
    this.scrollEl = el;
    this.onScrollHandler = () => this.updateScrollTargetFromElement();
    el.addEventListener('scroll', this.onScrollHandler, { passive: true });
    this.updateScrollTargetFromElement();
    this.curScroll01 = this.targetScroll01;
    this.zone.run(() => this.scroll01.set(this.curScroll01));
    this.ensureRafLoop();
  }

  detachScrollElement(resetToTop = true): void {
    if (this.scrollEl && this.onScrollHandler) {
      this.scrollEl.removeEventListener('scroll', this.onScrollHandler);
    }
    this.scrollEl = null;
    this.onScrollHandler = null;
    this.targetScroll01 = resetToTop ? 1 : 0;
    this.ensureRafLoop();
  }

  async requestDeviceOrientationPermission(): Promise<boolean> {
    const DO = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
    };
    if (typeof DO.requestPermission !== 'function') {
      this.notifyDeviceOrientationUnlocked();
      return true;
    }
    try {
      const r = await DO.requestPermission();
      if (r === 'granted') {
        this.notifyDeviceOrientationUnlocked();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  private updateScrollTargetFromElement(): void {
    const el = this.scrollEl;
    if (!el) {
      this.targetScroll01 = 1;
      return;
    }
    const maxPx = Math.max(0, el.scrollHeight - el.clientHeight);
    const cap = Math.min(maxPx, this.scrollRangePx);
    const p = cap <= 0 ? 0 : Math.min(1, el.scrollTop / cap);
    this.targetScroll01 = 1 - p;
    this.ensureRafLoop();
  }

  private ensureRafLoop(): void {
    if (this.rafId != null) {
      return;
    }
    this.lastFrameTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.rafId = requestAnimationFrame((ts) => this.onFrame(ts));
  }

  private onFrame(ts: number): void {
    const dt = Math.min(0.05, Math.max(0, (ts - this.lastFrameTs) / 1000));
    this.lastFrameTs = ts;

    const k = 1 - Math.exp(-this.smoothness * dt);

    this.curScroll01 += (this.targetScroll01 - this.curScroll01) * k;
    this.curCompass01 += (this.targetCompass01 - this.curCompass01) * k;
    this.curTilt01 += (this.targetTilt01 - this.curTilt01) * k;
    this.curScreenAngle01 += (this.targetScreenAngle01 - this.curScreenAngle01) * k;

    const eps = 0.001;
    const settled =
      Math.abs(this.targetScroll01 - this.curScroll01) < eps &&
      Math.abs(this.targetCompass01 - this.curCompass01) < eps &&
      Math.abs(this.targetTilt01 - this.curTilt01) < eps &&
      Math.abs(this.targetScreenAngle01 - this.curScreenAngle01) < eps;

    this.zone.run(() => {
      this.scroll01.set(this.curScroll01);
      this.compass01.set(this.curCompass01);
      this.tilt01.set(this.curTilt01);
      this.screenAngle01.set(this.curScreenAngle01);
    });

    if (settled) {
      this.rafId = null;
      return;
    }

    this.rafId = requestAnimationFrame((t) => this.onFrame(t));
  }
}
