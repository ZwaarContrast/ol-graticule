import { PolygonClippedGridSystem } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
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
 * Build the `sterea` proj4 definition shared by RD New and RD Old. The two
 * differ only in their false easting/northing; everything else (towgs84
 * rotations, nadgrid stack, bessel ellipsoid) is identical.
 *
 * `+nadgrids=@rdtrans2018,@null` attempts the RDNAPTRANS 2018 NTv2 grid first
 * (registered by {@link registerRDNAPTRANS2018}). If absent, proj4 falls back
 * to the `+towgs84` 7-parameter Helmert transform (EPSG:4833, ~1 m residual
 * across NL) instead of silently degrading to identity (~100 m error).
 *
 * The `+towgs84` values are EPSG:4833's rotations converted from microradians
 * to arc-seconds and sign-flipped from Coordinate Frame to Position Vector
 * convention — which is what proj4 expects.
 */
export function buildRDProj4(x0: number, y0: number): string {
  return (
    '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 ' +
    `+x_0=${x0} +y_0=${y0} +ellps=bessel ` +
    '+towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.87740,4.0725 ' +
    '+nadgrids=@rdtrans2018,@null +units=m +no_defs +type=crs'
  );
}

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
