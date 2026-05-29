import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures } from '@zwaarcontrast/test-utils';
import { PixelGridSystem } from '../PixelGridSystem.js';

const cases: Array<[string, [number, number], number, number, number]> = [
  ['centred near origin, fine resolution', [500, 500], 100, 100, 0.5],
  ['far from origin, fine resolution', [50000, 25000], 1000, 800, 1],
  ['fine pixel ruler', [200, 200], 80, 60, 0.1],
];

describe('PixelGridSystem viewport culling invariant', () => {
  it.each(cases)(
    'emits no line whose bbox is entirely off-screen — %s',
    (_label, centre, halfW, halfH, resolution) => {
      const grid = new PixelGridSystem();
      const extent: [number, number, number, number] = [
        centre[0] - halfW, centre[1] - halfH, centre[0] + halfW, centre[1] + halfH,
      ];
      const failures = findOffScreenFeatures(grid, extent, resolution, 'PIXEL');
      expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
        .toHaveLength(0);
    },
  );
});
