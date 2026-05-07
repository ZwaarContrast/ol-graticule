import { describe, it, expect } from 'vitest';
import {
  columnLetter,
  columnSetForZone,
  rowLetter,
  rowOffsetForZone,
  squareLetters,
} from '../squares.js';

describe('columnSetForZone', () => {
  it('cycles through the three column-letter sets every 3 zones', () => {
    expect(columnSetForZone(1)).toBe('ABCDEFGH');
    expect(columnSetForZone(2)).toBe('JKLMNPQR');
    expect(columnSetForZone(3)).toBe('STUVWXYZ');
    expect(columnSetForZone(4)).toBe('ABCDEFGH');
    expect(columnSetForZone(31)).toBe('ABCDEFGH'); // 31 mod 3 == 1
    expect(columnSetForZone(32)).toBe('JKLMNPQR');
  });
});

describe('rowOffsetForZone', () => {
  it('is 0 for odd zones (start at A) and 5 for even zones (start at F)', () => {
    expect(rowOffsetForZone(1)).toBe(0);
    expect(rowOffsetForZone(2)).toBe(5);
    expect(rowOffsetForZone(31)).toBe(0);
    expect(rowOffsetForZone(32)).toBe(5);
  });
});

describe('columnLetter', () => {
  it('returns A for the leftmost 100km column of an odd zone', () => {
    expect(columnLetter(1, 100_000)).toBe('A');
    expect(columnLetter(1, 199_999)).toBe('A');
    expect(columnLetter(1, 200_000)).toBe('B');
    expect(columnLetter(1, 800_000)).toBe('H');
  });
  it('returns J at easting 100k for zone 2 (no I)', () => {
    expect(columnLetter(2, 100_000)).toBe('J');
    expect(columnLetter(2, 600_000)).toBe('P'); // index 5 in JKLMNPQR
  });
  it('returns undefined outside the eight-column band', () => {
    expect(columnLetter(1, 0)).toBeUndefined();
    expect(columnLetter(1, 99_999)).toBeUndefined();
    expect(columnLetter(1, 900_000)).toBeUndefined();
  });
});

describe('rowLetter', () => {
  it('starts at A for odd zones at the equator', () => {
    expect(rowLetter(1, 0)).toBe('A');
    expect(rowLetter(1, 100_000)).toBe('B');
    expect(rowLetter(1, 700_000)).toBe('H'); // index 7
    expect(rowLetter(1, 800_000)).toBe('J'); // index 8 (no I)
    expect(rowLetter(1, 1_900_000)).toBe('V'); // last row
    expect(rowLetter(1, 2_000_000)).toBe('A'); // cycled
  });

  it('starts at F for even zones at the equator', () => {
    expect(rowLetter(2, 0)).toBe('F');
    expect(rowLetter(2, 100_000)).toBe('G');
    expect(rowLetter(2, 1_400_000)).toBe('V'); // F + 14 indices
    expect(rowLetter(2, 1_500_000)).toBe('A'); // wraps
    expect(rowLetter(2, 1_900_000)).toBe('E');
  });

  it('handles UTM southern hemisphere false northing 10 000 000', () => {
    // 10 000 000 is a multiple of the 2 000 000 m row cycle, so equator
    // from the southern side reads the same as from the northern side.
    expect(rowLetter(1, 10_000_000)).toBe('A');
    // One 100km step south of the equator is "V" (the row below A).
    expect(rowLetter(1, 9_900_000)).toBe('V');
  });
});

describe('squareLetters', () => {
  it('returns undefined when the easting is outside the letter band', () => {
    expect(squareLetters(1, 50_000, 5_000_000)).toBeUndefined();
  });
  it('combines col+row letters', () => {
    expect(squareLetters(1, 100_000, 0)).toBe('AA');
    expect(squareLetters(2, 100_000, 0)).toBe('JF');
  });
});
