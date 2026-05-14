/**
 * Build a `PolygonClip` for a DHG zone: the strip's longitudinal bounds in WGS 84,
 * intersected with the operational validity envelope (Planheft Schweiz, p. C 2).
 */

import type { PolygonClip } from '@zwaarcontrast/ol-graticule';

import type { DhgZone } from './types.js';

/**
 * Operational validity envelope from the Planheft Schweiz (OKH g 23/1,
 * 16 March 1944) page C 2: lon -36°..+84°, lat -32°..+72°.
 */
export const VALIDITY_WEST_LON = -36;
export const VALIDITY_EAST_LON = 84;
export const VALIDITY_SOUTH_LAT = -32;
export const VALIDITY_NORTH_LAT = 72;

/** Returns true if `zone` (optionally extended by `overlapDeg`) overlaps the validity envelope. */
export function zoneIntersectsValidity(zone: DhgZone, overlapDeg = 0): boolean {
  const halfWidth = 3 + overlapDeg;
  const west = zone.cm - halfWidth;
  const east = zone.cm + halfWidth;
  return east > VALIDITY_WEST_LON && west < VALIDITY_EAST_LON;
}

/** Returns true if `(lon, lat)` falls inside the operational validity envelope. */
export function pointInsideValidity(lon: number, lat: number): boolean {
  return (
    lon >= VALIDITY_WEST_LON &&
    lon <= VALIDITY_EAST_LON &&
    lat >= VALIDITY_SOUTH_LAT &&
    lat <= VALIDITY_NORTH_LAT
  );
}

/** Strip polygon for `zone`, intersected with the validity envelope. */
export function stripClipPolygon(zone: DhgZone, overlapDeg = 0): PolygonClip {
  const halfWidth = 3 + overlapDeg;
  const west = Math.max(VALIDITY_WEST_LON, zone.cm - halfWidth);
  const east = Math.min(VALIDITY_EAST_LON, zone.cm + halfWidth);

  if (east <= west) {
    // Degenerate triangle: zone outside the validity envelope.
    return {
      crs: 'EPSG:4326',
      rings: [[[0, 0], [0, 0.0001], [0.0001, 0]]],
    };
  }

  const ring: Array<[number, number]> = [
    [west, VALIDITY_SOUTH_LAT],
    [east, VALIDITY_SOUTH_LAT],
    [east, VALIDITY_NORTH_LAT],
    [west, VALIDITY_NORTH_LAT],
  ];

  return {
    crs: 'EPSG:4326',
    rings: [ring],
  };
}
