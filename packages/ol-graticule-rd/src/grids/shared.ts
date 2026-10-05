import { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import {
  ProjectedGridSystem,
  registerCRS,
} from '@zwaarcontrast/ol-graticule-projected';
import type { ProjectedGridSystemOptions } from '@zwaarcontrast/ol-graticule-projected';
import { registerRDNAPTRANS2018 } from '../rdnaptrans.js';

/**
 * Options accepted by the RD New / RD Old factories. The CRS/proj4/extent
 * fields are fixed by the factory; `clipPolygon` overrides the default NL
 * area-of-use polygon and is forwarded to the wrapping
 * {@link PolygonClippedGridSystem}. Everything else flows through to the
 * inner {@link ProjectedGridSystem}.
 */
export type RDGridSystemOptions = Omit<
  ProjectedGridSystemOptions,
  'crs' | 'proj4Def' | 'extent'
> & {
  /**
   * Override the default area-of-use polygon for this grid. Coordinates are
   * in the grid's native metres (RD New: EPSG:28992, RD Old: EPSG:28991).
   * Omit to use the package-default NL polygon.
   */
  clipPolygon?: [number, number][] | undefined;
};

/**
 * Shared implementation for `createRDNewGridSystem` / `createRDOldGridSystem`.
 * Registers the RDNAPTRANS 2018 grid and the CRS, constructs a no-clip
 * {@link ProjectedGridSystem} in the inner position, and wraps it with
 * {@link PolygonClippedGridSystem} so the NL area-of-use polygon is clipped
 * geometrically (no cell-staircase outline) and emitted as a first-class
 * boundary feature.
 */
export function createRDGridSystem(
  crs: string,
  proj4Def: string,
  extent: [number, number, number, number],
  defaultClipPolygon: [number, number][],
  options?: RDGridSystemOptions,
): PolygonClippedGridSystem {
  registerRDNAPTRANS2018();
  registerCRS(crs, proj4Def);

  const { clipPolygon: clipOverride, ...projOptions } = options ?? {};
  const inner = new ProjectedGridSystem({
    ...projOptions,
    crs,
    extent,
  });

  return new PolygonClippedGridSystem({
    source: inner,
    clipPolygon: {
      rings: [clipOverride ?? defaultClipPolygon],
      crs,
    },
  });
}
