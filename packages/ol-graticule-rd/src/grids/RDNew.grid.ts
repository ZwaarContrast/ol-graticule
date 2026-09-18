/** OpenLayers grid-system factory for RDNew; the zone data itself is ol-free in `RDNew.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { createRDGridSystem, type RDGridSystemOptions } from './shared.js';
import {
  RD_NEW_CRS,
  RD_NEW_PROJ4,
  RD_NEW_EXTENT,
  RD_NEW_CLIP_POLYGON,
} from './RDNew.js';

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
