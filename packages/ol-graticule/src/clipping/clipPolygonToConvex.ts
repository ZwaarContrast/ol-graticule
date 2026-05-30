/**
 * Sutherland-Hodgman clip of a subject polygon against a convex clip polygon.
 * Used by PolygonClippedGridSystem to compute the visible portion of a clipped cell.
 *
 * The clip polygon MUST be convex; for the strip rectangles in EPSG:4326
 * projected to Web Mercator that's automatic (parallels and meridians stay
 * horizontal/vertical in Mercator, so a WGS 84 rectangle stays rectangular).
 *
 * Rings are open (first vertex is not repeated as last) and assumed to be in
 * the same coordinate system.
 */

import { boundingExtent, intersects } from 'ol/extent';
import type { Coordinate } from 'ol/coordinate';
import { signedArea } from './polygonArea.js';

export function clipPolygonToConvex(
  subject: Coordinate[],
  clip: Coordinate[],
): Coordinate[] {
  if (subject.length < 3 || clip.length < 3) return [];

  if (!intersects(boundingExtent(subject), boundingExtent(clip))) return [];

  const clipSigned = signedArea(clip);
  if (clipSigned === 0) return [];
  const clipCCW = clipSigned > 0;

  let output: Coordinate[] = subject.map((p): Coordinate => [p[0], p[1]]);
  const cn = clip.length;
  for (let i = 0; i < cn; i++) {
    if (output.length === 0) break;
    const a = clip[i];
    const b = clip[(i + 1) % cn];
    const input = output;
    output = [];
    const len = input.length;
    for (let j = 0; j < len; j++) {
      const p = input[j];
      const q = input[(j + 1) % len];
      const pInside = isInsideEdge(p, a, b, clipCCW);
      const qInside = isInsideEdge(q, a, b, clipCCW);
      if (pInside) {
        output.push(p);
        if (!qInside) {
          const x = intersect(p, q, a, b);
          if (x) output.push(x);
        }
      } else if (qInside) {
        const x = intersect(p, q, a, b);
        if (x) output.push(x);
      }
    }
  }
  return output;
}

function isInsideEdge(p: Coordinate, a: Coordinate, b: Coordinate, ccw: boolean): boolean {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  return ccw ? cross >= 0 : cross <= 0;
}

function intersect(p: Coordinate, q: Coordinate, a: Coordinate, b: Coordinate): Coordinate | null {
  const rx = q[0] - p[0];
  const ry = q[1] - p[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const denom = rx * sy - ry * sx;
  if (denom === 0) return null;
  const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / denom;
  return [p[0] + t * rx, p[1] + t * ry];
}
