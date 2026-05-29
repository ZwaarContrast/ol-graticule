import { describe, expect, it } from 'vitest';
import { letterFromIndex, letterToIndex } from '../letters.js';

describe('Jägermeldenetz letter alphabet', () => {
  it('starts with A and ends with U (20 letters, no I)', () => {
    expect(letterFromIndex(0)).toBe('A');
    expect(letterFromIndex(19)).toBe('U');
  });

  it('skips I between H and J', () => {
    expect(letterFromIndex(7)).toBe('H');
    expect(letterFromIndex(8)).toBe('J');
    expect(letterToIndex('I')).toBe(-1);
  });

  it('round-trips index ↔ letter for all 20 entries', () => {
    for (let i = 0; i < 20; i++) {
      const letter = letterFromIndex(i);
      expect(letter).toBeDefined();
      expect(letterToIndex(letter!)).toBe(i);
    }
  });

  it('returns undefined for out-of-range index', () => {
    expect(letterFromIndex(-1)).toBeUndefined();
    expect(letterFromIndex(20)).toBeUndefined();
    expect(letterFromIndex(1.5)).toBeUndefined();
  });

  it('letterToIndex is case-insensitive', () => {
    expect(letterToIndex('a')).toBe(0);
    expect(letterToIndex('A')).toBe(0);
    expect(letterToIndex('u')).toBe(19);
  });

  it('letterToIndex rejects non-single-character strings', () => {
    expect(letterToIndex('AA')).toBe(-1);
    expect(letterToIndex('')).toBe(-1);
  });
});
