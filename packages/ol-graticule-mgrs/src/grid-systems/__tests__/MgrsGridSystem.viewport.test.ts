import { describe, expect, it } from 'vitest';
import { findOffScreenFeatures, viewportExtentAt } from '@zwaarcontrast/test-utils';
import { MgrsGridSystem } from '../MgrsGridSystem.js';

const cases: Array<[string, [number, number], number]> = [
  ['Berlin, deep zoom (z18)', [13.4, 52.5], 18],
  ['Berlin, moderate zoom (z14)', [13.4, 52.5], 14],
  ['Berlin, country zoom (z10)', [13.4, 52.5], 10],
  ['near antimeridian, deep zoom', [179, 0], 16],
  ['Norway exception zone, deep zoom', [6, 62], 17],
];

describe('MgrsGridSystem viewport culling invariant', () => {
  it.each(cases)('emits no line whose bbox is entirely off-screen — %s', (_label, lonLat, zoom) => {
    const grid = new MgrsGridSystem();
    const { extent, resolution } = viewportExtentAt(lonLat, zoom);
    const failures = findOffScreenFeatures(grid, extent, resolution, 'EPSG:3857');
    expect(failures, `off-screen lines: ${JSON.stringify(failures, null, 2)}`)
      .toHaveLength(0);
  });
});
