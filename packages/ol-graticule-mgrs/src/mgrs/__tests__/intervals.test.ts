import { describe, expect, it } from 'vitest';
import { MgrsIntervals } from '../intervals.js';

describe('MgrsIntervals.getInterval', () => {
  it('returns 1 m when resolution is sub-metre', () => {
    const intervals = new MgrsIntervals();
    expect(intervals.getInterval(0.01)).toBe(1);
  });

  it('snaps to 100 m at resolution 1 m/px with target=100 px (best log-distance match)', () => {
    // target = 100, candidates ≥ 50: {100, 1000, ...}; log-closest is 100.
    expect(new MgrsIntervals(100, 50).getInterval(1)).toBe(100);
  });

  it('never returns intervals tighter than the minScreenPx floor', () => {
    const intervals = new MgrsIntervals(100, 50);
    for (const res of [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000]) {
      const i = intervals.getInterval(res);
      // i ≥ res * minScreenPx, so i/res ≥ minScreenPx.
      expect(i / res).toBeGreaterThanOrEqual(50);
    }
  });

  it('caps at 100 000 m for very coarse resolutions', () => {
    const intervals = new MgrsIntervals();
    expect(intervals.getInterval(1_000_000)).toBe(100_000);
  });

  it('picks the nearest valid power of 10 when target sits between two', () => {
    // target = 50 (res=0.5, screen 100). minTarget=25 excludes 10, so the
    // log-closest valid candidate is 100 — even though 10 is closer in
    // linear distance, the minScreenPx floor wins.
    expect(new MgrsIntervals(100, 50).getInterval(0.5)).toBe(100);
  });

  it('a tighter screen target produces a smaller (or equal) interval than a looser one', () => {
    const tight = new MgrsIntervals(50, 25);
    const loose = new MgrsIntervals(200, 100);
    expect(tight.getInterval(1)).toBeLessThanOrEqual(loose.getInterval(1));
    expect(tight.getInterval(10)).toBeLessThanOrEqual(loose.getInterval(10));
  });
});

describe('MgrsIntervals.getMinorInterval', () => {
  it('returns undefined (no subdivision)', () => {
    const intervals = new MgrsIntervals();
    expect(intervals.getMinorInterval()).toBeUndefined();
  });
});
