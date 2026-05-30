/**
 * Polyline-vs-polygon clipping for arbitrary (possibly concave) clip rings.
 *
 * Per input segment: query a {@link PolygonEdgeIndex} for nearby ring edges,
 * compute every segment-vs-edge intersection, sort the t-values, then walk
 * them flipping inside/outside state. The first segment endpoint's containment
 * seeds the state via {@link PolygonEdgeIndex.pointInRing}.
 *
 * For the axis-aligned rectangle clip case, prefer {@link clipPolylineToRect}
 * (Liang-Barsky): no index, no per-edge intersections, just four scalar
 * inequalities per segment.
 */
import { createOrUpdateFromFlatCoordinates, intersects } from 'ol/extent';
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

/**
 * Clip a flat-coordinate polyline against the rings indexed by `index`.
 * Returns an array of flat-coordinate sub-polylines (all XY).
 */
export function clipPolylineToPolygon(
  flatCoordinates: number[],
  offset: number,
  end: number,
  stride: number,
  index: PolygonEdgeIndex,
  scratch?: ClipScratch,
): number[][] {
  const count = (end - offset) / stride;
  if (count < 2) return [];

  const bbox = createOrUpdateFromFlatCoordinates(flatCoordinates, offset, end, stride);
  if (!intersects(bbox, index.ringExtent)) return [];

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
