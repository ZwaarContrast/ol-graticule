import { describe, it, expect } from 'vitest';
import { findById, getAllLargeSquares } from '../lookup.js';
import { isPolySquare, isRectSquare } from '../types.js';

describe('Kriegsmarine lookup', () => {
  describe('getAllLargeSquares', () => {
    it('returns a non-empty array', () => {
      const squares = getAllLargeSquares();
      expect(squares.length).toBeGreaterThan(100);
    });

    it('includes known regular squares', () => {
      const squares = getAllLargeSquares();
      const ids = squares.map((s) => s.id);
      expect(ids).toContain('BC');
      expect(ids).toContain('AA');
      expect(ids).toContain('BF');
    });

    it('includes known polygonal squares', () => {
      const squares = getAllLargeSquares();
      const ids = squares.map((s) => s.id);
      expect(ids).toContain('AD');
      expect(ids).toContain('CT');
    });

    it('returns the cached result on subsequent calls', () => {
      const first = getAllLargeSquares();
      const second = getAllLargeSquares();
      expect(first).toBe(second); // same array reference
    });

    it('includes squares with umlaut characters', () => {
      const squares = getAllLargeSquares();
      const ids = squares.map((s) => s.id);
      expect(ids).toContain('ÄA');
      expect(ids).toContain('ÄE');
    });
  });

  describe('findById, large regular', () => {
    it('finds BC with correct bounds', () => {
      const sq = findById('BC');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
      if (isRectSquare(sq!)) {
        // BC is 3rd in the [BA,BB,BC,BD,BE] group with nw [51, -79], se [42.9, -65.5]
        // Each square width = (-65.5 - -79) = 13.5. BC is index 2 → shifted by 2 * 13.5 = 27
        expect(sq!.nw[0]).toBeCloseTo(51, 1);
        expect(sq!.se[0]).toBeCloseTo(42.9, 1);
      }
    });

    it('finds AA (shifted within group)', () => {
      const sq = findById('AA');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
      if (isRectSquare(sq!)) {
        // AA is 2nd in [ÄD, AA, AB, AC, AT] group
        expect(sq!.nw[0]).toBeCloseTo(77.1, 1);
        expect(sq!.se[0]).toBeCloseTo(69, 1);
      }
    });

    it('finds squares with umlaut bigrams', () => {
      const sq = findById('ÄJ');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });
  });

  describe('findById, polygonal', () => {
    it('finds AD as a polygonal square', () => {
      const sq = findById('AD');
      expect(sq).toBeDefined();
      expect(isPolySquare(sq!)).toBe(true);
      if (isPolySquare(sq!)) {
        expect(sq!.poly.length).toBeGreaterThan(4);
      }
    });

    it('finds CT as polygonal', () => {
      const sq = findById('CT');
      expect(sq).toBeDefined();
      expect(isPolySquare(sq!)).toBe(true);
    });

    it('finds nested polygonal sub-squares (CT3, CT34, CT349)', () => {
      const ct3 = findById('CT3');
      expect(ct3).toBeDefined();
      expect(isPolySquare(ct3!)).toBe(true);

      const ct34 = findById('CT34');
      expect(ct34).toBeDefined();
      expect(isPolySquare(ct34!)).toBe(true);

      const ct349 = findById('CT349');
      expect(ct349).toBeDefined();
      expect(isPolySquare(ct349!)).toBe(true);
    });
  });

  describe('findById, subdivision', () => {
    it('finds BC6 (1st-level sub-square)', () => {
      const sq = findById('BC6');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('finds BC61 (2nd-level sub-square)', () => {
      const sq = findById('BC61');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('finds BC617 (3rd-level sub-square)', () => {
      const sq = findById('BC617');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('finds BC6175 (Kleinquadrat)', () => {
      const sq = findById('BC6175');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('sub-squares nest correctly, BC6 contains BC61', () => {
      const bc6 = findById('BC6');
      const bc61 = findById('BC61');
      expect(isRectSquare(bc6!)).toBe(true);
      expect(isRectSquare(bc61!)).toBe(true);
      if (isRectSquare(bc6!) && isRectSquare(bc61!)) {
        // BC61 is position 1 (NW corner) of BC6
        expect(bc61!.nw[0]).toBeCloseTo(bc6!.nw[0], 1);
        expect(bc61!.nw[1]).toBeCloseTo(bc6!.nw[1], 1);
        // BC61 should be ~1/3 the width and height of BC6
        const bc6Width = Math.abs(bc6!.se[1] - bc6!.nw[1]);
        const bc61Width = Math.abs(bc61!.se[1] - bc61!.nw[1]);
        expect(bc61Width).toBeCloseTo(bc6Width / 3, 0);
      }
    });

    it('digit mapping follows telephone keypad (position 9 = SE corner)', () => {
      const bc = findById('BC');
      const bc9 = findById('BC9');
      expect(isRectSquare(bc!)).toBe(true);
      expect(isRectSquare(bc9!)).toBe(true);
      if (isRectSquare(bc!) && isRectSquare(bc9!)) {
        // Position 9 SE corner should match parent SE corner
        expect(bc9!.se[0]).toBeCloseTo(bc!.se[0], 1);
        expect(bc9!.se[1]).toBeCloseTo(bc!.se[1], 1);
      }
    });
  });

  describe('findById, partial squares', () => {
    it('finds OF (partial large square with sub [[1],[4],[7]])', () => {
      const sq = findById('OF');
      expect(sq).toBeDefined();
    });

    it('finds partial sub-squares (AD1, AD2)', () => {
      const ad1 = findById('AD1');
      const ad2 = findById('AD2');
      expect(ad1).toBeDefined();
      expect(ad2).toBeDefined();
      expect(isRectSquare(ad1!)).toBe(true);
      expect(isRectSquare(ad2!)).toBe(true);
    });
  });

  describe('findById, irregular squares', () => {
    it('finds DK (irregular large)', () => {
      const sq = findById('DK');
      expect(sq).toBeDefined();
    });

    it('finds DK sub-squares', () => {
      const dk1 = findById('DK1');
      expect(dk1).toBeDefined();
      expect(isRectSquare(dk1!)).toBe(true);
      if (isRectSquare(dk1!)) {
        // DK1 should have negative longitudes (Gulf of Mexico area)
        expect(dk1!.nw[1]).toBeLessThan(0);
        expect(dk1!.se[1]).toBeLessThan(0);
      }
    });

    it('finds deeply nested irregular squares (CS2, CS23)', () => {
      const cs2 = findById('CS2');
      expect(cs2).toBeDefined();

      const cs23 = findById('CS23');
      expect(cs23).toBeDefined();
    });
  });

  describe('findById, two-by-five squares', () => {
    it('finds ÄA1 (two-by-five parent)', () => {
      const sq = findById('ÄA1');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('finds AK1 sub-square within two-by-five', () => {
      const sq = findById('AK11');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('finds position 10 via leading zero encoding (AN05)', () => {
      const sq = findById('AN05');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
    });

    it('two-by-five sub-squares with further subdivision (AK15)', () => {
      const sq = findById('AK15');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
      if (isRectSquare(sq!)) {
        // AK15 should be a small sub-square within AK1
        const ak1 = findById('AK1');
        expect(isRectSquare(ak1!)).toBe(true);
        if (isRectSquare(ak1!)) {
          // AK15 lat should be within AK1 bounds
          expect(sq!.nw[0]).toBeLessThanOrEqual(ak1!.nw[0]);
          expect(sq!.se[0]).toBeGreaterThanOrEqual(ak1!.se[0]);
        }
      }
    });

    it('horizontal two-by-five (ÄA1) subdivides into 2×5 cells', () => {
      // ÄA1 is a 2×5 parent with so='h': 2 rows × 5 columns
      // Ref format: ÄA1X where X is position 1-9 in the 2×5 grid, ÄA01 for position 10
      const parent = findById('ÄA1');
      const cell1 = findById('ÄA11'); // position 1: top-left
      const cell5 = findById('ÄA15'); // position 5: top-right
      const cell6 = findById('ÄA16'); // position 6: bottom-left
      expect(parent).toBeDefined();
      expect(cell1).toBeDefined();
      expect(cell5).toBeDefined();
      expect(cell6).toBeDefined();
      if (isRectSquare(parent!) && isRectSquare(cell1!) && isRectSquare(cell5!) && isRectSquare(cell6!)) {
        // Positions 1 and 5 are in the top row (same lat)
        expect(cell1!.nw[0]).toBeCloseTo(cell5!.nw[0], 1);
        // Position 6 is in the bottom row (lower lat)
        expect(cell6!.nw[0]).toBeLessThan(cell1!.nw[0]);
        // Each cell should be 1/5 the parent width and 1/2 the parent height
        const parentWidth = Math.abs(parent!.se[1] - parent!.nw[1]);
        const cellWidth = Math.abs(cell1!.se[1] - cell1!.nw[1]);
        expect(cellWidth).toBeCloseTo(parentWidth / 5, 0);
      }
    });

    it('vertical two-by-five (AK1) subdivides into 5×2 cells', () => {
      // AK1 is a 2×5 parent with so='v': 5 rows × 2 columns
      // Ref format: AK1X where X is position 1-9, AK01 for position 10
      const parent = findById('AK1');
      const cell1 = findById('AK11'); // position 1: top-left
      const cell2 = findById('AK12'); // position 2: top-right
      const cell3 = findById('AK13'); // position 3: second row left
      expect(parent).toBeDefined();
      expect(cell1).toBeDefined();
      expect(cell2).toBeDefined();
      expect(cell3).toBeDefined();
      if (isRectSquare(parent!) && isRectSquare(cell1!) && isRectSquare(cell2!) && isRectSquare(cell3!)) {
        // Positions 1 and 2 are in the top row (same lat)
        expect(cell1!.nw[0]).toBeCloseTo(cell2!.nw[0], 1);
        // Position 3 is in the second row (lower lat)
        expect(cell3!.nw[0]).toBeLessThan(cell1!.nw[0]);
        // Each cell should be 1/2 the parent width and 1/5 the parent height
        const parentWidth = Math.abs(parent!.se[1] - parent!.nw[1]);
        const cellWidth = Math.abs(cell1!.se[1] - cell1!.nw[1]);
        expect(cellWidth).toBeCloseTo(parentWidth / 2, 0);
      }
    });
  });

  describe('findById, anti-meridian crossing squares', () => {
    it('finds ND (crosses anti-meridian)', () => {
      // ND group: nw [66.2, 170.6], se [58.1, -173.2]
      const sq = findById('ND');
      expect(sq).toBeDefined();
      expect(isRectSquare(sq!)).toBe(true);
      if (isRectSquare(sq!)) {
        // NW longitude > SE longitude indicates anti-meridian crossing
        expect(sq!.nw[1]).toBeGreaterThan(0);
        expect(sq!.se[1]).toBeLessThan(0);
      }
    });

    it('subdivides anti-meridian squares correctly', () => {
      const nd1 = findById('ND1');
      expect(nd1).toBeDefined();
      expect(isRectSquare(nd1!)).toBe(true);
    });
  });

  describe('findById, edge cases', () => {
    it('returns undefined for nonexistent square', () => {
      expect(findById('ZZ')).toBeUndefined();
      expect(findById('XX99')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(findById('')).toBeUndefined();
    });

    it('returns undefined for single character', () => {
      expect(findById('A')).toBeUndefined();
    });
  });
});
