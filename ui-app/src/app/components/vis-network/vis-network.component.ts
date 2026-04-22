import {

  Component, Input, Output, EventEmitter,

  ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy,

  computed, signal

} from '@angular/core';

import { DogEntry, Waves } from '../../models/dog-entry.model';

import { EdgeReadPropsOverlayComponent } from '../edge-read-props-overlay/edge-read-props-overlay.component';

import { GraphDogNodeComponent } from '../graph-dog-node/graph-dog-node.component';

import {

  buildGraphViewModel,

  applyGraphRepulsionAndProjection,

  cubicBezierMidpoint,

  GRAPH_EDGE_BORDER_PAD_PX,

  GRAPH_NODE_H,

  GRAPH_NODE_W,

  type RenderEdge,

  type RenderNode,

} from './graph-layout';

import { graphNodeIdMatchesKennelDogId } from '../../utils/kennel-dog-id-match';
import { DogPanelSectionId } from '../../utils/dog-panel-sections';



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

                class="edge-path edge-path--border"

                [attr.d]="e.pathD"

                [attr.stroke]="graphEdgeStrokeBorder"

                [attr.stroke-width]="edgeOuterStrokeWidth(e)"

                [attr.stroke-dasharray]="e.optional ? graphEdgeDashArray : null"

                stroke-linecap="round"

                stroke-linejoin="round"

                fill="none" />

              <path

                class="edge-path edge-path--main"

                [attr.d]="e.pathD"

                [attr.stroke]="graphEdgeStrokeMain(e)"

                [attr.stroke-width]="e.strokeWidthPx"

                [attr.stroke-dasharray]="e.optional ? graphEdgeDashArray : null"

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

              (click)="onNodeClick(n.dog, $event)"

              (dblclick)="onNodeDblClick(n.dog, $event)">

              <div class="graph-node-slot-inner">

                <app-graph-dog-node

                  [dog]="n.dog"

                  [label]="n.dog.name"

                  [icon]="n.dog.icon"

                  [selected]="isNodeSelected(n.id)"

                  [hasError]="!!n.dog.error"

                  [isSerialized]="!!n.dog.codeTs"

                  [isMimic]="n.dog.mimic"

                  [isLead]="isNodeLead(n.id)"

                  [leadRunUrl]="isNodeLead(n.id) ? leadRunUrl : null"

                  [leadSwaggerUrl]="isNodeLead(n.id) ? leadSwaggerUrl : null"

                  (sectionEditRequested)="onDogSectionFan($event, n.dog)" />

              </div>

            </div>

          }

          @for (s of edgeCutSlots(); track s.key) {

            <div

              class="edge-cut-cluster"

              [class.edge-cut-cluster--reads-open]="edgeReadsExpandedKey() === s.key"

              [style.left.px]="s.left"

              [style.top.px]="s.top">

              <div class="edge-cut-toolbar" (pointerdown)="$event.stopPropagation()">

                @if (s.readFromPaths.length > 0 || s.readByPaths.length > 0) {

                  <button

                    type="button"

                    class="edge-read-toggle-btn"

                    [class.edge-read-toggle-btn--open]="edgeReadsExpandedKey() === s.key"

                    [attr.aria-expanded]="edgeReadsExpandedKey() === s.key"

                    title="Read-Tracking (Liest von / Wird gelesen)"

                    aria-label="Read-Tracking: Liest von und Wird gelesen"

                    (click)="toggleEdgeReadsPanel(s.key, $event)">

                    <span aria-hidden="true">⌕</span>

                  </button>

                }

                <button

                  type="button"

                  class="edge-cut-btn"

                  title="Zweig aus Kennel entfernen (nicht Lead-Pfad; alle Knoten dieses Teilbaums aus dogIds)"

                  (click)="onBranchCutClick(s, $event)">✂</button>

              </div>

              @if (edgeReadsExpandedKey() === s.key && (s.readFromPaths.length > 0 || s.readByPaths.length > 0)) {

                <div class="edge-cut-reads-panel" (pointerdown)="$event.stopPropagation()">

                  <div class="edge-cut-reads-grid">

                    <div class="edge-cut-wing edge-cut-wing--left">

                      @if (s.readFromPaths.length > 0) {

                        <div class="edge-cut-read">

                          <app-edge-read-props-overlay

                            variant="edge"

                            title="Liest von"

                            [paths]="s.readFromPaths" />

                          <span class="edge-cut-arrow" aria-hidden="true">{{ s.arrowTowardTo }}</span>

                        </div>

                      }

                    </div>

                    <div class="edge-cut-reads-spacer" aria-hidden="true"></div>

                    <div class="edge-cut-wing edge-cut-wing--right">

                      @if (s.readByPaths.length > 0) {

                        <div class="edge-cut-read">

                          <span class="edge-cut-arrow" aria-hidden="true">{{ s.arrowTowardFrom }}</span>

                          <app-edge-read-props-overlay

                            variant="edge"

                            title="Wird gelesen"

                            [paths]="s.readByPaths" />

                        </div>

                      }

                    </div>

                  </div>

                </div>

              }

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

    .edge-svg .edge-path--main {

      pointer-events: stroke;

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

    .graph-node-slot-inner {

      position: relative;

      width: 100%;

      height: 100%;

      overflow: visible;

    }

    .edge-cut-cluster {

      position: absolute;

      z-index: 3;

      transform: translate(-50%, -50%);

      display: flex;

      flex-direction: column;

      align-items: center;

      gap: 0.4rem;

      width: auto;

      max-width: min(96vw, 76rem);

      pointer-events: none;

    }

    .edge-cut-cluster--reads-open {

      max-width: min(96vw, 76rem);

    }

    .edge-cut-toolbar {

      display: flex;

      flex-direction: row;

      align-items: center;

      justify-content: center;

      gap: 0.35rem;

      pointer-events: auto;

    }

    .edge-read-toggle-btn {

      margin: 0;

      padding: 1px 6px;

      font-size: 13px;

      line-height: 1.2;

      cursor: pointer;

      border-radius: 4px;

      border: 1px solid rgba(100, 130, 170, 0.5);

      background: rgba(18, 24, 36, 0.92);

      color: rgba(180, 200, 230, 0.95);

      opacity: 0.55;

    }

    .edge-read-toggle-btn:hover {

      opacity: 1;

      border-color: rgba(130, 170, 220, 0.75);

    }

    .edge-read-toggle-btn--open {

      opacity: 1;

      border-color: rgba(140, 180, 230, 0.85);

      background: rgba(28, 38, 54, 0.96);

    }

    .edge-cut-reads-panel {

      pointer-events: auto;

      width: min(92vw, 70rem);

      max-width: 96vw;

      padding: 0.35rem 0.25rem 0.15rem;

    }

    .edge-cut-reads-grid {

      display: grid;

      grid-template-columns: minmax(0, 1fr) 0.5rem minmax(0, 1fr);

      align-items: start;

      column-gap: 0.35rem;

    }

    .edge-cut-reads-spacer {

      min-width: 0;

    }

    .edge-cut-wing {

      display: flex;

      align-items: center;

      min-width: 0;

    }

    .edge-cut-wing--left {

      justify-content: flex-end;

    }

    .edge-cut-wing--right {

      justify-content: flex-start;

    }

    .edge-cut-read {

      display: flex;

      flex-direction: row;

      align-items: center;

      gap: 0.35rem;

      min-width: 0;

      max-width: 100%;

      pointer-events: auto;

    }

    .edge-cut-arrow {

      flex-shrink: 0;

      font-size: 1rem;

      line-height: 1;

      opacity: 0.95;

      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));

    }

    .edge-cut-btn {

      margin: 0;

      padding: 1px 5px;

      font-size: 13px;

      line-height: 1.2;

      cursor: pointer;

      border-radius: 4px;

      border: 1px solid rgba(120, 120, 140, 0.55);

      background: rgba(20, 22, 32, 0.92);

      color: #c8cad8;

      opacity: 0.5;

    }

    .edge-cut-btn:hover {

      opacity: 1;

      border-color: #889;

      color: #fff;

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

  /** Kante Parent → Kind: gesamten Teilbaum ab Kind aus `dogIds` des Kennels streichen. */
  @Output() branchCutRequested = new EventEmitter<{ fromId: string; toId: string }>();

  /** Erster Eintrag in kennel.dogIds — für Lead-Stern am Knoten */
  @Input() kennelLeadDogIdsSlot: string | null = null;

  /** Nur Lead-Knoten: Link „Antwort (Server)“ (öffentlicher GET /:kennelId). */
  @Input() leadRunUrl: string | null = null;

  /** Nur Lead-Knoten: Swagger-UI für dieses Kennel. */
  @Input() leadSwaggerUrl: string | null = null;

  /** Zusammen mit app-graph-canvas-scale (z. B. 0.5): Pointer-Deltas mit 1/scale korrigieren. */
  @Input() canvasScale = 1;



  readonly nodeW = GRAPH_NODE_W;

  readonly nodeH = GRAPH_NODE_H;

  /** Sehr dunkles Blau — Außenrand (unter der Hauptlinie gezeichnet). */
  readonly graphEdgeStrokeBorder = '#050d16';

  /** Strichmuster für optionale Kanten (Rand + Füllung gleich). */
  readonly graphEdgeDashArray = '10 7';

  graphEdgeStrokeMain(e: RenderEdge): string {
    return e.optional ? '#4d6689' : '#325176';
  }

  edgeOuterStrokeWidth(e: RenderEdge): number {
    return e.strokeWidthPx + GRAPH_EDGE_BORDER_PAD_PX;
  }



  private readonly wavesRef = signal<Waves>([]);

  /** Manuelle Weltkoordinaten (Top-Left), überschreibt Auto-Layout pro Knoten-id */

  readonly manualPositions = signal<Map<string, { x: number; y: number }>>(new Map());



  private readonly selectedRef = signal<DogEntry | null>(null);

  /** Einfachklick: Knoten im Graph hervorheben ohne Panel zu öffnen (siehe `onNodeDblClick`). */
  private readonly graphFocusDogId = signal<string | null>(null);

  /** Pro Kanten-Schere: Read-Tracking-Panel unter der Lupen-Schaltfläche (Template). */
  readonly edgeReadsExpandedKey = signal<string | null>(null);

  private readonly flatDogsRef = signal<DogEntry[]>([]);



  viewModel = computed(() => {

    const base = buildGraphViewModel(this.wavesRef(), this.manualPositions(), !this.draggingNodeId(), {
      leadAnchorTopId: this.resolveLeadGraphNodeId(),
    });

    if (!base) return null;

    if (this.draggingNodeId()) return base;

    return applyGraphRepulsionAndProjection(base, this.wavesRef(), this.resolveLeadGraphNodeId());

  });



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



  /**
   * Schere in Kantenmitte; „Liest von“ / „Wird gelesen“ nur für diese Kante (from → to), mit Pfeil Richtung Zielknoten.
   */
  edgeCutSlots = computed(() => {

    const vm = this.viewModel();

    if (!vm) return [];

    const map = vm.dogMap;

    const rnById = new Map(vm.renderNodes.map(n => [n.id, n]));

    return vm.renderEdges
      .filter(e => edgeShowsBranchCutForOffLeadPath(map.get(e.fromId), map.get(e.toId)))
      .map(e => {

        const mid = cubicBezierMidpoint(e.rx1, e.ry1, e.rx2, e.ry2);

        const fromDog = map.get(e.fromId);

        const toDog = map.get(e.toId);

        const fromRn = rnById.get(e.fromId);

        const toRn = rnById.get(e.toId);

        let arrowTowardTo = '⬇️';

        let arrowTowardFrom = '⬆️';

        if (fromRn && toRn) {

          const c1x = fromRn.rx + GRAPH_NODE_W / 2;

          const c1y = fromRn.ry + GRAPH_NODE_H / 2;

          const c2x = toRn.rx + GRAPH_NODE_W / 2;

          const c2y = toRn.ry + GRAPH_NODE_H / 2;

          arrowTowardTo = flowArrowEmoji(mid.x, mid.y, c2x, c2y);

          arrowTowardFrom = flowArrowEmoji(mid.x, mid.y, c1x, c1y);

        }

        const readFromPaths =
          fromDog && toDog ? readFromLinesAlongEdge(fromDog, toDog) : [];

        const readByPaths =
          fromDog && toDog ? readByLinesAlongEdge(fromDog, toDog) : [];

        return {

          key: e.key,

          left: mid.x,

          top: mid.y,

          fromId: e.fromId,

          toId: e.toId,

          readFromPaths,

          readByPaths,

          arrowTowardTo,

          arrowTowardFrom,

        };

      });

  });



  ngOnChanges(changes: SimpleChanges) {

    this.selectedRef.set(this.selectedDog);

    this.flatDogsRef.set(this.flatDogs ?? []);



    if (changes['waves']) {

      this.wavesRef.set(this.waves ?? []);

      this.graphFocusDogId.set(null);

      this.edgeReadsExpandedKey.set(null);

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

    if (this.selectedRef()?.id === id) return true;

    return this.graphFocusDogId() === id;

  }



  isNodeLead(graphNodeId: string): boolean {

    const slot = this.kennelLeadDogIdsSlot;

    if (!slot) return false;

    const dog = this.viewModel()?.dogMap.get(graphNodeId);

    return graphNodeIdMatchesKennelDogId(graphNodeId, slot, dog?.lineageId);

  }



  /** Graph-Knoten-id des Kennel-Leads (dogIds[0]) für Layout-Anker oben. */
  private resolveLeadGraphNodeId(): string | null {

    const slot = this.kennelLeadDogIdsSlot;

    if (!slot) return null;

    const flat = (this.wavesRef() ?? []).flat();

    const d = flat.find(dog => graphNodeIdMatchesKennelDogId(dog.id, slot, dog.lineageId));

    return d?.id ?? null;

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

      const base = buildGraphViewModel(this.wavesRef(), this.manualPositions(), true, {
        leadAnchorTopId: this.resolveLeadGraphNodeId(),
      });

      const vm = base
        ? applyGraphRepulsionAndProjection(base, this.wavesRef(), this.resolveLeadGraphNodeId())
        : null;

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

    this.graphFocusDogId.set(dog.id);

  }



  onNodeDblClick(dog: DogEntry, e: MouseEvent) {

    e.stopPropagation();

    e.preventDefault();

    if (this.nodeDragSuppressedClick) {

      this.nodeDragSuppressedClick = false;

      return;

    }

    this.graphFocusDogId.set(dog.id);

    this.dogSelected.emit(dog);

  }

  onDogSectionFan(section: DogPanelSectionId, dog: DogEntry): void {
    this.dogSectionEdit.emit({ dog, section });
  }

  toggleEdgeReadsPanel(slotKey: string, ev: MouseEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.edgeReadsExpandedKey.update((cur) => (cur === slotKey ? null : slotKey));
  }

  onBranchCutClick(
    s: { fromId: string; toId: string },
    ev: Event
  ): void {
    ev.stopPropagation();
    ev.preventDefault();
    const ok = confirm(
      'Diesen Zweig wirklich aus dem Kennel entfernen?\n\n' +
        'Alle Dogs dieses Teilbaums (ab dem Kind-Knoten) werden aus dogIds gestrichen. ' +
        'Der Lead-Pfad bleibt unverändert.'
    );
    if (!ok) return;
    this.edgeReadsExpandedKey.set(null);
    this.branchCutRequested.emit({ fromId: s.fromId, toId: s.toId });
  }

  onViewportPointerDown(e: PointerEvent) {

    if (e.button !== 0) return;

    const t = e.target as HTMLElement;

    if (t.closest('.graph-node-slot')) return;

    if (t.closest('.edge-cut-cluster')) return;

    this.graphFocusDogId.set(null);

    this.edgeReadsExpandedKey.set(null);

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

function instanceMatchesDog(name: string, dog: DogEntry): boolean {

  return dog.name === name || dog.id === name;

}

/** `to` liest entlang dieser Kante von `from` (readFrom auf dem Zielknoten). */
function readFromLinesAlongEdge(from: DogEntry, to: DogEntry): string[] {

  const readFrom = to.readFrom;

  if (!readFrom?.length) return [];

  const seen = new Set<string>();

  const out: string[] = [];

  for (const r of readFrom) {

    if (!instanceMatchesDog(r.sourceInstanceName, from)) continue;

    const line = `${r.sourceInstanceName} · ${r.propertyPath}`;

    if (seen.has(line)) continue;

    seen.add(line);

    out.push(line);

  }

  return out;

}

/** `from` wird von `to` entlang dieser Kante gelesen (readBy auf dem Quellknoten). */
function readByLinesAlongEdge(from: DogEntry, to: DogEntry): string[] {

  const readBy = from.readBy;

  if (!readBy?.length) return [];

  const seen = new Set<string>();

  const out: string[] = [];

  for (const r of readBy) {

    if (!instanceMatchesDog(r.readerInstanceName, to)) continue;

    const line = `${r.readerInstanceName} · ${r.propertyPath}`;

    if (seen.has(line)) continue;

    seen.add(line);

    out.push(line);

  }

  return out;

}

/** Pfeil von der Kantenmitte zum Zielpunkt (dominant vertikal → ⬆️/⬇️, sonst ⬅️/➡️). */
function flowArrowEmoji(mx: number, my: number, tx: number, ty: number): string {

  const dx = tx - mx;

  const dy = ty - my;

  const ax = Math.abs(dx);

  const ay = Math.abs(dy);

  if (ay >= ax) return dy >= 0 ? '⬇️' : '⬆️';

  return dx >= 0 ? '➡️' : '⬅️';

}

/**
 * Schere nur auf Kanten, die nicht vollständig zum Lead-Ergebnis gehören —
 * beide Enden müssen `onLeadDependencyPath === true` sein, sonst ist die Kante „abschneidbar“.
 */
function edgeShowsBranchCutForOffLeadPath(
  from: DogEntry | undefined,
  to: DogEntry | undefined
): boolean {
  return !(from?.onLeadDependencyPath === true && to?.onLeadDependencyPath === true);
}


