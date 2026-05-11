/**
 * Letter scheme, projection parameters, and coverage polygon for this theatre
 * are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import { PolygonClippedGridSystem, extentFromPolygon } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import { ITALIAN_NORTHERN_SCHEME } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/**
 * Italian Northern Grid, Lambert Conformal Conic with standard parallels
 * 43°20' and 48°30', central meridian 14°E, lat_0=45°55', Bessel 1841.
 * Letter arrangement: see {@link ITALIAN_NORTHERN_SCHEME}. No EPSG code;
 * registered as `MBS:ITALIAN_NORTHERN`.
 */

export const ITALIAN_NORTHERN_CRS = 'MBS:ITALIAN_NORTHERN';

/** LCC on Bessel 1841; lat_1=43°20', lat_2=48°30', lat_0=45°55', lon_0=14°. */
export const ITALIAN_NORTHERN_PROJ4 =
  '+proj=lcc +lat_1=43.333333333333336 +lat_2=48.5 +lat_0=45.916666666666664 +lon_0=14 ' +
  '+x_0=800000 +y_0=602846 +ellps=bessel +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering operational coverage plus buffer. */
export const ITALIAN_NORTHERN_BBOX_WGS84: [number, number, number, number] = [4, 39, 23, 51];

/** MBS coverage polygon in projected metres ({@link ITALIAN_NORTHERN_CRS}). Open ring. */
export const ITALIAN_NORTHERN_CLIP_POLYGON: [number, number][] = [
  [195071, 806009], [490847, 806593], [744910, 808170], [1056584, 805766],
  [1205607, 804750], [1207424, 194627], [861466, 193464], [518166, 193869],
  [193467, 194184],
];

export type ItalianNorthernGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
> & {
  /** Override the default AOI; coordinates in projected metres ({@link ITALIAN_NORTHERN_CRS}). */
  clipPolygon?: [number, number][] | undefined;
};

export function createItalianNorthernGridSystem(
  options?: ItalianNorthernGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(ITALIAN_NORTHERN_CRS, ITALIAN_NORTHERN_PROJ4);
  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const clip = clipOverride ?? ITALIAN_NORTHERN_CLIP_POLYGON;
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs: ITALIAN_NORTHERN_CRS,
    extent: extentFromPolygon(clip, 50_000),
    formatter: new MBSFormatter(ITALIAN_NORTHERN_SCHEME),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: { rings: [clip], crs: ITALIAN_NORTHERN_CRS },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}
