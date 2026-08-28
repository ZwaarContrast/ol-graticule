import { describe, it, expect } from 'vitest';
import { lineIntersection } from '../lensGeometry.js';

describe('lineIntersection', () => {
  const out: [number, number] = [0, 0];

  it('reduces to (a.x, b.y) for screen-axis-aligned segments (rotation 0)', () => {
    // Vertical meridian at x=30, horizontal parallel at y=70.
    const p = lineIntersection(30, 0, 30, 100, 0, 70, 100, 70, out);
    expect(p).not.toBeNull();
    expect(p?.[0]).toBeCloseTo(30);
    expect(p?.[1]).toBeCloseTo(70);
  });

  it('finds the true crossing of two perpendicular 45° lines (rotated grid)', () => {
    // A meridian and parallel both at 45°, crossing at (50, 50). Short segments
    // that do NOT overlap: the infinite lines still meet at the grid crossing,
    // which the old row/column-product approach would miss under rotation.
    const meridian = [40, 40, 45, 45]; // direction (1, 1)
    const parallel = [60, 40, 55, 45]; // direction (-1, 1)
    const p = lineIntersection(
      meridian[0], meridian[1], meridian[2], meridian[3],
      parallel[0], parallel[1], parallel[2], parallel[3],
      out,
    );
    expect(p).not.toBeNull();
    expect(p?.[0]).toBeCloseTo(50);
    expect(p?.[1]).toBeCloseTo(50);
  });

  it('returns null for parallel segments', () => {
    expect(lineIntersection(0, 0, 10, 0, 0, 5, 10, 5, out)).toBeNull();
    expect(lineIntersection(0, 0, 5, 5, 1, 0, 6, 5, out)).toBeNull();
  });
});
