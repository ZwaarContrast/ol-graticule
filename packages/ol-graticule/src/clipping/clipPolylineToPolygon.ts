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

  const flat = new Array<number>(n * 2);
  for (let i = 0; i < n; i++) {
    const p = polyline[i]!;
    flat[i * 2] = p[0];
    flat[i * 2 + 1] = p[1];
  }

  const flatPieces = clipPolylineFlat(flat, 0, flat.length, 2, rings, index, scratch);
  const tuplePieces: [number, number][][] = [];
  for (const piece of flatPieces) {
    const ring: [number, number][] = [];
    for (let i = 0; i < piece.length; i += 2) ring.push([piece[i]!, piece[i + 1]!]);
    tuplePieces.push(ring);
  }
  return tuplePieces;
}

/**
 * Clip a flat-coordinate polyline against one or more rings.
 * Returns an array of flat-coordinate sub-polylines (all XY).
 */
export function clipPolylineFlat(
  flatCoordinates: ReadonlyArray<number>,
  offset: number,
  end: number,
  stride: number,
  rings: ReadonlyArray<readonly [number, number]>
    | ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  index: PolygonEdgeIndex,
  scratch?: ClipScratch,
): number[][] {
  const count = (end - offset) / stride;
  if (count < 2) return [];

  let plMinX = Infinity, plMinY = Infinity, plMaxX = -Infinity, plMaxY = -Infinity;
  for (let i = offset; i < end; i += stride) {
    const x = flatCoordinates[i]!, y = flatCoordinates[i + 1]!;
    if (x < plMinX) plMinX = x;
    if (x > plMaxX) plMaxX = x;
    if (y < plMinY) plMinY = y;
    if (y > plMaxY) plMaxY = y;
  }
  const [rMinX, rMinY, rMaxX, rMaxY] = index.ringExtent;
  if (plMaxX < rMinX || plMinX > rMaxX || plMaxY < rMinY || plMinY > rMaxY) {
    return [];
  }

  const scr = scratch ?? createClipScratch();
  const inside = scr.insideFlags;
  inside.length = 0;
  for (let i = offset; i < end; i += stride) {
    const x = flatCoordinates[i]!, y = flatCoordinates[i + 1]!;
    inside.push(index.pointInRing(x, y));
  }

  const output: number[][] = [];
  let current: number[] | null = null;
  const edgeCandidates = scr.edgeCandidates;
  const ts = scr.intersectionTs;
  const eb = scr.edgeBuf;

  for (let i = 0; i < count - 1; i++) {
    const o0 = offset + i * stride;
    const o1 = o0 + stride;
    const p0x = flatCoordinates[o0]!, p0y = flatCoordinates[o0 + 1]!;
    const p1x = flatCoordinates[o1]!, p1y = flatCoordinates[o1 + 1]!;
    let state = inside[i]!;

    if (state && current === null) {
      current = [p0x, p0y];
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
        current!.push(ix, iy);
        if (current!.length >= 4) output.push(current!);
        current = null;
      } else {
        current = [ix, iy];
      }
      state = !state;
    }

    if (state) {
      if (current === null) current = [p0x, p0y];
      current.push(p1x, p1y);
    }
  }

  if (current !== null && current.length >= 4) output.push(current);
  return output;
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
