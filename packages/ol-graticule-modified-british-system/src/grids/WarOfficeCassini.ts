/**
 * Letter scheme and coverage polygon are sourced from Thierry Arsicaud's
 * Echo Delta site (https://www.echodelta.net/mbs/eng-welcome.php). The WWII
 * Dunnose origin and false-easting/northing values come from Roger Hellyer's
 * article in Sheetlines issue 55 (Charles Close Society, 2001). See the
 * package README for the full credit.
 */

import { PolygonClippedGridSystem, extentFromPolygon } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import { WAR_OFFICE_CASSINI_SCHEME } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/**
 * War Office Cassini Grid ("WOFO" / "Purple Grid"), WWII British Army
 * grid, used on GSGS series sheets 1927–WWII. Cassini-Soldner with natural
 * origin at Dunnose (Isle of Wight, 50°37'03.748"N, 1°11'50.136"W), Airy
 * 1830, false origin 500 km W and 100 km S of Dunnose. Units: metres.
 * No EPSG code; registered as `MBS:WAR_OFFICE_CASSINI`.
 */

export const WAR_OFFICE_CASSINI_CRS = 'MBS:WAR_OFFICE_CASSINI';

/** Cassini-Soldner on Dunnose (50.6177077778°N, -1.1972600000°), Airy 1830, false E/N 500 km / 100 km. */
export const WAR_OFFICE_CASSINI_PROJ4 =
  '+proj=cass +lat_0=50.6177077778 +lon_0=-1.1972600000 +x_0=500000 +y_0=100000 ' +
  '+ellps=airy +units=m +no_defs +type=crs';

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` covering Great Britain plus buffer. */
export const WAR_OFFICE_CASSINI_BBOX_WGS84: [number, number, number, number] = [-10.5, 48.5, 4.5, 62.0];

/** MBS coverage polygon for Britain in WOFO metres ({@link WAR_OFFICE_CASSINI_CRS}). Open ring. */
export const WAR_OFFICE_CASSINI_CLIP_POLYGON: [number, number][] = [
  [97239, 1103633], [302001, 1103149], [500154, 1103049], [700872, 1103219],
  [802575, 1103768], [802871, 196449], [703925, 196382], [704906, 96920],
  [604481, 96446], [603676, -3480], [302917, -4050], [97843, -4545],
  [96027, 203969], [195496, 204528], [195945, 596925], [95099, 595915],
];

export type WarOfficeCassiniGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
> & {
  /** Override the default AOI; coordinates in WOFO metres ({@link WAR_OFFICE_CASSINI_CRS}). */
  clipPolygon?: [number, number][] | undefined;
};

export function createWarOfficeCassiniGridSystem(
  options?: WarOfficeCassiniGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(WAR_OFFICE_CASSINI_CRS, WAR_OFFICE_CASSINI_PROJ4);
  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const clip = clipOverride ?? WAR_OFFICE_CASSINI_CLIP_POLYGON;
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs: WAR_OFFICE_CASSINI_CRS,
    extent: extentFromPolygon(clip, 50_000),
    formatter: new MBSFormatter(WAR_OFFICE_CASSINI_SCHEME),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: { rings: [clip], crs: WAR_OFFICE_CASSINI_CRS },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}
