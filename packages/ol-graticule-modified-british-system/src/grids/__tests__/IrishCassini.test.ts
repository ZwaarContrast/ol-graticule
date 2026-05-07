import { describe, it, expect } from 'vitest';
import { transform } from 'ol/proj';
import {
  createIrishCassiniGridSystem,
  IRISH_CASSINI_CRS,
} from '../IrishCassini';

/**
 * Ground truth sampled against Thierry Arsicaud's translator. Ireland
 * fits inside a single 500 km first-letter square labelled `i`, so every
 * in-island point should come back with `i` as its first letter.
 */
const samples = [
  {
    name: 'Dublin',
    lonLat: [-6.2603, 53.3498] as [number, number],
  },
  {
    name: 'Cork',
    lonLat: [-8.4756, 51.8985] as [number, number],
  },
  {
    name: 'Belfast',
    lonLat: [-5.9301, 54.5973] as [number, number],
  },
  {
    name: 'Galway',
    lonLat: [-9.0568, 53.2707] as [number, number],
  },
];

describe('Irish Cassini MBS factory', () => {
  for (const { name, lonLat } of samples) {
    it(`${name} labels as an i-prefixed cell`, () => {
      const grid = createIrishCassiniGridSystem();
      const [x, y] = transform(lonLat, 'EPSG:4326', IRISH_CASSINI_CRS);
      const formatted = grid.formatCoordinate([x!, y!], IRISH_CASSINI_CRS);
      if (!('combined' in formatted)) throw new Error('expected combined label');
      expect(formatted.combined).toMatch(/^i[A-Z] \d{3} \d{3}$/);
    });
  }

  it('rejects a point well outside Ireland', () => {
    const grid = createIrishCassiniGridSystem();
    // Deep Atlantic, beyond the 1-square Irish coverage.
    expect(grid.isValidCoordinate!([-2_000_000, -2_000_000], IRISH_CASSINI_CRS)).toBe(false);
  });
});
