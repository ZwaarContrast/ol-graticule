import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { DhgGridSystem } from '../DhgGridSystem.js';
import { HmnGridSystem } from '../HmnGridSystem.js';
import { GeographicHmnGridSystem } from '../GeographicHmnGridSystem.js';

const dhgCases: Array<[string, [number, number], number]> = [
  ['Berlin, z8', [13.4, 52.5], 8],
  ['Berlin, z12', [13.4, 52.5], 12],
  ['Berlin, z14', [13.4, 52.5], 14],
];
const hmnCases: Array<[string, [number, number], number]> = [
  ['Berlin, z11', [13.4, 52.5], 11],
  ['Berlin, z14', [13.4, 52.5], 14],
];
const hmnGeoCases: Array<[string, [number, number], number]> = [
  ['Berlin, z10', [13.4, 52.5], 10],
  ['Berlin, z13', [13.4, 52.5], 13],
];

describe('DhgGridSystem viewport culling invariant', () => {
  it.each(dhgCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new DhgGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});

describe('HmnGridSystem viewport culling invariant', () => {
  it.each(hmnCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new HmnGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});

describe('GeographicHmnGridSystem viewport culling invariant', () => {
  it.each(hmnGeoCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new GeographicHmnGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
