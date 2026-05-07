import { PolygonClippedGridSystem, extentFromPolygon } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import { IRISH_CASSINI_SCHEME } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/**
 * Irish Cassini — 1825 Ordnance Survey of Ireland Cassini-Soldner.
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

export type IrishCassiniGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
> & {
  /** Override the default AOI; coordinates in Cassini metres ({@link IRISH_CASSINI_CRS}). */
  clipPolygon?: [number, number][] | undefined;
};

export function createIrishCassiniGridSystem(
  options?: IrishCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(IRISH_CASSINI_CRS, IRISH_CASSINI_PROJ4);
  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const clip = clipOverride ?? IRISH_CASSINI_CLIP_POLYGON;
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs: IRISH_CASSINI_CRS,
    extent: extentFromPolygon(clip, 50_000),
    formatter: new MBSFormatter(IRISH_CASSINI_SCHEME),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: { rings: [clip], crs: IRISH_CASSINI_CRS },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}
