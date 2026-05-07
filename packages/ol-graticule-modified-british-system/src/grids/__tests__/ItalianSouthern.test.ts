import { describe, it, expect } from 'vitest';
import { transform } from 'ol/proj';
import {
  createItalianSouthernGridSystem,
  ITALIAN_SOUTHERN_CRS,
} from '../ItalianSouthern';

describe('Italian Southern MBS factory', () => {
  const cities: [string, [number, number]][] = [
    ['Naples', [14.2681, 40.8518]],
    ['Rome', [12.4964, 41.9028]],
    ['Palermo', [13.3615, 38.1157]],
    ['Cagliari', [9.1127, 39.2238]],
    ['Bari', [16.8719, 41.1177]],
    ['Catanzaro', [16.5970, 38.9106]],
  ];

  for (const [name, lonLat] of cities) {
    it(`${name} labels under a 4-letter MBS reference`, () => {
      const grid = createItalianSouthernGridSystem();
      const [x, y] = transform(lonLat, 'EPSG:4326', ITALIAN_SOUTHERN_CRS);
      const formatted = grid.formatCoordinate([x!, y!], ITALIAN_SOUTHERN_CRS);
      if (!('combined' in formatted)) throw new Error('expected combined label');
      expect(formatted.combined).toMatch(/^[a-z][A-Z] \d{3} \d{3}$/);
    });
  }

  it('the projection origin (39.5°N, 14°E) lands at the false-easting / false-northing point', () => {
    const [x, y] = transform([14, 39.5], 'EPSG:4326', ITALIAN_SOUTHERN_CRS);
    expect(x).toBeCloseTo(700_000, -2);
    expect(y).toBeCloseTo(600_000, -2);
  });
});
