import { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import { NORD_DE_GUERRE_SCHEME } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/** Nord de Guerre CRS (EPSG:27500) — French Lambert Conformal Conic, false E/N 500 000 / 300 000 m. */
export const NORD_DE_GUERRE_CRS = 'EPSG:27500';

export const NORD_DE_GUERRE_PROJ4 =
  '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=5.4 ' +
  '+k_0=0.99950908 +x_0=500000 +y_0=300000 +a=6376523 +rf=308.64 +pm=2.33720833333333 ' +
  '+units=m +no_defs +type=crs';

export const NORD_DE_GUERRE_EXTENT: [number, number, number, number] = [
  -125000, -20000, 1430000, 1115000,
];

/** MBS grid coverage polygon in Nord de Guerre metres (EPSG:27500). */
export const NORD_DE_GUERRE_CLIP_POLYGON: [number, number][] = [
  [992934, 1106517], [1211582, 1112253], [1210721, 716967], [1305936, 720043],
  [1312622, 405847], [1413712, 410912], [1429608, -3415], [942172, -16568],
  [390046, -10192], [391955, 89860], [-114167, 88673], [-123251, 402864],
  [-15549, 402583], [-5953, 502188], [85597, 505328], [94355, 616248],
  [189873, 609599], [195383, 810221], [287279, 805414], [292076, 916984],
  [787222, 909849], [793852, 1011105], [990966, 1004936],
];

export type NordDeGuerreGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
> & {
  /** Override the default MBS coverage polygon; coordinates in Nord de Guerre metres (EPSG:27500). */
  clipPolygon?: [number, number][] | undefined;
};

/** Build a Nord de Guerre grid with the MBS letter-cell formatter and standard coverage polygon. */
export function createNordDeGuerreGridSystem(
  options?: NordDeGuerreGridSystemOptions,
): PolygonClippedGridSystem {
  registerCRS(NORD_DE_GUERRE_CRS, NORD_DE_GUERRE_PROJ4);
  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs: NORD_DE_GUERRE_CRS,
    extent: NORD_DE_GUERRE_EXTENT,
    formatter: new MBSFormatter(NORD_DE_GUERRE_SCHEME),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: {
      rings: [clipOverride ?? NORD_DE_GUERRE_CLIP_POLYGON],
      crs: NORD_DE_GUERRE_CRS,
    },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}
