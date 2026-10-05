/**
 * Kriegsmarine grid helpers that need a view projection, split out of
 * `geo.ts` so the codecs there stay importable without OpenLayers.
 */

import type { Coordinate } from 'ol/coordinate';
import type { ProjectionLike } from 'ol/proj';
import { transform } from 'ol/proj';

import { normalizeLon } from '@zwaarcontrast/ol-graticule/headless';
import type { LatLon, Square } from './types.js';
import { isPolySquare } from './types.js';
import { lonSpanDeg, rectCrossesAntimeridian, squareExtent } from './geo.js';

function toOlCoord(latLon: LatLon): [number, number] {
  return [latLon[1], latLon[0]];
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
    return (
      Math.max(Math.abs(seV[0] - nwV[0]), Math.abs(nwV[1] - seV[1])) /
      resolution
    );
  }
  const { nw, se } = sq;

  if (rectCrossesAntimeridian(nw, se)) {
    const centerLat = (nw[0] + se[0]) / 2;
    const p1 = transform([0, centerLat], 'EPSG:4326', viewProjection);
    const p2 = transform([1, centerLat], 'EPSG:4326', viewProjection);
    const viewUnitsPerDeg = Math.abs(p2[0] - p1[0]);
    const widthPx = (lonSpanDeg(nw, se) * viewUnitsPerDeg) / resolution;
    const nwV = transform([nw[1], nw[0]], 'EPSG:4326', viewProjection);
    const swV = transform([nw[1], se[0]], 'EPSG:4326', viewProjection);
    const heightPx = Math.abs(nwV[1] - swV[1]) / resolution;
    return Math.max(widthPx, heightPx);
  }

  const nwView = transform(toOlCoord(nw), 'EPSG:4326', viewProjection);
  const seView = transform(toOlCoord(se), 'EPSG:4326', viewProjection);
  return (
    Math.max(Math.abs(seView[0] - nwView[0]), Math.abs(nwView[1] - seView[1])) /
    resolution
  );
}

/** Center of a square in the view projection. */
export function squareCenter(
  sq: Square,
  viewProjection: ProjectionLike,
): Coordinate {
  if (isPolySquare(sq)) {
    const ext = squareExtent(sq);
    return transform(
      [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2],
      'EPSG:4326',
      viewProjection,
    );
  }
  const { nw, se } = sq;
  const centerLat = (nw[0] + se[0]) / 2;
  const centerLon = rectCrossesAntimeridian(nw, se)
    ? normalizeLon(nw[1] + lonSpanDeg(nw, se) / 2)
    : (nw[1] + se[1]) / 2;
  return transform([centerLon, centerLat], 'EPSG:4326', viewProjection);
}
