/**
 * Geometric helpers for the Kriegsmarine grid: bounding boxes and density.
 * ol-free; the view-projection helpers live in `screen.ts`.
 *
 * The antimeridian-crossing handling and square-extent logic are ported from
 * Jan Kockrow's cljs-navalgrid (https://github.com/Nylle/cljs-navalgrid) and
 * his research at navalgrid.com. See the package README for the full credit.
 */

import type { Extent } from 'ol/extent';

import type { LatLon, Square } from './types.js';
import { isPolySquare } from './types.js';

const MIN_BOUNDARY_DENSITY = 2;
const MAX_BOUNDARY_DENSITY = 20;

/** Pick a segment count per edge given the square's on-screen size. */
function boundaryDensity(pxSize: number): number {
  if (!Number.isFinite(pxSize) || pxSize <= 40) return MIN_BOUNDARY_DENSITY;
  return Math.min(
    MAX_BOUNDARY_DENSITY,
    Math.max(MIN_BOUNDARY_DENSITY, Math.ceil(pxSize / 40)),
  );
}

export function rectCrossesAntimeridian(nw: LatLon, se: LatLon): boolean {
  return Math.abs(se[1] - nw[1]) > 180;
}

/** Interpolate longitude along the shorter path; may return values outside ±180. */
export function interpolateLon(lon1: number, lon2: number, t: number): number {
  if (Math.abs(lon2 - lon1) <= 180) {
    return lon1 + t * (lon2 - lon1);
  }
  const adjusted = lon2 < lon1 ? lon2 + 360 : lon2 - 360;
  return lon1 + t * (adjusted - lon1);
}

export function lonSpanDeg(nw: LatLon, se: LatLon): number {
  const diff = Math.abs(se[1] - nw[1]);
  return diff > 180 ? 360 - diff : diff;
}

const extentCache = new WeakMap<Square, Extent>();

/** Geographic bounding box of a square, in [minLon, minLat, maxLon, maxLat]. */
export function squareExtent(sq: Square): Extent {
  const cached = extentCache.get(sq);
  if (cached) return cached;

  let ext: Extent;
  if (isPolySquare(sq)) {
    const lats = sq.poly.map((p) => p[0]);
    const lons = sq.poly.map((p) => p[1]);
    ext = [
      Math.min(...lons),
      Math.min(...lats),
      Math.max(...lons),
      Math.max(...lats),
    ];
  } else {
    const { nw, se } = sq;
    if (rectCrossesAntimeridian(nw, se)) {
      ext = [-180, Math.min(nw[0], se[0]), 180, Math.max(nw[0], se[0])];
    } else {
      ext = [
        Math.min(nw[1], se[1]),
        Math.min(nw[0], se[0]),
        Math.max(nw[1], se[1]),
        Math.max(nw[0], se[0]),
      ];
    }
  }

  extentCache.set(sq, ext);
  return ext;
}

/** Public wrapper around the density heuristic. */
export function densityForPxSize(pxSize: number): number {
  return boundaryDensity(pxSize);
}
