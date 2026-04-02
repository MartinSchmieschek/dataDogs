import {
  Component, Input, Output, EventEmitter,
  OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';

export interface TimelineVersion {
  id: string;
  version: number;
  parentId?: string | null;
  createdAt?: string;
  displayName?: string;
}

interface GNode {
  v: TimelineVersion;
  x: number; y: number;
  col: number; row: number;
}

interface GEdge { x1: number; y1: number; x2: number; y2: number; }

const R = 5;
const CW = 24;
const RH = 22;
const PX = 14;
const PY = 12;

@Component({
  selector: 'app-version-timeline',
  standalone: true,
  template: `
    <div class="vc">
      <div class="vh">
        <span class="vl">Versionen</span>
      </div>
      <div class="vs">
        <svg [attr.width]="sw" [attr.height]="sh">
          @if (trunk) {
            <line [attr.x1]="trunk.x1" [attr.y1]="trunk.y1"
                  [attr.x2]="trunk.x2" [attr.y2]="trunk.y2" class="tl"/>
          }
          @for (e of edges; track $index) {
            <path [attr.d]="ep(e)" class="el"/>
          }
          @for (n of nodes; track n.v.id) {
            <!-- the dot -->
            <circle
              [attr.cx]="n.x" [attr.cy]="n.y" [attr.r]="r(n)"
              [class.active]="n.v.id === activeId"
              [class.sel]="n.v.id === selectedVersionId && n.v.id !== activeId"
              class="nd"
              (click)="select(n.v.id)">
              <title>{{ tip(n) }}</title>
            </circle>
            <!-- 📍 marker on the node the kennel actually uses -->
            @if (showPinControls && n.v.id === pinnedVersionId) {
              <text [attr.x]="n.x" [attr.y]="n.y - r(n) - 4" class="marker clickable"
                (click)="unpin($event)">📍</text>
            }
          }

          <!-- pin/unpin toggle on selected node -->
          @if (showPinControls && selNode) {
            <text
              [attr.x]="selNode.x"
              [attr.y]="selNode.y - r(selNode) - 4"
              class="pa"
              (click)="togglePin()">📌</text>
          }
        </svg>
      </div>
      @if (info) { <div class="vi">{{ info }}</div> }
    </div>
  `,
  styles: [`
    :host{display:block}
    .vc{padding:6px 10px 4px;background:#0a0a0a;border-top:1px solid #222}
    .vh{display:flex;align-items:center;gap:6px;margin-bottom:3px}
    .vl{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#555}
    .vs{overflow-x:auto;overflow-y:hidden}
    svg{display:block}

    .tl{stroke:#222;stroke-width:1.5}
    .el{fill:none;stroke:#222;stroke-width:1.5}

    .nd{fill:#3a3a3a;stroke:#555;stroke-width:1.5;cursor:pointer;transition:all .12s}
    .nd:hover{fill:#666;stroke:#aaa}
    .nd.active{fill:#07f;stroke:#5bf;stroke-width:2;filter:drop-shadow(0 0 4px rgba(0,119,255,.5))}
    .nd.sel{fill:#3a3a3a;stroke:#fff;stroke-width:2}

    .marker{font-size:11px;text-anchor:middle;pointer-events:none;user-select:none}
    .marker.clickable{pointer-events:all;cursor:pointer;opacity:.7;transition:opacity .12s}
    .marker.clickable:hover{opacity:1}
    .pa{font-size:12px;text-anchor:middle;cursor:pointer;user-select:none;opacity:.45;transition:opacity .12s}
    .pa:hover{opacity:1}

    .vi{margin-top:4px;font-size:9px;color:#666;text-align:center}
  `]
})
export class VersionTimelineComponent implements OnDestroy, OnChanges {
  @Input() versions: TimelineVersion[] = [];
  @Input() currentVersionId = '';
  @Input() selectedVersionId: string | null = null;
  @Input() pinnedVersionId: string | null = null;
  /** Whether to show pin/unpin controls. Set to false for kennel timelines. */
  @Input() showPinControls = true;
  @Output() versionSelected = new EventEmitter<string>();
  @Output() pinToggled = new EventEmitter<string | null>();

  nodes: GNode[] = [];
  edges: GEdge[] = [];
  trunk: { x1: number; y1: number; x2: number; y2: number } | null = null;
  sw = 60; sh = 30;

  /**
   * The node the kennel actually uses:
   * - If a version is pinned → that version
   * - Otherwise → the currentVersionId (latest loaded by the kennel)
   */
  get activeId(): string {
    return this.pinnedVersionId || this.currentVersionId;
  }

  get selNode(): GNode | null {
    if (!this.selectedVersionId) return null;
    return this.nodes.find(n => n.v.id === this.selectedVersionId) ?? null;
  }

  ngOnChanges(c: SimpleChanges) { if (c['versions']) this.lay(); }

  private lay() {
    const all = this.versions;
    if (!all.length) { this.nodes = []; this.edges = []; this.trunk = null; return; }

    // Sort all versions globally by createdAt — time dictates column position.
    const sorted = [...all].sort((a, b) => this.ts(a) - this.ts(b));

    const colOf = new Map<string, number>();
    sorted.forEach((v, i) => colOf.set(v.id, i));

    const byId = new Map<string, TimelineVersion>();
    all.forEach(v => byId.set(v.id, v));

    const ch = new Map<string, TimelineVersion[]>();
    all.forEach(v => {
      if (v.parentId && byId.has(v.parentId)) {
        const a = ch.get(v.parentId) || [];
        a.push(v);
        ch.set(v.parentId, a);
      }
    });
    ch.forEach(a => a.sort((a, b) => this.ts(a) - this.ts(b)));

    const roots = all.filter(v => !v.parentId || !byId.has(v.parentId))
      .sort((a, b) => this.ts(a) - this.ts(b));

    const rowOf = new Map<string, number>();
    let nextBranch = 1;

    const walk = (v: TimelineVersion, row: number) => {
      rowOf.set(v.id, row);
      (ch.get(v.id) || []).forEach((k, i) => walk(k, i === 0 ? row : nextBranch++));
    };
    roots.forEach((r, i) => walk(r, i === 0 ? 0 : nextBranch++));

    const maxCol = sorted.length - 1;
    const maxRow = Math.max(nextBranch - 1, 0);
    const topPad = PY + 16;

    this.nodes = sorted.map(v => {
      const col = colOf.get(v.id) ?? 0;
      const row = rowOf.get(v.id) ?? 0;
      return { v, col, row, x: PX + col * CW, y: topPad + row * RH };
    });

    const nm = new Map<string, GNode>();
    this.nodes.forEach(n => nm.set(n.v.id, n));

    const t0 = this.nodes.filter(n => n.row === 0);
    this.trunk = t0.length > 1
      ? { x1: t0[0].x, y1: topPad, x2: t0[t0.length - 1].x, y2: topPad }
      : null;

    this.edges = [];
    this.nodes.forEach(n => {
      if (!n.v.parentId || !nm.has(n.v.parentId)) return;
      const pa = nm.get(n.v.parentId)!;
      if (pa.row === 0 && n.row === 0) return;
      this.edges.push({ x1: pa.x, y1: pa.y, x2: n.x, y2: n.y });
    });

    this.sw = Math.max(PX * 2 + maxCol * CW, 50);
    this.sh = topPad + maxRow * RH + PY;
  }

  ep(e: GEdge): string {
    if (e.y1 === e.y2) return `M${e.x1},${e.y1}L${e.x2},${e.y2}`;
    const mx = e.x1 + CW * .4;
    return `M${e.x1},${e.y1}C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`;
  }

  r(n: GNode): number {
    return (n.v.id === this.activeId || n.v.id === this.selectedVersionId)
      ? R + 2 : R;
  }

  tip(n: GNode): string {
    const d = this.fd(n.v.createdAt);
    const nm = n.v.displayName || '';
    const fl: string[] = [];
    if (n.v.id === this.activeId) fl.push(this.pinnedVersionId ? 'fixiert' : 'aktuell');
    return `${nm} ${d}${fl.length ? ' (' + fl.join(', ') + ')' : ''}`.trim();
  }

  select(id: string) { this.versionSelected.emit(id); }

  togglePin() {
    if (!this.selectedVersionId) return;
    this.pinToggled.emit(this.pinnedVersionId === this.selectedVersionId ? null : this.selectedVersionId);
  }

  unpin(e: MouseEvent) {
    e.stopPropagation();
    this.pinToggled.emit(null);
  }

  get info(): string {
    if (this.selectedVersionId && this.selectedVersionId !== this.activeId) {
      const n = this.nodes.find(x => x.v.id === this.selectedVersionId);
      if (n) return `${n.v.displayName || this.fd(n.v.createdAt)} geladen — Speichern erzeugt Branch`;
    }
    return '';
  }

  private ts(v: TimelineVersion): number { return v.createdAt ? new Date(v.createdAt).getTime() : 0; }
  private fd(s?: string): string {
    if (!s) return '';
    const d = new Date(s);
    return `${d.getDate()}.${d.getMonth() + 1}. ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  ngOnDestroy() {}
}
