import { describe, it, expect } from 'vitest';
import type { TransformFunction } from 'ol/proj';
import type { Extent } from 'ol/extent';
import { isOnMajorLine, adaptiveAxisTs } from '../gridlines.js';

/** Identity transform: straight CRS lines stay straight in view space. */
const identity: TransformFunction = (input, output) => {
  const out = output ?? input.slice();
  for (let i = 0; i < input.length; i++) {
    const v = input[i];
    if (v !== undefined) out[i] = v;
  }
  return out;
};

/** Bows points by `k·x·(100−x)` in y, so horizontal lines (const y) curve. */
const bow = (k: number): TransformFunction => (input, output, dimension = 2) => {
  const out = output ?? input.slice();
  for (let i = 0; i < input.length; i += dimension) {
    const x = input[i];
    const y = input[i + 1];
    if (x === undefined || y === undefined) continue;
    out[i] = x;
    out[i + 1] = y + k * x * (100 - x);
  }
  return out;
};

const nanTransform: TransformFunction = (input, output) => {
  const out = output ?? input.slice();
  for (let i = 0; i < input.length; i++) out[i] = NaN;
  return out;
};

const unit: Extent = [0, 0, 100, 100];

describe('isOnMajorLine', () => {
  it('is true when value sits exactly on a major multiple', () => {
    expect(isOnMajorLine(0, 10, 0.01)).toBe(true);
    expect(isOnMajorLine(10, 10, 0.01)).toBe(true);
    expect(isOnMajorLine(-30, 10, 0.01)).toBe(true);
    expect(isOnMajorLine(2.5, 0.5, 1e-9)).toBe(true);
  });

  it('is false when value is further than epsilon from any major', () => {
    expect(isOnMajorLine(5, 10, 0.01)).toBe(false);
    expect(isOnMajorLine(10.5, 10, 0.01)).toBe(false);
  });

  it('absorbs floating-point drift within epsilon', () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v += 0.1;
    expect(v).not.toBe(10);
    expect(isOnMajorLine(v, 10, 0.0001)).toBe(true);
  });

  it('treats epsilon strictly: equal to epsilon is not on the line', () => {
    expect(isOnMajorLine(0.01, 10, 0.01)).toBe(false);
    expect(isOnMajorLine(0.009, 10, 0.01)).toBe(true);
  });
});

describe('adaptiveAxisTs', () => {
  const monotonic = (ts: number[]): boolean =>
    ts[0] === 0 && ts[ts.length - 1] === 1 && ts.every((t, i) => i === 0 || t > ts[i - 1]!);

  it('returns [0, 1] (2 points) under an identity transform', () => {
    expect(adaptiveAxisTs('x', unit, identity, 1, 64)).toEqual([0, 1]);
    expect(adaptiveAxisTs('y', unit, identity, 1, 64)).toEqual([0, 1]);
  });

  it('returns more, monotonic samples for an axis whose lines curve in view', () => {
    // bow() curves horizontal lines (const y), leaves vertical lines (const x) straight.
    const yTs = adaptiveAxisTs('y', unit, bow(0.01), 1, 64);
    expect(yTs.length).toBeGreaterThan(2);
    expect(monotonic(yTs)).toBe(true);
    expect(adaptiveAxisTs('x', unit, bow(0.01), 1, 64)).toEqual([0, 1]);
  });

  it('grows the sample count with curvature', () => {
    const mild = adaptiveAxisTs('y', unit, bow(0.005), 1, 1000).length;
    const sharp = adaptiveAxisTs('y', unit, bow(0.05), 1, 1000).length;
    expect(sharp).toBeGreaterThan(mild);
  });

  it('clamps to the cap', () => {
    expect(adaptiveAxisTs('y', unit, bow(10), 1, 8).length).toBeLessThanOrEqual(9);
  });

  it('treats a degenerate (all non-finite) transform as straight', () => {
    expect(adaptiveAxisTs('y', unit, nanTransform, 1, 16)).toEqual([0, 1]);
  });

  it('needs fewer samples at coarser resolution (larger pixels)', () => {
    const fine = adaptiveAxisTs('y', unit, bow(0.02), 1, 1000).length;
    const coarse = adaptiveAxisTs('y', unit, bow(0.02), 10, 1000).length;
    expect(coarse).toBeLessThan(fine);
  });

  it('clusters samples where the curvature is (concentrated in one bucket)', () => {
    // Curve only the last eighth of the sweep; samples should bunch near t=1.
    const hook: TransformFunction = (input, output, dimension = 2) => {
      const out = output ?? input.slice();
      for (let i = 0; i < input.length; i += dimension) {
        const x = input[i]!, y = input[i + 1]!;
        out[i] = x;
        out[i + 1] = y + (x > 87.5 ? (x - 87.5) * (x - 87.5) : 0);
      }
      return out;
    };
    const ts = adaptiveAxisTs('y', unit, hook, 1, 1000);
    const inHook = ts.filter((t) => t > 0.875).length;
    const elsewhere = ts.filter((t) => t > 0 && t <= 0.875).length;
    expect(inHook).toBeGreaterThan(elsewhere);
  });
});
