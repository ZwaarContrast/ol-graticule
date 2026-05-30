import { describe, it, expect } from 'vitest';
import { polygonArea, signedArea } from '../polygonArea.js';

type Pt = [number, number];

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

describe('signedArea', () => {
  it('is positive for CCW rings and negative for CW rings', () => {
    const ccw: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const cw: Pt[] = [...ccw].reverse();
    expect(signedArea(ccw)).toBeCloseTo(1, 12);
    expect(signedArea(cw)).toBeCloseTo(-1, 12);
  });
});
