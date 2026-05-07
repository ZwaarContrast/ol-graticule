import { describe, it, expect } from 'vitest';
import { MetricFormatter } from '../MetricFormatter.js';

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
});
