import { describe, it, expect } from 'vitest';
import { snapRingToCellGrid } from '../snapRingToCellGrid.js';
import { pointInRing } from '../pointInRing.js';

describe('snapRingToCellGrid', () => {
  it('returns a cell-aligned staircase for an irregular polygon', () => {
    // Triangle with vertices not on any grid line. Cell size 10.
    const triangle: [number, number][] = [[2, 2], [28, 2], [15, 27]];
    const rings = snapRingToCellGrid(triangle, 10);
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) {
      for (const [x, y] of ring) {
        expect(x % 10).toBe(0);
        expect(y % 10).toBe(0);
      }
    }
  });

  it('preserves the centre of cells whose midpoint is inside the source ring', () => {
    const ring: [number, number][] = [[0, 0], [40, 0], [40, 40], [0, 40]];
    const rings = snapRingToCellGrid(ring, 10);
    expect(rings.length).toBe(1);
    expect(pointInRing(15, 15, rings[0]!)).toBe(true);
  });

  it('returns no rings when no cell midpoint lies inside the source', () => {
    const tiny: [number, number][] = [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]];
    expect(snapRingToCellGrid(tiny, 10)).toEqual([]);
  });

  it('returns no rings for invalid intervals', () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [5, 10]];
    expect(snapRingToCellGrid(ring, 0)).toEqual([]);
    expect(snapRingToCellGrid(ring, -5)).toEqual([]);
  });

  it('is idempotent on a ring that is already cell-aligned', () => {
    const aligned: [number, number][] = [[0, 0], [30, 0], [30, 30], [0, 30]];
    const rings = snapRingToCellGrid(aligned, 10);
    expect(rings.length).toBe(1);
    let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
    for (const [x, y] of rings[0]!) {
      if (x < sMinX) sMinX = x;
      if (x > sMaxX) sMaxX = x;
      if (y < sMinY) sMinY = y;
      if (y > sMaxY) sMaxY = y;
    }
    expect([sMinX, sMinY, sMaxX, sMaxY]).toEqual([0, 0, 30, 30]);
  });

  it('emits multiple rings when snapping produces disjoint valid regions', () => {
    // Dumbbell: two 2×2 cell clusters connected by a thin neck that a 10-unit
    // snap slices away. Cell midpoints along the neck lie outside the source
    // ring, so the snap produces two disjoint staircase rings.
    const dumbbell: [number, number][] = [
      [0, 0], [20, 0], [20, 20], [0, 20],        // left blob cells (0,0)–(1,1)
      [0, 12], [60, 12], [60, 8], [0, 8],        // thin neck y ∈ [8, 12] — below any cell midpoint
      [60, 0], [80, 0], [80, 20], [60, 20],      // right blob cells (6,0)–(7,1)
    ];
    // The polygon above isn't simple; feed a simpler two-region shape instead:
    // two separate squares with a gap. The snap of this is two rings.
    const twoSquares: [number, number][] = [
      // Outer traversal of two squares separated horizontally, using a narrow
      // bridge at negative y that's entirely outside any cell midpoint row.
      [0, 0], [20, 0], [20, 20], [0, 20], [0, 0],  // first square (closed)
    ];
    void dumbbell; void twoSquares;
    // Direct check: two disconnected rings from a more realistic config where
    // the cell-midpoint bitmap splits. Use a pinch-diagonal shape:
    //   . V        where . = invalid, V = valid (center cell's midpoint
    //   V .        falls outside the source ring)
    // Source ring traces the L-shape of two diagonally-touching 1-cell blobs.
    const diagonal: [number, number][] = [
      // Bottom-left cell [10..20] × [0..10] — midpoint (15, 5).
      // Top-right cell [0..10] × [10..20] — midpoint (5, 15).
      // Source ring wraps both with a narrow link via the shared corner.
      [10, 0], [20, 0], [20, 10], [10.01, 10], [10.01, 20], [0, 20], [0, 10], [10, 10],
    ];
    const rings = snapRingToCellGrid(diagonal, 10);
    // Expect two rings for the two diagonally-touching blobs.
    expect(rings.length).toBe(2);
  });
});
