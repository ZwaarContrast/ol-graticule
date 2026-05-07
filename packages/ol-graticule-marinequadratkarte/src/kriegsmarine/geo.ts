/** Geometric helpers for the Kriegsmarine grid: bounding boxes, screen-size, density. */

import type { Extent } from 'ol/extent';
import type { Coordinate } from 'ol/coordinate';
import type { ProjectionLike } from 'ol/proj';
import { transform } from 'ol/proj';

import { normalizeLon } from '@zwaarcontrast/ol-graticule';
import type { LatLon, Square } from './types.js';
import { isPolySquare } from './types.js';

const MIN_BOUNDARY_DENSITY = 2;
const MAX_BOUNDARY_DENSITY = 20;

/** Pick a segment count per edge given the square's on-screen size. */
function boundaryDensity(pxSize: number): number {
  if (!Number.isFinite(pxSize) || pxSize <= 40) return MIN_BOUNDARY_DENSITY;
  return Math.min(MAX_BOUNDARY_DENSITY, Math.max(MIN_BOUNDARY_DENSITY, Math.ceil(pxSize / 40)));
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

function toOlCoord(latLon: LatLon): [number, number] {
  return [latLon[1], latLon[0]];
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
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (const [lat, lon] of sq.poly) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    ext = [minLon, minLat, maxLon, maxLat];
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

/** Approximate on-screen size (pixels) of a square at the given resolution. */
export function squareScreenSize(
  sq: Square,
  resolution: number,
  viewProjection: ProjectionLike,
): number {
  if (isPolySquare(sq)) {
    const ext = squareExtent(sq);
    const nwV = transform([ext[0], ext[3]], 'EPSG:4326', viewProjection);
    const seV = transform([ext[2], ext[1]], 'EPSG:4326', viewProjection);
    return Math.max(Math.abs(seV[0] - nwV[0]), Math.abs(nwV[1] - seV[1])) / resolution;
  }
  const { nw, se } = sq;

  if (rectCrossesAntimeridian(nw, se)) {
    const centerLat = (nw[0] + se[0]) / 2;
    const p1 = transform([0, centerLat], 'EPSG:4326', viewProjection);
    const p2 = transform([1, centerLat], 'EPSG:4326', viewProjection);
    const viewUnitsPerDeg = Math.abs(p2[0] - p1[0]);
    const widthPx = lonSpanDeg(nw, se) * viewUnitsPerDeg / resolution;
    const nwV = transform([nw[1], nw[0]], 'EPSG:4326', viewProjection);
    const swV = transform([nw[1], se[0]], 'EPSG:4326', viewProjection);
    const heightPx = Math.abs(nwV[1] - swV[1]) / resolution;
    return Math.max(widthPx, heightPx);
  }

  const nwView = transform(toOlCoord(nw), 'EPSG:4326', viewProjection);
  const seView = transform(toOlCoord(se), 'EPSG:4326', viewProjection);
  return Math.max(Math.abs(seView[0] - nwView[0]), Math.abs(nwView[1] - seView[1])) / resolution;
}

/** Center of a square in the view projection. */
export function squareCenter(sq: Square, viewProjection: ProjectionLike): Coordinate {
  if (isPolySquare(sq)) {
    const ext = squareExtent(sq);
    return transform([(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2], 'EPSG:4326', viewProjection);
  }
  const { nw, se } = sq;
  const centerLat = (nw[0] + se[0]) / 2;
  const centerLon = rectCrossesAntimeridian(nw, se)
    ? normalizeLon(nw[1] + lonSpanDeg(nw, se) / 2)
    : (nw[1] + se[1]) / 2;
  return transform([centerLon, centerLat], 'EPSG:4326', viewProjection);
}

/** Public wrapper around the density heuristic. */
export function densityForPxSize(pxSize: number): number {
  return boundaryDensity(pxSize);
}
