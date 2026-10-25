import type { Edge, Node } from '@vue-flow/core';
const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const NODE_SEP = 80;
const RANK_SEP = 120;
const MIN_SPACING = NODE_WIDTH + NODE_SEP;
const DUMMY_SPACING = NODE_SEP;
const LAYOUT_ITERATIONS = 4;
const DUMMY_PREFIX = '__dummy__';
function assignLayers(
  nodeIds: string[],
  children: Map<string, string[]>,
  parents: Map<string, string[]>
): Map<string, number> {
  const layers = new Map<string, number>();
  const roots = nodeIds.filter((id) => !parents.get(id)?.length);
  const queue = [...roots];
  for (const r of roots) layers.set(r, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const layer = layers.get(id)!;
    for (const child of children.get(id) ?? []) {
      const prev = layers.get(child) ?? -1;
      if (layer + 1 > prev) {
        layers.set(child, layer + 1);
        queue.push(child);
      }
    }
  }
  for (const id of nodeIds) {
    if (!layers.has(id)) layers.set(id, 0);
  }
  return layers;
}
function insertDummyNodes(
  layers: Map<string, number>,
  children: Map<string, string[]>,
  parents: Map<string, string[]>,
  layerBuckets: Map<number, string[]>,
  dummySet: Set<string>
): void {
  const edgesToSplit: { source: string; target: string; srcLayer: number; tgtLayer: number }[] = [];
  for (const [parentId, childList] of children) {
    const srcLayer = layers.get(parentId)!;
    for (const childId of childList) {
      const tgtLayer = layers.get(childId)!;
      if (tgtLayer - srcLayer > 1) {
        edgesToSplit.push({ source: parentId, target: childId, srcLayer, tgtLayer });
      }
    }
  }
  for (const { source, target, srcLayer, tgtLayer } of edgesToSplit) {
    const srcChildren = children.get(source)!;
    srcChildren.splice(srcChildren.indexOf(target), 1);
    const tgtParents = parents.get(target)!;
    tgtParents.splice(tgtParents.indexOf(source), 1);
    let prevId = source;
    for (let layer = srcLayer + 1; layer < tgtLayer; layer++) {
      const dummyId = `${DUMMY_PREFIX}${source}_${target}_${layer}`;
      dummySet.add(dummyId);
      layers.set(dummyId, layer);
      children.set(dummyId, []);
      parents.set(dummyId, []);
      layerBuckets.get(layer)!.push(dummyId);
      children.get(prevId)!.push(dummyId);
      parents.get(dummyId)!.push(prevId);
      prevId = dummyId;
    }
    children.get(prevId)!.push(target);
    tgtParents.push(prevId);
  }
}
function spacingFor(id: string, dummySet: Set<string>): number {
  return dummySet.has(id) ? DUMMY_SPACING : MIN_SPACING;
}
function minGap(a: string, b: string, dummySet: Set<string>): number {
  const aIsDummy = dummySet.has(a);
  const bIsDummy = dummySet.has(b);
  if (aIsDummy && bIsDummy) return DUMMY_SPACING;
  if (aIsDummy || bIsDummy) return (NODE_WIDTH + DUMMY_SPACING) / 2;
  return MIN_SPACING;
}
function barycenterSort(
  layerIds: string[],
  xPositions: Map<string, number>,
  adjacentIds: (id: string) => string[]
): string[] {
  const scored = layerIds.map((id) => {
    const adj = adjacentIds(id).filter((a) => xPositions.has(a));
    if (!adj.length) return { id, score: Infinity };
    const avg = adj.reduce((sum, a) => sum + xPositions.get(a)!, 0) / adj.length;
    return { id, score: avg };
  });
  const withParent = scored.filter((s) => s.score !== Infinity);
  const orphans = scored.filter((s) => s.score === Infinity);
  withParent.sort((a, b) => a.score - b.score);
  return [...withParent.map((s) => s.id), ...orphans.map((s) => s.id)];
}
function findNearestSlot(
  target: number,
  occupied: { x: number; id: string }[],
  nodeId: string,
  dummySet: Set<string>
): number {
  if (!occupied.length) return target;
  let bestPos = target;
  let bestDist = Infinity;
  const tryPos = (candidate: number) => {
    const valid = occupied.every(
      (o) => Math.abs(candidate - o.x) >= minGap(nodeId, o.id, dummySet)
    );
    if (valid) {
      const dist = Math.abs(candidate - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = candidate;
      }
    }
  };
  tryPos(target);
  if (bestDist === 0) return bestPos;
  for (const o of occupied) {
    const gap = minGap(nodeId, o.id, dummySet);
    tryPos(o.x + gap);
    tryPos(o.x - gap);
  }
  if (bestDist === Infinity) {
    const max = Math.max(...occupied.map((o) => o.x));
    bestPos = max + spacingFor(nodeId, dummySet);
  }
  return bestPos;
}
function placeLayerNodes(
  sortedIds: string[],
  xPositions: Map<string, number>,
  adjacentIds: (id: string) => string[],
  dummySet: Set<string>
): Map<string, number> {
  const result = new Map<string, number>();
  const occupied: { x: number; id: string }[] = [];
  for (const id of sortedIds) {
    const adj = adjacentIds(id).filter((a) => xPositions.has(a));
    let targetX: number;
    if (adj.length) {
      targetX = adj.reduce((sum, a) => sum + xPositions.get(a)!, 0) / adj.length;
    } else {
      const lastOcc = occupied.length ? occupied[occupied.length - 1]! : null;
      targetX = lastOcc ? lastOcc.x + minGap(id, lastOcc.id, dummySet) : 0;
    }
    const finalX = findNearestSlot(targetX, occupied, id, dummySet);
    result.set(id, finalX);
    occupied.push({ x: finalX, id });
    occupied.sort((a, b) => a.x - b.x);
  }
  return result;
}
function findConnectedComponents(
  xPositions: Map<string, number>,
  children: Map<string, string[]>,
  parents: Map<string, string[]>
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const id of xPositions.keys()) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current) || !xPositions.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const child of children.get(current) ?? []) {
        if (!visited.has(child) && xPositions.has(child)) queue.push(child);
      }
      for (const parent of parents.get(current) ?? []) {
        if (!visited.has(parent) && xPositions.has(parent)) queue.push(parent);
      }
    }
    if (component.length) components.push(component);
  }
  return components;
}
function compactComponents(
  xPositions: Map<string, number>,
  children: Map<string, string[]>,
  parents: Map<string, string[]>
): void {
  const components = findConnectedComponents(xPositions, children, parents);
  if (components.length <= 1) return;
  const bounds = components.map((comp) => {
    const xs = comp.map((id) => xPositions.get(id)!);
    return { ids: comp, minX: Math.min(...xs), maxX: Math.max(...xs) };
  });
  bounds.sort((a, b) => a.minX - b.minX);
  let nextX = bounds[0]!.minX;
  for (const bound of bounds) {
    const shift = nextX - bound.minX;
    if (shift !== 0) {
      for (const id of bound.ids) {
        xPositions.set(id, xPositions.get(id)! + shift);
      }
    }
    nextX = nextX + (bound.maxX - bound.minX) + MIN_SPACING;
  }
}
function compactLayer(
  layerIds: string[],
  xPositions: Map<string, number>,
  children: Map<string, string[]>,
  parents: Map<string, string[]>,
  dummySet: Set<string>
): void {
  if (layerIds.length <= 1) return;
  const sorted = [...layerIds].sort((a, b) => (xPositions.get(a) ?? 0) - (xPositions.get(b) ?? 0));
  for (let i = 0; i < sorted.length; i++) {
    const id = sorted[i]!;
    const ch = (children.get(id) ?? []).filter((c) => xPositions.has(c));
    const pa = (parents.get(id) ?? []).filter((p) => xPositions.has(p));
    const neighbors = ch.length ? ch : pa;
    if (!neighbors.length) continue;
    const idealX = neighbors.reduce((sum, n) => sum + xPositions.get(n)!, 0) / neighbors.length;
    const leftBound =
      i > 0 ? xPositions.get(sorted[i - 1]!)! + minGap(sorted[i - 1]!, id, dummySet) : -Infinity;
    const rightBound =
      i < sorted.length - 1
        ? xPositions.get(sorted[i + 1]!)! - minGap(id, sorted[i + 1]!, dummySet)
        : Infinity;
    const clampedX = Math.max(leftBound, Math.min(rightBound, idealX));
    xPositions.set(id, clampedX);
  }
}
export function layoutTaskGraph(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Node[] {
  if (!nodes.length) return [];
  const nodeIds = nodes.map((n) => n.id);
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const nodeSet = new Set(nodeIds);
  for (const id of nodeIds) {
    children.set(id, []);
    parents.set(id, []);
  }
  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue;
    children.get(edge.source)!.push(edge.target);
    parents.get(edge.target)!.push(edge.source);
  }
  const layers = assignLayers(nodeIds, children, parents);
  const maxLayer = Math.max(...layers.values(), 0);
  const layerBuckets = new Map<number, string[]>();
  for (let i = 0; i <= maxLayer; i++) layerBuckets.set(i, []);
  for (const [id, layer] of layers) {
    layerBuckets.get(layer)!.push(id);
  }
  const dummySet = new Set<string>();
  insertDummyNodes(layers, children, parents, layerBuckets, dummySet);
  const updatedMaxLayer = Math.max(...layers.values(), 0);
  for (let i = maxLayer + 1; i <= updatedMaxLayer; i++) {
    if (!layerBuckets.has(i)) layerBuckets.set(i, []);
  }
  const xPositions = new Map<string, number>();
  const rootIds = layerBuckets.get(0) ?? [];
  for (let i = 0; i < rootIds.length; i++) {
    xPositions.set(rootIds[i]!, i * MIN_SPACING);
  }
  for (let layer = 1; layer <= updatedMaxLayer; layer++) {
    const ids = layerBuckets.get(layer) ?? [];
    const sorted = barycenterSort(ids, xPositions, (id) => parents.get(id) ?? []);
    const placed = placeLayerNodes(sorted, xPositions, (id) => parents.get(id) ?? [], dummySet);
    for (const [id, x] of placed) xPositions.set(id, x);
  }
  for (let iter = 0; iter < LAYOUT_ITERATIONS; iter++) {
    for (let layer = updatedMaxLayer - 1; layer >= 0; layer--) {
      const ids = layerBuckets.get(layer) ?? [];
      const sorted = barycenterSort(ids, xPositions, (id) => children.get(id) ?? []);
      const placed = placeLayerNodes(
        sorted,
        xPositions,
        (id) => {
          const ch = (children.get(id) ?? []).filter((c) => xPositions.has(c));
          const pa = (parents.get(id) ?? []).filter((p) => xPositions.has(p));
          return ch.length ? ch : pa;
        },
        dummySet
      );
      for (const [id, x] of placed) xPositions.set(id, x);
    }
    for (let layer = 1; layer <= updatedMaxLayer; layer++) {
      const ids = layerBuckets.get(layer) ?? [];
      const sorted = barycenterSort(ids, xPositions, (id) => parents.get(id) ?? []);
      const placed = placeLayerNodes(sorted, xPositions, (id) => parents.get(id) ?? [], dummySet);
      for (const [id, x] of placed) xPositions.set(id, x);
    }
  }
  for (let layer = 0; layer <= updatedMaxLayer; layer++) {
    compactLayer(layerBuckets.get(layer) ?? [], xPositions, children, parents, dummySet);
  }
  for (let layer = updatedMaxLayer; layer >= 0; layer--) {
    compactLayer(layerBuckets.get(layer) ?? [], xPositions, children, parents, dummySet);
  }
  compactComponents(xPositions, children, parents);
  const allX = [...xPositions.values()];
  const minX = Math.min(...allX);
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, x] of xPositions) {
    if (dummySet.has(id)) continue;
    const layer = layers.get(id)!;
    const primary = layer * (NODE_HEIGHT + RANK_SEP);
    const cross = x - minX;
    positions.set(id, direction === 'TB' ? { x: cross, y: primary } : { x: primary, y: cross });
  }
  return nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return { ...node, position: pos };
  });
}
