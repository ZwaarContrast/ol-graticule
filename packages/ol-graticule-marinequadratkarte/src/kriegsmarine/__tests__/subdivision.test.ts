import { describe, it, expect } from 'vitest';
import { shift, steps, subSquare, regularSquare, twoByFiveSquare } from '../subdivision.js';
import type { RectSquare } from '../types.js';

describe('Kriegsmarine subdivision', () => {
  const baseSquare: RectSquare = { id: 'BC', nw: [51, -52], se: [42.9, -38.5] };

  describe('shift', () => {
    it('shifts horizontally by factor 0 (no shift)', () => {
      const result = shift(baseSquare, 'h', 0);
      expect(result.nw).toEqual(baseSquare.nw);
      expect(result.se).toEqual(baseSquare.se);
    });

    it('shifts horizontally by factor 1', () => {
      const result = shift(baseSquare, 'h', 1);
      const dLon = -38.5 - -52; // 13.5
      expect(result.nw[0]).toBe(51);
      expect(result.se[0]).toBe(42.9);
      expect(result.nw[1]).toBeCloseTo(-52 + dLon, 1);
      expect(result.se[1]).toBeCloseTo(-38.5 + dLon, 1);
    });

    it('shifts vertically by factor 1', () => {
      const result = shift(baseSquare, 'v', 1);
      const dLat = 42.9 - 51; // -8.1
      expect(result.nw[0]).toBeCloseTo(51 + dLat, 1);
      expect(result.se[0]).toBeCloseTo(42.9 + dLat, 1);
      expect(result.nw[1]).toBe(-52);
      expect(result.se[1]).toBe(-38.5);
    });

    it('preserves id and other properties', () => {
      const sq: RectSquare = { id: 'TEST', nw: [10, 20], se: [5, 30], sub: [[1, 2], [3, 4]] };
      const result = shift(sq, 'h', 1);
      expect(result.id).toBe('TEST');
      expect(result.sub).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('steps', () => {
    it('maps standard 3x3 digits to positions', () => {
      expect(steps(1)).toEqual([0, 0]); // top-left
      expect(steps(2)).toEqual([1, 0]); // top-center
      expect(steps(3)).toEqual([2, 0]); // top-right
      expect(steps(4)).toEqual([0, 1]); // middle-left
      expect(steps(5)).toEqual([1, 1]); // center
      expect(steps(6)).toEqual([2, 1]); // middle-right
      expect(steps(7)).toEqual([0, 2]); // bottom-left
      expect(steps(8)).toEqual([1, 2]); // bottom-center
      expect(steps(9)).toEqual([2, 2]); // bottom-right
    });

    it('maps custom sub layout', () => {
      // Partial square with only left column: [[1], [4], [7]]
      const sub = [[1], [4], [7]];
      expect(steps(1, sub)).toEqual([0, 0]);
      expect(steps(4, sub)).toEqual([0, 1]);
      expect(steps(7, sub)).toEqual([0, 2]);
    });

    it('returns undefined for missing position in custom layout', () => {
      const sub = [[1], [4], [7]];
      expect(steps(2, sub)).toBeUndefined();
      expect(steps(5, sub)).toBeUndefined();
    });

    it('maps 2-column partial layout', () => {
      const sub = [[1, 2], [4, 5], [7, 8]];
      expect(steps(1, sub)).toEqual([0, 0]);
      expect(steps(2, sub)).toEqual([1, 0]);
      expect(steps(5, sub)).toEqual([1, 1]);
      expect(steps(8, sub)).toEqual([1, 2]);
    });
  });

  describe('subSquare', () => {
    it('position 1 is NW corner of parent', () => {
      const result = subSquare(baseSquare, 1);
      expect(result).toBeDefined();
      expect(result!.nw[0]).toBeCloseTo(baseSquare.nw[0], 1);
      expect(result!.nw[1]).toBeCloseTo(baseSquare.nw[1], 1);
    });

    it('position 9 SE corner matches parent SE', () => {
      const result = subSquare(baseSquare, 9);
      expect(result).toBeDefined();
      expect(result!.se[0]).toBeCloseTo(baseSquare.se[0], 1);
      expect(result!.se[1]).toBeCloseTo(baseSquare.se[1], 1);
    });

    it('sub-square is 1/3 the width and height of parent', () => {
      const result = subSquare(baseSquare, 5);
      expect(result).toBeDefined();
      const parentWidth = Math.abs(baseSquare.se[1] - baseSquare.nw[1]);
      const parentHeight = Math.abs(baseSquare.se[0] - baseSquare.nw[0]);
      const subWidth = Math.abs(result!.se[1] - result!.nw[1]);
      const subHeight = Math.abs(result!.se[0] - result!.nw[0]);
      expect(subWidth).toBeCloseTo(parentWidth / 3, 0);
      expect(subHeight).toBeCloseTo(parentHeight / 3, 0);
    });

    it('generates correct ID', () => {
      const result = subSquare(baseSquare, 6);
      expect(result!.id).toBe('BC6');
    });

    it('handles partial layout', () => {
      const partial: RectSquare = { id: 'OF', nw: [41.9, 167], se: [33.8, 170.6], sub: [[1], [4], [7]] };
      const result = subSquare(partial, 4);
      expect(result).toBeDefined();
      expect(result!.id).toBe('OF4');
      // Single-column layout: width should match parent
      const parentWidth = Math.abs(partial.se[1] - partial.nw[1]);
      const subWidth = Math.abs(result!.se[1] - result!.nw[1]);
      expect(subWidth).toBeCloseTo(parentWidth, 0);
    });

    it('returns undefined for position not in partial layout', () => {
      const partial: RectSquare = { id: 'OF', nw: [41.9, 167], se: [33.8, 170.6], sub: [[1], [4], [7]] };
      expect(subSquare(partial, 2)).toBeUndefined();
      expect(subSquare(partial, 5)).toBeUndefined();
    });
  });

  describe('regularSquare', () => {
    it('returns parent when no digits remain', () => {
      const result = regularSquare('BC', baseSquare);
      expect(result).toBeDefined();
      expect(result!.id).toBe('BC');
    });

    it('subdivides single digit', () => {
      const result = regularSquare('BC5', baseSquare);
      expect(result).toBeDefined();
      expect(result!.id).toBe('BC5');
    });

    it('subdivides multiple digits recursively', () => {
      const result = regularSquare('BC617', baseSquare);
      expect(result).toBeDefined();
      expect(result!.id).toBe('BC617');
      // Should be much smaller than parent
      const parentWidth = Math.abs(baseSquare.se[1] - baseSquare.nw[1]);
      const subWidth = Math.abs(result!.se[1] - result!.nw[1]);
      // 3 levels of subdivision: 1/27 of parent width
      expect(subWidth).toBeCloseTo(parentWidth / 27, 0);
    });
  });

  describe('twoByFiveSquare', () => {
    const hDef = { nw: [60.9, -71.5] as [number, number], se: [59.1, -62.5] as [number, number], so: 'h' as const };
    const vDef = { nw: [60.9, -37.3] as [number, number], se: [56.4, -33.7] as [number, number], so: 'v' as const };

    it('horizontal: position 1 is top-left', () => {
      const result = twoByFiveSquare('ÄA11', hDef);
      expect(result).toBeDefined();
      expect(result!.nw[0]).toBeCloseTo(hDef.nw[0], 1);
      expect(result!.nw[1]).toBeCloseTo(hDef.nw[1], 1);
    });

    it('horizontal: position 5 is top-right', () => {
      const result = twoByFiveSquare('ÄA15', hDef);
      expect(result).toBeDefined();
      expect(result!.se[1]).toBeCloseTo(hDef.se[1], 1);
      expect(result!.nw[0]).toBeCloseTo(hDef.nw[0], 1);
    });

    it('horizontal: position 6 is bottom-left', () => {
      const result = twoByFiveSquare('ÄA16', hDef);
      expect(result).toBeDefined();
      expect(result!.nw[1]).toBeCloseTo(hDef.nw[1], 1);
      expect(result!.se[0]).toBeCloseTo(hDef.se[0], 1);
    });

    it('vertical: position 1 is top-left', () => {
      const result = twoByFiveSquare('AK11', vDef);
      expect(result).toBeDefined();
      expect(result!.nw[0]).toBeCloseTo(vDef.nw[0], 1);
      expect(result!.nw[1]).toBeCloseTo(vDef.nw[1], 1);
    });

    it('horizontal: position 10 via leading zero', () => {
      const result = twoByFiveSquare('ÄA01', hDef);
      expect(result).toBeDefined();
      // Position 10 is bottom-right
      expect(result!.se[0]).toBeCloseTo(hDef.se[0], 1);
      expect(result!.se[1]).toBeCloseTo(hDef.se[1], 1);
    });

    it('further subdivision after 2×5 cell', () => {
      // 5 chars: "ÄA115" = position 1 in 2×5, then position 5 in 3×3
      const result = twoByFiveSquare('ÄA115', hDef);
      expect(result).toBeDefined();
      // Should be smaller than a single 2×5 cell
      const cell = twoByFiveSquare('ÄA11', hDef);
      expect(result).toBeDefined();
      expect(cell).toBeDefined();
      const cellWidth = Math.abs(cell!.se[1] - cell!.nw[1]);
      const subWidth = Math.abs(result!.se[1] - result!.nw[1]);
      expect(subWidth).toBeCloseTo(cellWidth / 3, 0);
    });
  });
});
