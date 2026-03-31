import {

  Component, Input, Output, EventEmitter,

  ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy,

  computed, signal

} from '@angular/core';

import { DogEntry, ReadTrackingEntry, Waves } from '../../models/dog-entry.model';

import { EdgeReadPropsOverlayComponent } from '../edge-read-props-overlay/edge-read-props-overlay.component';

import { GraphDogNodeComponent } from '../graph-dog-node/graph-dog-node.component';

import {

  buildGraphViewModel,

  GRAPH_NODE_H,

  GRAPH_NODE_W,

  type RenderNode,

} from './graph-layout';

import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';



export interface EdgeReadOverlayVM {

  key: string;

  left: number;

  top: number;

  /** Eingehend: „Liest von“ · Ausgehend: „Wird gelesen“ */
  title: string;

  paths: string[];

}



/**

 * Dependency-Graph: SVG-Kanten + Angular-Knoten, gemeinsames Pan/Zoom.

 * Knoten per Drag verschiebbar (manuelle Positionen pro id), wie vis dragNodes.

 */

@Component({

  selector: 'app-vis-network',

  standalone: true,

  imports: [EdgeReadPropsOverlayComponent, GraphDogNodeComponent],

  template: `

    <div

      class="viewport"

      #viewport

      [class.panning]="isPanning"

      (pointerdown)="onViewportPointerDown($event)"

      (pointermove)="onViewportPointerMove($event)"

      (pointerup)="onViewportPointerUp($event)"

      (pointercancel)="onViewportPointerUp($event)"

      (wheel)="onWheel($event)">

      @if (viewModel(); as vm) {

        <div

          class="canvas"

          [style.transform]="canvasTransform()"

          [style.width.px]="vm.contentWidth"

          [style.height.px]="vm.contentHeight">

          <svg

            class="edge-svg"

            [attr.width]="vm.contentWidth"

            [attr.height]="vm.contentHeight"

            aria-hidden="true">

            @for (e of vm.renderEdges; track e.key) {

              <path

                [attr.d]="e.pathD"

                [attr.stroke]="e.optional ? '#0066cc' : '#cc0000'"

                [attr.stroke-width]="e.optional ? 1.5 : 2"

                [attr.stroke-dasharray]="e.optional ? '7 5' : null"

                stroke-linecap="round"

                stroke-linejoin="round"

                fill="none" />

            }

          </svg>

          @for (n of vm.renderNodes; track n.id) {

            <div

              class="graph-node-slot"

              [class.dragging]="draggingNodeId() === n.id"

              [style.width.px]="nodeW"

              [style.height.px]="nodeH"

              [style.left.px]="n.rx"

              [style.top.px]="n.ry"

              (pointerdown)="onNodePointerDown($event, n)"

              (click)="onNodeClick(n.dog, $event)">

              <app-graph-dog-node

                [dog]="n.dog"

                [label]="n.dog.name"

                [icon]="n.dog.icon"

                [selected]="isNodeSelected(n.id)"

                [hasError]="!!n.dog.error"

                [isSerialized]="!!n.dog.codeTs"

                [isMimic]="n.dog.mimic"

                [isLead]="isNodeLead(n.id)"

                [showSectionFan]="isNodeSelected(n.id)"

                (sectionEditRequested)="onDogSectionFan($event, n.dog)" />

            </div>

          }

          @for (o of edgeReadOverlays(); track o.key) {

            <div

              class="edge-read-slot"

              [style.left.px]="o.left"

              [style.top.px]="o.top">

              <app-edge-read-props-overlay [title]="o.title" [paths]="o.paths" />

            </div>

          }

        </div>

      }

    </div>

  `,

  styles: [`

    :host { display: block; width: 100%; height: 100%; }

    .viewport {

      width: 100%;

      height: 100%;

      overflow: hidden;

      background: transparent;

      position: relative;

      touch-action: none;

      user-select: none;

      cursor: grab;

    }

    .viewport.panning { cursor: grabbing; }

    .canvas {

      position: relative;

      transform-origin: 0 0;

      will-change: transform;

      background: transparent;

    }

    .edge-svg {

      position: absolute;

      left: 0;

      top: 0;

      z-index: 0;

      pointer-events: none;

      overflow: visible;

    }

    .graph-node-slot {

      position: absolute;

      z-index: 1;

      box-sizing: border-box;

      cursor: move;

      touch-action: none;

      overflow: visible;

    }

    .graph-node-slot.dragging { cursor: grabbing; }

    .edge-read-slot {

      position: absolute;

      z-index: 2;

      transform: translate(-50%, -50%);

      pointer-events: none;

    }

  `]

})

export class VisNetworkComponent implements OnChanges, OnDestroy {

  @ViewChild('viewport') viewportRef!: ElementRef<HTMLElement>;



  @Input() waves: Waves = [];

  @Input() selectedDog: DogEntry | null = null;

  @Input() flatDogs: DogEntry[] = [];

  @Output() dogSelected = new EventEmitter<DogEntry>();

  /** Klick auf roten Fächer-Button am Knoten: Panel mit gewählter Section öffnen. */
  @Output() dogSectionEdit = new EventEmitter<{ dog: DogEntry; section: DogPanelSectionId }>();

  @Output() dogDeleted = new EventEmitter<string>();

  /** Erster Eintrag in kennel.dogIds — für Lead-Stern am Knoten */
  @Input() kennelLeadDogIdsSlot: string | null = null;

  /** Zusammen mit app-graph-canvas-scale (z. B. 0.5): Pointer-Deltas mit 1/scale korrigieren. */
  @Input() canvasScale = 1;



  readonly nodeW = GRAPH_NODE_W;

  readonly nodeH = GRAPH_NODE_H;



  private readonly wavesRef = signal<Waves>([]);

  /** Manuelle Weltkoordinaten (Top-Left), überschreibt Auto-Layout pro Knoten-id */

  readonly manualPositions = signal<Map<string, { x: number; y: number }>>(new Map());



  private readonly selectedRef = signal<DogEntry | null>(null);

  private readonly flatDogsRef = signal<DogEntry[]>([]);



  viewModel = computed(() =>

    buildGraphViewModel(this.wavesRef(), this.manualPositions(), !this.draggingNodeId())

  );



  panX = signal(0);

  panY = signal(0);

  zoom = signal(1);



  isPanning = false;

  private panGrab: { sx: number; sy: number; px: number; py: number } | null = null;



  draggingNodeId = signal<string | null>(null);

  private nodeDragLast: { cx: number; cy: number } | null = null;

  private nodeDragSuppressedClick = false;



  private readonly onDocPointerMove = (e: PointerEvent) => this.onNodePointerMoveDoc(e);

  private readonly onDocPointerUp = (e: PointerEvent) => this.onNodePointerUpDoc(e);



  canvasTransform = computed(() => {

    const x = this.panX();

    const y = this.panY();

    const z = this.zoom();

    return `translate(${x}px, ${y}px) scale(${z})`;

  });



  /** Pro ausgewähltem Knoten höchstens zwei Karten: links eingehend (Liest von), rechts ausgehend (Wird gelesen). */
  edgeReadOverlays = computed((): EdgeReadOverlayVM[] => {

    const sel = this.selectedRef();

    const vm = this.viewModel();

    if (!sel || !vm) return [];

    const rn = vm.renderNodes.find((n) => n.id === sel.id);

    if (!rn) return [];

    /** Etwas über Knotenmitte, damit Karten/Titel nicht in den Node-Inhalt (Glyph) ragen */
    const midY = rn.ry + GRAPH_NODE_H / 2 - 14;

    /** Abstand Knotenkante → Overlay-Mitte (Karten ~240px breit; größer = weniger Überlappung mit Knoten) */
    const inset = 158;

    const out: EdgeReadOverlayVM[] = [];

    const incoming = formatReadFromLines(sel.readFrom);

    if (incoming.length > 0) {

      out.push({

        key: 'data-in',

        left: rn.rx - inset,

        top: midY,

        title: 'Liest von',

        paths: incoming,

      });

    }

    const outgoing = formatReadByLines(sel.readBy);

    if (outgoing.length > 0) {

      out.push({

        key: 'data-out',

        left: rn.rx + GRAPH_NODE_W + inset,

        top: midY,

        title: 'Wird gelesen',

        paths: outgoing,

      });

    }

    return out;

  });



  ngOnChanges(changes: SimpleChanges) {

    this.selectedRef.set(this.selectedDog);

    this.flatDogsRef.set(this.flatDogs ?? []);



    if (changes['waves']) {

      this.wavesRef.set(this.waves ?? []);

      const baseIds = new Set(

        (this.waves ?? [])

          .flat()

          .map(d => d.id)

      );

      const pruned = new Map<string, { x: number; y: number }>();

      for (const [id, pos] of this.manualPositions()) {

        if (baseIds.has(id)) pruned.set(id, pos);

      }

      this.manualPositions.set(pruned);



      if (baseIds.size > 0) {

        setTimeout(() => this.fitView(), 0);

      } else {

        this.panX.set(0);

        this.panY.set(0);

        this.zoom.set(1);

      }

    }

  }



  ngOnDestroy() {

    this.detachNodeDragListeners();

  }



  private detachNodeDragListeners() {

    document.removeEventListener('pointermove', this.onDocPointerMove);

    document.removeEventListener('pointerup', this.onDocPointerUp);

    document.removeEventListener('pointercancel', this.onDocPointerUp);

  }



  private canvasScaleInv(): number {
    const s = this.canvasScale;
    return s > 0 ? 1 / s : 1;
  }



  isNodeSelected(id: string): boolean {

    return this.selectedRef()?.id === id;

  }



  isNodeLead(graphNodeId: string): boolean {

    const slot = this.kennelLeadDogIdsSlot;

    if (!slot) return false;

    return graphNodeIdMatchesKennelDogId(graphNodeId, slot);

  }



  onNodePointerDown(e: PointerEvent, n: RenderNode) {

    if (e.button !== 0) return;

    e.stopPropagation();

    e.preventDefault();

    this.draggingNodeId.set(n.id);

    this.nodeDragLast = { cx: e.clientX, cy: e.clientY };

    this.nodeDragSuppressedClick = false;

    document.addEventListener('pointermove', this.onDocPointerMove, { passive: false });

    document.addEventListener('pointerup', this.onDocPointerUp);

    document.addEventListener('pointercancel', this.onDocPointerUp);

  }



  private onNodePointerMoveDoc(e: PointerEvent) {

    if (!this.draggingNodeId() || !this.nodeDragLast) return;

    e.preventDefault();

    const z = this.zoom();

    const inv = this.canvasScaleInv();

    const dx = ((e.clientX - this.nodeDragLast.cx) * inv) / z;

    const dy = ((e.clientY - this.nodeDragLast.cy) * inv) / z;

    if (Math.hypot(dx * z, dy * z) > 4) {

      this.nodeDragSuppressedClick = true;

    }

    this.nodeDragLast = { cx: e.clientX, cy: e.clientY };



    const vm = this.viewModel();

    if (!vm) return;

    const wn = vm.worldNodes.find(x => x.id === this.draggingNodeId());

    if (!wn) return;



    const next = new Map(this.manualPositions());

    const id = this.draggingNodeId()!;

    const cur = next.get(id) ?? { x: wn.x, y: wn.y };

    next.set(id, { x: cur.x + dx, y: cur.y + dy });

    this.manualPositions.set(next);

  }



  private onNodePointerUpDoc(_e: PointerEvent) {

    const draggedId = this.draggingNodeId();

    /** Nur bei echtem Ziehen — sonst wäre jeder Klick ein „Drag-Ende“ (Separation + Zoom). */
    const didDrag = this.nodeDragSuppressedClick;

    this.detachNodeDragListeners();

    this.draggingNodeId.set(null);

    this.nodeDragLast = null;

    if (draggedId && didDrag) {

      const vm = buildGraphViewModel(this.wavesRef(), this.manualPositions(), true);

      if (vm?.worldNodes.length) {

        const m = new Map<string, { x: number; y: number }>();

        for (const n of vm.worldNodes) m.set(n.id, { x: n.x, y: n.y });

        this.manualPositions.set(m);

      }

    }

  }



  onNodeClick(dog: DogEntry, e: MouseEvent) {

    e.stopPropagation();

    if (this.nodeDragSuppressedClick) {

      this.nodeDragSuppressedClick = false;

      return;

    }

    this.dogSelected.emit(dog);

  }

  onDogSectionFan(section: DogPanelSectionId, dog: DogEntry): void {
    this.dogSectionEdit.emit({ dog, section });
  }

  onViewportPointerDown(e: PointerEvent) {

    if (e.button !== 0) return;

    const t = e.target as HTMLElement;

    if (t.closest('.graph-node-slot')) return;



    this.isPanning = true;

    this.panGrab = {

      sx: e.clientX,

      sy: e.clientY,

      px: this.panX(),

      py: this.panY(),

    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

  }



  onViewportPointerMove(e: PointerEvent) {

    if (!this.isPanning || !this.panGrab) return;

    e.preventDefault();

    const g = this.panGrab;

    const inv = this.canvasScaleInv();

    this.panX.set(g.px + (e.clientX - g.sx) * inv);

    this.panY.set(g.py + (e.clientY - g.sy) * inv);

  }



  onViewportPointerUp(_e: PointerEvent) {

    this.isPanning = false;

    this.panGrab = null;

  }



  onWheel(e: WheelEvent) {

    e.preventDefault();

    const z = this.zoom();

    const factor = e.deltaY > 0 ? 0.92 : 1.08;

    const nz = Math.min(2.5, Math.max(0.3, z * factor));

    this.zoom.set(nz);

  }



  private fitView() {

    const vm = this.viewModel();

    const vp = this.viewportRef?.nativeElement;

    if (!vm || !vp) return;



    const vw = vp.clientWidth;

    const vh = vp.clientHeight;

    if (vw < 8 || vh < 8) return;



    const cw = vm.contentWidth;

    const ch = vm.contentHeight;

    const margin = 0.9;

    const z = Math.min(vw / cw, vh / ch, 1.25) * margin;

    const nz = Math.max(0.35, Math.min(2.5, z));

    this.zoom.set(nz);

    this.panX.set((vw - cw * nz) / 2);

    this.panY.set((vh - ch * nz) / 2);

  }



}

function formatReadFromLines(readFrom: ReadTrackingEntry[] | undefined): string[] {

  if (!readFrom?.length) return [];

  const seen = new Set<string>();

  const out: string[] = [];

  for (const r of readFrom) {

    const line = `${r.sourceInstanceName} · ${r.propertyPath}`;

    if (seen.has(line)) continue;

    seen.add(line);

    out.push(line);

  }

  return out;

}

function formatReadByLines(readBy: ReadTrackingEntry[] | undefined): string[] {

  if (!readBy?.length) return [];

  const seen = new Set<string>();

  const out: string[] = [];

  for (const r of readBy) {

    const line = `${r.readerInstanceName} · ${r.propertyPath}`;

    if (seen.has(line)) continue;

    seen.add(line);

    out.push(line);

  }

  return out;

}


