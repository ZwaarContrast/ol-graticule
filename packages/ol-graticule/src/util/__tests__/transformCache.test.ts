import { describe, it, expect, vi } from 'vitest';
import { TransformCache, transformBatchCached } from '../transformCache.js';

function makeIdentityTransform(): (input: number[], output?: number[], stride?: number) => number[] {
  return (input, output, stride) => {
    const out = output ?? new Array<number>(input.length);
    const s = stride ?? 2;
    for (let i = 0; i < input.length; i += s) {
      out[i] = input[i]!;
      out[i + 1] = input[i + 1]!;
    }
    return out;
  };
}

describe('TransformCache', () => {
  it('stores and retrieves by (x, y) pair', () => {
    const c = new TransformCache();
    c.set(1.5, 2.5, [10, 20]);
    expect(c.get(1.5, 2.5)).toEqual([10, 20]);
    expect(c.get(2.5, 1.5)).toBeUndefined();
  });

  it('overwrites without growing size on repeat sets', () => {
    const c = new TransformCache();
    c.set(0, 0, [1, 1]);
    expect(c.size).toBe(1);
    c.set(0, 0, [2, 2]);
    expect(c.size).toBe(1);
    expect(c.get(0, 0)).toEqual([2, 2]);
  });

  it('bulk-clears once maxEntries is exceeded', () => {
    const c = new TransformCache(3);
    c.set(0, 0, [0, 0]);
    c.set(1, 0, [0, 0]);
    c.set(2, 0, [0, 0]);
    expect(c.size).toBe(3);
    c.set(3, 0, [0, 0]);
    expect(c.size).toBe(1);
    expect(c.get(0, 0)).toBeUndefined();
    expect(c.get(3, 0)).toEqual([0, 0]);
  });

  it('clears on demand', () => {
    const c = new TransformCache();
    c.set(1, 1, [1, 1]);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get(1, 1)).toBeUndefined();
  });
});

describe('transformBatchCached', () => {
  it('calls the underlying transformFn once for a fresh batch', () => {
    const c = new TransformCache();
    const id = vi.fn(makeIdentityTransform());
    const input = [1, 2, 3, 4, 5, 6];
    const output = new Array<number>(6);
    const result = transformBatchCached(input, output, 2, id, c);
    expect(result).toBe(output);
    expect(output).toEqual([1, 2, 3, 4, 5, 6]);
    expect(id).toHaveBeenCalledTimes(1);
    expect(c.size).toBe(3);
  });

  it('serves repeat calls from cache without invoking transformFn', () => {
    const c = new TransformCache();
    const id = vi.fn(makeIdentityTransform());
    const input = [1, 2, 3, 4];
    transformBatchCached(input, new Array<number>(4), 2, id, c);
    expect(id).toHaveBeenCalledTimes(1);
    id.mockClear();
    transformBatchCached(input, new Array<number>(4), 2, id, c);
    expect(id).not.toHaveBeenCalled();
  });

  it('only sends cache-miss points through transformFn for mixed batches', () => {
    const c = new TransformCache();
    c.set(1, 2, [100, 200]);
    const sawInputs: number[][] = [];
    const id = vi.fn((input: number[], output?: number[], stride?: number) => {
      sawInputs.push([...input]);
      return makeIdentityTransform()(input, output, stride);
    });
    const input = [1, 2, 3, 4, 5, 6];
    const output = new Array<number>(6);
    transformBatchCached(input, output, 2, id, c);
    expect(output).toEqual([100, 200, 3, 4, 5, 6]);
    expect(sawInputs).toEqual([[3, 4, 5, 6]]);
    expect(c.size).toBe(3);
  });

  it('passes through unmodified for stride !== 2', () => {
    const c = new TransformCache();
    const id = vi.fn(makeIdentityTransform());
    const input = [1, 2, 9, 3, 4, 9];
    const output = new Array<number>(6);
    transformBatchCached(input, output, 3, id, c);
    expect(id).toHaveBeenCalledTimes(1);
    expect(c.size).toBe(0);
  });

  it('handles in-place transforms (input === output)', () => {
    const c = new TransformCache();
    const flipXY = (input: number[], output?: number[], stride?: number) => {
      const out = output ?? new Array<number>(input.length);
      const s = stride ?? 2;
      for (let i = 0; i < input.length; i += s) {
        const x = input[i]!;
        const y = input[i + 1]!;
        out[i] = y;
        out[i + 1] = x;
      }
      return out;
    };
    const buf = [1, 2, 3, 4];
    transformBatchCached(buf, buf, 2, flipXY, c);
    expect(buf).toEqual([2, 1, 4, 3]);
    expect(c.get(1, 2)).toEqual([2, 1]);
    expect(c.get(3, 4)).toEqual([4, 3]);
  });
});
