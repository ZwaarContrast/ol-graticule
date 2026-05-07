import { describe, it, expect } from 'vitest';
import { isOnMajorLine } from '../gridlines.js';

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
