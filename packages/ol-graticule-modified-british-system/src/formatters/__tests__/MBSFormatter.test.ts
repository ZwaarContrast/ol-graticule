import { describe, it, expect } from 'vitest';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import { MBSFormatter } from '../MBSFormatter';
import { NORD_DE_GUERRE_SCHEME } from '../schemes';

describe('MBSFormatter', () => {
  const formatter = new MBSFormatter(NORD_DE_GUERRE_SCHEME);

  describe('format() — single-axis metric labels', () => {
    it('formats meters to km for whole numbers', () => {
      expect(formatter.format(500000, 'x')).toBe('500 km');
    });

    it('formats meters to km with decimals', () => {
      expect(formatter.format(350500, 'x')).toBe('350.5 km');
    });

    it('formats zero', () => {
      expect(formatter.format(0, 'x')).toBe('0 km');
    });
  });

  describe('formatCellLabel() — grid square letter codes', () => {
    it('returns correct first letter using both easting and northing', () => {
      // Easting 350km, Northing 620km
      // firstCol = floor((350+100)/500) = 0, firstRow = floor(620/500) = 1
      // firstLetterIndex = 1*5+0 = 5 → Q → 'q'
      const label = formatter.formatCellLabel(350000, 620000);
      expect(label).toMatch(/^q/);
    });

    it('returns correct second letter with row mapping', () => {
      // Within the v-square (firstRow=0, firstCol=0):
      // easting 350km → relE%500 = 450 → secondCol=4
      // northing 150km → relN%500 = 150 → secondGeoRow=1
      // GEO_TO_LETTER_ROW[1] = 0 → GRID_LETTERS row 0 = VWXYZ
      // secondLetterIndex = 0*5+4 = 4 → Z
      const label = formatter.formatCellLabel(350000, 150000);
      expect(label).toBe('vZ');
    });

    it('returns bottom row letters (ABCDE) for lowest northing in a square', () => {
      // Northing 50km → relN%500 = 50 → secondGeoRow=0
      // GEO_TO_LETTER_ROW[0] = 4 → GRID_LETTERS row 4 = ABCDE
      // secondCol = floor((200+100)%500/100) = 3
      // secondLetterIndex = 4*5+3 = 23 → D
      const label = formatter.formatCellLabel(200000, 50000);
      expect(label).toBe('vD');
    });

    it('returns top row letters (FGHJK) for highest northing in a square', () => {
      // Northing 450km → relN%500 = 450 → secondGeoRow=4
      // GEO_TO_LETTER_ROW[4] = 3 → GRID_LETTERS row 3 = FGHJK
      // secondCol = floor(100%500/100) = 1 → G
      const label = formatter.formatCellLabel(0, 450000);
      expect(label).toBe('vG');
    });

    it('returns undefined for negative coordinates outside grid', () => {
      expect(formatter.formatCellLabel(-200000, 300000)).toBeUndefined();
    });

    it('handles the w first-letter column correctly', () => {
      const label = formatter.formatCellLabel(500000, 250000);
      expect(label).toMatch(/^w/);
    });

    it('handles the r first-letter square correctly', () => {
      const label = formatter.formatCellLabel(500000, 600000);
      expect(label).toMatch(/^r/);
    });
  });

  describe('formatMBS() — full MBS notation', () => {
    it('formats with correct grid square and digits', () => {
      // Easting 350km, Northing 150km → vZ
      // baseE = -100 + 0*500 + 4*100 = 300, baseN = 0 + 0*500 + 1*100 = 100
      // relE = (350-300)*10 = 500, relN = (150-100)*10 = 500
      expect(formatter.formatMBS(350000, 150000)).toBe('vZ 500 500');
    });

    it('formats coordinates in the q first-letter area', () => {
      expect(formatter.formatMBS(350000, 650000)).toMatch(/^q[A-Z] \d{3} \d{3}$/);
    });

    it('returns metric fallback for coordinates outside grid', () => {
      expect(formatter.formatMBS(-200000, 300000)).toContain('km');
    });

    it('first letter is lowercase, second letter is uppercase', () => {
      expect(formatter.formatMBS(350000, 150000)).toMatch(/^[a-z][A-Z]/);
    });

    it('digits are zero-padded to 3 characters', () => {
      const result = formatter.formatMBS(300100, 100100);
      const parts = result.split(' ');
      expect(parts[1]!.length).toBe(3);
      expect(parts[2]!.length).toBe(3);
    });

    it('clamps the suffix at the cell boundary instead of overflowing to 4 digits', () => {
      // `eastingKm - baseE` can round to 100 near the north-/east-edge of the
      // 100 km cell; without the clamp this produced a 4-digit suffix that
      // misaligned with the grid square we already chose.
      // Easting just below the 400 km boundary: round((399.9999 − 300) × 10) = 1000.
      // Clamped to 999, so the suffix stays 3 digits.
      const result = formatter.formatMBS(399999.999, 150000);
      const parts = result.split(' ');
      expect(parts[1]).toBe('999');
    });
  });

  describe('formatCoordinate() — cursor position display', () => {
    it('returns the full MBS reference as a single combined label', () => {
      const result = formatter.formatCoordinate(350000, 150000);
      expect(result).toEqual({ combined: 'vZ 500 500' });
    });
  });

  describe('parse() — single-axis metric', () => {
    it('round-trips format output (km)', () => {
      for (const v of [0, 500000, 350500, 1000]) {
        expect(formatter.parse(formatter.format(v, 'x'), 'x')).toBeCloseTo(v, 6);
      }
    });

    it('accepts m suffix and unitless values', () => {
      expect(formatter.parse('1234 m')).toBeCloseTo(1234, 6);
      expect(formatter.parse('1234')).toBeCloseTo(1234, 6);
    });
  });

  describe('parseCoordinate() — compound MBS reference', () => {
    it('returns cell centre at 100 km precision for "vK"', () => {
      // 'v' at firstLetterGrid[0][0]; 'K' at secondLetterGrid[4][4] (FGHJK).
      // baseE_m = (-100 + 0*500 + 4*100) * 1000 = 300_000
      // baseN_m = (0 + 0*500 + 4*100) * 1000 = 400_000
      // Cell is 100 km × 100 km, centre offset = 50_000 m on each axis.
      const [e, n] = formatter.parseCoordinate('vK');
      expect(e).toBeCloseTo(350_000, 6);
      expect(n).toBeCloseTo(450_000, 6);
    });

    it('returns cell centre at 100 m precision for "vK 617 517"', () => {
      // formatMBS rounds to nearest 100 m → cell N=617 is centred on 61_700 m.
      const [e, n] = formatter.parseCoordinate('vK 617 517');
      expect(e).toBeCloseTo(361_700, 6);
      expect(n).toBeCloseTo(451_700, 6);
    });

    it('returns cell centre at 10 m precision for "vK90449926"', () => {
      // 8 digits → 10 m precision; cell N=9044 is centred on 90_440 m.
      const [e, n] = formatter.parseCoordinate('vK90449926');
      expect(e).toBeCloseTo(390_440, 6);
      expect(n).toBeCloseTo(499_260, 6);
    });

    it('round-trips formatMBS ↔ parseCoordinate', () => {
      const ref = 'vK 617 517';
      const [e, n] = formatter.parseCoordinate(ref);
      expect(formatter.formatMBS(e, n)).toBe(ref);
    });

    it('is case-insensitive', () => {
      const a = formatter.parseCoordinate('vK 617 517');
      const b = formatter.parseCoordinate('VK617517');
      const c = formatter.parseCoordinate('Vk 617517');
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    });

    it('accepts numeric fallback in km', () => {
      const [e, n] = formatter.parseCoordinate('309.02 296.80');
      expect(e).toBeCloseTo(309_020, 6);
      expect(n).toBeCloseTo(296_800, 6);
    });

    it('accepts numeric fallback with comma', () => {
      const [e, n] = formatter.parseCoordinate('309.02, 296.80');
      expect(e).toBeCloseTo(309_020, 6);
      expect(n).toBeCloseTo(296_800, 6);
    });

    it('accepts numeric fallback with km suffix', () => {
      const [e, n] = formatter.parseCoordinate('309.02 296.80 km');
      expect(e).toBeCloseTo(309_020, 6);
      expect(n).toBeCloseTo(296_800, 6);
    });

    it('accepts numeric fallback with m suffix', () => {
      const [e, n] = formatter.parseCoordinate('309020 296800 m');
      expect(e).toBeCloseTo(309_020, 6);
      expect(n).toBeCloseTo(296_800, 6);
    });

    it('throws ParseError on odd digit count', () => {
      expect(() => formatter.parseCoordinate('vK123')).toThrow(ParseError);
    });

    it('throws ParseError on >10 digits', () => {
      expect(() => formatter.parseCoordinate('vK123456789012')).toThrow(ParseError);
    });

    it('throws ParseError on unknown letter', () => {
      // 'I' is the omitted letter in the 25-letter MBS alphabet.
      expect(() => formatter.parseCoordinate('iX 617 517')).toThrow(ParseError);
      expect(() => formatter.parseCoordinate('vI 617 517')).toThrow(ParseError);
    });

    it('throws ParseError on garbage', () => {
      expect(() => formatter.parseCoordinate('')).toThrow(ParseError);
      expect(() => formatter.parseCoordinate('hello')).toThrow(ParseError);
    });
  });
});
