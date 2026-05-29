import { describe, expect, it } from 'vitest';
import { fromLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import { MgrsGridSystem } from '../MgrsGridSystem.js';

function viewportAt(lonLat: [number, number], zoom: number) {
  const resolution = 40_075_016.686 / (256 * Math.pow(2, zoom));
  const [cx, cy] = fromLonLat(lonLat);
  const halfW = (1280 * resolution) / 2;
  const halfH = (800 * resolution) / 2;
  const extent: [number, number, number, number] = [cx - halfW, cy - halfH, cx + halfW, cy + halfH];
  return { extent, resolution };
}

describe('MgrsGridSystem deep zoom emission count', () => {
  it('emits a bounded number of features at z18 / z20 / z22', () => {
    for (const zoom of [16, 18, 20, 22, 24, 26, 28]) {
      const grid = new MgrsGridSystem();
      const { extent, resolution } = viewportAt([13.4, 52.5], zoom);
      const features = grid.getFeatures(extent, resolution, 'EPSG:3857');
      const lines = features.filter((f) => f.getGeometry() instanceof LineString);
      const verticals = lines.filter((f) => f.get('gridAxis') === 'x' || f.get('gridAxis') === 'e').length;
      const horizontals = lines.filter((f) => f.get('gridAxis') === 'y' || f.get('gridAxis') === 'n').length;
      console.log(`z${zoom}: ${features.length} features (verticals=${verticals}, horizontals=${horizontals})`);
      expect(features.length, `z${zoom} explodes`).toBeLessThan(2000);
    }
  });
});
