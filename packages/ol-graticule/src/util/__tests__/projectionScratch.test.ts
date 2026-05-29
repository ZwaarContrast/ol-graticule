import { describe, it, expect } from 'vitest';
import { ProjectionScratch } from '../projectionScratch.js';

describe('ProjectionScratch', () => {
  it('starts empty', () => {
    const s = new ProjectionScratch();
    expect(s.length).toBe(0);
    expect(s.raw).toEqual([]);
  });

  it('push2 appends interleaved x/y pairs', () => {
    const s = new ProjectionScratch();
    s.push2(1, 2);
    s.push2(3, 4);
    expect(s.length).toBe(4);
    expect(s.raw).toEqual([1, 2, 3, 4]);
  });

  it('getX and getY index by pair', () => {
    const s = new ProjectionScratch();
    s.push2(10, 20);
    s.push2(30, 40);
    expect(s.getX(0)).toBe(10);
    expect(s.getY(0)).toBe(20);
    expect(s.getX(1)).toBe(30);
    expect(s.getY(1)).toBe(40);
  });

  it('reset truncates logical length', () => {
    const s = new ProjectionScratch();
    s.push2(1, 2);
    s.push2(3, 4);
    s.reset();
    expect(s.length).toBe(0);
    expect(s.raw).toEqual([]);
  });

  it('truncate sets length explicitly', () => {
    const s = new ProjectionScratch();
    s.push2(1, 2);
    s.push2(3, 4);
    s.push2(5, 6);
    s.truncate(2);
    expect(s.length).toBe(2);
    expect(s.raw).toEqual([1, 2]);
  });

  it('slice copies a range of pairs as a new flat array', () => {
    const s = new ProjectionScratch();
    s.push2(1, 2);
    s.push2(3, 4);
    s.push2(5, 6);
    expect(s.slice(2, 2)).toEqual([3, 4, 5, 6]);
  });

  it('transform applies a transform function in place', () => {
    const s = new ProjectionScratch();
    s.push2(1, 2);
    s.push2(3, 4);
    const doubleAll = (input: number[], output: number[] | undefined, stride: number): number[] => {
      const out = output ?? new Array<number>(input.length);
      for (let i = 0; i < input.length; i += stride) {
        out[i] = input[i]! * 2;
        out[i + 1] = input[i + 1]! * 2;
      }
      return out;
    };
    s.transform(doubleAll);
    expect(s.raw).toEqual([2, 4, 6, 8]);
  });

  it('transform is a no-op on an empty buffer', () => {
    const s = new ProjectionScratch();
    let called = false;
    s.transform(() => {
      called = true;
      return [];
    });
    expect(called).toBe(false);
  });
});
