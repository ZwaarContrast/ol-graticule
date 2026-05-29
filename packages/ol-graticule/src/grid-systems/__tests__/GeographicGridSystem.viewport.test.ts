import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { GeographicGridSystem } from '../GeographicGridSystem.js';

const cases: Array<[string, [number, number], number]> = [
  ['World, z3', [0, 0], 3],
  ['Europe, z6', [10, 50], 6],
  ['New York, z14', [-74, 40.7], 14],
  ['Tokyo, z18', [139.7, 35.7], 18],
];

describe('GeographicGridSystem viewport culling invariant', () => {
  it.each(cases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new GeographicGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
