import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import {
  BRITISH_YARD_M,
  OS_GRIDS,
  OS_YARD_GRID_PROJ4,
  OS_YARD_GRID_VALIDITY_WGS84,
  YardFormatter,
} from '../index.js';

type Ring = ReadonlyArray<readonly [number, number]>;

function inside([x, y]: readonly [number, number], ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit;
  }
  return hit;
}

function yards(def: string, lon: number, lat: number): [number, number] {
  const [x, y] = proj4(def, OS_YARD_GRID_PROJ4).forward([lon, lat]);
  return [x ?? 0, y ?? 0];
}

const OSGB36_TOWGS84 =
  '+towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489';
/** Sheet-native geographic co-ordinates: same datum, so no shift applied. */
const AIRY = `+proj=longlat +ellps=airy ${OSGB36_TOWGS84} +no_defs`;
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';
// epsg.io's EPSG:27700, OSGB36 / British National Grid, as served on 2026-10-04.
const NATIONAL_GRID =
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 ' +
  `+ellps=airy ${OSGB36_TOWGS84} +units=m +no_defs`;

describe('OS yard grid', () => {
  it('puts the true origin 1 000 000 yards east and north of the false origin', () => {
    const [e, n] = yards(AIRY, -2, 49);
    expect(e).toBeCloseTo(1_000_000, 2);
    expect(n).toBeCloseTo(1_000_000, 2);
  });

  it('is the National Grid projection in yards, apart from its 1-in-2500 scale', () => {
    // Land's End, Lowestoft, Glasgow, Lerwick
    const places: Array<[number, number]> = [
      [-5.71, 50.07],
      [1.75, 52.48],
      [-4.25, 55.86],
      [-1.15, 60.15],
    ];
    for (const [lon, lat] of places) {
      const [e, n] = yards(AIRY, lon, lat);
      const [x, y] = proj4(AIRY, NATIONAL_GRID).forward([lon, lat]);
      const fromNg: [number, number] = [
        ((x ?? 0) - 400_000) / BRITISH_YARD_M + 1_000_000,
        ((y ?? 0) + 100_000) / BRITISH_YARD_M + 1_000_000,
      ];
      // k 0.9996 against 0.9996012717: 1.27 ppm of the distance from the
      // true origin, under 2 yd as far north as Shetland.
      expect(Math.abs(e - fromNg[0])).toBeLessThan(2);
      expect(Math.abs(n - fromNg[1])).toBeLessThan(2);
    }
  });

  it('reproduces the worked examples printed on the Quarter-inch Fourth Edition', () => {
    // "Thus the position of Helensburgh Sta. would be defined as E.813,800
    // N.1,856,600. The co-ordinates 804,400 - 1,812,200 would refer to Horse
    // Isle" (sheet 4, Glasgow). Positions: OpenStreetMap, 2026-10-05.
    const [he, hn] = yards(WGS84, -4.7307717, 56.0124414); // Helensburgh Upper
    expect(Math.abs(he - 813_800)).toBeLessThan(200);
    expect(Math.abs(hn - 1_856_600)).toBeLessThan(200);
    const [ie, iN] = yards(WGS84, -4.842956, 55.6457317); // Horse Isle, centroid
    expect(Math.abs(ie - 804_400)).toBeLessThan(200);
    expect(Math.abs(iN - 1_812_200)).toBeLessThan(200);
  });

  it('covers Great Britain with Orkney and Shetland, and not Ireland', () => {
    expect(inside([-0.13, 51.51], OS_YARD_GRID_VALIDITY_WGS84)).toBe(true); // London
    expect(inside([-1.15, 60.15], OS_YARD_GRID_VALIDITY_WGS84)).toBe(true); // Lerwick
    expect(inside([-2.96, 58.98], OS_YARD_GRID_VALIDITY_WGS84)).toBe(true); // Kirkwall
    expect(inside([-6.26, 53.35], OS_YARD_GRID_VALIDITY_WGS84)).toBe(false); // Dublin
    expect(inside([-4.48, 54.15], OS_YARD_GRID_VALIDITY_WGS84)).toBe(false); // Isle of Man
  });

  it('labels and parses full-figure yards', () => {
    const f = new YardFormatter();
    expect(f.format(1_856_600)).toBe('1,856,600 yd');
    expect(f.format(680_000)).toBe('680,000 yd');
    expect(f.parse('E 813,800 yd', 'x')).toBe(813_800);
    expect(f.parse('N.1,856,600', 'y')).toBe(1_856_600);
    expect(() => f.parse('Helensburgh', 'x')).toThrow(/yards/);
  });

  it('registers the grid by its CRS code', () => {
    expect(Object.keys(OS_GRIDS)).toEqual(['OS:YARD_GRID']);
    const grid = OS_GRIDS['OS:YARD_GRID'];
    if (!grid) throw new Error('expected the yard grid');
    expect(grid.name).toBe('OS yard grid');
    expect(grid.createGridSystem()).toBeDefined();
  });
});
