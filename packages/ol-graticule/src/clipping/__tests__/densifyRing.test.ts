import { describe, it, expect } from 'vitest';
import { densifyRing, projectRing } from '../densifyRing.js';

describe('densifyRing', () => {
  it('returns a copy when stepsPerEdge is 1', () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const out = densifyRing(ring, 1);
    expect(out).toEqual(ring);
    expect(out).not.toBe(ring);
  });

  it('inserts intermediate points along each edge', () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const out = densifyRing(ring, 4);
    expect(out).toHaveLength(16);
    // First edge: (0,0) → (10,0) with t = 0, 0.25, 0.5, 0.75
    expect(out[0]).toEqual([0, 0]);
    expect(out[1]).toEqual([2.5, 0]);
    expect(out[2]).toEqual([5, 0]);
    expect(out[3]).toEqual([7.5, 0]);
    expect(out[4]).toEqual([10, 0]);
  });

  it('keeps the ring open (no duplicated closing vertex)', () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const out = densifyRing(ring, 2);
    expect(out[0]).not.toEqual(out[out.length - 1]);
  });

  it('treats negative or zero stepsPerEdge as 1', () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    expect(densifyRing(ring, 0)).toEqual(ring);
    expect(densifyRing(ring, -5)).toEqual(ring);
  });
});

describe('projectRing', () => {
  it('returns identity when from === to', () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const out = projectRing(ring, 'EPSG:3857', 'EPSG:3857');
    expect(out).toEqual(ring);
  });

  it('reprojects EPSG:3857 coords to EPSG:4326', () => {
    // Equator-and-meridian point in web mercator = [0, 0] in lon/lat
    const ring: [number, number][] = [[0, 0], [1113195, 0], [1113195, 1118890]];
    const out = projectRing(ring, 'EPSG:3857', 'EPSG:4326');
    expect(out).toHaveLength(3);
    expect(out[0]![0]).toBeCloseTo(0, 5);
    expect(out[0]![1]).toBeCloseTo(0, 5);
    expect(out[1]![0]).toBeCloseTo(10, 2);
    expect(out[2]![0]).toBeCloseTo(10, 2);
    expect(out[2]![1]).toBeCloseTo(10, 0);
  });
});
