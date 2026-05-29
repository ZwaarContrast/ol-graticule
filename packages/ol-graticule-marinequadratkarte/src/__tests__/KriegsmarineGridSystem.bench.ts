import { bench, describe } from 'vitest';
import { KriegsmarineGridSystem } from '../grid-systems/KriegsmarineGridSystem.js';

describe('KriegsmarineGridSystem', () => {
  const graticule = new KriegsmarineGridSystem();
  const projection = 'EPSG:3857';

  describe('getFeatures — Overview (depth 0)', () => {
    const extent: [number, number, number, number] = [-1000000, 5000000, 3000000, 8000000];
    const resolution = 2000;

    bench('run', () => {
      graticule.getFeatures(extent, resolution, projection);
    });
  });

  describe('getFeatures — Deep (depth 4)', () => {
    const extent: [number, number, number, number] = [1000000, 6000000, 1010000, 6010000];
    const resolution = 1;

    bench('run', () => {
      graticule.getFeatures(extent, resolution, projection);
    });
  });

  describe('getFeatures — Wide (res=100)', () => {
    const extent: [number, number, number, number] = [0, 5000000, 2000000, 7000000];
    const resolution = 100;

    bench('run', () => {
      graticule.getFeatures(extent, resolution, projection);
    });
  });
});
