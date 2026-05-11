import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { buildRDProj4, createRDGridSystem, type RDGridSystemOptions } from './shared.js';
import { RD_NEW_CLIP_POLYGON } from './RDNew.js';

/**
 * RD Old (Rijksdriehoekstelsel), EPSG:28991. The pre-1989 Dutch national
 * grid, same projection as RD New but with origin shifted to (0, 0).
 * Produces coordinates like (-150000, 50000) for Amersfoort instead of
 * (155000, 463000).
 */
export const RD_OLD_CRS = 'EPSG:28991';

export const RD_OLD_PROJ4 = buildRDProj4(0, 0);

export const RD_OLD_EXTENT: [number, number, number, number] = [
  -154518, -156382, 129183, 174050,
];

/**
 * Same WGS84 area-of-use as RD_NEW_CLIP_POLYGON, expressed in RD Old
 * coordinates. RD Old is RD New with the false origin removed, so this is
 * literally the RD New polygon translated by (-155000, -463000).
 */
export const RD_OLD_CLIP_POLYGON: [number, number][] = RD_NEW_CLIP_POLYGON.map(
  ([x, y]) => [x - 155000, y - 463000],
);

export type RDOldGridSystemOptions = RDGridSystemOptions;

/**
 * Build an RD Old (EPSG:28991) ProjectedGridSystem with the NL area-of-use
 * polygon pre-configured.
 *
 * Registers the bundled RDNAPTRANS 2018 NTv2 grid synchronously before
 * returning, see {@link createRDNewGridSystem} for the rationale.
 * Registers the RD Old CRS with proj4/OL on first call.
 */
export function createRDOldGridSystem(
  options?: RDOldGridSystemOptions,
): PolygonClippedGridSystem {
  return createRDGridSystem(
    RD_OLD_CRS,
    RD_OLD_PROJ4,
    RD_OLD_EXTENT,
    RD_OLD_CLIP_POLYGON,
    options,
  );
}
