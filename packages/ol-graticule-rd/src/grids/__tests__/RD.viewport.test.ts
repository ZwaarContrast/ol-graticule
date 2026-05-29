import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { createRDNewGridSystem } from '../RDNew.js';
import { createRDOldGridSystem } from '../RDOld.js';

const rdNewCases: Array<[string, [number, number], number]> = [
  ['Amersfoort, z8', [5.39, 52.16], 8],
  ['Amersfoort, z12', [5.39, 52.16], 12],
  ['Amersfoort, z16', [5.39, 52.16], 16],
];
const rdOldCases: Array<[string, [number, number], number]> = [
  ['Amersfoort, z10', [5.39, 52.16], 10],
  ['Amersfoort, z14', [5.39, 52.16], 14],
];

describe('RD New viewport culling invariant', () => {
  it.each(rdNewCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = createRDNewGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});

describe('RD Old viewport culling invariant', () => {
  it.each(rdOldCases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = createRDOldGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
