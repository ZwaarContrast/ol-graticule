import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { dms, dmsSigned } from '../dms.js';

describe('dms', () => {
  it('returns plain degrees when minutes and seconds are zero', () => {
    expect(dms(52, 0)).toBe(52);
    expect(dms(52, 0, 0)).toBe(52);
  });

  it('converts 52°04\'46" to ~52.0794° (Den Haag fixture)', () => {
    expect(dms(52, 4, 46)).toBeCloseTo(52.0794, 4);
  });

  it('handles fractional seconds', () => {
    expect(dms(0, 30, 0)).toBeCloseTo(0.5, 10);
    expect(dms(0, 0, 1800)).toBeCloseTo(0.5, 10);
  });

  it('seconds is additive with minutes (1 min == 60 sec)', () => {
    expect(dms(0, 1, 0)).toBeCloseTo(dms(0, 0, 60), 10);
  });

  it('property: equals the canonical decomposition deg + min/60 + sec/3600', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -179, max: 179 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (d, m, s) => {
          expect(dms(d, m, s)).toBeCloseTo(d + m / 60 + s / 3600, 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: 60-second carry — dms(d, m, 60) === dms(d, m+1, 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -89, max: 89 }),
        fc.integer({ min: 0, max: 58 }),
        (d, m) => {
          expect(dms(d, m, 60)).toBeCloseTo(dms(d, m + 1, 0), 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: 60-minute carry — dms(d, 60, s) === dms(d+1, 0, s)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -89, max: 89 }),
        fc.integer({ min: 0, max: 59 }),
        (d, s) => {
          expect(dms(d, 60, s)).toBeCloseTo(dms(d + 1, 0, s), 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: minute and second contributions sum the same as the equivalent total seconds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -179, max: 179 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (d, m, s) => {
          expect(dms(d, m, s)).toBeCloseTo(dms(d, 0, m * 60 + s), 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: monotone in minutes (d fixed, s fixed) — larger m → larger value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -179, max: 179 }),
        fc.integer({ min: 0, max: 58 }),
        fc.integer({ min: 0, max: 59 }),
        (d, m, s) => {
          expect(dms(d, m + 1, s)).toBeGreaterThan(dms(d, m, s));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: monotone in seconds (d fixed, m fixed) — larger s → larger value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -179, max: 179 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 58 }),
        (d, m, s) => {
          expect(dms(d, m, s + 1)).toBeGreaterThan(dms(d, m, s));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: default sec=0 — dms(d, m) === dms(d, m, 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -179, max: 179 }),
        fc.integer({ min: 0, max: 59 }),
        (d, m) => {
          expect(dms(d, m)).toBe(dms(d, m, 0));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('dmsSigned', () => {
  it('flips sign with sign=-1', () => {
    expect(dmsSigned(-1, 52, 4, 46)).toBeCloseTo(-dms(52, 4, 46), 10);
  });

  it('passes through with sign=+1', () => {
    expect(dmsSigned(1, 33, 51, 24)).toBeCloseTo(dms(33, 51, 24), 10);
  });

  it('property: dmsSigned(sign, ...) === sign * dms(...)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1 as const, -1 as const),
        fc.integer({ min: 0, max: 179 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (sign, d, m, s) => {
          expect(dmsSigned(sign, d, m, s)).toBeCloseTo(sign * dms(d, m, s), 10);
        },
      ),
      { numRuns: 100 },
    );
  });
});
