/** Edge classification and interval merging for Kriegsmarine cells. */

import type { LatLon, RectSquare, PolySquare } from './types.js';
import { rectCrossesAntimeridian } from './geo.js';

const COORD_PRECISION = 6;

function roundCoord(v: number): number {
  const f = 10 ** COORD_PRECISION;
  return Math.round(v * f) / f;
}

interface VerticalEdge {
  axis: 'v';
  lon: number;
  latLo: number;
  latHi: number;
  depth: number;
  squareId: string;
}

interface HorizontalEdge {
  axis: 'h';
  lat: number;
  lonLo: number;
  lonHi: number;
  depth: number;
  squareId: string;
}

interface DiagonalEdge {
  axis: 'd';
  p1: LatLon;
  p2: LatLon;
  depth: number;
  squareId: string;
}

export type ClassifiedEdge = VerticalEdge | HorizontalEdge | DiagonalEdge;

interface MergedVertical {
  axis: 'v';
  lon: number;
  latLo: number;
  latHi: number;
  depth: number;
  squareIds: string[];
}

interface MergedHorizontal {
  axis: 'h';
  lat: number;
  lonLo: number;
  lonHi: number;
  depth: number;
  squareIds: string[];
}

interface MergedDiagonal {
  axis: 'd';
  p1: LatLon;
  p2: LatLon;
  depth: number;
  squareIds: string[];
}

type MergedEdge = MergedVertical | MergedHorizontal | MergedDiagonal;

/** Classify each of a rect square's 4 edges; antimeridian-crossing rects emit as diagonals. */
export function rectEdges(sq: RectSquare, depth: number): ClassifiedEdge[] {
  if (rectCrossesAntimeridian(sq.nw, sq.se)) {
    return antimeridianRectEdges(sq, depth);
  }
  const nwLat = roundCoord(sq.nw[0]);
  const nwLon = roundCoord(sq.nw[1]);
  const seLat = roundCoord(sq.se[0]);
  const seLon = roundCoord(sq.se[1]);
  const latLo = Math.min(nwLat, seLat);
  const latHi = Math.max(nwLat, seLat);
  const lonLo = Math.min(nwLon, seLon);
  const lonHi = Math.max(nwLon, seLon);
  return [
    { axis: 'h', lat: latHi, lonLo, lonHi, depth, squareId: sq.id },
    { axis: 'h', lat: latLo, lonLo, lonHi, depth, squareId: sq.id },
    { axis: 'v', lon: lonLo, latLo, latHi, depth, squareId: sq.id },
    { axis: 'v', lon: lonHi, latLo, latHi, depth, squareId: sq.id },
  ];
}

function antimeridianRectEdges(sq: RectSquare, depth: number): ClassifiedEdge[] {
  const { nw, se } = sq;
  const eastLon = se[1] < nw[1] ? se[1] + 360 : se[1];
  const corners: LatLon[] = [
    [nw[0], nw[1]],
    [nw[0], eastLon],
    [se[0], eastLon],
    [se[0], nw[1]],
  ];
  const out: ClassifiedEdge[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    out.push({ axis: 'd', p1: a, p2: b, depth, squareId: sq.id });
  }
  return out;
}

/** Classify each edge of a poly square; axis-aligned edges bucket with rect edges, others stay diagonal. */
export function polyEdges(sq: PolySquare, depth: number): ClassifiedEdge[] {
  const out: ClassifiedEdge[] = [];
  const n = sq.poly.length;
  for (let i = 0; i < n; i++) {
    const a = sq.poly[i]!;
    const b = sq.poly[(i + 1) % n]!;
    const aLat = roundCoord(a[0]);
    const bLat = roundCoord(b[0]);
    const aLon = roundCoord(a[1]);
    const bLon = roundCoord(b[1]);
    if (aLat === bLat && aLon !== bLon) {
      out.push({
        axis: 'h',
        lat: aLat,
        lonLo: Math.min(aLon, bLon),
        lonHi: Math.max(aLon, bLon),
        depth,
        squareId: sq.id,
      });
    } else if (aLon === bLon && aLat !== bLat) {
      out.push({
        axis: 'v',
        lon: aLon,
        latLo: Math.min(aLat, bLat),
        latHi: Math.max(aLat, bLat),
        depth,
        squareId: sq.id,
      });
    } else {
      out.push({ axis: 'd', p1: a, p2: b, depth, squareId: sq.id });
    }
  }
  return out;
}

/** Merge classified edges into deduplicated segments; merged segments carry every contributing `squareIds`. */
export function mergeEdges(edges: ClassifiedEdge[]): MergedEdge[] {
  const vertical = new Map<number, VerticalEdge[]>();
  const horizontal = new Map<number, HorizontalEdge[]>();
  const diagonals = new Map<string, DiagonalEdge>();

  for (const e of edges) {
    if (e.axis === 'v') {
      const list = vertical.get(e.lon);
      if (list) list.push(e);
      else vertical.set(e.lon, [e]);
    } else if (e.axis === 'h') {
      const list = horizontal.get(e.lat);
      if (list) list.push(e);
      else horizontal.set(e.lat, [e]);
    } else {
      const key = diagonalKey(e.p1, e.p2);
      if (!diagonals.has(key)) diagonals.set(key, e);
    }
  }

  const out: MergedEdge[] = [];

  for (const [lon, bucket] of vertical) {
    for (const merged of mergeIntervals(bucket, 'latLo', 'latHi')) {
      out.push({
        axis: 'v',
        lon,
        latLo: merged.lo,
        latHi: merged.hi,
        depth: merged.depth,
        squareIds: merged.squareIds,
      });
    }
  }

  for (const [lat, bucket] of horizontal) {
    for (const merged of mergeIntervals(bucket, 'lonLo', 'lonHi')) {
      out.push({
        axis: 'h',
        lat,
        lonLo: merged.lo,
        lonHi: merged.hi,
        depth: merged.depth,
        squareIds: merged.squareIds,
      });
    }
  }

  for (const e of diagonals.values()) {
    out.push({
      axis: 'd',
      p1: e.p1,
      p2: e.p2,
      depth: e.depth,
      squareIds: [e.squareId],
    });
  }

  return out;
}

interface Interval {
  lo: number;
  hi: number;
  depth: number;
  squareIds: string[];
}

/** Sort + sweep interval merge; overlapping/touching edges union to one interval with max depth. */
function mergeIntervals<
  E extends { depth: number; squareId: string },
  LoKey extends keyof E,
  HiKey extends keyof E,
>(edges: E[], loKey: LoKey, hiKey: HiKey): Interval[] {
  if (edges.length === 0) return [];
  const sorted = edges.slice().sort((a, b) => {
    const aLo = a[loKey] as unknown as number;
    const bLo = b[loKey] as unknown as number;
    return aLo - bLo;
  });

  const result: Interval[] = [];
  const first = sorted[0]!;
  let cur: Interval = {
    lo: first[loKey] as unknown as number,
    hi: first[hiKey] as unknown as number,
    depth: first.depth,
    squareIds: [first.squareId],
  };

  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i]!;
    const eLo = e[loKey] as unknown as number;
    const eHi = e[hiKey] as unknown as number;
    if (eLo <= cur.hi) {
      if (eHi > cur.hi) cur.hi = eHi;
      if (e.depth > cur.depth) cur.depth = e.depth;
      cur.squareIds.push(e.squareId);
    } else {
      result.push(cur);
      cur = { lo: eLo, hi: eHi, depth: e.depth, squareIds: [e.squareId] };
    }
  }
  result.push(cur);
  return result;
}

function diagonalKey(p1: LatLon, p2: LatLon): string {
  const first = p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1]) ? p1 : p2;
  const second = first === p1 ? p2 : p1;
  return (
    `${roundCoord(first[0])},${roundCoord(first[1])}|` +
    `${roundCoord(second[0])},${roundCoord(second[1])}`
  );
}
