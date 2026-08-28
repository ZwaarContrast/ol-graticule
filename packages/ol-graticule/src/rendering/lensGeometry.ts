import LineString from 'ol/geom/LineString';
import { apply as applyTransform } from 'ol/transform';
import type { Transform } from 'ol/transform';
import type Feature from 'ol/Feature';
import { distToSegmentSq } from '../util/edgeCrossing.js';

/** A grid crossing the lens carves clear, in pixel space, with a fade strength. */
export interface LensHole {
  x: number;
  y: number;
  strength: number;
}

/**
 * Walk a grid line's segments, transforming each vertex to pixel space through
 * `toPixel` (× `pixelRatio`, so callers get device px or CSS px), and call `cb`
 * with each segment's endpoints. `worldOffset` shifts x into the cursor's wrapped
 * world so the lens can reach base-world source lines under wrap.
 */
export function eachSegmentPx(
  geom: LineString, toPixel: Transform, pixelRatio: number, worldOffset: number,
  scratch: [number, number], cb: (x0: number, y0: number, x1: number, y1: number) => void,
): void {
  const flat = geom.getFlatCoordinates();
  const stride = geom.getStride();
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i + 1 < flat.length; i += stride) {
    scratch[0] = (flat[i] ?? 0) + worldOffset;
    scratch[1] = flat[i + 1] ?? 0;
    applyTransform(toPixel, scratch);
    const x = scratch[0] * pixelRatio;
    const y = scratch[1] * pixelRatio;
    if (i > 0) cb(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

/** Whether any part of a grid line's pixel-space bbox lies within `radius` of the cursor. */
export function lineNearCursor(
  geom: LineString, toPixel: Transform, pixelRatio: number, worldOffset: number,
  cx: number, cy: number, radius: number, scratch: [number, number],
): boolean {
  const [minX, minY, maxX, maxY] = geom.getExtent();
  let loX = Infinity;
  let loY = Infinity;
  let hiX = -Infinity;
  let hiY = -Infinity;
  for (let i = 0; i < 4; i++) {
    scratch[0] = (i === 1 || i === 2 ? maxX : minX) + worldOffset;
    scratch[1] = i >= 2 ? maxY : minY;
    applyTransform(toPixel, scratch);
    const x = scratch[0] * pixelRatio;
    const y = scratch[1] * pixelRatio;
    if (x < loX) loX = x;
    if (y < loY) loY = y;
    if (x > hiX) hiX = x;
    if (y > hiY) hiY = y;
  }
  return cx >= loX - radius && cx <= hiX + radius && cy >= loY - radius && cy <= hiY + radius;
}

/**
 * The grid crossings within reach of the cursor (pixel space), each with a
 * smoothstep fade strength, plus the measured local cell size. The reach scales
 * with the finest local cell spacing (so only the crossing you are near lights
 * up), falling back to `fallbackApproach` when spacing can't be measured. Holes
 * sit on true meridian×parallel intersections, so they track under rotation.
 */
export function collectLensHoles(
  features: Feature[], toPixel: Transform, pixelRatio: number, worldOffset: number,
  cx: number, cy: number, searchRadius: number,
  approachFraction: number, fallbackApproach: number, maxHoles: number,
): { holes: LensHole[]; cell: number } {
  const vxs: number[] = [];
  const hys: number[] = [];
  const vertSegs: number[] = [];
  const horizSegs: number[] = [];
  const scratch: [number, number] = [0, 0];
  const radiusSq = searchRadius * searchRadius;

  for (const feature of features) {
    const geom = feature.getGeometry();
    if (!(geom instanceof LineString)) continue;
    const axis = feature.get('gridAxis');
    if (axis !== 'x' && axis !== 'y') continue;
    if (!lineNearCursor(geom, toPixel, pixelRatio, worldOffset, cx, cy, searchRadius, scratch)) continue;

    let best = NaN;
    let bestD = Infinity;
    let segX0 = 0, segY0 = 0, segX1 = 0, segY1 = 0, segD = Infinity;
    eachSegmentPx(geom, toPixel, pixelRatio, worldOffset, scratch, (x0, y0, x1, y1) => {
      const sd = distToSegmentSq(cx, cy, x0, y0, x1, y1);
      if (sd < segD) { segD = sd; segX0 = x0; segY0 = y0; segX1 = x1; segY1 = y1; }
      if (axis === 'x' && straddles(y0, y1, cy)) {
        const crossX = x0 + (x1 - x0) * ((cy - y0) / (y1 - y0));
        if (Math.abs(crossX - cx) < bestD) { bestD = Math.abs(crossX - cx); best = crossX; }
      } else if (axis === 'y' && straddles(x0, x1, cx)) {
        const crossY = y0 + (y1 - y0) * ((cx - x0) / (x1 - x0));
        if (Math.abs(crossY - cy) < bestD) { bestD = Math.abs(crossY - cy); best = crossY; }
      }
    });
    if (segD >= radiusSq) continue;
    if (axis === 'x') {
      vertSegs.push(segX0, segY0, segX1, segY1);
      if (!Number.isNaN(best) && bestD < searchRadius) vxs.push(best);
    } else {
      horizSegs.push(segX0, segY0, segX1, segY1);
      if (!Number.isNaN(best) && bestD < searchRadius) hys.push(best);
    }
  }

  const cellW = minSpacing(vxs);
  const cellH = minSpacing(hys);
  let cell = NaN;
  if (!Number.isNaN(cellW) && !Number.isNaN(cellH)) cell = Math.min(cellW, cellH);
  else if (!Number.isNaN(cellW)) cell = cellW;
  else if (!Number.isNaN(cellH)) cell = cellH;

  const approach = Number.isNaN(cell)
    ? fallbackApproach
    : Math.max(cell * approachFraction, LENS_MIN_APPROACH * pixelRatio);

  const holes: LensHole[] = [];
  if (approach > 0) {
    const out: [number, number] = [0, 0];
    for (let vi = 0; vi + 3 < vertSegs.length; vi += 4) {
      for (let hi = 0; hi + 3 < horizSegs.length; hi += 4) {
        const cross = lineIntersection(
          vertSegs[vi] ?? 0, vertSegs[vi + 1] ?? 0, vertSegs[vi + 2] ?? 0, vertSegs[vi + 3] ?? 0,
          horizSegs[hi] ?? 0, horizSegs[hi + 1] ?? 0, horizSegs[hi + 2] ?? 0, horizSegs[hi + 3] ?? 0, out,
        );
        if (!cross) continue;
        const dist = Math.hypot(cx - cross[0], cy - cross[1]);
        if (dist >= approach) continue;
        const s = 1 - dist / approach;
        holes.push({ x: cross[0], y: cross[1], strength: s * s * (3 - 2 * s) });
        if (holes.length >= maxHoles) return { holes, cell: Number.isNaN(cell) ? 0 : cell };
      }
    }
  }
  return { holes, cell: Number.isNaN(cell) ? 0 : cell };
}

// CSS px floor on the hole reach, so fine grids still trigger early enough.
const LENS_MIN_APPROACH = 34;

/** Does the value `c` lie within the closed interval spanned by `a` and `b`? */
export function straddles(a: number, b: number, c: number): boolean {
  return a !== b && ((a <= c && c <= b) || (b <= c && c <= a));
}

/** Smallest gap between values (ignoring near-duplicates); NaN if fewer than 2. */
export function minSpacing(values: number[]): number {
  if (values.length < 2) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const d = (sorted[i] ?? 0) - (sorted[i - 1] ?? 0);
    if (d > 0.5 && d < min) min = d;
  }
  return min === Infinity ? NaN : min;
}

/**
 * Intersection point of the infinite lines through segments A `(a0,a1)-(a2,a3)`
 * and B `(b0,b1)-(b2,b3)`, written into `out`; null when they are (near)
 * parallel. Segment-axis-aligned inputs (rotation 0) reduce to `(a.x, b.y)`.
 */
export function lineIntersection(
  a0: number, a1: number, a2: number, a3: number,
  b0: number, b1: number, b2: number, b3: number,
  out: [number, number],
): [number, number] | null {
  const dax = a2 - a0;
  const day = a3 - a1;
  const dbx = b2 - b0;
  const dby = b3 - b1;
  const denom = dax * dby - day * dbx;
  if (denom > -1e-9 && denom < 1e-9) return null;
  const t = ((b0 - a0) * dby - (b1 - a1) * dbx) / denom;
  out[0] = a0 + dax * t;
  out[1] = a1 + day * t;
  return out;
}
