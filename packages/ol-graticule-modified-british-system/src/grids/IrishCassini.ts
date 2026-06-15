/**
 * Letter scheme, projection parameters, and coverage polygon for this theatre
 * are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { IRISH_CASSINI_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';

/**
 * Irish Cassini, 1825 Ordnance Survey of Ireland Cassini-Soldner.
 * Projection origin 53°30'N, 8°W, Airy 1830, false E/N 200 / 250 km.
 * Ireland fits inside a single 500 km square labelled `i` (non-standard;
 * the 25-letter A–Z-minus-I alphabet skips `I`). No EPSG code; registered
 * as `MBS:IRISH_CASSINI`.
 */

export const IRISH_CASSINI_CRS = 'MBS:IRISH_CASSINI';

/** Cassini-Soldner, Airy 1830, OSI 1825 origin (53°30'N, 8°W), false E/N 200 / 250 km. */
export const IRISH_CASSINI_PROJ4 =
  '+proj=cass +lat_0=53.5 +lon_0=-8 +x_0=200000 +y_0=250000 ' +
  '+ellps=airy +units=m +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering Ireland plus buffer. */
export const IRISH_CASSINI_BBOX_WGS84: [number, number, number, number] = [-12.0, 50.0, -4.5, 56.5];

/** MBS coverage polygon for Ireland in Cassini metres ({@link IRISH_CASSINI_CRS}). Open ring. */
export const IRISH_CASSINI_CLIP_POLYGON: [number, number][] = [
  [-4448, 504651], [200506, 503942], [404710, 504102],
  [403253, -3106], [198965, -4687], [-3077, -4788],
];

export type IrishCassiniGridSystemOptions = MBSGridSystemOptions;

export function createIrishCassiniGridSystem(
  options?: IrishCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    IRISH_CASSINI_CRS,
    IRISH_CASSINI_PROJ4,
    IRISH_CASSINI_SCHEME,
    IRISH_CASSINI_CLIP_POLYGON,
    options,
  );
}
