import {
  Component, Input, ElementRef, ViewChild, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, signal,
} from '@angular/core';
import { GRAPH_NODE_H } from '../vis-network/graph-layout';

/**
 * Kompakte Liste von Property-Pfaden (z. B. „Liest von“ entlang einer Kante im Graph).
 */
@Component({
  selector: 'app-dog-read-props-display',
  standalone: true,
  template: `
    <div class="read-props-glass" [class.read-props-glass--plain]="plain">
      <div
        #clipBox
        class="read-props-clip"
        [style.max-height.px]="maxHeightPx">
        @if (paths.length === 0) {
          <span class="read-props-empty">Keine Einträge</span>
        } @else {
          <ul class="read-props-list">
            @for (p of paths; track $index) {
              <li class="read-props-item">
                <span class="read-props-paw" aria-hidden="true">🐾</span>
                <code class="read-props-code">{{ p }}</code>
              </li>
            }
          </ul>
        }
      </div>
      @if (overflowing()) {
        <div class="read-props-fade" aria-hidden="true"></div>
        <div class="read-props-ellipsis" aria-hidden="true">…</div>
      }
    </div>
  `,
  styleUrls: ['./dog-read-props-display.component.scss'],
})
export class DogReadPropsDisplayComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() paths: string[] = [];

  /** Kein Glas/Hintergrund — z. B. Read-Infos neben der Kanten-Schere. */
  @Input() plain = false;

  @ViewChild('clipBox') clipBox?: ElementRef<HTMLDivElement>;

  /** 1,5× Graph-Knotenhöhe — kompakt neben dem Graph lesbar. */
  readonly maxHeightPx = GRAPH_NODE_H * 1.5;

  readonly overflowing = signal(false);

  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    const el = this.clipBox?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      this.scheduleOverflowCheck();
      return;
    }
    this.ro = new ResizeObserver(() => this.updateOverflow());
    this.ro.observe(el);
    this.scheduleOverflowCheck();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.scheduleOverflowCheck();
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private scheduleOverflowCheck(): void {
    queueMicrotask(() => this.updateOverflow());
  }

  private updateOverflow(): void {
    const el = this.clipBox?.nativeElement;
    if (!el) {
      this.overflowing.set(false);
      return;
    }
    this.overflowing.set(el.scrollHeight > el.clientHeight + 1);
  }
}
