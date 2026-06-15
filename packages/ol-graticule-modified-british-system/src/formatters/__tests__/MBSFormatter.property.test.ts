import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import { MBSFormatter } from '../MBSFormatter.js';
import {
  BRITISH_CASSINI_SCHEME,
  NORD_DE_GUERRE_SCHEME,
  SCANDINAVIAN_ZONE_3_SCHEME,
} from '../schemes.js';
import type { MBSLetterScheme } from '../schemes.js';

const SCHEMES: Array<[string, MBSLetterScheme]> = [
  ['Nord de Guerre', NORD_DE_GUERRE_SCHEME],
  ['British Cassini', BRITISH_CASSINI_SCHEME],
  ['Scandinavian Zone 3', SCANDINAVIAN_ZONE_3_SCHEME],
];

describe.each(SCHEMES)('%s — round-trip property', (label, scheme) => {
  const formatter = new MBSFormatter(scheme);
  const baseE = scheme.eOriginKm * 1000;
  const baseN = scheme.nOriginKm * 1000;
  // Sample inside the populated 2500 km × 2500 km tile, avoiding the very
  // edge of any 100 km cell to dodge boundary flap.
  const e = fc.double({ min: baseE + 5_000, max: baseE + 2_495_000, noNaN: true, noDefaultInfinity: true });
  const n = fc.double({ min: baseN + 5_000, max: baseN + 2_495_000, noNaN: true, noDefaultInfinity: true });

  it('parseCoordinate(formatMBS(e, n)) recovers (e, n) to within one 100 m sub-cell', () => {
    fc.assert(
      fc.property(e, n, (eV, nV) => {
        const text = formatter.formatMBS(eV, nV);
        // Skip points that the scheme renders as bare metric (outside grid).
        if (!/^[a-zA-Z]/.test(text)) return true;
        const [eBack, nBack] = formatter.parseCoordinate(text);
        // formatMBS rounds to the nearest 100 m (pad3 → 3 digits) and
        // parseCoordinate returns the SW corner of the 100 m sub-cell, so
        // the worst-case round-trip difference is one sub-cell (100 m).
        expect(Math.abs(eBack - eV)).toBeLessThanOrEqual(100.5);
        expect(Math.abs(nBack - nV)).toBeLessThanOrEqual(100.5);
      }),
      { numRuns: 200 },
    );
  });

  it('compound output is exactly "<letter><letter> <3 digits> <3 digits>" for in-grid points', () => {
    fc.assert(
      fc.property(e, n, (eV, nV) => {
        const text = formatter.formatMBS(eV, nV);
        if (!/^[a-zA-Z]/.test(text)) return true;
        expect(text).toMatch(/^[a-zA-Z]{2} \d{3} \d{3}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('case-insensitive parse returns the same coordinate as uppercased input', () => {
    fc.assert(
      fc.property(e, n, (eV, nV) => {
        const text = formatter.formatMBS(eV, nV);
        if (!/^[a-zA-Z]/.test(text)) return true;
        const lower = formatter.parseCoordinate(text.toLowerCase());
        const upper = formatter.parseCoordinate(text.toUpperCase());
        expect(lower[0]).toBeCloseTo(upper[0], 6);
        expect(lower[1]).toBeCloseTo(upper[1], 6);
      }),
      { numRuns: 50 },
    );
  });
});

describe('parseCoordinate — robustness', () => {
  const formatter = new MBSFormatter(NORD_DE_GUERRE_SCHEME);

  it('resolves pathological whitespace input quickly (ReDoS guard)', () => {
    const evil = 'AA' + '\t'.repeat(50_000) + '!';
    const start = performance.now();
    expect(() => formatter.parseCoordinate(evil)).toThrow(ParseError);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('returns a finite pair or throws ParseError for any input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        try {
          const [e, n] = formatter.parseCoordinate(s);
          expect(Number.isFinite(e)).toBe(true);
          expect(Number.isFinite(n)).toBe(true);
        } catch (err) {
          expect(err).toBeInstanceOf(ParseError);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
