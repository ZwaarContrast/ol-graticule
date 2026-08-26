import { describe, expect, it } from 'vitest';
import { fromLonLat, transform } from 'ol/proj';

import { DrgGridSystem } from '../DrgGridSystem.js';

function extentOf(west: number, south: number, east: number, north: number): [number, number, number, number] {
  const [minX, minY] = fromLonLat([west, south]);
  const [maxX, maxY] = fromLonLat([east, north]);
  return [minX, minY, maxX, maxY];
}

function extentAround(lon: number, lat: number, padDeg: number): [number, number, number, number] {
  return extentOf(lon - padDeg, lat - padDeg, lon + padDeg, lat + padDeg);
}

const ELSENBORN: [number, number] = [6.2076, 50.4514];
/** Sheet 5503's neatline: 6°10'–6°20' E, 50°24'–50°30' N. */
const SHEET_EXTENT = extentOf(6 + 10 / 60, 50 + 24 / 60, 6 + 20 / 60, 50.5);
// Resolution at zoom 13 in EPSG:3857, well inside the render gate.
const ZOOM13_RES = 19.1093;

describe('DrgGridSystem render smoke', () => {
  it('emits grid lines on both axes over sheet 5503', () => {
    const grid = new DrgGridSystem();
    const features = grid.getFeatures(SHEET_EXTENT, ZOOM13_RES, 'EPSG:3857');
    expect(features.length).toBeGreaterThan(0);
    const axes = new Set(features.map((f) => f.get('gridAxis')));
    expect(axes.has('x')).toBe(true);
    expect(axes.has('y')).toBe(true);
  });

  it('labels the eastings the sheet prints, 2512..2523', () => {
    const grid = new DrgGridSystem();
    const labels = grid.getLabels(SHEET_EXTENT, ZOOM13_RES, 'EPSG:3857');
    const eastings = labels.filter((l) => l.axis === 'x').map((l) => Number(l.text));
    const northings = labels.filter((l) => l.axis === 'y').map((l) => Number(l.text));
    expect(eastings).toContain(2512);
    expect(eastings).toContain(2523);
    expect(northings).toContain(5585);
    expect(northings).toContain(5595);
  });

  it('does not repeat a Hochwert when two strips are on screen', () => {
    const grid = new DrgGridSystem();
    // 7°30' E is the strip 2 / strip 3 boundary.
    const straddling = extentAround(7.5, 50.4, 0.09);
    const labels = grid.getLabels(straddling, ZOOM13_RES, 'EPSG:3857');
    const northings = labels.filter((l) => l.axis === 'y').map((l) => l.text);
    expect(new Set(northings).size).toBe(northings.length);
  });

  it('reads the cursor as a metre-precision Rechts/Hoch pair', () => {
    const grid = new DrgGridSystem();
    const view = transform(ELSENBORN, 'EPSG:4326', 'EPSG:3857');
    const [vx, vy] = view;
    expect(vx).toBeDefined();
    expect(vy).toBeDefined();
    if (vx === undefined || vy === undefined) return;
    const formatted = grid.formatCoordinate([vx, vy], 'EPSG:3857');
    expect(formatted.x).toMatch(/^2514\d{3}$/);
    expect(formatted.y).toMatch(/^5590\d{3}$/);
  });

  it('parses a sheet reference back to the point it names', () => {
    const grid = new DrgGridSystem();
    const [vx, vy] = grid.parseCoordinate('2512200 5585450', 'EPSG:3857');
    const [lon, lat] = transform([vx, vy], 'EPSG:3857', 'EPSG:4326');
    expect(lon).toBeCloseTo(6.17, 1);
    expect(lat).toBeCloseTo(50.4, 1);
  });

  it('draws nothing when zoomed out past the render gate', () => {
    const grid = new DrgGridSystem();
    expect(grid.getFeatures(SHEET_EXTENT, 5000, 'EPSG:3857')).toHaveLength(0);
    expect(grid.getLabels(SHEET_EXTENT, 5000, 'EPSG:3857')).toHaveLength(0);
  });
});
