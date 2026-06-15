/**
 * Letter scheme, projection parameters, and coverage polygon for this theatre
 * are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { BRITISH_CASSINI_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';

/**
 * British Cassini, Cassini-Soldner on the OS Cassini-Delamere origin
 * (Cheshire, 53°13'17.274"N, 2°41'03.562"W), Airy 1830 ellipsoid.
 * Civilian OS grid (1801–c.1920s); for the WWII military Dunnose grid see
 * {@link createWarOfficeCassiniGridSystem}. No EPSG code; registered as
 * `MBS:BRITISH_CASSINI`.
 */

export const BRITISH_CASSINI_CRS = 'MBS:BRITISH_CASSINI';

/** Cassini-Soldner on Delamere, Airy 1830, false easting 500 km, false northing 100 km. */
export const BRITISH_CASSINI_PROJ4 =
  '+proj=cass +lat_0=53.22146500 +lon_0=-2.68432278 +x_0=500000 +y_0=100000 ' +
  '+ellps=airy +units=m +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering Great Britain plus buffer. */
export const BRITISH_CASSINI_BBOX_WGS84: [number, number, number, number] = [-10.5, 48.5, 4.5, 62.0];

/** MBS coverage polygon for Britain, in Cassini metres ({@link BRITISH_CASSINI_CRS}). Open ring. */
export const BRITISH_CASSINI_CLIP_POLYGON: [number, number][] = [
  [194204, 805823], [413895, 807287], [610516, 808445], [908309, 807075],
  [909065, 383188], [908377, -106138], [809002, -106715], [808142, -206635],
  [707709, -205432], [707986, -306996], [410741, -306655], [190966, -309023],
  [190436, -89732], [291778, -91016], [294070, 295645], [195665, 293235],
];

export type BritishCassiniGridSystemOptions = MBSGridSystemOptions;

export function createBritishCassiniGridSystem(
  options?: BritishCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    BRITISH_CASSINI_CRS,
    BRITISH_CASSINI_PROJ4,
    BRITISH_CASSINI_SCHEME,
    BRITISH_CASSINI_CLIP_POLYGON,
    options,
  );
}
