import { describe, it, expect } from 'vitest';
import {
  clipPolygonToRect,
  polygonArea,
  polygonCentroid,
} from '../clipPolygonToRect.js';

describe('clipPolygonToRect', () => {
  it('keeps a polygon entirely inside the rect', () => {
    const out = clipPolygonToRect(
      [[1, 1], [2, 1], [2, 2], [1, 2]],
      0, 0, 5, 5,
    );
    expect(out).toEqual([[1, 1], [2, 1], [2, 2], [1, 2]]);
  });

  it('returns empty for a polygon entirely outside', () => {
    const out = clipPolygonToRect(
      [[10, 10], [12, 10], [12, 12], [10, 12]],
      0, 0, 5, 5,
    );
    expect(out).toEqual([]);
  });

  it('clips a square that straddles the right edge', () => {
    const out = clipPolygonToRect(
      [[0, 0], [10, 0], [10, 5], [0, 5]],
      0, 0, 5, 5,
    );
    // Should be clipped to [0,0]-[5,5] square.
    expect(out).toContainEqual([0, 0]);
    expect(out).toContainEqual([5, 0]);
    expect(out).toContainEqual([5, 5]);
    expect(out).toContainEqual([0, 5]);
  });

  it('clips a tilted polygon at one corner', () => {
    // A triangle sticking out of the top-right corner.
    const out = clipPolygonToRect(
      [[3, 3], [10, 4], [4, 10]],
      0, 0, 5, 5,
    );
    // Result must be inside the rect.
    for (const [x, y] of out) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(5);
    }
    // And must include the original (3,3) which was inside.
    expect(out).toContainEqual([3, 3]);
  });
});

describe('polygonArea', () => {
  it('returns 0 for degenerate polygons', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([[0, 0]])).toBe(0);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
  });

  it('computes a unit square area', () => {
    expect(polygonArea([[0, 0], [1, 0], [1, 1], [0, 1]])).toBeCloseTo(1, 12);
  });

  it('is independent of winding direction', () => {
    const ccw = polygonArea([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const cw = polygonArea([[0, 0], [0, 1], [1, 1], [1, 0]]);
    expect(ccw).toBe(cw);
  });
});

describe('polygonCentroid', () => {
  it('returns the centre of a unit square', () => {
    const c = polygonCentroid([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(c[0]).toBeCloseTo(0.5, 12);
    expect(c[1]).toBeCloseTo(0.5, 12);
  });

  it('shifts toward the wide side of an L-shape', () => {
    // L-shape biased toward +x at the bottom.
    const c = polygonCentroid([[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [0, 2]]);
    expect(c[0]).toBeGreaterThan(0.5);
    expect(c[1]).toBeLessThan(1);
  });

  it('falls back to the vertex mean for a degenerate sliver', () => {
    const c = polygonCentroid([[0, 0], [1, 0], [2, 0]]);
    expect(c[0]).toBeCloseTo(1, 12);
    expect(c[1]).toBeCloseTo(0, 12);
  });
});
