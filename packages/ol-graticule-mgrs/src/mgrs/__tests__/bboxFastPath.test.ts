import { describe, expect, it } from 'vitest';
import { inspectBboxRelToRect } from '../bboxFastPath.js';

describe('inspectBboxRelToRect', () => {
  it('marks input fully inside the clip rect', () => {
    const result = inspectBboxRelToRect(
      [[1, 1], [4, 4], [2, 3]],
      0, 0, 10, 10,
    );
    expect(result.allInside).toBe(true);
    expect(result.outsideRect).toBe(false);
  });

  it('marks input fully outside the clip rect (to the right)', () => {
    const result = inspectBboxRelToRect(
      [[20, 20], [30, 30]],
      0, 0, 10, 10,
    );
    expect(result.allInside).toBe(false);
    expect(result.outsideRect).toBe(true);
  });

  it('marks input fully outside the clip rect (above)', () => {
    const result = inspectBboxRelToRect(
      [[5, 100], [6, 200]],
      0, 0, 10, 10,
    );
    expect(result.outsideRect).toBe(true);
  });

  it('marks partial overlap as neither fully inside nor fully outside', () => {
    const result = inspectBboxRelToRect(
      [[5, 5], [15, 15]],
      0, 0, 10, 10,
    );
    expect(result.allInside).toBe(false);
    expect(result.outsideRect).toBe(false);
  });

  it('input on the clip edge counts as inside (closed rect)', () => {
    const result = inspectBboxRelToRect(
      [[0, 0], [10, 10]],
      0, 0, 10, 10,
    );
    expect(result.allInside).toBe(true);
  });

  it('empty input returns allInside=true, outsideRect=true', () => {
    const result = inspectBboxRelToRect([], 0, 0, 10, 10);
    expect(result.allInside).toBe(true);
    expect(result.outsideRect).toBe(true);
  });
});
