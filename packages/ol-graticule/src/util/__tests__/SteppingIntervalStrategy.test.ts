import { describe, it, expect } from 'vitest';
import { SteppingIntervalStrategy } from '../SteppingIntervalStrategy.js';

describe('SteppingIntervalStrategy', () => {
  const intervals = [1, 2, 5, 10, 20, 50, 100];

  it('returns the smallest table entry >= resolution * targetScreenPx', () => {
    const s = new SteppingIntervalStrategy(intervals, 10);
    // resolution 0.3 * 10 = 3 → smallest entry >= 3 is 5
    expect(s.getInterval(0.3)).toBe(5);
  });

  it('returns the last entry when target exceeds every step', () => {
    const s = new SteppingIntervalStrategy(intervals, 10);
    // resolution 1000 * 10 = 10000 → falls through, returns last entry
    expect(s.getInterval(1000)).toBe(100);
  });

  it('returns the first entry when target is tiny', () => {
    const s = new SteppingIntervalStrategy(intervals, 10);
    expect(s.getInterval(0.01)).toBe(1);
  });

  it('getMinorInterval returns major / 5', () => {
    const s = new SteppingIntervalStrategy(intervals, 10);
    expect(s.getMinorInterval(50)).toBe(10);
    expect(s.getMinorInterval(1)).toBe(0.2);
  });

  it('scales with targetScreenPx', () => {
    const tight = new SteppingIntervalStrategy(intervals, 10);
    const wide = new SteppingIntervalStrategy(intervals, 50);
    // Same resolution, wider spacing: snap to a larger interval.
    expect(wide.getInterval(1)).toBeGreaterThanOrEqual(tight.getInterval(1));
  });
});
