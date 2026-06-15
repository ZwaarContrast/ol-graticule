/**
 * Letter scheme, projection parameters, and coverage polygon for this theatre
 * are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { IBERIAN_PENINSULA_SCHEME } from '../formatters/schemes.js';
import { createMBSGridSystem, type MBSGridSystemOptions } from './shared.js';

/**
 * Iberian Peninsula MBS theatre, tangent Lambert Conformal Conic at
 * lat_0=40°N on the International 1924 (Hayford) ellipsoid, central
 * meridian at the Madrid Royal Observatory (3°41'14.55"W = -3.6872055555°),
 * false easting 600 000 m, false northing 530 000 m. Letter family:
 * British Cassini. No EPSG code; registered as `MBS:IBERIAN_PENINSULA`.
 */

export const IBERIAN_PENINSULA_CRS = 'MBS:IBERIAN_PENINSULA';

/** Tangent LCC at lat_0=40°N on Hayford 1924; Madrid Royal Observatory meridian; false E/N 600 000 / 530 000 m. */
export const IBERIAN_PENINSULA_PROJ4 =
  '+proj=lcc +lat_1=40 +lat_2=40 +lat_0=40 +lon_0=-3.6872055555 ' +
  '+x_0=600000 +y_0=530000 +ellps=intl +units=m +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering the Iberian Peninsula plus buffer. */
export const IBERIAN_PENINSULA_BBOX_WGS84: [number, number, number, number] = [-11, 35, 8, 45];

/** MBS coverage polygon for the Iberian Peninsula in projected metres ({@link IBERIAN_PENINSULA_CRS}). Open ring. */
export const IBERIAN_PENINSULA_CLIP_POLYGON: [number, number][] = [
  [-8118, 1008859], [339233, 1007778], [679488, 1007844], [806391, 1006094],
  [807196, 905979], [1172983, 902317], [1410329, 901145], [1406490, 289811],
  [1206888, 290710], [1206532, 193161], [904490, 192234], [904264, 93340],
  [604069, 92719], [603965, -6123], [-5712, -7663],
];

export type IberianPeninsulaGridSystemOptions = MBSGridSystemOptions;

export function createIberianPeninsulaGridSystem(
  options?: IberianPeninsulaGridSystemOptions,
): PolygonClippedGridSystem {
  return createMBSGridSystem(
    IBERIAN_PENINSULA_CRS,
    IBERIAN_PENINSULA_PROJ4,
    IBERIAN_PENINSULA_SCHEME,
    IBERIAN_PENINSULA_CLIP_POLYGON,
    options,
  );
}
