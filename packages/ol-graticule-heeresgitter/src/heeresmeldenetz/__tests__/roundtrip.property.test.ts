import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { encodeHmn } from '../encode.js';
import { parseHmn } from '../decode.js';

// Cover most of the populated central-European DHG band where every
// 6-km HMN Kleinquadrat exists in the lattice. Stay clear of the
// equator and high latitudes where the Bessel + Gauß-Krüger projection
// stretches significantly. The existing unit tests pin specific named
// points (Kolosjoki, Hadres, Berlin).
const lat = fc.double({ min: 45, max: 68, noNaN: true, noDefaultInfinity: true });
const lon = fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true });

describe('HMN encode → parse round-trip property', () => {
  it('parse(encode(p), { grossquadrat }).center recovers p within the cell', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const ref = encodeHmn([latV, lonV], { depth: 5 });
        const parsed = parseHmn(ref.canonical, { grossquadrat: ref.grossquadrat });
        if (!parsed) return true;
        const [centreLat, centreLon] = parsed.center;
        // Depth 5 tenths cells are 100 m. At these latitudes 100 m ≈ 0.001°.
        // Worst-case round-trip distance is one tenth-cell, so we bound
        // with a generous 0.002°.
        expect(Math.abs(centreLat - latV)).toBeLessThan(0.002);
        expect(Math.abs(centreLon - lonV)).toBeLessThan(0.002);
      }),
      { numRuns: 100 },
    );
  });

  it('canonical text matches "XX d[a-d] dd" shape at depth 5', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const ref = encodeHmn([latV, lonV], { depth: 5 });
        expect(ref.canonical).toMatch(/^[A-HJ-Z]{2} \d[a-d] \d{2}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('cell area shrinks monotonically with depth (5 < 4 < 3 < 2)', () => {
    fc.assert(
      fc.property(lat, lon, (latV, lonV) => {
        const area = (bbox: readonly number[]): number =>
          (bbox[2]! - bbox[0]!) * (bbox[3]! - bbox[1]!);
        const a2 = area(encodeHmn([latV, lonV], { depth: 2 }).bbox);
        const a3 = area(encodeHmn([latV, lonV], { depth: 3 }).bbox);
        const a4 = area(encodeHmn([latV, lonV], { depth: 4 }).bbox);
        const a5 = area(encodeHmn([latV, lonV], { depth: 5 }).bbox);
        // Each successive cell must be a strict refinement: smaller or equal
        // (equal only allowed under float-rounding noise, hence 1e-12).
        expect(a2).toBeGreaterThan(a3 - 1e-12);
        expect(a3).toBeGreaterThan(a4 - 1e-12);
        expect(a4).toBeGreaterThan(a5 - 1e-12);
        // Sanity: depth 2 (Kleinquadrat, 6 km) is at least ~3000× larger
        // than depth 5 (tenths, 100 m) by area.
        expect(a2 / a5).toBeGreaterThan(3000);
      }),
      { numRuns: 50 },
    );
  });
});
