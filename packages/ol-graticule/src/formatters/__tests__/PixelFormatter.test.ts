import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PixelFormatter } from '../PixelFormatter.js';
import { ParseError } from '../../util/ParseError.js';

describe('PixelFormatter', () => {
  const formatter = new PixelFormatter();

  it('formats integer values', () => {
    expect(formatter.format(1234)).toBe('1234 px');
  });

  it('formats zero', () => {
    expect(formatter.format(0)).toBe('0 px');
  });

  it('rounds fractional values', () => {
    expect(formatter.format(99.7)).toBe('100 px');
  });

  it('formats negative values', () => {
    expect(formatter.format(-50)).toBe('-50 px');
  });

  it('rounds down when below .5', () => {
    expect(formatter.format(10.3)).toBe('10 px');
  });

  describe('memoization', () => {
    it('returns the same string instance for repeat values (cache hit)', () => {
      const f = new PixelFormatter();
      const first = f.format(250);
      const second = f.format(250);
      expect(Object.is(first, second)).toBe(true);
    });

    it('collapses nearby floats that round to the same integer key', () => {
      const f = new PixelFormatter();
      // 250.1 and 250.4 both round to 250 -> should share one cache entry.
      const a = f.format(250.1);
      const b = f.format(250.4);
      expect(Object.is(a, b)).toBe(true);
    });
  });

  describe('parse', () => {
    const f = new PixelFormatter();

    it('round-trips format output', () => {
      for (const v of [0, 100, 1234, -50]) {
        expect(f.parse(f.format(v))).toBe(v);
      }
    });

    it('parses lenient variants', () => {
      expect(f.parse('123')).toBe(123);
      expect(f.parse('123px')).toBe(123);
      expect(f.parse('123 px')).toBe(123);
      expect(f.parse('123 PX')).toBe(123);
      expect(f.parse('-50')).toBe(-50);
    });

    it('throws ParseError on garbage', () => {
      expect(() => f.parse('')).toThrow(ParseError);
      expect(() => f.parse('hello')).toThrow(ParseError);
    });
  });

  describe('parseCoordinate', () => {
    const f = new PixelFormatter();

    it('handles whitespace pair', () => {
      expect(f.parseCoordinate('800 600')).toEqual([800, 600]);
    });

    it('handles comma pair', () => {
      expect(f.parseCoordinate('800, 600')).toEqual([800, 600]);
    });

    it('handles trailing px on the pair', () => {
      expect(f.parseCoordinate('800 600 px')).toEqual([800, 600]);
    });

    it('handles per-half px', () => {
      expect(f.parseCoordinate('800px 600px')).toEqual([800, 600]);
    });

    it('throws ParseError on empty or three-token input', () => {
      expect(() => f.parseCoordinate('')).toThrow(ParseError);
      expect(() => f.parseCoordinate('1 2 3')).toThrow(ParseError);
    });
  });

  describe('robustness', () => {
    it('resolves pathological whitespace input quickly (ReDoS guard)', () => {
      const evil = '1' + ' '.repeat(50_000) + 'z';
      const start = Date.now();
      expect(() => formatter.parse(evil)).toThrow(ParseError);
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('returns a finite number or throws ParseError for any input', () => {
      fc.assert(
        fc.property(fc.string(), (s) => {
          try {
            expect(Number.isFinite(formatter.parse(s))).toBe(true);
          } catch (e) {
            expect(e).toBeInstanceOf(ParseError);
          }
        }),
        { numRuns: 1000 },
      );
    });
  });
});
