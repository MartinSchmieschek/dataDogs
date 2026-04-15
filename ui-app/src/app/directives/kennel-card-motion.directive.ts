import {
  Directive,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  AfterViewInit,
  Renderer2,
} from '@angular/core';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Mehrstufige lineare Interpolation (wie Framer useTransform mit Stützstellen). */
function piecewise(p: number, stops: number[], values: number[]): number {
  if (stops.length !== values.length || stops.length < 2) return values[0] ?? 0;
  if (p <= stops[0]) return values[0];
  if (p >= stops[stops.length - 1]) return values[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p <= stops[i + 1]) {
      const t = (p - stops[i]) / (stops[i + 1] - stops[i]);
      return values[i] + (values[i + 1] - values[i]) * t;
    }
  }
  return values[values.length - 1];
}

/**
 * Scroll-Fortschritt relativ zum sichtbaren Bereich (Fenster oder `.kennel-scroll`).
 * p≈0: Element kommt unten ins Sichtfeld; p≈1: verlässt oben.
 */
function scrollProgressInViewport(el: HTMLElement, root: HTMLElement | null): number {
  const rect = el.getBoundingClientRect();
  const h = rect.height || 1;
  if (root) {
    const rr = root.getBoundingClientRect();
    const vh = rr.height || 1;
    const relTop = rect.top - rr.top;
    return clamp01((vh - relTop) / (vh + h));
  }
  const vh = window.innerHeight || 1;
  return clamp01((vh - rect.top) / (vh + h));
}

/** Ziel-Blend aus Abstand zur Mitte: weicher Verlauf (keine harte Schwelle → weniger Scroll-Feedback). */
function focusBlendTarget(offCenter: number): number {
  if (offCenter <= 0.2) return 1;
  if (offCenter >= 0.52) return 0;
  return 1 - (offCenter - 0.2) / 0.32;
}

/** Exponentielles Glätten pro Frame (Overlay statt Zustandsklasse). */
const KENNEL_FOCUS_BLEND_LERP = 0.14;

/**
 * 0 = Kartenmitte liegt auf der vertikalen Mitte des sichtbaren Bereichs,
 * 1 = weit weg von der Mitte (oben/unten) → für zusätzliche Verkleinerung.
 */
function verticalCenterDistance(el: HTMLElement, root: HTMLElement | null): number {
  const rect = el.getBoundingClientRect();
  const cy = rect.top + rect.height / 2;
  let mid: number;
  let half: number;
  if (root) {
    const rr = root.getBoundingClientRect();
    mid = rr.top + rr.height / 2;
    half = rr.height / 2;
  } else {
    mid = window.innerHeight / 2;
    half = window.innerHeight / 2;
  }
  if (half < 1) half = 1;
  return clamp01(Math.abs(cy - mid) / half);
}

/**
 * 3D-Kartenbewegung: Bogen mit Linksbias, damit unten rechts optisch Luft bleibt
 * (oben links = feste Leiste mit Buttons).
 */
@Directive({
  selector: '[appKennelCardMotion]',
  standalone: true,
})
export class KennelCardMotionDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private zone = inject(NgZone);

  private raf = 0;
  private unsub: (() => void) | null = null;
  private scrollRoot: HTMLElement | null = null;
  private focusBlend = 1;

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;
    this.scrollRoot = host.closest('.kennel-scroll');

    this.zone.runOutsideAngular(() => {
      const tick = () => {
        this.raf = 0;
        const p = scrollProgressInViewport(host, this.scrollRoot);
        const offCenter = verticalCenterDistance(host, this.scrollRoot);
        const targetBlend = focusBlendTarget(offCenter);
        this.focusBlend += (targetBlend - this.focusBlend) * KENNEL_FOCUS_BLEND_LERP;
        if (this.focusBlend < 0.001) this.focusBlend = 0;
        if (this.focusBlend > 0.999) this.focusBlend = 1;
        this.renderer.setStyle(host, '--kennel-focus-blend', this.focusBlend.toFixed(4));
        this.renderer.setStyle(host, 'z-index', this.focusBlend > 0.45 ? '2' : '1');
        /*
         * Bogen: von leicht unten-links (Eintritt) über Mitte nach oben-rechts (Austritt),
         * mit negativem X-Bias in der Mitte → Masse nicht in die untere rechte Ecke.
         */
        const xPct = piecewise(p, [0, 0.5, 1], [-14, -6, 10]);
        const yPct = piecewise(p, [0, 0.5, 1], [10, 0, -12]);
        const rotateY = piecewise(p, [0, 0.5, 1], [-14, 0, 12]);
        const rotateX = piecewise(p, [0, 0.5, 1], [10, 0, -10]);
        const pathScale = piecewise(p, [0, 0.2, 0.5, 0.8, 1], [0.82, 0.96, 1, 0.96, 0.82]);
        /** Je weiter von der vertikalen Bildschirmmitte, desto kleiner (max. ~18 %). */
        const centerScale = 1 - 0.18 * offCenter * offCenter;
        const scale = pathScale * centerScale;
        const opacity = piecewise(p, [0, 0.12, 0.88, 1], [0.45, 1, 1, 0.45]);

        const transform = [
          `translate3d(${xPct}%, ${yPct}%, 0)`,
          `rotateX(${rotateX}deg)`,
          `rotateY(${rotateY}deg)`,
          `scale(${scale})`,
        ].join(' ');

        this.renderer.setStyle(host, 'transform', transform);
        this.renderer.setStyle(host, 'opacity', String(opacity));
      };

      const schedule = () => {
        if (this.raf) return;
        this.raf = requestAnimationFrame(tick);
      };

      tick();
      const scrollTarget: EventTarget = this.scrollRoot ?? window;
      scrollTarget.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });

      this.unsub = () => {
        scrollTarget.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        if (this.raf) cancelAnimationFrame(this.raf);
      };
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    this.unsub = null;
  }
}
