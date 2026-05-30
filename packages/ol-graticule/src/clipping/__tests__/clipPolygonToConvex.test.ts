import { describe, it, expect } from 'vitest';
import { clipPolygonToConvex } from '../clipPolygonToConvex.js';

type Pt = [number, number];

function square(minX: number, minY: number, size: number): Pt[] {
  return [
    [minX, minY],
    [minX + size, minY],
    [minX + size, minY + size],
    [minX, minY + size],
  ];
}

function polygonArea(ring: ReadonlyArray<Pt>): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) * 0.5;
}

function vertexSet(ring: ReadonlyArray<Pt>): Set<string> {
  return new Set(ring.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`));
}

describe('clipPolygonToConvex', () => {
  it('returns the subject unchanged when fully inside the clip', () => {
    const subject = square(2, 2, 1);
    const clip = square(0, 0, 10);
    const result = clipPolygonToConvex(subject, clip);
    expect(vertexSet(result)).toEqual(vertexSet(subject));
    expect(polygonArea(result)).toBeCloseTo(1, 10);
  });

  it('returns the clip when subject fully covers it', () => {
    const subject = square(-10, -10, 30);
    const clip = square(0, 0, 4);
    const result = clipPolygonToConvex(subject, clip);
    expect(vertexSet(result)).toEqual(vertexSet(clip));
    expect(polygonArea(result)).toBeCloseTo(16, 10);
  });

  it('returns empty array when subject is fully outside the clip', () => {
    const subject = square(20, 20, 2);
    const clip = square(0, 0, 5);
    const result = clipPolygonToConvex(subject, clip);
    expect(result).toEqual([]);
  });

  it('clips a half-overlap to the exact sub-rectangle [5,0]–[10,10]', () => {
    const subject = square(0, 0, 10);
    const clip = square(5, 0, 10);
    const result = clipPolygonToConvex(subject, clip);
    expect(polygonArea(result)).toBeCloseTo(50, 10);
    const expectedCorners = vertexSet([
      [5, 0],
      [10, 0],
      [10, 10],
      [5, 10],
    ]);
    expect(vertexSet(result)).toEqual(expectedCorners);
  });

  it('CW and CCW clip rings produce the identical vertex set', () => {
    const subject = square(2, 2, 6);
    const clipCcw = square(0, 0, 10);
    const clipCw: Pt[] = [...clipCcw].reverse();
    const ccw = clipPolygonToConvex(subject, clipCcw);
    const cw = clipPolygonToConvex(subject, clipCw);
    expect(vertexSet(cw)).toEqual(vertexSet(ccw));
    expect(polygonArea(ccw)).toBeCloseTo(36, 10);
  });

  it('cuts a triangle into a pentagon when the hypotenuse leaves and re-enters the clip', () => {
    const triangle: Pt[] = [
      [0, 0],
      [10, 0],
      [0, 10],
    ];
    const clip = square(0, 0, 6);
    const result = clipPolygonToConvex(triangle, clip);
    expect(result.length).toBe(5);
    // Pentagon (0,0)-(6,0)-(6,4)-(4,6)-(0,6); area = 34 via shoelace.
    expect(polygonArea(result)).toBeCloseTo(34, 6);
    expect(vertexSet(result)).toEqual(
      vertexSet([
        [0, 0],
        [6, 0],
        [6, 4],
        [4, 6],
        [0, 6],
      ]),
    );
  });

  it('returns empty when the subject has fewer than 3 vertices', () => {
    expect(clipPolygonToConvex([[0, 0], [1, 1]], square(0, 0, 10))).toEqual([]);
  });

  it('returns empty when the clip polygon has zero area (collinear)', () => {
    const collinear: Pt[] = [[0, 0], [1, 0], [2, 0]];
    expect(clipPolygonToConvex(square(0, 0, 2), collinear)).toEqual([]);
  });
});

