import { describe, it, expect } from 'vitest';
import {
  bandLatBounds,
  bandLetterFromLatitude,
  zoneBandLonBounds,
  zoneNumberFromLonLat,
} from '../zones.js';

describe('bandLetterFromLatitude', () => {
  it('returns C for the southernmost UTM band', () => {
    expect(bandLetterFromLatitude(-80)).toBe('C');
    expect(bandLetterFromLatitude(-72.0001)).toBe('C');
  });

  it('returns X for the widest northern band (12 deg tall)', () => {
    expect(bandLetterFromLatitude(72)).toBe('X');
    expect(bandLetterFromLatitude(83.999)).toBe('X');
  });

  it('skips I and O', () => {
    // Steps of 8 deg starting at -80; band index 8 → 'L', 9 → 'M', etc.
    // Indices 6 (skipping I) maps to 'J', so latitude band at lat=0 is N.
    expect(bandLetterFromLatitude(0)).toBe('N');
    // -8 to 0 = M
    expect(bandLetterFromLatitude(-7)).toBe('M');
    // 8 to 16 = P (no O)
    expect(bandLetterFromLatitude(10)).toBe('P');
  });

  it('returns undefined outside the UTM range', () => {
    expect(bandLetterFromLatitude(-81)).toBeUndefined();
    expect(bandLetterFromLatitude(84)).toBeUndefined();
    expect(bandLetterFromLatitude(NaN)).toBeUndefined();
  });
});

describe('zoneNumberFromLonLat', () => {
  it('returns the standard zone for a temperate longitude', () => {
    // London at lon=-0.1: zone 30.
    expect(zoneNumberFromLonLat(-0.1)).toBe(30);
    // Empire State Building at lon=-73.98: zone 18.
    expect(zoneNumberFromLonLat(-73.98)).toBe(18);
    // Sydney at lon=151.2: zone 56.
    expect(zoneNumberFromLonLat(151.2)).toBe(56);
  });

  it('clamps to zone 1 / zone 60 at the antimeridian', () => {
    expect(zoneNumberFromLonLat(-180)).toBe(1);
    expect(zoneNumberFromLonLat(179.999)).toBe(60);
  });

  it('applies the Norway exception (32V)', () => {
    expect(zoneNumberFromLonLat(4, 60)).toBe(32);
    expect(zoneNumberFromLonLat(11.99, 60)).toBe(32);
    // Outside the exception band keeps the standard zone.
    expect(zoneNumberFromLonLat(4, 55.99)).toBe(31);
    expect(zoneNumberFromLonLat(4, 64)).toBe(31);
  });

  it('applies the Svalbard exceptions (no 32X / 34X / 36X)', () => {
    expect(zoneNumberFromLonLat(8.99, 75)).toBe(31); // 0..9 -> 31
    expect(zoneNumberFromLonLat(15, 75)).toBe(33);   // 9..21 -> 33
    expect(zoneNumberFromLonLat(28, 75)).toBe(35);   // 21..33 -> 35
    expect(zoneNumberFromLonLat(40, 75)).toBe(37);   // 33..42 -> 37
  });
});

describe('zoneBandLonBounds', () => {
  it('returns standard 6-deg-wide bounds for non-exception cells', () => {
    expect(zoneBandLonBounds(31, 'U')).toEqual([0, 6]);
    expect(zoneBandLonBounds(60, 'N')).toEqual([174, 180]);
  });

  it('widens 32V / narrows 31V for the Norway exception', () => {
    expect(zoneBandLonBounds(31, 'V')).toEqual([0, 3]);
    expect(zoneBandLonBounds(32, 'V')).toEqual([3, 12]);
  });

  it('applies the Svalbard widenings and drops 32X/34X/36X', () => {
    expect(zoneBandLonBounds(31, 'X')).toEqual([0, 9]);
    expect(zoneBandLonBounds(33, 'X')).toEqual([9, 21]);
    expect(zoneBandLonBounds(35, 'X')).toEqual([21, 33]);
    expect(zoneBandLonBounds(37, 'X')).toEqual([33, 42]);
    expect(zoneBandLonBounds(32, 'X')).toBeUndefined();
    expect(zoneBandLonBounds(34, 'X')).toBeUndefined();
    expect(zoneBandLonBounds(36, 'X')).toBeUndefined();
  });
});

describe('bandLatBounds', () => {
  it('returns 8 deg bounds for normal bands', () => {
    expect(bandLatBounds('C')).toEqual([-80, -72]);
    expect(bandLatBounds('N')).toEqual([0, 8]);
  });
  it('returns 12 deg bounds for X', () => {
    expect(bandLatBounds('X')).toEqual([72, 84]);
  });
  it('returns undefined for unknown letters', () => {
    expect(bandLatBounds('I')).toBeUndefined();
    expect(bandLatBounds('Y')).toBeUndefined();
  });
});
