import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { LuftwaffeGridSystem } from '../LuftwaffeGridSystem.js';

type LuftwaffeSystem = 'gnmv' | 'jmn';
const cases: Array<[string, [number, number], number, LuftwaffeSystem]> = [
  ['Berlin, z6 (GNMV)', [13.4, 52.5], 6, 'gnmv'],
  ['Berlin, z10 (GNMV)', [13.4, 52.5], 10, 'gnmv'],
  ['Berlin, z14 (GNMV)', [13.4, 52.5], 14, 'gnmv'],
  ['Ruhr, z10 (JMN)', [6.9, 51], 10, 'jmn'],
  ['Ruhr, z14 (JMN)', [6.9, 51], 14, 'jmn'],
];

describe('LuftwaffeGridSystem viewport culling invariant', () => {
  it.each(cases)(
    'emits no line whose bbox is entirely off-screen — %s',
    (_label, lonLat, zoom, system) => {
      const grid = new LuftwaffeGridSystem({ system });
      const { extent, resolution } = viewportExtentAt(lonLat, zoom);
      const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
      expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
        .toHaveLength(0);
    },
  );
});
