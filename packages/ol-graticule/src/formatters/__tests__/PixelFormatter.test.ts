import { describe, it, expect } from 'vitest';
import { PixelFormatter } from '../PixelFormatter.js';

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
});
