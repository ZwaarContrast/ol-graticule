import { describe, it, expect } from 'vitest';
import { DegreeFormatter } from '../DegreeFormatter.js';
import { ParseError } from '../../util/ParseError.js';

describe('DegreeFormatter', () => {
  describe('DMS format', () => {
    const formatter = new DegreeFormatter('dms');

    it('formats positive longitude as East', () => {
      expect(formatter.format(5.5, 'x')).toBe('5\u00B030\u203200\u2033E');
    });

    it('formats negative longitude as West', () => {
      expect(formatter.format(-5.5, 'x')).toBe('5\u00B030\u203200\u2033W');
    });

    it('formats positive latitude as North', () => {
      expect(formatter.format(49.5, 'y')).toBe('49\u00B030\u203200\u2033N');
    });

    it('formats negative latitude as South', () => {
      expect(formatter.format(-33.25, 'y')).toBe('33\u00B015\u203200\u2033S');
    });

    it('formats zero longitude as East', () => {
      expect(formatter.format(0, 'x')).toBe('0\u00B000\u203200\u2033E');
    });

    it('formats zero latitude as North', () => {
      expect(formatter.format(0, 'y')).toBe('0\u00B000\u203200\u2033N');
    });

    it('formats whole degrees', () => {
      expect(formatter.format(10, 'x')).toBe('10\u00B000\u203200\u2033E');
    });

    it('formats degrees with minutes and seconds', () => {
      // 10.5086111... = 10° 30' 31"
      expect(formatter.format(10 + 30 / 60 + 31 / 3600, 'x')).toBe('10\u00B030\u203231\u2033E');
    });
  });

  describe('DD format', () => {
    const formatter = new DegreeFormatter('dd');

    it('formats whole degrees', () => {
      expect(formatter.format(45, 'y')).toBe('45\u00B0N');
    });

    it('formats decimal degrees', () => {
      expect(formatter.format(5.5, 'x')).toBe('5.5\u00B0E');
    });

    it('formats negative values with hemisphere', () => {
      expect(formatter.format(-120.75, 'x')).toBe('120.75\u00B0W');
    });
  });

  describe('DDM format', () => {
    const formatter = new DegreeFormatter('ddm');

    it('formats whole degrees', () => {
      expect(formatter.format(45, 'y')).toBe('45\u00B00\u2032N');
    });

    it('formats degrees and minutes', () => {
      expect(formatter.format(5.5, 'x')).toBe('5\u00B030\u2032E');
    });

    it('formats with decimal minutes', () => {
      expect(formatter.format(49.255, 'y')).toBe('49\u00B015.3\u2032N');
    });
  });

  describe('memoization', () => {
    it('returns the same string instance for repeat values (cache hit)', () => {
      const formatter = new DegreeFormatter('dms');
      const first = formatter.format(5.5, 'x');
      const second = formatter.format(5.5, 'x');
      expect(second).toBe(first);
      expect(Object.is(first, second)).toBe(true);
    });

    it('keeps x-axis and y-axis caches independent', () => {
      const formatter = new DegreeFormatter('dms');
      expect(formatter.format(0, 'x')).not.toBe(formatter.format(0, 'y'));
    });
  });

  describe('default format', () => {
    it('defaults to DMS', () => {
      const formatter = new DegreeFormatter();
      expect(formatter.format(10, 'x')).toBe('10\u00B000\u203200\u2033E');
    });
  });

  describe('parse', () => {
    const formatter = new DegreeFormatter();

    it('round-trips DMS format output', () => {
      for (const v of [5.5, -5.5, 49.5, -33.25, 10 + 30 / 60 + 31 / 3600]) {
        const text = formatter.format(v, 'x');
        expect(formatter.parse(text, 'x')).toBeCloseTo(v, 6);
      }
    });

    it('round-trips DD format output', () => {
      const dd = new DegreeFormatter('dd');
      for (const v of [45, 5.5, -120.75]) {
        const axis = v < 0 || v > 90 ? 'x' : 'y';
        const text = dd.format(v, axis);
        expect(dd.parse(text, axis)).toBeCloseTo(v, 4);
      }
    });

    it('round-trips DDM format output', () => {
      const ddm = new DegreeFormatter('ddm');
      for (const v of [45, 5.5, 49.255]) {
        const text = ddm.format(v, 'y');
        expect(ddm.parse(text, 'y')).toBeCloseTo(v, 6);
      }
    });

    it('parses lenient DMS variants', () => {
      expect(formatter.parse("50 37 2 N", 'y')).toBeCloseTo(50 + 37 / 60 + 2 / 3600, 6);
      expect(formatter.parse("50d37m02sN", 'y')).toBeCloseTo(50 + 37 / 60 + 2 / 3600, 6);
      expect(formatter.parse("N50 37 02", 'y')).toBeCloseTo(50 + 37 / 60 + 2 / 3600, 6);
      expect(formatter.parse("50\u00B037'02\"", 'y')).toBeCloseTo(50 + 37 / 60 + 2 / 3600, 6);
    });

    it('parses bare numbers (no hemisphere, no sign)', () => {
      expect(formatter.parse('50.6172', 'y')).toBeCloseTo(50.6172, 6);
      expect(formatter.parse('-50.6172', 'y')).toBeCloseTo(-50.6172, 6);
    });

    it('hemisphere takes precedence over leading sign', () => {
      expect(formatter.parse('-50.6172N', 'y')).toBeCloseTo(50.6172, 6);
    });

    it('routes hemisphere by axis', () => {
      expect(formatter.parse('5.5E', 'x')).toBeCloseTo(5.5, 6);
      expect(formatter.parse('5.5W', 'x')).toBeCloseTo(-5.5, 6);
      expect(formatter.parse('5.5N', 'y')).toBeCloseTo(5.5, 6);
      expect(formatter.parse('5.5S', 'y')).toBeCloseTo(-5.5, 6);
    });

    it('throws ParseError on empty input', () => {
      expect(() => formatter.parse('', 'x')).toThrow(ParseError);
      expect(() => formatter.parse('   ', 'x')).toThrow(ParseError);
    });

    it('throws ParseError on garbage', () => {
      expect(() => formatter.parse('hello', 'x')).toThrow(ParseError);
    });

    it('throws ParseError on multiple hemispheres', () => {
      expect(() => formatter.parse('50N E', 'x')).toThrow(ParseError);
    });

    it('throws ParseError when hemisphere mismatches axis', () => {
      expect(() => formatter.parse('50N', 'x')).toThrow(ParseError);
      expect(() => formatter.parse('50E', 'y')).toThrow(ParseError);
    });

    it('throws ParseError when minutes or seconds out of range', () => {
      expect(() => formatter.parse('50 70 0 N', 'y')).toThrow(ParseError);
      expect(() => formatter.parse('50 30 60 N', 'y')).toThrow(ParseError);
    });

    it('throws ParseError on too many numeric components', () => {
      expect(() => formatter.parse('1 2 3 4 N', 'y')).toThrow(ParseError);
    });
  });

  describe('parseCoordinate', () => {
    const formatter = new DegreeFormatter();

    it('default order is "lon lat" without hemisphere markers', () => {
      const [lon, lat] = formatter.parseCoordinate('4.35 50.85');
      expect(lon).toBeCloseTo(4.35, 6);
      expect(lat).toBeCloseTo(50.85, 6);
    });

    it('routes axes when first half carries N/S marker', () => {
      const [lon, lat] = formatter.parseCoordinate('50°51′N, 4°21′E');
      expect(lat).toBeCloseTo(50 + 51 / 60, 4);
      expect(lon).toBeCloseTo(4 + 21 / 60, 4);
    });

    it('routes axes when second half carries E/W marker but first has none', () => {
      const [lon, lat] = formatter.parseCoordinate('4°21′E 50°51′N');
      expect(lon).toBeCloseTo(4 + 21 / 60, 4);
      expect(lat).toBeCloseTo(50 + 51 / 60, 4);
    });

    it('handles negative pair without hemispheres', () => {
      const [lon, lat] = formatter.parseCoordinate('-4.5, -50.8');
      expect(lon).toBeCloseTo(-4.5, 6);
      expect(lat).toBeCloseTo(-50.8, 6);
    });

    it('throws ParseError on two-of-same-axis hemispheres', () => {
      expect(() => formatter.parseCoordinate('50N 4N')).toThrow(ParseError);
    });
  });
});
