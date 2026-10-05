/** The proj4 definition shared by RD New and RD Old. ol-free. */

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
 * convention, which is what proj4 expects.
 */
export function buildRDProj4(x0: number, y0: number): string {
  return (
    '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 ' +
    `+x_0=${x0} +y_0=${y0} +ellps=bessel ` +
    '+towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.87740,4.0725 ' +
    '+nadgrids=@rdtrans2018,@null +units=m +no_defs +type=crs'
  );
}
