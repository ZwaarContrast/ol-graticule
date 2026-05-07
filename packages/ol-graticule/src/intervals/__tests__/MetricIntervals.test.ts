import { describe, it, expect } from 'vitest';
import { MetricIntervals } from '../MetricIntervals.js';

describe('MetricIntervals', () => {
  const strategy = new MetricIntervals(100);

  it('returns 1m for very high resolution (zoomed in)', () => {
    // resolution * 100 = 0.5 → first interval >= 0.5 is 1
    expect(strategy.getInterval(0.005)).toBe(1);
  });

  it('returns 100m for moderate resolution', () => {
    // resolution * 100 = 80 → first interval >= 80 is 100
    expect(strategy.getInterval(0.8)).toBe(100);
  });

  it('returns 1000m (1km) for wider view', () => {
    // resolution * 100 = 800 → first interval >= 800 is 1000
    expect(strategy.getInterval(8)).toBe(1000);
  });

  it('returns 100000m for zoomed-out view', () => {
    // resolution * 100 = 50001 → first interval >= 50001 is 100000
    expect(strategy.getInterval(500.01)).toBe(100000);
  });

  it('returns fallback for extremely low resolution', () => {
    expect(strategy.getInterval(100000)).toBe(1000000);
  });

  it('getMinorInterval returns 1/5 of major interval', () => {
    expect(strategy.getMinorInterval(100)).toBe(20);
    expect(strategy.getMinorInterval(1000)).toBe(200);
  });
});
