/**
 * Edge classification and interval merging for Kriegsmarine cells.
 *
 * The cell adjacency and edge-deduplication logic follows Jan Kockrow's
 * cljs-navalgrid (https://github.com/Nylle/cljs-navalgrid) and his research
 * at navalgrid.com. See the package README for the full credit.
 */

import type { LatLon, RectSquare, PolySquare } from './types.js';
import { rectCrossesAntimeridian } from './geo.js';

const COORD_PRECISION = 6;

function roundCoord(v: number): number {
  const f = 10 ** COORD_PRECISION;
  return Math.round(v * f) / f;
}

/** Internal raw representation of an edge to minimize allocations. */
export interface RawEdge {
  axis: 'v' | 'h' | 'd';
  val: number; // lon for 'v', lat for 'h'
  lo: number;
  hi: number;
  depth: number;
  squareId: string;
  p1?: LatLon; // Only for diagonals
  p2?: LatLon;
}

interface MergedEdge {
  axis: 'v' | 'h' | 'd';
  lon?: number;
  lat?: number;
  latLo?: number;
  latHi?: number;
  lonLo?: number;
  lonHi?: number;
  p1?: LatLon;
  p2?: LatLon;
  depth: number;
  squareIds: string[];
}

/** Classify each of a rect square's 4 edges; antimeridian-crossing rects emit as diagonals. */
export function rectEdges(sq: RectSquare, depth: number, out: RawEdge[] = []): RawEdge[] {
  if (rectCrossesAntimeridian(sq.nw, sq.se)) {
    return antimeridianRectEdges(sq, depth, out);
  }
  const nwLat = roundCoord(sq.nw[0]);
  const nwLon = roundCoord(sq.nw[1]);
  const seLat = roundCoord(sq.se[0]);
  const seLon = roundCoord(sq.se[1]);
  const latLo = Math.min(nwLat, seLat);
  const latHi = Math.max(nwLat, seLat);
  const lonLo = Math.min(nwLon, seLon);
  const lonHi = Math.max(nwLon, seLon);

  out.push(
    { axis: 'h', val: latHi, lo: lonLo, hi: lonHi, depth, squareId: sq.id },
    { axis: 'h', val: latLo, lo: lonLo, hi: lonHi, depth, squareId: sq.id },
    { axis: 'v', val: lonLo, lo: latLo, hi: latHi, depth, squareId: sq.id },
    { axis: 'v', val: lonHi, lo: latLo, hi: latHi, depth, squareId: sq.id },
  );
  return out;
}

function antimeridianRectEdges(sq: RectSquare, depth: number, out: RawEdge[]): RawEdge[] {
  const { nw, se } = sq;
  const eastLon = se[1] < nw[1] ? se[1] + 360 : se[1];
  const corners: LatLon[] = [
    [nw[0], nw[1]],
    [nw[0], eastLon],
    [se[0], eastLon],
    [se[0], nw[1]],
  ];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    out.push({ axis: 'd', val: 0, lo: 0, hi: 0, p1: a, p2: b, depth, squareId: sq.id });
  }
  return out;
}

/** Classify each edge of a poly square; axis-aligned edges bucket with rect edges, others stay diagonal. */
export function polyEdges(sq: PolySquare, depth: number, out: RawEdge[] = []): RawEdge[] {
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
        val: aLat,
        lo: Math.min(aLon, bLon),
        hi: Math.max(aLon, bLon),
        depth,
        squareId: sq.id,
      });
    } else if (aLon === bLon && aLat !== bLat) {
      out.push({
        axis: 'v',
        val: aLon,
        lo: Math.min(aLat, bLat),
        hi: Math.max(aLat, bLat),
        depth,
        squareId: sq.id,
      });
    } else {
      out.push({ axis: 'd', val: 0, lo: 0, hi: 0, p1: a, p2: b, depth, squareId: sq.id });
    }
  }
  return out;
}

/** Merge classified edges into deduplicated segments; merged segments carry every contributing `squareIds`. */
export function mergeEdges(edges: RawEdge[]): MergedEdge[] {
  const vertical = new Map<number, RawEdge[]>();
  const horizontal = new Map<number, RawEdge[]>();
  const diagonals = new Map<string, RawEdge>();

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (e.axis === 'v') {
      const list = vertical.get(e.val);
      if (list) list.push(e);
      else vertical.set(e.val, [e]);
    } else if (e.axis === 'h') {
      const list = horizontal.get(e.val);
      if (list) list.push(e);
      else horizontal.set(e.val, [e]);
    } else {
      const key = diagonalKey(e.p1!, e.p2!);
      if (!diagonals.has(key)) diagonals.set(key, e);
    }
  }

  const out: MergedEdge[] = [];

  for (const [lon, bucket] of vertical) {
    for (const merged of mergeIntervals(bucket)) {
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
    for (const merged of mergeIntervals(bucket)) {
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
      p1: e.p1!,
      p2: e.p2!,
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
function mergeIntervals(edges: RawEdge[]): Interval[] {
  if (edges.length === 0) return [];
  if (edges.length > 1) {
    edges.sort((a, b) => a.lo - b.lo);
  }

  const result: Interval[] = [];
  const first = edges[0]!;
  let cur: Interval = {
    lo: first.lo,
    hi: first.hi,
    depth: first.depth,
    squareIds: [first.squareId],
  };

  for (let i = 1; i < edges.length; i++) {
    const e = edges[i]!;
    if (e.lo <= cur.hi + 1e-9) {
      if (e.hi > cur.hi) cur.hi = e.hi;
      if (e.depth > cur.depth) cur.depth = e.depth;
      cur.squareIds.push(e.squareId);
    } else {
      result.push(cur);
      cur = { lo: e.lo, hi: e.hi, depth: e.depth, squareIds: [e.squareId] };
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
