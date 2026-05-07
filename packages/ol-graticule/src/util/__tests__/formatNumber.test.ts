import { describe, it, expect } from 'vitest';
import { formatDecimal } from '../formatNumber.js';

describe('formatDecimal', () => {
  it('renders integers without a decimal point', () => {
    expect(formatDecimal(5, 2)).toBe('5');
    expect(formatDecimal(-42, 4)).toBe('-42');
    expect(formatDecimal(0, 3)).toBe('0');
  });

  it('strips trailing zeros from fractional values', () => {
    expect(formatDecimal(5.1, 2)).toBe('5.1');
    expect(formatDecimal(5.10, 3)).toBe('5.1');
    expect(formatDecimal(5.100, 4)).toBe('5.1');
  });

  it('strips the decimal point when all fractional digits round to zero', () => {
    expect(formatDecimal(5.0001, 2)).toBe('5');
    expect(formatDecimal(5.0049, 2)).toBe('5');
  });

  it('keeps fractional digits that survive rounding', () => {
    expect(formatDecimal(5.123, 2)).toBe('5.12');
    expect(formatDecimal(5.0001, 4)).toBe('5.0001');
  });

  it('rounds at the requested precision', () => {
    expect(formatDecimal(1.239, 2)).toBe('1.24');
    expect(formatDecimal(1.235, 2)).toMatch(/^1\.2[34]$/);
  });

  it('handles negative fractional values', () => {
    expect(formatDecimal(-3.14, 2)).toBe('-3.14');
    expect(formatDecimal(-3.10, 2)).toBe('-3.1');
  });
});
