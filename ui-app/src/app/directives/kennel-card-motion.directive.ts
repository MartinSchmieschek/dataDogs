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

/**
 * Ziel-Blend aus Abstand zur Mitte: weicher Verlauf (keine harte Schwelle → weniger Scroll-Feedback).
 * Untergrenze > 0: Beschreibung/Meta bleiben lesbar, auch wenn die Karte vertikal „am Rand“ liegt.
 */
const KENNEL_FOCUS_BLEND_FLOOR = 0.4;

function focusBlendTarget(offCenter: number): number {
  if (offCenter <= 0.2) return 1;
  if (offCenter >= 0.52) return KENNEL_FOCUS_BLEND_FLOOR;
  return Math.max(KENNEL_FOCUS_BLEND_FLOOR, 1 - (offCenter - 0.2) / 0.32);
}

/** Exponentielles Glätten pro Frame (Overlay statt Zustandsklasse). */
const KENNEL_FOCUS_BLEND_LERP = 0.14;

/** Kartenmitte nahe Scrollport-Mitte → Beschreibung aufklappen (siehe Kennel-Liste SCSS). */
const KENNEL_VIEWPORT_FOCUS_OFFCENTER = 0.38;

const KENNEL_MOTION_VISUAL_SELECTOR = '.kennel-card-motion-visual';

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
 * Scroll-gekoppelte Kartenbewegung (2D): Bogen mit Linksbias, damit unten rechts optisch Luft bleibt
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
  private intersectionObserver: IntersectionObserver | null = null;
  /** Transform/Opacity auf innerem Wrapper — Layout-Höhe der Liste bleibt stabil. */
  private motionVisual: HTMLElement | null = null;
  private viewportFocusClass = false;

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;
    this.scrollRoot = host.closest('.kennel-scroll');
    this.motionVisual = host.querySelector(KENNEL_MOTION_VISUAL_SELECTOR) as HTMLElement | null;

    /** Parallax-Transform liegt auf innenliegendem Wrapper — Mitte/Sichtbarkeit am Host messen würde falsch auslösen. */
    const measureEl = (): HTMLElement => this.motionVisual ?? host;

    this.zone.runOutsideAngular(() => {
      const tick = () => {
        this.raf = 0;
        const el = measureEl();
        const p = scrollProgressInViewport(el, this.scrollRoot);
        const offCenter = verticalCenterDistance(el, this.scrollRoot);
        const targetBlend = focusBlendTarget(offCenter);
        this.focusBlend += (targetBlend - this.focusBlend) * KENNEL_FOCUS_BLEND_LERP;
        if (this.focusBlend < 0.001) this.focusBlend = 0;
        if (this.focusBlend > 0.999) this.focusBlend = 1;
        this.renderer.setStyle(host, '--kennel-focus-blend', this.focusBlend.toFixed(4));

        const wantViewportFocus = offCenter <= KENNEL_VIEWPORT_FOCUS_OFFCENTER;
        if (wantViewportFocus !== this.viewportFocusClass) {
          this.viewportFocusClass = wantViewportFocus;
          if (wantViewportFocus) {
            this.renderer.addClass(host, 'kennel-card-motion--viewport-focus');
          } else {
            this.renderer.removeClass(host, 'kennel-card-motion--viewport-focus');
          }
        }
        /*
         * Bogen: von leicht unten-links (Eintritt) über Mitte nach oben-rechts (Austritt),
         * mit negativem X-Bias in der Mitte → Masse nicht in die untere rechte Ecke.
         *
         * Nur 2D (translate + rotate(Z) + scale): rotateX/rotateY + perspective erzeugen
         * in mehreren Engines eine Verschiebung zwischen sichtbarer Fläche und Klick-Hitbox.
         */
        const xPct = piecewise(p, [0, 0.5, 1], [-9, -4, 6]);
        const yPct = piecewise(p, [0, 0.5, 1], [6, 0, -7]);
        const rotateY = piecewise(p, [0, 0.5, 1], [-9, 0, 8]);
        const rotateX = piecewise(p, [0, 0.5, 1], [6, 0, -6]);
        const pathScale = piecewise(p, [0, 0.2, 0.5, 0.8, 1], [0.9, 0.97, 1, 0.97, 0.9]);
        /** Je weiter von der vertikalen Bildschirmmitte, desto kleiner (max. ~11 %). */
        const centerScale = 1 - 0.11 * offCenter * offCenter;
        const scale = pathScale * centerScale;
        /* Mindest-Deckkraft höher: Text auf goldenem Hintergrund bleibt lesbar am Listenrand */
        const opacity = piecewise(p, [0, 0.12, 0.88, 1], [0.82, 1, 1, 0.82]);
        /** Leichte 2D-Drehung statt 3D-Kippung (vermeidet Hit-Test-Drift). */
        const twistDeg = rotateY * 0.38 + rotateX * 0.22;

        const transform = [
          `translate(${xPct}%, ${yPct}%)`,
          `rotate(${twistDeg}deg)`,
          `scale(${scale})`,
        ].join(' ');

        const targetEl = this.motionVisual ?? host;
        this.renderer.setStyle(targetEl, 'transform', transform);
        this.renderer.setStyle(targetEl, 'opacity', String(opacity));
      };

      const schedule = () => {
        if (this.raf) return;
        this.raf = requestAnimationFrame(tick);
      };

      /** Nach Sort/Track-Wechsel ist oft erst nach einem Paint das Layout korrekt — sonst falscher Parallax bis zum Scroll. */
      const scheduleLayoutSyncTicks = () => {
        requestAnimationFrame(() => {
          tick();
          requestAnimationFrame(() => {
            tick();
            requestAnimationFrame(tick);
          });
        });
      };

      tick();
      scheduleLayoutSyncTicks();

      /* Ohne Scroll: nach Sort/Reflow neue Position relativ zum Scrollport → Parallax neu berechnen */
      this.intersectionObserver = new IntersectionObserver(
        () => {
          schedule();
        },
        {
          root: this.scrollRoot,
          rootMargin: '80px 0px 120px 0px',
          threshold: [0, 0.02, 0.25, 0.5, 0.75, 1],
        }
      );
      this.intersectionObserver.observe(measureEl());

      const scrollTarget: EventTarget = this.scrollRoot ?? window;
      scrollTarget.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });

      this.unsub = () => {
        this.intersectionObserver?.disconnect();
        this.intersectionObserver = null;
        scrollTarget.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        if (this.raf) cancelAnimationFrame(this.raf);
        const vis = this.motionVisual;
        if (vis) {
          this.renderer.removeStyle(vis, 'transform');
          this.renderer.removeStyle(vis, 'opacity');
        } else {
          this.renderer.removeStyle(host, 'transform');
          this.renderer.removeStyle(host, 'opacity');
        }
        if (this.viewportFocusClass) {
          this.renderer.removeClass(host, 'kennel-card-motion--viewport-focus');
          this.viewportFocusClass = false;
        }
      };
    });
  }

  ngOnDestroy(): void {
    this.unsub?.();
    this.unsub = null;
  }
}
