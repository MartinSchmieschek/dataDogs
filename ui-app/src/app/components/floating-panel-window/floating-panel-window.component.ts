import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  HostListener,
  signal,
} from '@angular/core';

/**
 * Schwebendes Fenster (Titelleiste zum Verschieben, native Größenänderung per Ecke).
 * Position und Größe werden pro `storageKey` in localStorage gehalten.
 */
@Component({
  selector: 'app-floating-panel-window',
  standalone: true,
  templateUrl: './floating-panel-window.component.html',
  styleUrls: ['./floating-panel-window.component.scss'],
})
export class FloatingPanelWindowComponent implements OnInit, OnDestroy, AfterViewInit {
  /** Eindeutiger Schlüssel für localStorage (z. B. `waves-node-panel-mein-kennel`). */
  @Input({ required: true }) storageKey!: string;

  /** Zeile in der Titelleiste (z. B. „Node: dog-123“). */
  @Input() title = '';

  @ViewChild('panelEl') panelEl?: ElementRef<HTMLElement>;

  panelLeft = signal(0);
  panelTop = signal(72);
  panelW = signal(480);
  panelH = signal(520);

  private drag: {
    active: boolean;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } = { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };

  private resizeObserver: ResizeObserver | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.applyDefaultGeometry();
    this.loadRect();
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.persistTimer) clearTimeout(this.persistTimer);
  }

  private applyDefaultGeometry(): void {
    const w = 480;
    const h = Math.min(640, Math.max(320, window.innerHeight - 100));
    const left = Math.max(8, window.innerWidth - w - 16);
    this.panelLeft.set(left);
    this.panelTop.set(72);
    this.panelW.set(w);
    this.panelH.set(h);
  }

  private storageKeyFull(): string {
    return `floating-panel-${this.storageKey}`;
  }

  private loadRect(): void {
    try {
      const raw = localStorage.getItem(this.storageKeyFull());
      if (!raw) return;
      const r = JSON.parse(raw) as { left?: number; top?: number; width?: number; height?: number };
      if (typeof r.left === 'number') this.panelLeft.set(this.clampLeft(r.left));
      if (typeof r.top === 'number') this.panelTop.set(this.clampTop(r.top));
      if (typeof r.width === 'number' && r.width >= 280) {
        this.panelW.set(Math.min(r.width, window.innerWidth - 16));
      }
      if (typeof r.height === 'number' && r.height >= 200) {
        this.panelH.set(Math.min(r.height, window.innerHeight - 24));
      }
    } catch {
      /* ignore */
    }
  }

  private clampLeft(left: number): number {
    const w = this.panelW();
    return Math.max(8, Math.min(left, window.innerWidth - w - 8));
  }

  private clampTop(top: number): number {
    const h = this.panelH();
    return Math.max(8, Math.min(top, window.innerHeight - h - 8));
  }

  private setupResizeObserver(): void {
    const el = this.panelEl?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w >= 280 && Math.abs(w - this.panelW()) > 1) this.panelW.set(w);
      if (h >= 200 && Math.abs(h - this.panelH()) > 1) this.panelH.set(h);
      this.schedulePersist();
    });
    this.resizeObserver.observe(el);
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistRect(), 200);
  }

  private persistRect(): void {
    try {
      const el = this.panelEl?.nativeElement;
      localStorage.setItem(
        this.storageKeyFull(),
        JSON.stringify({
          left: this.panelLeft(),
          top: this.panelTop(),
          width: el?.offsetWidth ?? this.panelW(),
          height: el?.offsetHeight ?? this.panelH(),
        })
      );
    } catch {
      /* ignore */
    }
  }

  onDragStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.drag = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: this.panelLeft(),
      origTop: this.panelTop(),
    };
    (event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
  }

  @HostListener('document:pointermove', ['$event'])
  onDragMove(event: PointerEvent): void {
    if (!this.drag.active) return;
    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    this.panelLeft.set(this.clampLeft(this.drag.origLeft + dx));
    this.panelTop.set(this.clampTop(this.drag.origTop + dy));
  }

  @HostListener('document:pointerup')
  onDragEnd(): void {
    if (!this.drag.active) return;
    this.drag.active = false;
    this.persistRect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.panelLeft.update((v) => this.clampLeft(v));
    this.panelTop.update((v) => this.clampTop(v));
  }
}
