import { describe, it, expect } from 'vitest';
import { transform } from 'ol/proj';
import {
  createScandinavianZone3GridSystem,
  SCANDINAVIAN_ZONE_3_CRS,
} from '../ScandinavianZone3';

describe('Scandinavian Zone 3 MBS factory', () => {
  it('Copenhagen labels under a 4-letter MBS reference', () => {
    const grid = createScandinavianZone3GridSystem();
    const [x, y] = transform([12.5683, 55.6761], 'EPSG:4326', SCANDINAVIAN_ZONE_3_CRS);
    const formatted = grid.formatCoordinate([x!, y!], SCANDINAVIAN_ZONE_3_CRS);
    if (!('combined' in formatted)) throw new Error('expected combined label');
    expect(formatted.combined).toMatch(/^[a-z][A-Z] \d{3} \d{3}$/);
  });

  it('Stockholm labels under a 4-letter MBS reference', () => {
    const grid = createScandinavianZone3GridSystem();
    const [x, y] = transform([18.0686, 59.3293], 'EPSG:4326', SCANDINAVIAN_ZONE_3_CRS);
    const formatted = grid.formatCoordinate([x!, y!], SCANDINAVIAN_ZONE_3_CRS);
    if (!('combined' in formatted)) throw new Error('expected combined label');
    expect(formatted.combined).toMatch(/^[a-z][A-Z] \d{3} \d{3}$/);
  });

  it('Oslo labels under a 4-letter MBS reference', () => {
    const grid = createScandinavianZone3GridSystem();
    const [x, y] = transform([10.7522, 59.9139], 'EPSG:4326', SCANDINAVIAN_ZONE_3_CRS);
    const formatted = grid.formatCoordinate([x!, y!], SCANDINAVIAN_ZONE_3_CRS);
    if (!('combined' in formatted)) throw new Error('expected combined label');
    expect(formatted.combined).toMatch(/^[a-z][A-Z] \d{3} \d{3}$/);
  });

  it('the projection origin (57.5°N, 20°E) projects to (900 km, ~543 km)', () => {
    // Sanity check that the x_0/y_0 offsets are applied correctly. The
    // natural origin lands at the false-easting/northing point.
    const [x, y] = transform([20, 57.5], 'EPSG:4326', SCANDINAVIAN_ZONE_3_CRS);
    expect(x).toBeCloseTo(900_000, -2); // within 100 m
    expect(y).toBeCloseTo(543_355, -2);
  });
});
