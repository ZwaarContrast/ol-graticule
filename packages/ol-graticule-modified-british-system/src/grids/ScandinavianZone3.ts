import { PolygonClippedGridSystem, extentFromPolygon } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import { SCANDINAVIAN_ZONE_3_SCHEME } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/**
 * Scandinavian Zone 3 — Lambert Conformal Conic with standard parallels
 * 55°N and 60°N, central meridian 20°E, lat_0=57.5°, Bessel 1841. Letter
 * arrangement: see {@link SCANDINAVIAN_ZONE_3_SCHEME}. No EPSG code;
 * registered as `MBS:SCANDINAVIAN_ZONE_3`.
 */

export const SCANDINAVIAN_ZONE_3_CRS = 'MBS:SCANDINAVIAN_ZONE_3';

/** LCC on Bessel 1841; lat_1=55°N, lat_2=60°N, lat_0=57.5°, lon_0=20°. */
export const SCANDINAVIAN_ZONE_3_PROJ4 =
  '+proj=lcc +lat_1=55 +lat_2=60 +lat_0=57.5 +lon_0=20 +x_0=900000 +y_0=543355 ' +
  '+ellps=bessel +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering mainland Norway, Sweden, Denmark plus buffer. */
export const SCANDINAVIAN_ZONE_3_BBOX_WGS84: [number, number, number, number] = [-2, 53, 32, 72];

/** MBS coverage polygon for Scandinavia in projected metres ({@link SCANDINAVIAN_ZONE_3_CRS}). Open ring. */
export const SCANDINAVIAN_ZONE_3_CLIP_POLYGON: [number, number][] = [
  [-4966, 196188], [-6034, 907506], [225034, 904869], [475355, 906060],
  [689413, 905343], [906260, 903688], [905954, 295372], [704459, 294265],
  [704686, 196032], [386326, 193466], [159493, 193857],
];

export type ScandinavianZone3GridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
> & {
  /** Override the default AOI; coordinates in projected metres ({@link SCANDINAVIAN_ZONE_3_CRS}). */
  clipPolygon?: [number, number][] | undefined;
};

export function createScandinavianZone3GridSystem(
  options?: ScandinavianZone3GridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(SCANDINAVIAN_ZONE_3_CRS, SCANDINAVIAN_ZONE_3_PROJ4);
  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const clip = clipOverride ?? SCANDINAVIAN_ZONE_3_CLIP_POLYGON;
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs: SCANDINAVIAN_ZONE_3_CRS,
    extent: extentFromPolygon(clip, 50_000),
    formatter: new MBSFormatter(SCANDINAVIAN_ZONE_3_SCHEME),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: { rings: [clip], crs: SCANDINAVIAN_ZONE_3_CRS },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}
