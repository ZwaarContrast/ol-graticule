import { createEmpty, extendXY } from 'ol/extent';
import { pointInRing } from './pointInRing.js';

/** Snap a ring to an axis-aligned cell grid; returns staircase rings per region. */
export function snapRingToCellGrid(
  ring: ReadonlyArray<readonly [number, number]>,
  interval: number,
): [number, number][][] {
  if (interval <= 0 || !isFinite(interval)) return [];
  const n = ring.length;
  if (n < 3) return [];
  const NONE: [number, number][][] = [];

  const bbox = createEmpty();
  for (let i = 0; i < n; i++) extendXY(bbox, ring[i][0], ring[i][1]);
  const [minX, minY, maxX, maxY] = bbox;

  const startX = Math.floor(minX / interval) * interval;
  const startY = Math.floor(minY / interval) * interval;
  const endX = Math.ceil(maxX / interval) * interval;
  const endY = Math.ceil(maxY / interval) * interval;
  const nX = Math.round((endX - startX) / interval);
  const nY = Math.round((endY - startY) / interval);
  if (nX <= 0 || nY <= 0) return NONE;

  const valid = new Uint8Array(nX * nY);
  let anyValid = false;
  for (let cx = 0; cx < nX; cx++) {
    for (let cy = 0; cy < nY; cy++) {
      const midX = startX + (cx + 0.5) * interval;
      const midY = startY + (cy + 0.5) * interval;
      if (pointInRing(midX, midY, ring)) {
        valid[cx * nY + cy] = 1;
        anyValid = true;
      }
    }
  }
  if (!anyValid) return NONE;

  const edges: number[] = [];
  const pushEdge = (x0: number, y0: number, x1: number, y1: number): void => {
    edges.push(x0, y0, x1, y1);
  };
  const cellValid = (cx: number, cy: number): boolean => {
    if (cx < 0 || cx >= nX || cy < 0 || cy >= nY) return false;
    return valid[cx * nY + cy] === 1;
  };

  for (let cy = 0; cy <= nY; cy++) {
    const y = startY + cy * interval;
    for (let cx = 0; cx < nX; cx++) {
      const below = cellValid(cx, cy - 1);
      const above = cellValid(cx, cy);
      if (below === above) continue;
      const x0 = startX + cx * interval;
      const x1 = startX + (cx + 1) * interval;
      if (below && !above) {
        pushEdge(x1, y, x0, y);
      } else {
        pushEdge(x0, y, x1, y);
      }
    }
  }
  for (let cx = 0; cx <= nX; cx++) {
    const x = startX + cx * interval;
    for (let cy = 0; cy < nY; cy++) {
      const west = cellValid(cx - 1, cy);
      const east = cellValid(cx, cy);
      if (west === east) continue;
      const y0 = startY + cy * interval;
      const y1 = startY + (cy + 1) * interval;
      if (west && !east) {
        pushEdge(x, y0, x, y1);
      } else {
        pushEdge(x, y1, x, y0);
      }
    }
  }

  if (edges.length === 0) return NONE;

  const edgeCount = edges.length / 4;
  const tailBuckets = new Map<string, number[]>();
  const keyOf = (x: number, y: number): string => `${x},${y}`;
  for (let i = 0; i < edgeCount; i++) {
    const k = keyOf(edges[i * 4]!, edges[i * 4 + 1]!);
    let bucket = tailBuckets.get(k);
    if (!bucket) {
      bucket = [];
      tailBuckets.set(k, bucket);
    }
    bucket.push(i);
  }

  const used = new Uint8Array(edgeCount);
  const rings: [number, number][][] = [];
  for (let start = 0; start < edgeCount; start++) {
    if (used[start]) continue;
    const ringPts: [number, number][] = [];
    let idx = start;
    for (let guard = 0; guard < edgeCount + 1 && idx >= 0 && !used[idx]; guard++) {
      used[idx] = 1;
      const base = idx * 4;
      ringPts.push([edges[base]!, edges[base + 1]!]);
      const hx = edges[base + 2]!;
      const hy = edges[base + 3]!;
      const pdx = Math.sign(hx - edges[base]!);
      const pdy = Math.sign(hy - edges[base + 1]!);
      const candidates = tailBuckets.get(keyOf(hx, hy));
      idx = pickNextEdge_(edges, candidates, used, pdx, pdy);
    }
    if (ringPts.length >= 3) rings.push(ringPts);
  }

  return rings;
}

function pickNextEdge_(
  edges: number[],
  candidates: number[] | undefined,
  used: Uint8Array,
  pdx: number,
  pdy: number,
): number {
  if (!candidates) return -1;
  const prefs: readonly (readonly [number, number])[] = [
    [-pdy, pdx],
    [pdx, pdy],
    [pdy, -pdx],
  ];
  for (let p = 0; p < prefs.length; p++) {
    const prefDx = prefs[p]![0];
    const prefDy = prefs[p]![1];
    for (let c = 0; c < candidates.length; c++) {
      const j = candidates[c]!;
      if (used[j]) continue;
      const jBase = j * 4;
      const jdx = Math.sign(edges[jBase + 2]! - edges[jBase]!);
      const jdy = Math.sign(edges[jBase + 3]! - edges[jBase + 1]!);
      if (jdx === prefDx && jdy === prefDy) return j;
    }
  }
  for (let c = 0; c < candidates.length; c++) {
    const j = candidates[c]!;
    if (!used[j]) return j;
  }
  return -1;
}
