import { describe, it, expect } from 'vitest';
import { MetricFormatter } from '../MetricFormatter.js';
import { ParseError } from '../../util/ParseError.js';

describe('MetricFormatter', () => {
  const formatter = new MetricFormatter();

  it('formats small values as meters', () => {
    expect(formatter.format(500)).toBe('500 m');
  });

  it('formats zero', () => {
    expect(formatter.format(0)).toBe('0 m');
  });

  it('formats values at 1000 as km', () => {
    expect(formatter.format(1000)).toBe('1 km');
  });

  it('formats large values as km', () => {
    expect(formatter.format(50000)).toBe('50 km');
  });

  it('formats fractional km', () => {
    expect(formatter.format(2500)).toBe('2.5 km');
  });

  it('formats negative meters', () => {
    expect(formatter.format(-200)).toBe('-200 m');
  });

  it('formats negative km', () => {
    expect(formatter.format(-5000)).toBe('-5 km');
  });

  it('formats decimal meters', () => {
    expect(formatter.format(1.5)).toBe('1.5 m');
  });

  describe('with unit: ft', () => {
    const ft = new MetricFormatter({ unit: 'ft' });

    it('formats small values as feet', () => {
      expect(ft.format(500)).toBe('500 ft');
    });

    it('does NOT roll over to "kft" at 1000', () => {
      expect(ft.format(1000)).toBe('1000 ft');
      expect(ft.format(10000)).toBe('10000 ft');
    });

    it('formats fractional feet', () => {
      expect(ft.format(2.5)).toBe('2.5 ft');
    });

    it('formats negative feet', () => {
      expect(ft.format(-500)).toBe('-500 ft');
    });
  });

  describe('with unit: us-ft', () => {
    const usFt = new MetricFormatter({ unit: 'us-ft' });

    it('labels as us-ft', () => {
      expect(usFt.format(5280)).toBe('5280 us-ft');
    });
  });

  describe('memoization', () => {
    it('returns the same string instance for repeat values (cache hit)', () => {
      const f = new MetricFormatter();
      const first = f.format(2500);
      const second = f.format(2500);
      expect(Object.is(first, second)).toBe(true);
    });
  });

  describe('parse', () => {
    it('round-trips metric format output', () => {
      const f = new MetricFormatter();
      for (const v of [0, 500, 1000, 2500, 50000, -200, -5000, 1.5]) {
        const text = f.format(v);
        expect(f.parse(text)).toBeCloseTo(v, 6);
      }
    });

    it('parses lenient variants', () => {
      const f = new MetricFormatter();
      expect(f.parse('1234.5 m')).toBeCloseTo(1234.5, 6);
      expect(f.parse('1234.5m')).toBeCloseTo(1234.5, 6);
      expect(f.parse('1.2345 km')).toBeCloseTo(1234.5, 6);
      expect(f.parse('1.2345km')).toBeCloseTo(1234.5, 6);
      expect(f.parse('-1234.5 m')).toBeCloseTo(-1234.5, 6);
      expect(f.parse('1234.5')).toBeCloseTo(1234.5, 6);
      expect(f.parse('1,234.5 m')).toBeCloseTo(1234.5, 6);
    });

    it('round-trips ft format output', () => {
      const ft = new MetricFormatter({ unit: 'ft' });
      for (const v of [500, 1000, 2.5, -500]) {
        expect(ft.parse(ft.format(v))).toBeCloseTo(v, 6);
      }
    });

    it('round-trips us-ft format output', () => {
      const usFt = new MetricFormatter({ unit: 'us-ft' });
      expect(usFt.parse(usFt.format(5280))).toBeCloseTo(5280, 6);
      expect(usFt.parse('5280 us-ft')).toBeCloseTo(5280, 6);
      expect(usFt.parse('5280 us ft')).toBeCloseTo(5280, 6);
    });

    it('rejects mismatched unit', () => {
      const f = new MetricFormatter();
      expect(() => f.parse('1234 ft')).toThrow(ParseError);
      const ft = new MetricFormatter({ unit: 'ft' });
      expect(() => ft.parse('1234 m')).toThrow(ParseError);
      expect(() => ft.parse('1.234 km')).toThrow(ParseError);
    });

    it('throws ParseError on garbage', () => {
      const f = new MetricFormatter();
      expect(() => f.parse('')).toThrow(ParseError);
      expect(() => f.parse('hello')).toThrow(ParseError);
    });
  });

  describe('parseCoordinate', () => {
    it('handles whitespace pair without unit', () => {
      const f = new MetricFormatter();
      expect(f.parseCoordinate('155000 463000')).toEqual([155000, 463000]);
    });

    it('handles comma pair without unit', () => {
      const f = new MetricFormatter();
      expect(f.parseCoordinate('155000, 463000')).toEqual([155000, 463000]);
    });

    it('applies trailing km to both halves (whitespace pair)', () => {
      const f = new MetricFormatter();
      expect(f.parseCoordinate('155 463 km')).toEqual([155000, 463000]);
    });

    it('applies trailing km to both halves (comma pair)', () => {
      const f = new MetricFormatter();
      expect(f.parseCoordinate('155, 463 km')).toEqual([155000, 463000]);
    });

    it('applies trailing m to both halves', () => {
      const f = new MetricFormatter();
      expect(f.parseCoordinate('155000 463000 m')).toEqual([155000, 463000]);
    });

    it('respects per-half units when both halves carry one', () => {
      const f = new MetricFormatter();
      expect(f.parseCoordinate('1.5 km, 2 km')).toEqual([1500, 2000]);
      expect(f.parseCoordinate('1234m 5678m')).toEqual([1234, 5678]);
    });

    it('round-trips formatCoordinate-style output (rounded values)', () => {
      const f = new MetricFormatter();
      // format() rounds to 1 decimal, pick values that survive that.
      for (const [x, y] of [[0, 0], [155000, 463000], [-1500, 5000]] as [number, number][]) {
        const text = `${f.format(x)} ${f.format(y)}`;
        const [px, py] = f.parseCoordinate(text);
        expect(px).toBeCloseTo(x, 0);
        expect(py).toBeCloseTo(y, 0);
      }
    });

    it('round-trips ft pair', () => {
      const ft = new MetricFormatter({ unit: 'ft' });
      expect(ft.parseCoordinate('500 1000 ft')).toEqual([500, 1000]);
    });

    it('throws ParseError on empty input', () => {
      const f = new MetricFormatter();
      expect(() => f.parseCoordinate('')).toThrow(ParseError);
      expect(() => f.parseCoordinate('   ')).toThrow(ParseError);
    });

    it('throws ParseError on three-token whitespace input without unit', () => {
      const f = new MetricFormatter();
      expect(() => f.parseCoordinate('155 463 789')).toThrow(ParseError);
    });

    it('throws ParseError on incompatible unit', () => {
      const f = new MetricFormatter();
      expect(() => f.parseCoordinate('500 1000 ft')).toThrow(ParseError);
    });
  });
});
