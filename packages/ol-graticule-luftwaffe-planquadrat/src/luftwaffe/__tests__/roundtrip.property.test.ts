import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { encodeGnmv, encodeJmn } from '../encode.js';
import { parseGnmvRef, parseJmnRef } from '../decode.js';

// Restrict to populated mid-latitudes. We stay clear of every JMN/GNMV
// cell boundary at the 1' arcminute step that the encoder uses, because
// Math.floor flips at exact boundaries and a 1e-16 offset would map a
// point to a neighbour cell. The existing unit tests pin boundary
// behaviour explicitly. Property tests sample cell *interiors*.
function awayFromCellBoundary(v: number): boolean {
  const arcmin = v * 60;
  const frac = arcmin - Math.floor(arcmin);
  return frac > 0.05 && frac < 0.95;
}

const lat = fc.double({ min: 5, max: 80, noNaN: true, noDefaultInfinity: true })
  .filter(awayFromCellBoundary);
const lon = fc.double({ min: -160, max: 160, noNaN: true, noDefaultInfinity: true })
  .filter(awayFromCellBoundary);

describe('GNMV encode → parse round-trip', () => {
  it('parse(encode(p)).bbox contains p at depth 1 (Großtrapez)', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const encoded = encodeGnmv([latV, lonV], 'post-1943', 1);
        if (encoded === undefined) return true;
        const decoded = parseGnmvRef(encoded);
        const [minLon, minLat, maxLon, maxLat] = decoded.bbox;
        expect(latV).toBeGreaterThanOrEqual(minLat - 1e-9);
        expect(latV).toBeLessThanOrEqual(maxLat + 1e-9);
        expect(lonV).toBeGreaterThanOrEqual(minLon - 1e-9);
        expect(lonV).toBeLessThanOrEqual(maxLon + 1e-9);
      }),
      { numRuns: 200 },
    );
  });

  it('cell area shrinks monotonically as depth increases (5 ≤ 4 ≤ 3 ≤ 2 ≤ 1)', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const refs = [1, 2, 3, 4, 5].map((d) => encodeGnmv([latV, lonV], 'post-1943', d));
        if (refs.some((r) => r === undefined)) return true;
        const areas = refs.map((r) => {
          const bbox = parseGnmvRef(r!).bbox;
          return (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
        });
        for (let i = 0; i < areas.length - 1; i++) {
          expect(
            areas[i]!,
            `depth ${i + 1} area should be ≥ depth ${i + 2} area`,
          ).toBeGreaterThanOrEqual(areas[i + 1]! - 1e-12);
        }
        // GT (1°×1°) vs AT (~33"×1'07") at depth 5: factor ~3500.
        expect(areas[0]! / areas[4]!).toBeGreaterThan(1000);
      }),
      { numRuns: 100 },
    );
  });
});

describe('JMN encode → parse round-trip', () => {
  // Depth 1 (Jagdtrapez half = 5° lat × 10° lon). Deeper levels divide each
  // axis into 1/400 arcsecond fractions where any sub-microdegree drift can
  // tip the input across a cell boundary, so they're tested explicitly with
  // pinned coordinates in encode.test.ts and not via property testing.
  it('parse(encode(p)).bbox contains p at depth 1', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const encoded = encodeJmn([latV, lonV], 1);
        if (encoded === undefined) return true;
        const decoded = parseJmnRef(encoded);
        const [minLon, minLat, maxLon, maxLat] = decoded.bbox;
        expect(latV).toBeGreaterThanOrEqual(minLat - 1e-9);
        expect(latV).toBeLessThanOrEqual(maxLat + 1e-9);
        expect(lonV).toBeGreaterThanOrEqual(minLon - 1e-9);
        expect(lonV).toBeLessThanOrEqual(maxLon + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});

describe('GNMV format invariants', () => {
  it('depth=0 output is always the ZZG token only', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const encoded = encodeGnmv([latV, lonV], 'post-1943', 0);
        if (encoded === undefined) return true;
        expect(encoded).toMatch(/^\d+[A-Z]+$/);
      }),
      { numRuns: 100 },
    );
  });

  it('depth=5 output adds exactly four trailing digits beyond depth=1', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const d1 = encodeGnmv([latV, lonV], 'post-1943', 1);
        const d5 = encodeGnmv([latV, lonV], 'post-1943', 5);
        if (!d1 || !d5) return true;
        expect(d5.length).toBe(d1.length + 4);
      }),
      { numRuns: 100 },
    );
  });
});
