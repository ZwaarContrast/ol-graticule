import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  HMN_LABEL_PATTERN,
  canonicalizeHmnLabel,
  clampTenth,
  parseHmnTokens,
} from '../canonical.js';

describe('canonicalizeHmnLabel', () => {
  it('depth 2: just the Kleinquadrat letter pair', () => {
    expect(canonicalizeHmnLabel('PE', undefined, undefined, undefined)).toBe('PE');
  });

  it('depth 3: Kleinquadrat + Meldetrapez', () => {
    expect(canonicalizeHmnLabel('PE', 5, undefined, undefined)).toBe('PE 5');
  });

  it('depth 4: + Arbeitstrapez (no space between MT and AT)', () => {
    expect(canonicalizeHmnLabel('PE', 5, 'b', undefined)).toBe('PE 5b');
  });

  it('depth 5: + tenths as two adjacent digits', () => {
    expect(canonicalizeHmnLabel('PE', 5, 'b', [2, 4])).toBe('PE 5b 24');
  });

  it('a missing intermediate level truncates the canonical', () => {
    // No Meldetrapez means we can't emit Arbeitstrapez or tenths even if present.
    expect(canonicalizeHmnLabel('PE', undefined, 'b', [2, 4])).toBe('PE');
  });

  it('tenths render with leading zeros where the value < 10', () => {
    expect(canonicalizeHmnLabel('PE', 5, 'b', [0, 3])).toBe('PE 5b 03');
  });
});

describe('clampTenth', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [5, 5],
    [9, 9],
    [10, 9],
    [100, 9],
  ])('clampTenth(%i) → %i', (input, expected) => {
    expect(clampTenth(input)).toBe(expected);
  });

  it('passes NaN through (caller guards)', () => {
    expect(Number.isNaN(clampTenth(Number.NaN))).toBe(true);
  });
});

describe('HMN_LABEL_PATTERN', () => {
  it.each([
    'PE',
    'PE 5',
    'PE 5b',
    'PE 5b 24',
    'pe5b24',
    '  PE   5b   24  ',
  ])('accepts canonical-shaped %s', (text) => {
    expect(HMN_LABEL_PATTERN.test(text)).toBe(true);
  });

  it.each([
    '',
    'P',          // single letter
    'PEE',        // three letters
    'PI',         // contains I
    'IP',         // contains I
    'PE 0',       // Meldetrapez must be 1..9
    'PE 5e',      // Arbeitstrapez must be a..d
    'PE 5b 5',    // tenths must be 2 digits
    'PE 5 24',    // tenths without Arbeitstrapez
  ])('rejects %s', (text) => {
    expect(HMN_LABEL_PATTERN.test(text)).toBe(false);
  });
});

describe('parseHmnTokens', () => {
  it('extracts every part of a full depth-5 reference', () => {
    const tokens = parseHmnTokens('PE 5b 24');
    expect(tokens).toBeDefined();
    expect(tokens!.col).toBe('P');
    expect(tokens!.row).toBe('E');
    expect(tokens!.kx).toBe(14); // P = index 14 (A..H = 0..7, J = 8, ..., P = 14)
    expect(tokens!.ky).toBe(4);  // E = index 4
    expect(tokens!.meldetrapez).toBe(5);
    expect(tokens!.arbeitstrapez).toBe('b');
    expect(tokens!.tenths).toEqual([2, 4]);
    expect(tokens!.depth).toBe(5);
  });

  it.each([
    ['PE', 2],
    ['PE 5', 3],
    ['PE 5b', 4],
    ['PE 5b 24', 5],
  ] as const)('depth("%s") = %i', (text, expected) => {
    expect(parseHmnTokens(text)?.depth).toBe(expected);
  });

  it('uppercases letters regardless of input casing', () => {
    const tokens = parseHmnTokens('pe5B24');
    expect(tokens?.col).toBe('P');
    expect(tokens?.row).toBe('E');
    // Arbeitstrapez stays lowercase (the spec uses lowercase a..d).
    expect(tokens?.arbeitstrapez).toBe('b');
  });

  it('returns undefined for invalid input', () => {
    expect(parseHmnTokens('')).toBeUndefined();
    expect(parseHmnTokens('PI')).toBeUndefined();
    expect(parseHmnTokens('PE 0b 24')).toBeUndefined();
    expect(parseHmnTokens('PE 5e 24')).toBeUndefined();
  });

  it('letter-pair indices respect the I-skip alphabet', () => {
    // H = 7, J = 8 (no I). Verify the index, not the cell content.
    expect(parseHmnTokens('HA')?.ky).toBe(0);
    expect(parseHmnTokens('HA')?.kx).toBe(7);
    expect(parseHmnTokens('JA')?.kx).toBe(8);
    // Z is the last letter at index 24.
    expect(parseHmnTokens('ZZ')?.kx).toBe(24);
    expect(parseHmnTokens('ZZ')?.ky).toBe(24);
  });

  it('rejects `I` in either position of the letter pair', () => {
    expect(parseHmnTokens('AI')).toBeUndefined();
    expect(parseHmnTokens('IA')).toBeUndefined();
    expect(parseHmnTokens('II')).toBeUndefined();
  });

  it('rejects tenths without an Arbeitstrapez (grammar requires Arbeit before tenths)', () => {
    expect(parseHmnTokens('PE 5 24')).toBeUndefined();
  });

  it('rejects malformed tenths (single digit, three digits, non-digit)', () => {
    expect(parseHmnTokens('PE 5b 5')).toBeUndefined();
    expect(parseHmnTokens('PE 5b 555')).toBeUndefined();
    expect(parseHmnTokens('PE 5b ab')).toBeUndefined();
  });

  it('resolves pathological whitespace input quickly (ReDoS guard)', () => {
    const evil = 'AA' + ' '.repeat(50_000) + '!';
    const start = performance.now();
    expect(parseHmnTokens(evil)).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('never throws and returns well-formed tokens (or undefined) for any input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const t = parseHmnTokens(s);
        if (t !== undefined) {
          expect(t.kx).toBeGreaterThanOrEqual(0);
          expect(t.ky).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
