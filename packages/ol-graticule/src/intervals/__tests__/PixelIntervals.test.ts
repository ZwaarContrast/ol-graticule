import { describe, it, expect } from 'vitest';
import { PixelIntervals } from '../PixelIntervals.js';

describe('PixelIntervals', () => {
  const strategy = new PixelIntervals(120);

  it('returns 1px for very high resolution (zoomed in)', () => {
    // resolution * 120 = 0.12 → first interval >= 0.12 is 1
    expect(strategy.getInterval(0.001)).toBe(1);
  });

  it('returns 5px for moderate zoom', () => {
    // resolution * 120 = 4.8 → first interval >= 4.8 is 5
    expect(strategy.getInterval(0.04)).toBe(5);
  });

  it('returns 100px for wider view', () => {
    // resolution * 120 = 60 → first interval >= 60 is 100
    expect(strategy.getInterval(0.5)).toBe(100);
  });

  it('returns 1000px for zoomed-out view', () => {
    // resolution * 120 = 600 → first interval >= 600 is 1000
    expect(strategy.getInterval(5)).toBe(1000);
  });

  it('returns fallback for extremely zoomed out', () => {
    expect(strategy.getInterval(10000)).toBe(100000);
  });

  it('getMinorInterval returns 1/5 of major interval', () => {
    expect(strategy.getMinorInterval(100)).toBe(20);
    expect(strategy.getMinorInterval(50)).toBe(10);
  });

  it('respects custom targetScreenPx', () => {
    const custom = new PixelIntervals(60);
    // resolution * 60 = 3 → first interval >= 3 is 5
    expect(custom.getInterval(0.05)).toBe(5);
  });
});
