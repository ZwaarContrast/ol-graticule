import { describe, it, expect } from 'vitest';
import { requireTransform } from '../requireTransform.js';

describe('requireTransform', () => {
  it('returns the transform OpenLayers knows', () => {
    const [x] = requireTransform('EPSG:4326', 'EPSG:3857')([180, 0]);
    expect(x).toBeCloseTo(20037508.34, 1);
  });

  it('throws for an unknown projection instead of returning null', () => {
    expect(() => requireTransform('EPSG:4326', 'TEST:UNKNOWN')).toThrow();
  });
});
