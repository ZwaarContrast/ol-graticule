import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { encodeDhg, encodeDhgText } from '../encode.js';
import { parseDhg, decodeDhg } from '../decode.js';

const lat = fc.double({ min: 45, max: 68, noNaN: true, noDefaultInfinity: true });
const lon = fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true });

describe('DHG forward/inverse projection round-trip', () => {
  it('decodeDhg(encodeDhg(p)) ≈ p in WGS 84 degrees', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const coord = encodeDhg([latV, lonV]);
        const [backLat, backLon] = decodeDhg(coord);
        expect(Math.abs(backLat - latV)).toBeLessThan(1e-6);
        expect(Math.abs(backLon - lonV)).toBeLessThan(1e-6);
      }),
      { numRuns: 200 },
    );
  });

  it('explicit Kennziffer override picks the requested zone', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const coord = encodeDhg([latV, lonV], 3);
        expect(coord.kennziffer).toBe(3);
      }),
      { numRuns: 50 },
    );
  });
});

describe('DHG text format round-trip', () => {
  it('parseDhg(encodeDhgText(p)) recovers the same coordinate', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const text = encodeDhgText([latV, lonV]);
        const parsed = parseDhg(text);
        expect(parsed).toBeDefined();
        // parseDhg rounds to integer km, so the result is a km-cell, not
        // the original metre-precision coord. Just check the zone matches
        // and the km coordinates round-trip cleanly.
        const original = encodeDhg([latV, lonV]);
        expect(parsed!.coord.kennziffer).toBe(original.kennziffer);
        expect(parsed!.coord.easting).toBe(Math.floor(original.easting / 1000) * 1000);
        expect(parsed!.coord.northing).toBe(Math.floor(original.northing / 1000) * 1000);
      }),
      { numRuns: 100 },
    );
  });
});
