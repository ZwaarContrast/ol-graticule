import { describe, it, expect } from 'vitest';
import { asArray } from 'ol/color';
import { withAlpha, toRgbaNormalized } from '../color.js';

describe('withAlpha', () => {
  it('keeps rgb and sets the given alpha for rgba/rgb/hex inputs', () => {
    expect(asArray(withAlpha('rgba(10, 20, 30, 0.9)', 0.4))).toEqual([10, 20, 30, 0.4]);
    expect(asArray(withAlpha('rgb(10, 20, 30)', 0))).toEqual([10, 20, 30, 0]);
    expect(asArray(withAlpha('#ffcc00', 0.88))).toEqual([255, 204, 0, 0.88]);
    expect(asArray(withAlpha('#fc0', 1))).toEqual([255, 204, 0, 1]);
  });
});

describe('toRgbaNormalized', () => {
  it('converts color strings and arrays to normalized 0..1 floats', () => {
    expect(toRgbaNormalized('rgba(255, 0, 128, 0.5)')).toEqual([1, 0, 128 / 255, 0.5]);
    expect(toRgbaNormalized([100, 200, 50, 0.8])).toEqual([100 / 255, 200 / 255, 50 / 255, 0.8]);
    expect(toRgbaNormalized('#ffffff')).toEqual([1, 1, 1, 1]);
    expect(toRgbaNormalized(undefined, 0.5)).toEqual([0, 0, 0, 0.5]);
  });
});

