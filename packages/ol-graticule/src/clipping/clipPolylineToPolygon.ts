import { pointInRing, pointInRings } from './pointInRing.js';
import { PolygonEdgeIndex, createEdgeBuffer, type EdgeBuffer } from './PolygonEdgeIndex.js';

const T_EPSILON = 1e-9;

/** Reusable scratch buffers for {@link clipPolylineToPolygon}. */
export interface ClipScratch {
  insideFlags: boolean[];
  edgeCandidates: number[];
  intersectionTs: number[];
  edgeBuf: EdgeBuffer;
  tuBuf: { t: number; u: number; hit: boolean };
}

export function createClipScratch(): ClipScratch {
  return {
    insideFlags: [],
    edgeCandidates: [],
    intersectionTs: [],
    edgeBuf: createEdgeBuffer(),
    tuBuf: { t: 0, u: 0, hit: false },
  };
}

/** Clip a polyline against one or more rings, returning inside sub-polylines. */
export function clipPolylineToPolygon(
  polyline: ReadonlyArray<readonly [number, number]>,
  rings: ReadonlyArray<readonly [number, number]>
    | ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  index: PolygonEdgeIndex,
  scratch?: ClipScratch,
): [number, number][][] {
  const n = polyline.length;
  if (n < 2) return [];
  const ringList = normaliseRings(rings);

  let plMinX = Infinity, plMinY = Infinity, plMaxX = -Infinity, plMaxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = polyline[i]!;
    if (p[0] < plMinX) plMinX = p[0];
    if (p[0] > plMaxX) plMaxX = p[0];
    if (p[1] < plMinY) plMinY = p[1];
    if (p[1] > plMaxY) plMaxY = p[1];
  }
  const [rMinX, rMinY, rMaxX, rMaxY] = index.ringExtent;
  if (plMaxX < rMinX || plMinX > rMaxX || plMaxY < rMinY || plMinY > rMaxY) {
    return [];
  }

  const scr = scratch ?? createClipScratch();
  const inside = scr.insideFlags;
  inside.length = 0;
  for (let i = 0; i < n; i++) {
    const p = polyline[i]!;
    inside.push(
      ringList.length === 1
        ? pointInRing(p[0], p[1], ringList[0]!)
        : pointInRings(p[0], p[1], ringList),
    );
  }

  const output: [number, number][][] = [];
  let current: [number, number][] | null = null;
  const edgeCandidates = scr.edgeCandidates;
  const ts = scr.intersectionTs;
  const eb = scr.edgeBuf;

  for (let i = 0; i < n - 1; i++) {
    const p0 = polyline[i]!;
    const p1 = polyline[i + 1]!;
    const p0x = p0[0], p0y = p0[1];
    const p1x = p1[0], p1y = p1[1];
    let state = inside[i]!;

    if (state && current === null) {
      current = [[p0x, p0y]];
    }

    const segMinX = p0x < p1x ? p0x : p1x;
    const segMaxX = p0x < p1x ? p1x : p0x;
    const segMinY = p0y < p1y ? p0y : p1y;
    const segMaxY = p0y < p1y ? p1y : p0y;
    index.queryBBox(segMinX, segMinY, segMaxX, segMaxY, edgeCandidates);

    ts.length = 0;
    const tu = scr.tuBuf;
    for (let k = 0; k < edgeCandidates.length; k++) {
      index.readEdge(edgeCandidates[k]!, eb);
      segmentSegmentTU_(p0x, p0y, p1x, p1y, eb.x1, eb.y1, eb.x2, eb.y2, tu);
      if (!tu.hit) continue;
      if (tu.u <= T_EPSILON) continue;
      if (tu.t > T_EPSILON && tu.t < 1 - T_EPSILON) ts.push(tu.t);
    }
    ts.sort((a, b) => a - b);

    for (let k = 0; k < ts.length; k++) {
      const t = ts[k]!;
      const ix = p0x + t * (p1x - p0x);
      const iy = p0y + t * (p1y - p0y);
      if (state) {
        current!.push([ix, iy]);
        if (current!.length >= 2) output.push(current!);
        current = null;
      } else {
        current = [[ix, iy]];
      }
      state = !state;
    }

    if (state) {
      if (current === null) current = [[p0x, p0y]];
      current.push([p1x, p1y]);
    }
  }

  if (current !== null && current.length >= 2) output.push(current);
  return output;
}

type Ring = ReadonlyArray<readonly [number, number]>;

function normaliseRings(
  input: Ring | ReadonlyArray<Ring>,
): ReadonlyArray<Ring> {
  if (input.length === 0) return [] as unknown as ReadonlyArray<Ring>;
  const first = input[0]!;
  if (Array.isArray(first) && first.length === 2 && typeof first[0] === 'number') {
    return [input as Ring];
  }
  return input as ReadonlyArray<Ring>;
}

function segmentSegmentTU_(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
  out: { t: number; u: number; hit: boolean },
): void {
  const rx = ax2 - ax1;
  const ry = ay2 - ay1;
  const sx = bx2 - bx1;
  const sy = by2 - by1;
  const denom = rx * sy - ry * sx;
  if (denom === 0) { out.hit = false; return; }
  const dx = bx1 - ax1;
  const dy = by1 - ay1;
  const t = (dx * sy - dy * sx) / denom;
  const u = (dx * ry - dy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) { out.hit = false; return; }
  out.t = t;
  out.u = u;
  out.hit = true;
}
