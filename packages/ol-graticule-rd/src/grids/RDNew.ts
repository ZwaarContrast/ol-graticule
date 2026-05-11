import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { buildRDProj4, createRDGridSystem, type RDGridSystemOptions } from './shared.js';

/**
 * RD New (Rijksdriehoekstelsel), EPSG:28992. The current Dutch national grid.
 * Origin: Amersfoort, with false easting 155 000 m and false northing 463 000 m.
 */
export const RD_NEW_CRS = 'EPSG:28992';

export const RD_NEW_PROJ4 = buildRDProj4(155000, 463000);

export const RD_NEW_EXTENT: [number, number, number, number] = [
  482, 306618, 284183, 637050,
];

/**
 * Official EPSG:28992 area-of-use (Netherlands onshore + Wadden + 12-mile
 * offshore zone) as a polygon in RD New metres. Derived from the WGS84
 * bounding box on https://epsg.io/28992, sampled at 8 points per edge.
 */
export const RD_NEW_CLIP_POLYGON: [number, number][] = [
  [482, 308914], [35939, 307975], [71400, 307280], [106864, 306827],
  [142329, 306618], [177795, 306652], [213260, 306930], [248723, 307451],
  [284183, 308215], [283157, 349229], [282129, 390244], [281098, 431260],
  [280064, 472277], [279028, 513297], [277989, 554321], [276947, 595349],
  [275902, 636382], [242717, 635652], [209528, 635155], [176338, 634890],
  [143146, 634857], [109956, 635057], [76766, 635489], [43580, 636153],
  [10397, 637050], [9147, 596021], [7899, 554997], [6655, 513977],
  [5414, 472961], [4176, 431948], [2942, 390936], [1710, 349925],
];

export type RDNewGridSystemOptions = RDGridSystemOptions;

/**
 * Build an RD New (EPSG:28992) ProjectedGridSystem with the NL area-of-use
 * polygon pre-configured.
 *
 * Registers the RDNAPTRANS 2018 NTv2 grid (bundled inline in this package)
 * before constructing the system, so every coordinate it produces uses the
 * grid, sub-centimetre accuracy across NL. Without the grid, the
 * `+towgs84` Helmert fallback has ~1 m residual error.
 *
 * Registers the RD New CRS with proj4/OL on first call, idempotent across
 * calls.
 */
export function createRDNewGridSystem(
  options?: RDNewGridSystemOptions,
): PolygonClippedGridSystem {
  return createRDGridSystem(
    RD_NEW_CRS,
    RD_NEW_PROJ4,
    RD_NEW_EXTENT,
    RD_NEW_CLIP_POLYGON,
    options,
  );
}
