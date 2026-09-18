/** OpenLayers grid-system factory for RDOld; the zone data itself is ol-free in `RDOld.ts`. */

import type { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { createRDGridSystem, type RDGridSystemOptions } from './shared.js';
import {
  RD_OLD_CRS,
  RD_OLD_PROJ4,
  RD_OLD_EXTENT,
  RD_OLD_CLIP_POLYGON,
} from './RDOld.js';

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
