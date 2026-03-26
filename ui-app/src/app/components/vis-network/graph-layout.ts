import { DogEntry, Waves } from '../../models/dog-entry.model';

/** Muss zu `.graph-node-slot` / GraphDogNode passen */
export const GRAPH_NODE_W = 136;
export const GRAPH_NODE_H = 84;

/** Horizontaler Abstand zwischen Wellen-Spalten */
const COL_GAP = 120;
/** Vertikaler Abstand zwischen Knoten in derselben Welle */
const ROW_GAP = 48;
/** Außenrand um den Graphen */
const PADDING = 56;

const SEP_GAP = 12;
const SEP_ITERATIONS = 20;

export interface PlacedNode {
  id: string;
  dog: DogEntry;
  /** Weltkoordinaten (Top-Left), wie aus dem Auto-Layout oder manuell */
  x: number;
  y: number;
}

export interface EdgeSegment {
  key: string;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  optional: boolean;
}

export interface GraphLayout {
  nodes: PlacedNode[];
  edges: EdgeSegment[];
  dogMap: Map<string, DogEntry>;
  contentWidth: number;
  contentHeight: number;
}

/** Für Template: Weltkoordinaten in Canvas-Pixel (oben links min mit Rand) */
export interface RenderNode extends PlacedNode {
  rx: number;
  ry: number;
}

export interface RenderEdge extends EdgeSegment {
  rx1: number;
  ry1: number;
  rx2: number;
  ry2: number;
  pathD: string;
}

export interface GraphViewModel {
  worldNodes: PlacedNode[];
  renderNodes: RenderNode[];
  renderEdges: RenderEdge[];
  dogMap: Map<string, DogEntry>;
  contentWidth: number;
  contentHeight: number;
}

export function cleanParentId(parentId: string): string {
  return parentId.startsWith('base:') ? parentId.substring(5) : parentId;
}

/**
 * Gleich große AABB: iterativ entlang der kleineren Überlappungsachse trennen.
 */
export function separateOverlappingNodes(
  nodes: PlacedNode[],
  w: number,
  h: number,
  gap: number = SEP_GAP,
  iterations: number = SEP_ITERATIONS
): void {
  const hw = w / 2;
  const hh = h / 2;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x + hw - (a.x + hw);
        const dy = b.y + hh - (a.y + hh);
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const overlapX = w + gap - absDx;
        const overlapY = h + gap - absDy;
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const sign = dx >= 0 ? 1 : -1;
          const shift = overlapX / 2;
          a.x -= sign * shift;
          b.x += sign * shift;
        } else {
          const sign = dy >= 0 ? 1 : -1;
          const shift = overlapY / 2;
          a.y -= sign * shift;
          b.y += sign * shift;
        }
      }
    }
  }
}

/**
 * Kubische Bézier mit horizontalen Tangenten an beiden Enden (LR-Dependency-Graph):
 * die Linie verläuft aus dem Knoten waagrecht heraus und trifft den Zielknoten waagrecht —
 * kein senkrechter „Vorhang“/Hängen entlang der Sehne.
 */
export function cubicBezierPathD(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number
): string {
  const gap = Math.max(rx2 - rx1, 1);
  const stretch = Math.min(100, gap * 0.42);
  const cx1 = rx1 + stretch;
  const cy1 = ry1;
  const cx2 = rx2 - stretch;
  const cy2 = ry2;
  return `M ${rx1} ${ry1} C ${cx1} ${cy1} ${cx2} ${cy2} ${rx2} ${ry2}`;
}

/**
 * Einfaches LR-Stufen-Layout aus den Wellen — rein geometrisch.
 */
export function buildGraphLayout(waves: Waves): GraphLayout {
  const dogMap = new Map<string, DogEntry>();
  const pos = new Map<string, { x: number; y: number }>();

  if (!waves?.length) {
    return {
      nodes: [],
      edges: [],
      dogMap,
      contentWidth: PADDING * 2,
      contentHeight: PADDING * 2,
    };
  }

  const colHeights = waves.map(w => {
    if (w.length === 0) return 0;
    return w.length * GRAPH_NODE_H + (w.length - 1) * ROW_GAP;
  });
  const maxColH = Math.max(0, ...colHeights);

  waves.forEach((wave, L) => {
    const colH = colHeights[L];
    const top = (maxColH - colH) / 2 + PADDING;
    wave.forEach((dog, i) => {
      const x = PADDING + L * (GRAPH_NODE_W + COL_GAP);
      const y = top + i * (GRAPH_NODE_H + ROW_GAP);
      pos.set(dog.id, { x, y });
      dogMap.set(dog.id, dog);
    });
  });

  const nodes: PlacedNode[] = [...dogMap.entries()].map(([id, dog]) => {
    const p = pos.get(id)!;
    return { id, dog, x: p.x, y: p.y };
  });

  const edges = recomputeEdgeSegments(nodes, waves);

  const numCols = waves.length;
  const contentWidth =
    PADDING * 2 + numCols * GRAPH_NODE_W + Math.max(0, numCols - 1) * COL_GAP;
  const contentHeight = PADDING * 2 + maxColH;

  return { nodes, edges, dogMap, contentWidth, contentHeight };
}

/**
 * Kanten aus aktuellen Knotenpositionen (nach Drag).
 */
export function recomputeEdgeSegments(nodes: PlacedNode[], waves: Waves): EdgeSegment[] {
  const pos = new Map(nodes.map(n => [n.id, n]));
  const seenEdge = new Set<string>();
  const edges: EdgeSegment[] = [];

  const pushEdge = (fromId: string, toId: string, optional: boolean) => {
    const ek = `${fromId}|${toId}`;
    if (seenEdge.has(ek)) return;
    seenEdge.add(ek);
    const pN = pos.get(fromId);
    const cN = pos.get(toId);
    if (!pN || !cN) return;
    const x1 = pN.x + GRAPH_NODE_W;
    const y1 = pN.y + GRAPH_NODE_H / 2;
    const x2 = cN.x;
    const y2 = cN.y + GRAPH_NODE_H / 2;
    edges.push({
      key: `${ek}-${optional ? 'opt' : 'req'}`,
      fromId,
      toId,
      x1,
      y1,
      x2,
      y2,
      optional,
    });
  };

  waves.forEach(wave => {
    wave.forEach(dog => {
      (dog.parentsRequired ?? []).forEach(pid => {
        pushEdge(cleanParentId(pid), dog.id, false);
      });
      (dog.parentsOptional ?? []).forEach(pid => {
        pushEdge(cleanParentId(pid), dog.id, true);
      });
    });
  });

  return edges;
}

/**
 * Wendet manuelle Positionen an, berechnet Kanten und Render-Koordinaten (Bounding Box).
 * @param separate — bei false (z. B. während Drag) keine Kollisionsauflösung.
 */
export function buildGraphViewModel(
  waves: Waves,
  manual: ReadonlyMap<string, { x: number; y: number }>,
  separate = true
): GraphViewModel | null {
  const base = buildGraphLayout(waves);
  if (!base.nodes.length) return null;

  const worldNodes: PlacedNode[] = base.nodes.map(n => {
    const o = manual.get(n.id);
    return o ? { ...n, x: o.x, y: o.y } : { ...n };
  });

  if (separate) {
    separateOverlappingNodes(worldNodes, GRAPH_NODE_W, GRAPH_NODE_H, SEP_GAP, SEP_ITERATIONS);
  }

  const edges = recomputeEdgeSegments(worldNodes, waves);
  const { renderNodes, renderEdges, contentWidth, contentHeight } = worldToRender(
    worldNodes,
    edges
  );

  return {
    worldNodes,
    renderNodes,
    renderEdges,
    dogMap: base.dogMap,
    contentWidth,
    contentHeight,
  };
}

function worldToRender(
  worldNodes: PlacedNode[],
  edges: EdgeSegment[]
): {
  renderNodes: RenderNode[];
  renderEdges: RenderEdge[];
  contentWidth: number;
  contentHeight: number;
} {
  if (worldNodes.length === 0) {
    return {
      renderNodes: [],
      renderEdges: [],
      contentWidth: PADDING * 2,
      contentHeight: PADDING * 2,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of worldNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + GRAPH_NODE_W);
    maxY = Math.max(maxY, n.y + GRAPH_NODE_H);
  }

  const sx = minX - PADDING;
  const sy = minY - PADDING;

  const renderNodes: RenderNode[] = worldNodes.map(n => ({
    ...n,
    rx: n.x - sx,
    ry: n.y - sy,
  }));

  const renderEdges: RenderEdge[] = edges.map(e => {
    const rx1 = e.x1 - sx;
    const ry1 = e.y1 - sy;
    const rx2 = e.x2 - sx;
    const ry2 = e.y2 - sy;
    return {
      ...e,
      rx1,
      ry1,
      rx2,
      ry2,
      pathD: cubicBezierPathD(rx1, ry1, rx2, ry2),
    };
  });

  const contentWidth = maxX - minX + 2 * PADDING;
  const contentHeight = maxY - minY + 2 * PADDING;

  return { renderNodes, renderEdges, contentWidth, contentHeight };
}
