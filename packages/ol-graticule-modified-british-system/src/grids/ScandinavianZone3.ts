/**
 * Letter scheme, projection parameters, and coverage polygon for this theatre
 * are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { SCANDINAVIAN_ZONE_3_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';

/**
 * Scandinavian Zone 3, Lambert Conformal Conic with standard parallels
 * 55°N and 60°N, central meridian 20°E, lat_0=57.5°, Bessel 1841. Letter
 * arrangement: see {@link SCANDINAVIAN_ZONE_3_SCHEME}. No EPSG code;
 * registered as `MBS:SCANDINAVIAN_ZONE_3`.
 */

export const SCANDINAVIAN_ZONE_3_CRS = 'MBS:SCANDINAVIAN_ZONE_3';

/**
 * LCC on Bessel 1841; lat_1=55°N, lat_2=60°N, lat_0=57.5°, lon_0=20°, false
 * origin 900 000 m E / 543 365.71 m N — the latter read verbatim off the GRID
 * DATA table of GSGS 4416 sheet J.5 Heiligenhafen (War Office, 1944), which
 * prints this grid alongside Nord de Guerre. It corrects the 543 355 this
 * package carried from a secondary source, a 10.71 m error.
 */
export const SCANDINAVIAN_ZONE_3_PROJ4 =
  '+proj=lcc +lat_1=55 +lat_2=60 +lat_0=57.5 +lon_0=20 +x_0=900000 +y_0=543365.71 ' +
  '+ellps=bessel +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering mainland Norway, Sweden, Denmark plus buffer. */
export const SCANDINAVIAN_ZONE_3_BBOX_WGS84: [number, number, number, number] = [-2, 53, 32, 72];

/** MBS coverage polygon for Scandinavia in projected metres ({@link SCANDINAVIAN_ZONE_3_CRS}). Open ring. */
export const SCANDINAVIAN_ZONE_3_CLIP_POLYGON: [number, number][] = [
  [-4966, 196188], [-6034, 907506], [225034, 904869], [475355, 906060],
  [689413, 905343], [906260, 903688], [905954, 295372], [704459, 294265],
  [704686, 196032], [386326, 193466], [159493, 193857],
];

export type ScandinavianZone3GridSystemOptions = MBSGridSystemOptions;

export function createScandinavianZone3GridSystem(
  options?: ScandinavianZone3GridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    SCANDINAVIAN_ZONE_3_CRS,
    SCANDINAVIAN_ZONE_3_PROJ4,
    SCANDINAVIAN_ZONE_3_SCHEME,
    SCANDINAVIAN_ZONE_3_CLIP_POLYGON,
    options,
  );
}
