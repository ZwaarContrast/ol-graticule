import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { encodeHmnGeo } from '../encode.js';
import { parseHmnGeo } from '../decode.js';

// Sample populated latitudes (north of the 0°40'N anchor) and a
// pan-European/Soviet longitude band where every Großtrapez in the
// lattice exists. Keep clear of 0°E (the prime meridian Großtrapez
// boundary) and of 0°40'N (the anchor parallel).
const lat = fc.double({ min: 5, max: 75, noNaN: true, noDefaultInfinity: true });
const lon = fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true });

describe('Geographic HMN encode → parse round-trip property', () => {
  it('parse(encode(p), { grosstrapez }).center recovers p within ½ cell', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const ref = encodeHmnGeo([latV, lonV], { depth: 5 });
        const parsed = parseHmnGeo(ref.canonical, { grosstrapez: ref.grosstrapez });
        if (!parsed) return true;
        const [centreLat, centreLon] = parsed.center;
        // Depth-5 cell is 6″ lon × 4″ lat. The centre lies exactly at the
        // cell midpoint, so the worst-case |input − centre| is ½ cell.
        // Half a tenth-cell: 2″ lat = 5.56e-4°, 3″ lon = 8.33e-4°.
        expect(Math.abs(centreLat - latV)).toBeLessThan(5.6e-4);
        expect(Math.abs(centreLon - lonV)).toBeLessThan(8.4e-4);
      }),
      { numRuns: 100 },
    );
  });

  it('canonical text matches the depth-5 grammar', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const ref = encodeHmnGeo([latV, lonV], { depth: 5 });
        expect(ref.canonical).toMatch(/^[A-HJ-Z]{2} \d[a-d] \d{2}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('bbox always contains the input point', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const ref = encodeHmnGeo([latV, lonV], { depth: 5 });
        const [minLon, minLat, maxLon, maxLat] = ref.bbox;
        expect(latV).toBeGreaterThanOrEqual(minLat - 1e-9);
        expect(latV).toBeLessThanOrEqual(maxLat + 1e-9);
        expect(lonV).toBeGreaterThanOrEqual(minLon - 1e-9);
        expect(lonV).toBeLessThanOrEqual(maxLon + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});
