import { describe, it, expect } from 'vitest';
import { splitCoordinatePair, parsePairViaFormatter } from '../parseCoordinatePair.js';
import { ParseError } from '../ParseError.js';
import type { LabelFormatter } from '../../types.js';

describe('splitCoordinatePair', () => {
  it('splits on comma', () => {
    expect(splitCoordinatePair('1, 2')).toEqual(['1', '2']);
    expect(splitCoordinatePair('1,2')).toEqual(['1', '2']);
  });

  it('splits on whitespace when no comma', () => {
    expect(splitCoordinatePair('1 2')).toEqual(['1', '2']);
    expect(splitCoordinatePair('1   2')).toEqual(['1', '2']);
  });

  it('trims surrounding whitespace', () => {
    expect(splitCoordinatePair('  3 , 4  ')).toEqual(['3', '4']);
  });

  it('preserves internal whitespace within a half (DMS like "52 4 46")', () => {
    expect(splitCoordinatePair(`52°N, 4°18'E`)).toEqual([`52°N`, `4°18'E`]);
  });

  it('throws ParseError on empty input', () => {
    expect(() => splitCoordinatePair('')).toThrow(ParseError);
    expect(() => splitCoordinatePair('   ')).toThrow(ParseError);
  });

  it('throws ParseError when comma split yields wrong number of parts', () => {
    expect(() => splitCoordinatePair('1, 2, 3')).toThrow(ParseError);
  });

  it('throws ParseError when comma split has empty side', () => {
    expect(() => splitCoordinatePair('1,')).toThrow(ParseError);
    expect(() => splitCoordinatePair(',2')).toThrow(ParseError);
  });

  it('throws ParseError when whitespace split does not yield exactly two tokens', () => {
    expect(() => splitCoordinatePair('1 2 3')).toThrow(ParseError);
    expect(() => splitCoordinatePair('only-one-token')).toThrow(ParseError);
  });
});

describe('parsePairViaFormatter', () => {
  it('delegates to parseCoordinate when available', () => {
    const fmt: LabelFormatter = {
      format: (n) => String(n),
      parseCoordinate: (text) => {
        expect(text).toBe('compound input');
        return [10, 20];
      },
    };
    expect(parsePairViaFormatter(fmt, 'compound input')).toEqual([10, 20]);
  });

  it('falls back to splitting and per-axis parse', () => {
    const fmt: LabelFormatter = {
      format: (n) => String(n),
      parse: (text, axis) => {
        if (axis === 'x') return Number(text) + 1;
        return Number(text) + 100;
      },
    };
    expect(parsePairViaFormatter(fmt, '5, 7')).toEqual([6, 107]);
  });

  it('throws ParseError when formatter exposes neither parse method', () => {
    const fmt: LabelFormatter = { format: (n) => String(n) };
    expect(() => parsePairViaFormatter(fmt, '1, 2')).toThrow(ParseError);
  });

  it('propagates ParseError from splitCoordinatePair when only parse is available', () => {
    const fmt: LabelFormatter = {
      format: (n) => String(n),
      parse: (t) => Number(t),
    };
    expect(() => parsePairViaFormatter(fmt, '')).toThrow(ParseError);
  });
});
