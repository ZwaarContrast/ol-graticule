import { describe, expect, it } from 'vitest';
import {
  upsColumnLetter,
  upsCrsCode,
  upsIsNorth,
  upsProj4,
  upsRowLetter,
  upsSquareLetters,
  upsZoneLetter,
  upsZoneLonLatBounds,
} from '../ups.js';

describe('upsZoneLetter', () => {
  it('returns Y for northern western polar cap', () => {
    expect(upsZoneLetter(-90, 85)).toBe('Y');
  });

  it('returns Z for northern eastern polar cap', () => {
    expect(upsZoneLetter(90, 85)).toBe('Z');
  });

  it('returns A for southern western polar cap', () => {
    expect(upsZoneLetter(-90, -85)).toBe('A');
  });

  it('returns B for southern eastern polar cap', () => {
    expect(upsZoneLetter(90, -85)).toBe('B');
  });

  it('returns undefined inside UTM-only latitudes', () => {
    expect(upsZoneLetter(0, 0)).toBeUndefined();
    expect(upsZoneLetter(0, 83.9)).toBeUndefined();
    expect(upsZoneLetter(0, -79.99)).toBeUndefined();
  });

  it('returns undefined for non-finite inputs', () => {
    expect(upsZoneLetter(NaN, 85)).toBeUndefined();
    expect(upsZoneLetter(0, Infinity)).toBeUndefined();
  });

  it('boundary lat=84 is inside UPS-N, lat=-80 is inside UTM', () => {
    expect(upsZoneLetter(0, 84)).toBe('Z');
    expect(upsZoneLetter(0, -80)).toBeUndefined();
    expect(upsZoneLetter(0, -80.0001)).toBe('B');
  });
});

describe('upsIsNorth', () => {
  it('is true for northern UPS', () => {
    expect(upsIsNorth(85)).toBe(true);
    expect(upsIsNorth(84)).toBe(true);
  });

  it('is false for southern UPS', () => {
    expect(upsIsNorth(-85)).toBe(false);
  });

  it('is undefined for UTM latitudes', () => {
    expect(upsIsNorth(0)).toBeUndefined();
    expect(upsIsNorth(83)).toBeUndefined();
    expect(upsIsNorth(-79)).toBeUndefined();
  });
});

describe('upsProj4', () => {
  it('north uses +lat_0=90', () => {
    expect(upsProj4(true)).toContain('+lat_0=90');
  });

  it('south uses +lat_0=-90', () => {
    expect(upsProj4(false)).toContain('+lat_0=-90');
  });

  it('always uses k=0.994 and 2 000 000 m false easting/northing', () => {
    expect(upsProj4(true)).toContain('+k=0.994');
    expect(upsProj4(true)).toContain('+x_0=2000000');
    expect(upsProj4(true)).toContain('+y_0=2000000');
  });
});

describe('upsCrsCode', () => {
  it('maps to EPSG:5041 / EPSG:5042', () => {
    expect(upsCrsCode(true)).toBe('EPSG:5041');
    expect(upsCrsCode(false)).toBe('EPSG:5042');
  });
});

describe('upsColumnLetter / upsRowLetter', () => {
  it('returns undefined when the easting is below the column offset', () => {
    // Zone Y starts at column offset 13 (1.3 Mm); easting 0 underflows.
    expect(upsColumnLetter('Y', 0)).toBeUndefined();
  });

  it('returns the expected letters at the UPS-N false-origin centre (2 Mm, 2 Mm)', () => {
    // Zone Z column table starts at offset 20 with letters "ABCFGHJ", so
    // easting 2 Mm (xh=20, idx=0) maps to "A".
    expect(upsColumnLetter('Z', 2_000_000)).toBe('A');
    // Zone N row table starts at offset 13 with letters "ABCDEFGHJKLMNP",
    // so northing 2 Mm (yh=20, idx=7) maps to the 8th letter "H".
    expect(upsRowLetter('Z', 2_000_000)).toBe('H');
  });

  it('returns undefined when easting overflows the letter band', () => {
    expect(upsColumnLetter('Y', 50_000_000)).toBeUndefined();
  });
});

describe('upsSquareLetters', () => {
  it('concatenates column and row letters in that order', () => {
    expect(upsSquareLetters('Z', 2_000_000, 2_000_000)).toBe('AH');
  });

  it('returns undefined when the column letter is undefined', () => {
    expect(upsSquareLetters('Y', 0, 2_000_000)).toBeUndefined();
  });

  it('returns undefined when the row letter is undefined', () => {
    expect(upsSquareLetters('Z', 2_000_000, 0)).toBeUndefined();
  });
});

describe('upsZoneLonLatBounds', () => {
  it('Y/Z together cover the northern cap longitude span', () => {
    const y = upsZoneLonLatBounds('Y');
    const z = upsZoneLonLatBounds('Z');
    expect(y.lon).toEqual([-180, 0]);
    expect(z.lon).toEqual([0, 180]);
    expect(y.lat).toEqual([84, 90]);
    expect(z.lat).toEqual([84, 90]);
  });

  it('A/B together cover the southern cap longitude span', () => {
    const a = upsZoneLonLatBounds('A');
    const b = upsZoneLonLatBounds('B');
    expect(a.lon).toEqual([-180, 0]);
    expect(b.lon).toEqual([0, 180]);
    expect(a.lat).toEqual([-90, -80]);
    expect(b.lat).toEqual([-90, -80]);
  });
});
