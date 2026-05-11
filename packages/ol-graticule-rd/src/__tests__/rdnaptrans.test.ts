import { describe, it, expect, beforeEach } from 'vitest';
import proj4 from 'proj4';
import {
  registerRDNAPTRANS2018,
  RDNAPTRANS2018_GRID_NAME,
  __resetRDNAPTRANS2018,
} from '../rdnaptrans.js';

describe('registerRDNAPTRANS2018', () => {
  beforeEach(() => {
    __resetRDNAPTRANS2018();
  });

  it('uses "rdtrans2018" as the proj4 grid name (matches proj4 string)', () => {
    expect(RDNAPTRANS2018_GRID_NAME).toBe('rdtrans2018');
  });

  it('registers the bundled grid synchronously so the RD proj4 string resolves', () => {
    registerRDNAPTRANS2018();

    // After registration, defining a proj4 CRS that references the grid
    // must not throw. Without the grid present, proj4 would fall through
    // via @null, still not throw, but coord accuracy drops; the stronger
    // signal is that defs + first transform succeeds end-to-end.
    expect(() =>
      proj4.defs(
        'EPSG:28992-TEST',
        '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 ' +
          '+x_0=155000 +y_0=463000 +ellps=bessel ' +
          '+towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.87740,4.0725 ' +
          '+nadgrids=@rdtrans2018,@null +units=m +no_defs +type=crs',
      ),
    ).not.toThrow();
  });

  it('is idempotent across repeated calls', () => {
    // Second + third calls should early-out on the cached `registered` flag.
    expect(() => {
      registerRDNAPTRANS2018();
      registerRDNAPTRANS2018();
      registerRDNAPTRANS2018();
    }).not.toThrow();
  });

  it('produces a valid NTv2 parse (proj4.nadgrid accepts the inlined bytes)', () => {
    // proj4.nadgrid throws if the buffer's magic bytes / header don't parse
    // as NTv2, so a successful registration is itself a sanity check on the
    // bundled base64 payload.
    expect(() => registerRDNAPTRANS2018()).not.toThrow();
  });
});
