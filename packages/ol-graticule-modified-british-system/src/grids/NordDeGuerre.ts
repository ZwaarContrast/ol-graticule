import { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import { NORD_DE_GUERRE_SCHEME } from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/** Nord de Guerre CRS (EPSG:27500) — French Lambert Conformal Conic, false E/N 500 000 / 300 000 m. */
export const NORD_DE_GUERRE_CRS = 'EPSG:27500';

/**
 * Empirical 3-parameter Helmert shift from ATF (Paris) / Plessis 1817
 * to WGS84, applied via `+towgs84` in {@link NORD_DE_GUERRE_PROJ4}.
 *
 * **Why we need this and EPSG can't help.** ATF was superseded by NTF
 * in 1898 and never re-tied to a global frame, so EPSG/IGN publish no
 * transformation from EPSG:4901 (ATF Paris) to WGS84. PROJ
 * (`projinfo -s EPSG:27500 -t EPSG:4326`) reports only a "ballpark"
 * operation — i.e. zero translation, off by ~100 m across the Western
 * Front.
 *
 * **Source.** Bill Sayers, *Transforming French WW1 Lambert Coordinates
 * to WGS84*, The Wandering Cartographer (16 January 2024):
 * <https://wanderingcartographer.wordpress.com/2024/01/16/transforming-french-ww1-lambert-coordinates-to-wgs84/>.
 * Derived by averaging ECEF deltas across 13 georeferenced WWI Initial
 * Point survey plats from 1919–1920 in NE France.
 *
 * **Accuracy.** Reported residuals: 10 of 13 control points within 20 m,
 * three outliers up to ~100 m. Best published estimate; not an
 * EPSG-blessed value. Pass a custom `towgs84` to
 * {@link createNordDeGuerreGridSystem} if you have a better fit, or
 * `null` to disable the shift entirely (canonical EPSG:27500, ballpark
 * accuracy).
 */
export const NORD_DE_GUERRE_DEFAULT_TOWGS84 = [
  1383.8, 38.7, 392, 0, 0, 0, 0,
] as const;

function buildNordDeGuerreProj4(towgs84: readonly number[] | null): string {
  const base =
    '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=5.4 ' +
    '+k_0=0.99950908 +x_0=500000 +y_0=300000 +a=6376523 +rf=308.64 ' +
    '+pm=2.33720833333333';
  const shift = towgs84 === null ? '' : ` +towgs84=${towgs84.join(',')}`;
  return `${base}${shift} +units=m +no_defs +type=crs`;
}

/**
 * proj4 definition for {@link NORD_DE_GUERRE_CRS}, including the default
 * empirical Helmert shift to WGS84. See
 * {@link NORD_DE_GUERRE_DEFAULT_TOWGS84} for source and accuracy.
 */
export const NORD_DE_GUERRE_PROJ4 = buildNordDeGuerreProj4(
  NORD_DE_GUERRE_DEFAULT_TOWGS84,
);

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
  /**
   * Override the Helmert shift baked into the registered proj4 string
   * for datum transformation between EPSG:27500 and WGS84.
   *
   * - `undefined` (default): use {@link NORD_DE_GUERRE_DEFAULT_TOWGS84}.
   * - `null`: register the canonical EPSG:27500 with no `+towgs84`.
   *   proj4 falls back to a ballpark transformation (~100 m off across
   *   the Western Front).
   * - 3- or 7-element array (`[Tx, Ty, Tz]` or
   *   `[Tx, Ty, Tz, Rx, Ry, Rz, Ds]`): use this Helmert.
   *
   * Calling the factory with a different `towgs84` re-registers
   * `EPSG:27500` against the new string; last call wins.
   */
  towgs84?: readonly number[] | null | undefined;
};

/** Build a Nord de Guerre grid with the MBS letter-cell formatter and standard coverage polygon. */
export function createNordDeGuerreGridSystem(
  options?: NordDeGuerreGridSystemOptions,
): PolygonClippedGridSystem {
  const { clipPolygon: clipOverride, towgs84, ...projOptions } = options ?? {};
  const towgs84Effective =
    towgs84 === undefined ? NORD_DE_GUERRE_DEFAULT_TOWGS84 : towgs84;
  if (
    towgs84Effective !== null &&
    towgs84Effective.length !== 3 &&
    towgs84Effective.length !== 7
  ) {
    throw new Error(
      `towgs84 must have 3 or 7 elements, got ${towgs84Effective.length}`,
    );
  }
  registerCRS(NORD_DE_GUERRE_CRS, buildNordDeGuerreProj4(towgs84Effective));
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
