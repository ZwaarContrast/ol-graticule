import { describe, it, expect } from 'vitest';
import { MBSIntervals } from '../MBSIntervals.js';

describe('MBSIntervals', () => {
  it('always returns 100km (letter-block size) regardless of resolution', () => {
    const intervals = new MBSIntervals();
    expect(intervals.getInterval(0.01, 'EPSG:27500')).toBe(100_000);
    expect(intervals.getInterval(1, 'EPSG:27500')).toBe(100_000);
    expect(intervals.getInterval(1_000, 'EPSG:27500')).toBe(100_000);
    expect(intervals.getInterval(1_000_000, 'EPSG:27500')).toBe(100_000);
  });

  it('ignores the view projection argument', () => {
    const intervals = new MBSIntervals();
    expect(intervals.getInterval(1, 'EPSG:3857')).toBe(100_000);
    expect(intervals.getInterval(1, 'EPSG:4326')).toBe(100_000);
  });

  it('returns 20km minor interval (5 subdivisions per letter block)', () => {
    const intervals = new MBSIntervals();
    expect(intervals.getMinorInterval(100_000)).toBe(20_000);
  });

  it('minor interval is independent of the major argument (fixed strategy)', () => {
    const intervals = new MBSIntervals();
    expect(intervals.getMinorInterval(50_000)).toBe(20_000);
    expect(intervals.getMinorInterval(1_000_000)).toBe(20_000);
  });
});
