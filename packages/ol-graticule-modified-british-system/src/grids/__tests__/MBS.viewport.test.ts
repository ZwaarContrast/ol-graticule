import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { createNordDeGuerreGridSystem } from '../NordDeGuerre.js';
import { createBritishCassiniGridSystem } from '../BritishCassini.js';

const ndgCases: Array<[string, [number, number], number]> = [
  ['Western Front, z9', [3, 50], 9],
  ['Western Front, z12', [3, 50], 12],
  ['Western Front, z14', [3, 50], 14],
];
const bcCases: Array<[string, [number, number], number]> = [
  ['London, z10', [-0.1, 51.5], 10],
  ['London, z14', [-0.1, 51.5], 14],
];

describe('Nord de Guerre viewport culling invariant', () => {
  it.each(ndgCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = createNordDeGuerreGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});

describe('British Cassini viewport culling invariant', () => {
  it.each(bcCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = createBritishCassiniGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
