import { describe, expect, it } from 'vitest';
import { viewportExtentAt } from '@zwaarcontrast/test-utils';
import { MgrsGridSystem } from '../MgrsGridSystem.js';

describe('MgrsGridSystem deep zoom emission count', () => {
  it('emits a bounded number of features at z18 / z20 / z22', () => {
    for (const zoom of [16, 18, 20, 22, 24, 26, 28]) {
      const grid = new MgrsGridSystem();
      const { extent, resolution } = viewportExtentAt([13.4, 52.5], zoom);
      const features = grid.getFeatures(extent, resolution, 'EPSG:3857');
      expect(features.length, `z${zoom} explodes`).toBeLessThan(2000);
    }
  });
});
