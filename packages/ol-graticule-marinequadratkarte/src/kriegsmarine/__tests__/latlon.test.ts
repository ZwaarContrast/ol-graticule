import { describe, it, expect } from 'vitest';
import { normalizeLon } from '@zwaarcontrast/ol-graticule';
import {
  smallestLonDiff,
  lonRange,
  latRange,
  simpleRhumbDivision,
  roundTo,
} from '../latlon.js';

const DEG_TO_RAD = Math.PI / 180;

describe('latlon helpers', () => {
  describe('normalizeLon', () => {
    it('normalizes 181 to -179', () => {
      expect(normalizeLon(181)).toBe(-179);
    });
    it('normalizes -181 to 179', () => {
      expect(normalizeLon(-181)).toBe(179);
    });
    it('leaves normal values unchanged', () => {
      expect(normalizeLon(45)).toBe(45);
      expect(normalizeLon(-90)).toBe(-90);
    });
    it('handles exact boundary values', () => {
      expect(normalizeLon(180)).toBe(180);
      expect(normalizeLon(-180)).toBe(-180);
    });
    it('normalizes values beyond ±360', () => {
      expect(normalizeLon(541)).toBe(-179);
      expect(normalizeLon(-541)).toBe(179);
      expect(normalizeLon(720)).toBe(0);
    });
    it('normalizes large positive values', () => {
      expect(normalizeLon(900)).toBe(180);
    });
    it('normalizes large negative values', () => {
      expect(normalizeLon(-900)).toBe(-180);
    });
  });

  describe('smallestLonDiff', () => {
    it('returns direct difference for non-wrapping case', () => {
      const diff = smallestLonDiff(10 * DEG_TO_RAD, 20 * DEG_TO_RAD);
      expect(diff).toBeCloseTo(10 * DEG_TO_RAD, 10);
    });
    it('crosses anti-meridian for shorter path', () => {
      const diff = smallestLonDiff(170 * DEG_TO_RAD, -170 * DEG_TO_RAD);
      expect(diff).toBeCloseTo(20 * DEG_TO_RAD, 10);
    });
    it('returns negative difference going west', () => {
      const diff = smallestLonDiff(20 * DEG_TO_RAD, 10 * DEG_TO_RAD);
      expect(diff).toBeCloseTo(-10 * DEG_TO_RAD, 10);
    });
    it('anti-meridian crossing going west', () => {
      const diff = smallestLonDiff(-170 * DEG_TO_RAD, 170 * DEG_TO_RAD);
      expect(diff).toBeCloseTo(-20 * DEG_TO_RAD, 10);
    });
    it('returns zero for same longitude', () => {
      const diff = smallestLonDiff(45 * DEG_TO_RAD, 45 * DEG_TO_RAD);
      expect(diff).toBeCloseTo(0, 10);
    });
  });

  describe('lonRange', () => {
    it('divides longitude range into equal parts', () => {
      const result = lonRange(10, 40, 3);
      expect(result).toHaveLength(4); // 3 divisions + endpoint
      expect(result[0]).toBe(10);
      expect(result[1]).toBeCloseTo(20);
      expect(result[2]).toBeCloseTo(30);
      expect(result[3]).toBe(40);
    });
    it('handles anti-meridian crossing (east to west)', () => {
      const result = lonRange(175, -175, 2);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(175);
      expect(result[2]).toBe(-175);
      // Middle point should be at 180 or -180
      expect(Math.abs(result[1]!)).toBeCloseTo(180);
    });
    it('handles anti-meridian crossing (west to east)', () => {
      const result = lonRange(-175, 175, 2);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(-175);
      expect(result[2]).toBe(175);
    });
    it('single division', () => {
      const result = lonRange(0, 10, 1);
      expect(result).toEqual([0, 10]);
    });
    it('negative to positive range', () => {
      const result = lonRange(-10, 10, 2);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(-10);
      expect(result[1]).toBeCloseTo(0);
      expect(result[2]).toBe(10);
    });
  });

  describe('latRange', () => {
    it('divides latitude range into equal parts', () => {
      const result = latRange(60, 30, 3);
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(60);
      expect(result[1]).toBe(50);
      expect(result[2]).toBe(40);
      expect(result[3]).toBe(30);
    });
    it('ascending latitude', () => {
      const result = latRange(-10, 20, 3);
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(-10);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(10);
      expect(result[3]).toBe(20);
    });
    it('single division', () => {
      const result = latRange(50, 40, 1);
      expect(result).toEqual([50, 40]);
    });
  });

  describe('simpleRhumbDivision', () => {
    it('divides horizontal line', () => {
      const result = simpleRhumbDivision([50, 10], [50, 40], 3);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([50, 10]);
      expect(result[3]).toEqual([50, 40]);
    });
    it('divides vertical line', () => {
      const result = simpleRhumbDivision([60, 10], [30, 10], 3);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual([60, 10]);
      expect(result[3]).toEqual([30, 10]);
    });
    it('throws on diagonal line', () => {
      expect(() => simpleRhumbDivision([60, 10], [30, 40], 3)).toThrow();
    });
    it('handles anti-meridian horizontal line', () => {
      const result = simpleRhumbDivision([50, 175], [50, -175], 2);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([50, 175]);
      expect(result[2]).toEqual([50, -175]);
    });
  });

  describe('roundTo', () => {
    it('rounds to specified decimal places', () => {
      expect(roundTo(3, 1.23456)).toBe(1.235);
      expect(roundTo(0, 1.5)).toBe(2);
      expect(roundTo(2, -3.456)).toBe(-3.46);
    });
    it('rounds to zero decimal places', () => {
      expect(roundTo(0, 3.7)).toBe(4);
      expect(roundTo(0, 3.3)).toBe(3);
    });
    it('handles already-rounded values', () => {
      expect(roundTo(2, 1.23)).toBe(1.23);
    });
  });

});
