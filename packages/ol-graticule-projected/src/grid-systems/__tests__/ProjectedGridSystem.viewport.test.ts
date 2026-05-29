import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { ProjectedGridSystem } from '../ProjectedGridSystem.js';
import { registerCRS } from '../../registerCRS.js';

const cases: Array<[string, [number, number], number]> = [
  ['Berlin, z14', [13.4, 52.5], 14],
  ['Berlin, z10', [13.4, 52.5], 10],
  ['Berlin, z6', [13.4, 52.5], 6],
];

describe('ProjectedGridSystem viewport culling invariant', () => {
  registerCRS('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs');

  it.each(cases)('UTM 33N emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new ProjectedGridSystem({ crs: 'EPSG:32633' });
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
