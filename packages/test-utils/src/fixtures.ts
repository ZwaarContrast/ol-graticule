/**
 * Primary-source reference coordinates used across packages. Each entry
 * carries [latitude, longitude] in WGS 84 decimal degrees and a `where`
 * label explaining its provenance. Use these to assert against real-world
 * grid references rather than synthetic round-trip pairs.
 */

import { dms } from './dms.js';

export interface RefPoint {
  readonly where: string;
  readonly lat: number;
  readonly lon: number;
}

/** Wartime HMN-relevant points sampled from sheet faces. */
export const HMN_POINTS = {
  denHaag: { where: 'Den Haag, NL', lat: dms(52, 4, 46), lon: dms(4, 18, 25) },
  scheveningenLighthouse: {
    where: 'Scheveningen Lighthouse, NL',
    lat: dms(52, 6, 21),
    lon: dms(4, 16, 22),
  },
  romfo: { where: 'Romfo, NO', lat: dms(62, 35, 0), lon: dms(9, 25, 0) },
  berlinReichstag: {
    where: 'Berlin Reichstag, DE',
    lat: dms(52, 31, 6),
    lon: dms(13, 22, 34),
  },
  kolosjoki: { where: 'Kolosjoki, FI', lat: dms(69, 38, 0), lon: dms(30, 6, 0) },
} as const satisfies Record<string, RefPoint>;

/** Points used in MGRS reference assertions. */
export const MGRS_POINTS = {
  whiteHouse: {
    where: 'White House, Washington DC',
    lat: dms(38, 53, 52),
    lon: -dms(77, 2, 11),
  },
  eiffelTower: {
    where: 'Eiffel Tower, Paris',
    lat: dms(48, 51, 30),
    lon: dms(2, 17, 40),
  },
  sydneyOpera: {
    where: 'Sydney Opera House',
    lat: -dms(33, 51, 24),
    lon: dms(151, 12, 55),
  },
} as const satisfies Record<string, RefPoint>;

/** A spread of latitudes for property tests that need to cover the globe. */
export const GLOBE_LATITUDES = [-84, -60, -30, -1, 0, 1, 30, 60, 84];
/** A spread of longitudes including antimeridian. */
export const GLOBE_LONGITUDES = [-179.5, -120, -60, -1, 0, 1, 60, 120, 179.5];

/** Polygon of a unit square (CCW). */
export function unitSquare(): [number, number][] {
  return [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
}
