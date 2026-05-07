import { describe, it, expect } from 'vitest';
import { pointInRing } from '../pointInRing.js';

describe('pointInRing', () => {
  const square: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10],
  ];

  it('returns true for a point strictly inside', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
  });

  it('returns false for a point strictly outside', () => {
    expect(pointInRing(-1, 5, square)).toBe(false);
    expect(pointInRing(15, 5, square)).toBe(false);
    expect(pointInRing(5, -1, square)).toBe(false);
    expect(pointInRing(5, 15, square)).toBe(false);
  });

  it('returns false for rings with fewer than 3 vertices', () => {
    expect(pointInRing(0, 0, [])).toBe(false);
    expect(pointInRing(0, 0, [[0, 0]])).toBe(false);
    expect(pointInRing(0, 0, [[0, 0], [1, 1]])).toBe(false);
  });

  it('handles concave rings', () => {
    // C-shape opening to the right
    const c: [number, number][] = [
      [0, 0], [10, 0], [10, 3], [3, 3],
      [3, 7], [10, 7], [10, 10], [0, 10],
    ];
    expect(pointInRing(1, 5, c)).toBe(true);   // inside the arm
    expect(pointInRing(8, 1, c)).toBe(true);   // bottom bar
    expect(pointInRing(6, 5, c)).toBe(false);  // inside the mouth cut-out
  });

  it('handles triangles', () => {
    const triangle: [number, number][] = [[0, 0], [10, 0], [5, 10]];
    expect(pointInRing(5, 2, triangle)).toBe(true);
    expect(pointInRing(5, 12, triangle)).toBe(false);
    expect(pointInRing(0, 5, triangle)).toBe(false);
  });
});
