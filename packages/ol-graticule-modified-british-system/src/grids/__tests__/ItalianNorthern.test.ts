import { describe, it, expect } from 'vitest';
import { transform } from 'ol/proj';
import {
  createItalianNorthernGridSystem,
  ITALIAN_NORTHERN_CRS,
} from '../ItalianNorthern';

describe('Italian Northern MBS factory', () => {
  // Cities inside the hand-drawn AOI, Rome is too far south, Vienna too
  // far east-north, so they're outside the current clip polygon.
  const cities: [string, [number, number]][] = [
    ['Milan', [9.1900, 45.4642]],
    ['Venice', [12.3155, 45.4408]],
    ['Zurich', [8.5417, 47.3769]],
    ['Zagreb', [15.9819, 45.8150]],
    ['Bologna', [11.3426, 44.4949]],
    ['Innsbruck', [11.4041, 47.2692]],
  ];

  for (const [name, lonLat] of cities) {
    it(`${name} labels under a 4-letter MBS reference`, () => {
      const grid = createItalianNorthernGridSystem();
      const [x, y] = transform(lonLat, 'EPSG:4326', ITALIAN_NORTHERN_CRS);
      const formatted = grid.formatCoordinate([x!, y!], ITALIAN_NORTHERN_CRS);
      if (!('combined' in formatted)) throw new Error('expected combined label');
      expect(formatted.combined).toMatch(/^[a-z][A-Z] \d{3} \d{3}$/);
    });
  }

  it('the projection origin (45°55′N, 14°E) lands at the false-easting / false-northing point', () => {
    const [x, y] = transform([14, 45.916666666666664], 'EPSG:4326', ITALIAN_NORTHERN_CRS);
    expect(x).toBeCloseTo(800_000, -2);
    expect(y).toBeCloseTo(602_846, -2);
  });
});
