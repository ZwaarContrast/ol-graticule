/**
 * Letter scheme, projection parameters, and coverage polygons for the three
 * French Lambert theatres are sourced from Thierry Arsicaud's Echo Delta site
 * (https://www.echodelta.net/mbs/eng-welcome.php). See the package README for
 * the full credit.
 */

import { PolygonClippedGridSystem, extentFromPolygon } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { MBSFormatter } from '../formatters/MBSFormatter.js';
import {
  FRENCH_LAMBERT_1_SCHEME,
  FRENCH_LAMBERT_2_SCHEME,
  FRENCH_LAMBERT_3_SCHEME,
  type MBSLetterScheme,
} from '../formatters/schemes.js';
import { MBSIntervals } from '../intervals/MBSIntervals.js';

/** French IGN Lambert zones I (Nord), II (Centre), and III (Sud) with the MBS letter-cell grid overlaid. */

/**
 * IGN NTF-Paris Lambert specs: k_0 = 0.999877340, Clarke 1880 IGN ellipsoid,
 * Paris prime meridian, false E/N 600/200 km. Gradian → degrees: 55 gr =
 * 49.5°, 52 gr = 46.8°, 49 gr = 44.1°.
 */
function proj4For(latDeg: number): string {
  return (
    `+proj=lcc +lat_1=${latDeg} +lat_0=${latDeg} +lon_0=0 ` +
    `+k_0=0.999877340 +x_0=600000 +y_0=200000 +ellps=clrk80ign ` +
    `+pm=paris +towgs84=-168,-60,320,0,0,0,0 +units=m +no_defs +type=crs`
  );
}

export const FRENCH_LAMBERT_1_CRS = 'EPSG:27561';
export const FRENCH_LAMBERT_1_PROJ4 = proj4For(49.5);

export const FRENCH_LAMBERT_2_CRS = 'EPSG:27562';
export const FRENCH_LAMBERT_2_PROJ4 = proj4For(46.8);

export const FRENCH_LAMBERT_3_CRS = 'EPSG:27563';
export const FRENCH_LAMBERT_3_PROJ4 = proj4For(44.1);

/** WGS84 bbox `[lonMin, latMin, lonMax, latMax]` for each zone. */
export const FRENCH_LAMBERT_1_BBOX_WGS84: [number, number, number, number] = [-7, 46, 10, 52];
export const FRENCH_LAMBERT_2_BBOX_WGS84: [number, number, number, number] = [-6, 43, 9, 49];
export const FRENCH_LAMBERT_3_BBOX_WGS84: [number, number, number, number] = [-9, 41, 10, 46];

/** MBS coverage polygons in zone Lambert metres. Open rings. */
export const FRENCH_LAMBERT_1_CLIP_POLYGON: [number, number][] = [
  [-4018, -4087], [-8190, 306861], [283473, 307338], [465075, 307966],
  [509180, 307135], [507736, -10011], [251849, -8262],
];

export const FRENCH_LAMBERT_2_CLIP_POLYGON: [number, number][] = [
  [-8849, 404323], [159982, 406846], [350283, 406154], [570809, 406093],
  [786636, 407177], [1010627, 405133], [1007435, -7530], [749085, -7852],
  [399074, -7642], [152056, -7904], [-6768, -6408],
];

export const FRENCH_LAMBERT_3_CLIP_POLYGON: [number, number][] = [
  [-6843, 409721], [353080, 409519], [623686, 408296], [860265, 410612],
  [1009454, 407861], [1008579, -8194], [611157, -6286], [303784, -7509],
  [195277, -8896], [192720, 195213], [-6180, 194617],
];

interface ZoneSpec {
  crs: string;
  proj4: string;
  scheme: MBSLetterScheme;
  clipPolygon: [number, number][];
}

const ZONES: Record<1 | 2 | 3, ZoneSpec> = {
  1: { crs: FRENCH_LAMBERT_1_CRS, proj4: FRENCH_LAMBERT_1_PROJ4, scheme: FRENCH_LAMBERT_1_SCHEME, clipPolygon: FRENCH_LAMBERT_1_CLIP_POLYGON },
  2: { crs: FRENCH_LAMBERT_2_CRS, proj4: FRENCH_LAMBERT_2_PROJ4, scheme: FRENCH_LAMBERT_2_SCHEME, clipPolygon: FRENCH_LAMBERT_2_CLIP_POLYGON },
  3: { crs: FRENCH_LAMBERT_3_CRS, proj4: FRENCH_LAMBERT_3_PROJ4, scheme: FRENCH_LAMBERT_3_SCHEME, clipPolygon: FRENCH_LAMBERT_3_CLIP_POLYGON },
};

export type FrenchLambertGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent' | 'formatter' | 'intervals'
> & {
  /** Override the default AOI; coordinates in the zone's Lambert metres. */
  clipPolygon?: [number, number][] | undefined;
};

function createFrenchLambert(
  zone: 1 | 2 | 3,
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem {
  const spec = ZONES[zone];
  registerCRS(spec.crs, spec.proj4);
  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const clip = clipOverride ?? spec.clipPolygon;
  const intervals = new MBSIntervals();
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs: spec.crs,
    extent: extentFromPolygon(clip, 50_000),
    formatter: new MBSFormatter(spec.scheme),
    intervals,
  });
  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: { rings: [clip], crs: spec.crs },
    cellSnapInterval: (resolution, viewProjection) =>
      intervals.getInterval(resolution, viewProjection),
  });
}

export const createFrenchLambert1GridSystem = (
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem => createFrenchLambert(1, options);

export const createFrenchLambert2GridSystem = (
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem => createFrenchLambert(2, options);

export const createFrenchLambert3GridSystem = (
  options?: FrenchLambertGridSystemOptions,
): PolygonClippedGridSystem => createFrenchLambert(3, options);
