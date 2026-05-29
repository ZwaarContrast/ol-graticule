import { bench, describe } from 'vitest';
import { DhgGridSystem } from '../grid-systems/DhgGridSystem.js';

describe('DhgGridSystem — Multiple Zones', () => {
  const graticule = new DhgGridSystem({
    zoneBoundary: 'overlap',
  });

  const extent: [number, number, number, number] = [
    500000, 5000000, 2000000, 6000000,
  ]; // Wide extent covering multiple DHG zones
  const resolution = 100;
  const projection = 'EPSG:3857';

  bench('getFeatures (wide view)', () => {
    graticule.getFeatures(extent, resolution, projection);
  });

  bench('getLabels (wide view)', () => {
    graticule.getLabels(extent, resolution, projection);
  });

  bench('formatCoordinate (hot cache)', () => {
    graticule.formatCoordinate([1000000, 5500000], projection);
  });

  bench('formatCoordinate (cold cache)', () => {
    // Force cache miss by shifting slightly
    const coord: [number, number] = [1000000 + Math.random(), 5500000];
    graticule.formatCoordinate(coord, projection);
  });
});
