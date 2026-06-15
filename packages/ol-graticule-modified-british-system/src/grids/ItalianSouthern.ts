/**
 * Letter scheme, projection parameters, and coverage polygon for this theatre
 * are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { ITALIAN_SOUTHERN_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';

/**
 * Italian Southern Grid, Lambert Conformal Conic with standard parallels
 * 37° and 42°, central meridian 14°E, lat_0=39°30', Bessel 1841. Letter
 * arrangement reuses British Cassini (see {@link ITALIAN_SOUTHERN_SCHEME}).
 * No EPSG code; registered as `MBS:ITALIAN_SOUTHERN`.
 */

export const ITALIAN_SOUTHERN_CRS = 'MBS:ITALIAN_SOUTHERN';

/** LCC on Bessel 1841; lat_1=37°, lat_2=42°, lat_0=39°30', lon_0=14°. */
export const ITALIAN_SOUTHERN_PROJ4 =
  '+proj=lcc +lat_1=37 +lat_2=42 +lat_0=39.5 +lon_0=14 ' +
  '+x_0=700000 +y_0=600000 +ellps=bessel +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering southern Italy, Sicily, Sardinia, Malta plus buffer. */
export const ITALIAN_SOUTHERN_BBOX_WGS84: [number, number, number, number] = [6, 34, 22, 44];

/** MBS coverage polygon in projected metres ({@link ITALIAN_SOUTHERN_CRS}). Open ring. */
export const ITALIAN_SOUTHERN_CLIP_POLYGON: [number, number][] = [
  [96060, 1103449], [425444, 1104265], [690903, 1105493], [975135, 1104931],
  [1104387, 1104279], [1104751, 195638], [693611, 193970], [493585, 194506],
  [494002, 398087], [283213, 395123], [118365, 395380], [95872, 395351],
];

export type ItalianSouthernGridSystemOptions = MBSGridSystemOptions;

export function createItalianSouthernGridSystem(
  options?: ItalianSouthernGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    ITALIAN_SOUTHERN_CRS,
    ITALIAN_SOUTHERN_PROJ4,
    ITALIAN_SOUTHERN_SCHEME,
    ITALIAN_SOUTHERN_CLIP_POLYGON,
    options,
  );
}
