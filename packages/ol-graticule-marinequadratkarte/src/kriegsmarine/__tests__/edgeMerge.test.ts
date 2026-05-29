import { describe, expect, it } from 'vitest';
import { mergeEdges, polyEdges, rectEdges } from '../edgeMerge.js';
import type { PolySquare, RectSquare } from '../types.js';

function rect(id: string, nw: [number, number], se: [number, number]): RectSquare {
  return { id, nw, se };
}

describe('rectEdges', () => {
  it('emits 4 edges for an axis-aligned rect: 2 horizontal + 2 vertical', () => {
    const r = rect('AA', [50, -10], [40, 0]);
    const edges = rectEdges(r, 0);
    const horiz = edges.filter((e) => e.axis === 'h');
    const vert = edges.filter((e) => e.axis === 'v');
    expect(horiz.length).toBe(2);
    expect(vert.length).toBe(2);
  });

  it('emits diagonal edges for antimeridian-crossing rect', () => {
    const r = rect('XL', [60, 170], [50, -170]);
    const edges = rectEdges(r, 0);
    expect(edges.every((e) => e.axis === 'd')).toBe(true);
    expect(edges.length).toBe(4);
  });

  it('horizontal edge spans the full longitude range and vice versa', () => {
    const r = rect('AA', [50, -10], [40, 0]);
    const horiz = rectEdges(r, 0).filter((e) => e.axis === 'h');
    for (const e of horiz) {
      if (e.axis === 'h') {
        expect(e.lo).toBe(-10);
        expect(e.hi).toBe(0);
      }
    }
  });
});

describe('polyEdges', () => {
  it('classifies axis-aligned poly edges as h/v and tilted ones as diagonal', () => {
    const poly: PolySquare = {
      id: 'P',
      poly: [
        [50, 0],
        [50, 5],
        [45, 5],
        [40, 2],
        [45, 0],
      ],
    };
    const edges = polyEdges(poly, 0);
    expect(edges.length).toBe(5);
    expect(edges.some((e) => e.axis === 'h')).toBe(true);
    expect(edges.some((e) => e.axis === 'v')).toBe(true);
    expect(edges.some((e) => e.axis === 'd')).toBe(true);
  });
});

describe('mergeEdges', () => {
  it('merges two collinear adjacent vertical edges into one segment', () => {
    const a = rectEdges(rect('A', [50, 0], [40, 1]), 0);
    const b = rectEdges(rect('B', [40, 0], [30, 1]), 0);
    const merged = mergeEdges([...a, ...b]);
    const leftEdges = merged.filter((e) => e.axis === 'v' && e.lon === 0);
    expect(leftEdges.length).toBe(1);
    if (leftEdges[0]!.axis === 'v') {
      expect(leftEdges[0]!.latLo).toBe(30);
      expect(leftEdges[0]!.latHi).toBe(50);
      expect(leftEdges[0]!.squareIds.length).toBe(2);
    }
  });

  it('keeps disjoint vertical edges separate', () => {
    const a = rectEdges(rect('A', [50, 0], [45, 1]), 0);
    const b = rectEdges(rect('B', [40, 0], [35, 1]), 0);
    const merged = mergeEdges([...a, ...b]);
    const leftEdges = merged.filter((e) => e.axis === 'v' && e.lon === 0);
    expect(leftEdges.length).toBe(2);
  });

  it('promotes merged depth to the max contributing depth', () => {
    const shallow = rectEdges(rect('A', [50, 0], [40, 1]), 0);
    const deep = rectEdges(rect('B', [40, 0], [30, 1]), 3);
    const merged = mergeEdges([...shallow, ...deep]);
    const leftEdges = merged.filter((e) => e.axis === 'v' && e.lon === 0);
    expect(leftEdges[0]!.depth).toBe(3);
  });

  it('deduplicates identical diagonal edges into one', () => {
    const r1 = rect('X', [60, 170], [50, -170]);
    const r2 = rect('Y', [60, 170], [50, -170]);
    const merged = mergeEdges([
      ...rectEdges(r1, 0),
      ...rectEdges(r2, 0),
    ]);
    expect(merged.length).toBe(4);
  });
});
