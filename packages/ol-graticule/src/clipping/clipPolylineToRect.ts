/**
 * Liang-Barsky polyline clipping against an axis-aligned 2D rectangle.
 *
 * Per input segment: solve four scalar inequalities for the `[t0, t1]`
 * sub-interval that lies inside the rect, then emit `[p0 + t0·d, p0 + t1·d]`.
 * Cheaper than {@link clipPolylineToPolygon} because no spatial index and no
 * 2D segment-vs-edge intersections are needed. Only valid for axis-aligned
 * rectangular clip shapes.
 */

import { boundingExtent, containsExtent, intersects } from 'ol/extent';
import type { Extent } from 'ol/extent';
import type { Coordinate } from 'ol/coordinate';

const EPS = 1e-12;

export function clipPolylineToRect(
  polyline: Coordinate[],
  xLo: number,
  yLo: number,
  xHi: number,
  yHi: number,
): Coordinate[][] {
  const out: Coordinate[][] = [];
  if (polyline.length < 2) return out;

  const rect: Extent = [xLo, yLo, xHi, yHi];
  const bbox = boundingExtent(polyline);
  if (!intersects(rect, bbox)) return out;
  if (containsExtent(rect, bbox)) {
    out.push(polyline.map((p): Coordinate => [p[0]!, p[1]!]));
    return out;
  }

  let current: Coordinate[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const p0 = polyline[i];
    const p1 = polyline[i + 1];
    const seg = liangBarsky_(p0, p1, xLo, yLo, xHi, yHi);
    if (seg === null) {
      if (current.length > 1) out.push(current);
      current = [];
      continue;
    }
    const [pa, pb] = seg;
    if (current.length === 0) {
      current.push(pa);
    } else {
      const last = current[current.length - 1];
      if (Math.abs(last[0] - pa[0]) > EPS || Math.abs(last[1] - pa[1]) > EPS) {
        if (current.length > 1) out.push(current);
        current = [pa];
      }
    }
    current.push(pb);
  }
  if (current.length > 1) out.push(current);
  return out;
}

function liangBarsky_(
  p0: Coordinate,
  p1: Coordinate,
  xLo: number,
  yLo: number,
  xHi: number,
  yHi: number,
): [Coordinate, Coordinate] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];

  const ps: [number, number][] = [
    [-dx, p0[0] - xLo],
    [dx, xHi - p0[0]],
    [-dy, p0[1] - yLo],
    [dy, yHi - p0[1]],
  ];
  for (let k = 0; k < 4; k++) {
    const p = ps[k][0];
    const q = ps[k][1];
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    [p0[0] + t0 * dx, p0[1] + t0 * dy],
    [p0[0] + t1 * dx, p0[1] + t1 * dy],
  ];
}
