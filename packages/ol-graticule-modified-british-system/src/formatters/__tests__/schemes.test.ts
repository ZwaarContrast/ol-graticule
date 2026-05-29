import { describe, expect, it } from 'vitest';
import {
  BRITISH_CASSINI_FAMILY_LETTERS,
  BRITISH_CASSINI_SCHEME,
  FRENCH_LAMBERT_1_SCHEME,
  FRENCH_LAMBERT_2_SCHEME,
  FRENCH_LAMBERT_3_SCHEME,
  IBERIAN_PENINSULA_SCHEME,
  IRISH_CASSINI_SCHEME,
  ITALIAN_NORTHERN_FAMILY_LETTERS,
  ITALIAN_NORTHERN_SCHEME,
  ITALIAN_SOUTHERN_SCHEME,
  NORD_DE_GUERRE_FAMILY_LETTERS,
  NORD_DE_GUERRE_SCHEME,
  SCANDINAVIAN_ZONE_3_FAMILY_LETTERS,
  SCANDINAVIAN_ZONE_3_SCHEME,
  WAR_OFFICE_CASSINI_SCHEME,
} from '../schemes.js';
import type { MBSLetterScheme } from '../schemes.js';

const ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

function flat(grid: readonly string[]): string {
  return grid.join('');
}

function expectLetterGridShape(grid: readonly string[], label: string): void {
  expect(grid.length, `${label} should have 5 rows`).toBe(5);
  for (const row of grid) {
    expect(row.length, `${label} row "${row}"`).toBe(5);
  }
}

const ALL_FULL_SCHEMES: Array<[string, MBSLetterScheme]> = [
  ['Nord de Guerre', NORD_DE_GUERRE_SCHEME],
  ['French Lambert 1', FRENCH_LAMBERT_1_SCHEME],
  ['French Lambert 2', FRENCH_LAMBERT_2_SCHEME],
  ['French Lambert 3', FRENCH_LAMBERT_3_SCHEME],
  ['British Cassini', BRITISH_CASSINI_SCHEME],
  ['War Office Cassini', WAR_OFFICE_CASSINI_SCHEME],
  ['Scandinavian Zone 3', SCANDINAVIAN_ZONE_3_SCHEME],
  ['Italian Northern', ITALIAN_NORTHERN_SCHEME],
  ['Italian Southern', ITALIAN_SOUTHERN_SCHEME],
  ['Iberian Peninsula', IBERIAN_PENINSULA_SCHEME],
];

describe('Letter family grids share the universal first-letter grid', () => {
  it.each([
    ['Nord de Guerre family', NORD_DE_GUERRE_FAMILY_LETTERS],
    ['British Cassini family', BRITISH_CASSINI_FAMILY_LETTERS],
    ['Scandinavian Zone 3 family', SCANDINAVIAN_ZONE_3_FAMILY_LETTERS],
    ['Italian Northern family', ITALIAN_NORTHERN_FAMILY_LETTERS],
  ])('%s first-letter grid is the universal V→A south→north arrangement', (label, grid) => {
    expect(grid.firstLetterGrid).toEqual(['VWXYZ', 'QRSTU', 'LMNOP', 'FGHJK', 'ABCDE']);
  });
});

describe.each(ALL_FULL_SCHEMES)('%s scheme shape', (label, scheme) => {
  it('has 5×5 first letter grid', () => {
    expectLetterGridShape(scheme.firstLetterGrid, `${label} first`);
  });

  it('has 5×5 second letter grid', () => {
    expectLetterGridShape(scheme.secondLetterGrid, `${label} second`);
  });

  it('first-letter grid is a permutation of the 25-letter alphabet (A-Z minus I)', () => {
    expect(flat(scheme.firstLetterGrid).split('').sort().join('')).toBe(
      ALPHABET.split('').sort().join(''),
    );
  });

  it('second-letter grid is a permutation of the 25-letter alphabet', () => {
    expect(flat(scheme.secondLetterGrid).split('').sort().join('')).toBe(
      ALPHABET.split('').sort().join(''),
    );
  });

  it('never uses the letter I', () => {
    expect(flat(scheme.firstLetterGrid)).not.toContain('I');
    expect(flat(scheme.secondLetterGrid)).not.toContain('I');
  });
});

describe('Irish Cassini is a single-cell scheme', () => {
  it('only one first-letter cell is populated and uses lowercase "i"', () => {
    const flat = IRISH_CASSINI_SCHEME.firstLetterGrid.join('');
    expect(flat).toContain('i');
    const populated = [...flat].filter((c) => c !== '-').length;
    expect(populated).toBe(1);
  });

  it('still uses a 5×5 second-letter grid', () => {
    expectLetterGridShape(IRISH_CASSINI_SCHEME.secondLetterGrid, 'Irish Cassini second');
  });
});

describe('Grid origins', () => {
  it('Nord de Guerre tile SW sits at (-100, 0) km', () => {
    expect(NORD_DE_GUERRE_SCHEME.eOriginKm).toBe(-100);
    expect(NORD_DE_GUERRE_SCHEME.nOriginKm).toBe(0);
  });

  it('French Lambert 1 / 2 share (0, -100) tile SW', () => {
    expect(FRENCH_LAMBERT_1_SCHEME.eOriginKm).toBe(0);
    expect(FRENCH_LAMBERT_1_SCHEME.nOriginKm).toBe(-100);
    expect(FRENCH_LAMBERT_2_SCHEME.eOriginKm).toBe(0);
    expect(FRENCH_LAMBERT_2_SCHEME.nOriginKm).toBe(-100);
  });

  it('French Lambert 3 northing origin is offset by an extra 2000 km (Lambert Sud)', () => {
    expect(FRENCH_LAMBERT_3_SCHEME.nOriginKm).toBe(-2100);
  });

  it('British Cassini tile SW at (100, -300) km', () => {
    expect(BRITISH_CASSINI_SCHEME.eOriginKm).toBe(100);
    expect(BRITISH_CASSINI_SCHEME.nOriginKm).toBe(-300);
  });
});
