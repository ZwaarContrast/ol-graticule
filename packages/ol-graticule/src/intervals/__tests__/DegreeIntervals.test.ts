import { describe, it, expect } from 'vitest';
import { DegreeIntervals } from '../DegreeIntervals.js';

describe('DegreeIntervals', () => {
  const strategy = new DegreeIntervals(100);

  it('returns 90° for very low resolution (zoomed way out)', () => {
    // resolution * 100 = 100 → first interval >= 100 is... none, fallback to 90
    // Actually resolution = 1 → target = 100, largest is 90 → fallback
    expect(strategy.getInterval(1)).toBe(90);
  });

  it('returns 10° for moderate resolution', () => {
    // resolution * 100 = 8 → first interval >= 8 is 10
    expect(strategy.getInterval(0.08)).toBe(10);
  });

  it('returns 1° when target is just under 1', () => {
    // resolution * 100 = 0.9 → first interval >= 0.9 is 1
    expect(strategy.getInterval(0.009)).toBe(1);
  });

  it('returns sub-degree intervals for high resolution', () => {
    // resolution * 100 = 0.01 → 1/60 ≈ 0.0167 (1 minute)
    const interval = strategy.getInterval(0.0001);
    expect(interval).toBeCloseTo(1 / 60, 6);
  });

  it('returns the smallest interval when resolution is extremely high', () => {
    const interval = strategy.getInterval(0.0000001);
    expect(interval).toBeCloseTo(1 / 3600, 8);
  });

  it('returns fallback (largest) for extremely low resolution', () => {
    // resolution * 100 = 10000 → exceeds all intervals, falls back to last (90)
    expect(strategy.getInterval(100)).toBe(90);
  });

  it('getMinorInterval returns 1/5 of major interval', () => {
    expect(strategy.getMinorInterval(10)).toBe(2);
    expect(strategy.getMinorInterval(1)).toBe(0.2);
  });

  it('respects custom targetScreenPx', () => {
    const wide = new DegreeIntervals(200);
    // resolution * 200 = 2 → first interval >= 2 is 2
    expect(wide.getInterval(0.01)).toBe(2);
  });
});
