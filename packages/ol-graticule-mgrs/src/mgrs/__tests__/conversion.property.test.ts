import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  lonLatToMgrsParts,
  lonLatToMgrs,
  lonLatToUtm,
  utmToLonLat,
  formatMgrs,
} from '../conversion.js';
import { zoneNumberFromLonLat } from '../zones.js';

// UTM band (excluding the polar caps and a small antimeridian fuzz to avoid
// flapping right on zone boundaries).
const utmLat = fc.double({ min: -78, max: 82, noNaN: true, noDefaultInfinity: true });
const safeLon = fc.double({ min: -179, max: 179, noNaN: true, noDefaultInfinity: true });

describe('UTM forward/back round-trip (property)', () => {
  it('utmToLonLat(lonLatToUtm(p)) ≈ p inside the UTM band', () => {
    fc.assert(
      fc.property(safeLon, utmLat, (lonV, latV) => {
        const zone = zoneNumberFromLonLat(lonV, latV);
        const { easting, northing } = lonLatToUtm(lonV, latV, zone);
        const [backLon, backLat] = utmToLonLat(zone, easting, northing, latV < 0);
        expect(Math.abs(backLat - latV)).toBeLessThan(1e-6);
        expect(Math.abs(backLon - lonV)).toBeLessThan(1e-5);
      }),
      { numRuns: 200 },
    );
  });
});

describe('MGRS format shape (property)', () => {
  it('lonLatToMgrs at precision 5 always matches the canonical regex', () => {
    fc.assert(
      fc.property(safeLon, utmLat, (lonV, latV) => {
        const mgrs = lonLatToMgrs(lonV, latV, 5);
        expect(mgrs).toMatch(/^\d{1,2}[A-Z] [A-Z]{2} \d{5} \d{5}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('lonLatToMgrsParts and formatMgrs agree on the textual form', () => {
    fc.assert(
      fc.property(safeLon, utmLat, (lonV, latV) => {
        const parts = lonLatToMgrsParts(lonV, latV);
        if (!parts) return true;
        const direct = lonLatToMgrs(lonV, latV, 5);
        expect(formatMgrs(parts, 5)).toBe(direct);
      }),
      { numRuns: 100 },
    );
  });
});
