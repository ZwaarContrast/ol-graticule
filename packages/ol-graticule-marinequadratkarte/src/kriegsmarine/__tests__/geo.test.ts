import { describe, it, expect } from 'vitest';
import {
  rectCrossesAntimeridian,
  interpolateLon,
  lonSpanDeg,
  squareExtent,
  squareCenter,
} from '../geo.js';
import type { RectSquare, PolySquare } from '../types.js';

describe('rectCrossesAntimeridian', () => {
  it('is true when east-to-west longitude span exceeds 180°', () => {
    // NW at 170°E, SE at -170°E (i.e. 190° round the short way), crosses.
    expect(rectCrossesAntimeridian([55, 170], [50, -170])).toBe(true);
  });

  it('is false for ordinary rectangles that don\'t cross the date line', () => {
    expect(rectCrossesAntimeridian([55, -10], [50, 10])).toBe(false);
    expect(rectCrossesAntimeridian([55, 170], [50, 179])).toBe(false);
  });

  it('uses absolute longitude difference > 180', () => {
    // Exactly 180°: not crossing (Math.abs > 180 is strict).
    expect(rectCrossesAntimeridian([0, -90], [0, 90])).toBe(false);
  });
});

describe('interpolateLon', () => {
  it('linearly interpolates within a 180° span', () => {
    expect(interpolateLon(0, 10, 0)).toBeCloseTo(0);
    expect(interpolateLon(0, 10, 0.5)).toBeCloseTo(5);
    expect(interpolateLon(0, 10, 1)).toBeCloseTo(10);
  });

  it('wraps across the anti-meridian along the shorter path (east)', () => {
    // 170°E → -170°E via the date line: shorter path is +20°, so t=0.5 → 180°.
    const mid = interpolateLon(170, -170, 0.5);
    expect(mid).toBeCloseTo(180);
  });

  it('wraps across the anti-meridian along the shorter path (west)', () => {
    // -170°E → 170°E via the date line: shorter path is -20°, so t=0.5 → -180°.
    const mid = interpolateLon(-170, 170, 0.5);
    expect(mid).toBeCloseTo(-180);
  });

  it('returns monotonic longitudes that may exceed ±180', () => {
    // Full sweep through the date line: endpoints should sit 20° apart in
    // the direction of travel, not 340°.
    const start = interpolateLon(170, -170, 0);
    const end = interpolateLon(170, -170, 1);
    expect(end - start).toBeCloseTo(20);
  });
});

describe('lonSpanDeg', () => {
  it('returns the raw difference when ≤ 180°', () => {
    expect(lonSpanDeg([0, -10], [0, 10])).toBeCloseTo(20);
  });

  it('returns the shorter arc for anti-meridian-crossing rectangles', () => {
    // 170°E to -170°E: long way 340°, short way 20°.
    expect(lonSpanDeg([0, 170], [0, -170])).toBeCloseTo(20);
  });

  it('is symmetric (order-independent in absolute value)', () => {
    expect(lonSpanDeg([0, 10], [0, -10])).toBeCloseTo(20);
  });
});

describe('squareExtent', () => {
  it('returns [minLon, minLat, maxLon, maxLat] for a normal rectangle', () => {
    const sq: RectSquare = {
      id: 'X1',
      nw: [55, -10],
      se: [45, 10],
    };
    expect(squareExtent(sq)).toEqual([-10, 45, 10, 55]);
  });

  it('expands anti-meridian rectangles to the full [-180, 180] lon band', () => {
    // This is lossy by design: the grid system renders the wrap separately.
    const sq: RectSquare = {
      id: 'X2',
      nw: [55, 170],
      se: [45, -170],
    };
    expect(squareExtent(sq)).toEqual([-180, 45, 180, 55]);
  });

  it('computes a bounding box over polygon vertices', () => {
    const sq: PolySquare = {
      id: 'P1',
      poly: [
        [60, -30], [65, -20], [55, -10], [50, -40],
      ],
    };
    expect(squareExtent(sq)).toEqual([-40, 50, -10, 65]);
  });

  it('memoizes per-square (same reference returns same extent array)', () => {
    const sq: RectSquare = { id: 'M1', nw: [10, -10], se: [0, 10] };
    const a = squareExtent(sq);
    const b = squareExtent(sq);
    expect(a).toBe(b);
  });
});

describe('squareCenter', () => {
  it('returns the geometric midpoint of a normal rectangle (on 4326 view)', () => {
    const sq: RectSquare = { id: 'C1', nw: [10, -10], se: [0, 10] };
    const [x, y] = squareCenter(sq, 'EPSG:4326');
    expect(x).toBeCloseTo(0); // (-10 + 10) / 2
    expect(y).toBeCloseTo(5); // (10 + 0) / 2
  });

  it('places the center at the anti-meridian for a date-line-crossing rect', () => {
    const sq: RectSquare = { id: 'C2', nw: [10, 170], se: [0, -170] };
    const [x] = squareCenter(sq, 'EPSG:4326');
    // lonSpan is 20°, normalized center of 170 + 10 is ±180.
    expect(Math.abs(Math.abs(x) - 180)).toBeLessThan(1e-6);
  });

  it('returns the centroid of a polygonal extent for PolySquares', () => {
    const sq: PolySquare = {
      id: 'PC1',
      poly: [[60, -30], [60, 10], [40, 10], [40, -30]],
    };
    const [x, y] = squareCenter(sq, 'EPSG:4326');
    expect(x).toBeCloseTo(-10); // ((-30) + 10) / 2
    expect(y).toBeCloseTo(50); // (40 + 60) / 2
  });
});

