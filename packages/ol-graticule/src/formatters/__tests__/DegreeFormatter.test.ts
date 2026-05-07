import { describe, it, expect } from 'vitest';
import { DegreeFormatter } from '../DegreeFormatter.js';

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
});
