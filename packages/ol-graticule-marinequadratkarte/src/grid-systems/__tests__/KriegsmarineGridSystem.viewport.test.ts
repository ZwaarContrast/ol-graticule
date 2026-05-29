import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { KriegsmarineGridSystem } from '../KriegsmarineGridSystem.js';

const cases: Array<[string, [number, number], number]> = [
  ['North Atlantic, z6', [-30, 50], 6],
  ['Western Med, z9', [4, 41], 9],
  ['mid-Atlantic, z12', [-25, 35], 12],
  ['South Atlantic, z8', [-15, -30], 8],
];

describe('KriegsmarineGridSystem viewport culling invariant', () => {
  it.each(cases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new KriegsmarineGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
