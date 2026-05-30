import { describe, it, expect } from 'vitest';
import { clipPolylineToRect } from '../clipPolylineToRect.js';

describe('clipPolylineToRect', () => {
  it('returns the input polyline unchanged when entirely inside', () => {
    const out = clipPolylineToRect(
      [[1, 1], [2, 2], [3, 1]],
      0, 0, 4, 4,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual([[1, 1], [2, 2], [3, 1]]);
  });

  it('returns an empty list when entirely outside', () => {
    const out = clipPolylineToRect(
      [[10, 10], [20, 20]],
      0, 0, 5, 5,
    );
    expect(out).toEqual([]);
  });

  it('clips at the rect boundary on entry', () => {
    const out = clipPolylineToRect(
      [[-1, 0], [3, 0]],
      0, -5, 5, 5,
    );
    expect(out).toHaveLength(1);
    expect(out[0]![0]).toEqual([0, 0]);
    expect(out[0]![1]).toEqual([3, 0]);
  });

  it('clips at the rect boundary on exit', () => {
    const out = clipPolylineToRect(
      [[2, 0], [10, 0]],
      0, -5, 5, 5,
    );
    expect(out).toHaveLength(1);
    expect(out[0]![0]).toEqual([2, 0]);
    expect(out[0]![1]).toEqual([5, 0]);
  });

  it('breaks a polyline that exits and re-enters into multiple pieces', () => {
    // Polyline goes inside → outside → inside.
    const out = clipPolylineToRect(
      [[1, 0], [10, 0], [10, 10], [1, 10]],
      0, -5, 5, 12,
    );
    expect(out).toHaveLength(2);
    // First piece: from (1,0) to the right boundary at x=5.
    expect(out[0]![0]).toEqual([1, 0]);
    expect(out[0]![out[0]!.length - 1]).toEqual([5, 0]);
    // Second piece: re-entry from the right at y=10 to (1,10).
    expect(out[1]![out[1]!.length - 1]).toEqual([1, 10]);
  });

  it('handles a segment fully outside on one side without breaking neighbours', () => {
    // Down-up-down pattern; the middle segment exits the top.
    const out = clipPolylineToRect(
      [[0, 0], [0, 5], [5, 5], [5, 0]],
      -1, -1, 6, 4,
    );
    // First piece: starts at (0,0), goes up to (0,4) where it exits.
    expect(out[0]![0]).toEqual([0, 0]);
    expect(out[0]![out[0]!.length - 1]).toEqual([0, 4]);
    // Last piece: re-enters at (5,4) and goes down to (5,0).
    const last = out[out.length - 1]!;
    expect(last[0]).toEqual([5, 4]);
    expect(last[last.length - 1]).toEqual([5, 0]);
  });
});
