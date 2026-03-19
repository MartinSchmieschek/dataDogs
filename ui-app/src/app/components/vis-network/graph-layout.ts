import { DogEntry, Waves } from '../../models/dog-entry.model';

/** Muss zu `.graph-node-slot` / GraphDogNode passen */
export const GRAPH_NODE_W = 160;
export const GRAPH_NODE_H = 100;

const COL_GAP = 72;
const ROW_GAP = 20;
const PADDING = 48;

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
 */
export function buildGraphViewModel(
  waves: Waves,
  manual: ReadonlyMap<string, { x: number; y: number }>
): GraphViewModel | null {
  const base = buildGraphLayout(waves);
  if (!base.nodes.length) return null;

  const worldNodes: PlacedNode[] = base.nodes.map(n => {
    const o = manual.get(n.id);
    return o ? { ...n, x: o.x, y: o.y } : { ...n };
  });

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

  const renderEdges: RenderEdge[] = edges.map(e => ({
    ...e,
    rx1: e.x1 - sx,
    ry1: e.y1 - sy,
    rx2: e.x2 - sx,
    ry2: e.y2 - sy,
  }));

  const contentWidth = maxX - minX + 2 * PADDING;
  const contentHeight = maxY - minY + 2 * PADDING;

  return { renderNodes, renderEdges, contentWidth, contentHeight };
}
