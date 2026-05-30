import { describe, it, expect } from 'vitest';
import { clipPolylineToPolygon } from '../clipPolylineToPolygon.js';
import { PolygonEdgeIndex } from '../PolygonEdgeIndex.js';

type Pt = [number, number];

const square: Pt[] = [
  [0, 0], [10, 0], [10, 10], [0, 10],
];

function clip(polyline: Pt[], index: PolygonEdgeIndex): Pt[][] {
  const flat: number[] = [];
  for (const p of polyline) flat.push(p[0], p[1]);
  const pieces = clipPolylineToPolygon(flat, 0, flat.length, 2, index);
  return pieces.map((piece) => {
    const out: Pt[] = [];
    for (let i = 0; i < piece.length; i += 2) out.push([piece[i]!, piece[i + 1]!]);
    return out;
  });
}

describe('clipPolylineToPolygon', () => {
  it('returns empty for a polyline entirely outside the ring AABB', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[100, 100], [200, 200]], index);
    expect(result).toEqual([]);
  });

  it('returns empty for a polyline outside the ring but inside its AABB', () => {
    const l: Pt[] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
    const index = new PolygonEdgeIndex(l);
    const result = clip([[6, 6], [9, 9]], index);
    expect(result).toEqual([]);
  });

  it('returns a copy for a polyline entirely inside', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[2, 2], [3, 3], [4, 4]], index);
    expect(result).toEqual([[[2, 2], [3, 3], [4, 4]]]);
  });

  it('clips a segment that enters the ring', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[-5, 5], [5, 5]], index);
    expect(result).toHaveLength(1);
    expect(result[0]!.length).toBe(2);
    expect(result[0]![0]).toEqual([0, 5]);
    expect(result[0]![1]).toEqual([5, 5]);
  });

  it('clips a segment that exits the ring', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[5, 5], [15, 5]], index);
    expect(result).toHaveLength(1);
    expect(result[0]![0]).toEqual([5, 5]);
    expect(result[0]![1]).toEqual([10, 5]);
  });

  it('clips a segment that crosses the ring twice (both endpoints outside)', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[-5, 5], [15, 5]], index);
    expect(result).toHaveLength(1);
    expect(result[0]![0]).toEqual([0, 5]);
    expect(result[0]![1]).toEqual([10, 5]);
  });

  it('returns empty for a segment parallel to and outside the ring', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[-5, -1], [15, -1]], index);
    expect(result).toEqual([]);
  });

  it('handles a multi-vertex polyline that crosses in and out', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[-5, 5], [5, 5], [15, 5]], index);
    expect(result).toHaveLength(1);
    expect(result[0]![0]).toEqual([0, 5]);
    expect(result[0]![result[0]!.length - 1]).toEqual([10, 5]);
  });

  it('emits two separate runs for a polyline that exits and re-enters', () => {
    const index = new PolygonEdgeIndex(square);
    const result = clip([[2, 5], [-2, 5], [-2, 7], [2, 7]], index);
    expect(result).toHaveLength(2);
    expect(result[0]![0]).toEqual([2, 5]);
    expect(result[0]![1]).toEqual([0, 5]);
    expect(result[1]![0]).toEqual([0, 7]);
    expect(result[1]![1]).toEqual([2, 7]);
  });

  it('handles a concave-polygon bite for a segment with both endpoints inside', () => {
    const u: Pt[] = [
      [0, 0], [10, 0], [10, 10], [7, 10],
      [7, 3], [3, 3], [3, 10], [0, 10],
    ];
    const index = new PolygonEdgeIndex(u);
    const result = clip([[1, 6], [9, 6]], index);
    expect(result).toHaveLength(2);
    expect(result[0]![0]).toEqual([1, 6]);
    expect(result[0]![result[0]!.length - 1]).toEqual([3, 6]);
    expect(result[1]![0]).toEqual([7, 6]);
    expect(result[1]![result[1]!.length - 1]).toEqual([9, 6]);
  });

  it('returns empty for a degenerate polyline (< 2 vertices)', () => {
    const index = new PolygonEdgeIndex(square);
    expect(clip([], index)).toEqual([]);
    expect(clip([[5, 5]], index)).toEqual([]);
  });
});
