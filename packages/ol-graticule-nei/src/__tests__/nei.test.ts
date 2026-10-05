import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import {
  NEI_GRIDS,
  NEI_EQUATORIAL_ZONE_CRS,
  NEI_EQUATORIAL_ZONE_PROJ4,
  NEI_EQUATORIAL_ZONE_VALIDITY_WGS84,
  NEI_SOUTHERN_ZONE_CRS,
  NEI_SOUTHERN_ZONE_PROJ4,
  NEI_SOUTHERN_ZONE_VALIDITY_WGS84,
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

const BATAVIA_GEOGRAPHIC =
  '+proj=longlat +ellps=bessel +towgs84=-377,681,-50,0,0,0,0 +no_defs';

const fromSouthern = proj4(NEI_SOUTHERN_ZONE_PROJ4, 'EPSG:4326');

describe('NEI Southern Zone', () => {
  it('puts the Batavia 1:20 000 sheet frame on Jakarta', () => {
    const corners: [number, number, number, number][] = [
      [195_000, 595_000, 106.79, -6.22],
      [206_000, 609_000, 106.89, -6.1],
    ];
    for (const [x, y, lon, lat] of corners) {
      const [gotLon, gotLat] = fromSouthern.forward([x, y]);
      expect(gotLon).toBeCloseTo(lon, 1);
      expect(gotLat).toBeCloseTo(lat, 1);
    }
  });

  it('validity covers Jakarta, Surabaya and Bali but not Palembang', () => {
    const ring = NEI_SOUTHERN_ZONE_VALIDITY_WGS84;
    expect(inside([106.85, -6.2], ring)).toBe(true);
    expect(inside([112.75, -7.25], ring)).toBe(true);
    expect(inside([115.2, -8.65], ring)).toBe(true);
    expect(inside([104.75, -2.98], ring)).toBe(false);
  });

  it('western limit is the zero-easting line', () => {
    const toSouthern = proj4('EPSG:4326', NEI_SOUTHERN_ZONE_PROJ4);
    const [x] = toSouthern.forward([
      ...(NEI_SOUTHERN_ZONE_VALIDITY_WGS84[0] ?? [0, 0]),
    ]);
    expect(x).toBeCloseTo(0, 3);
  });
});

describe('NEI Equatorial Zone', () => {
  it('is EPSG:3001 with its false origin at 0°N 110°E', () => {
    expect(NEI_EQUATORIAL_ZONE_CRS).toBe('EPSG:3001');
    const [x, y] = proj4(BATAVIA_GEOGRAPHIC, NEI_EQUATORIAL_ZONE_PROJ4).forward(
      [110, 0],
    );
    expect(x).toBeCloseTo(3_900_000, 0);
    expect(y).toBeCloseTo(900_000, 0);
  });

  it('validity covers Medan, Pontianak and Makassar but not Jakarta or Singapore', () => {
    const ring = NEI_EQUATORIAL_ZONE_VALIDITY_WGS84;
    expect(inside([98.67, 3.59], ring)).toBe(true);
    expect(inside([109.33, -0.03], ring)).toBe(true);
    expect(inside([119.42, -5.14], ring)).toBe(true);
    expect(inside([106.85, -6.2], ring)).toBe(false);
    expect(inside([103.82, 1.35], ring)).toBe(false);
  });
});

describe('NEI_GRIDS', () => {
  it('builds a grid system per zone, keyed by CRS', () => {
    expect(Object.keys(NEI_GRIDS).sort()).toEqual(
      [NEI_EQUATORIAL_ZONE_CRS, NEI_SOUTHERN_ZONE_CRS].sort(),
    );
    for (const [crs, grid] of Object.entries(NEI_GRIDS)) {
      expect(grid.crs).toBe(crs);
      expect(grid.createGridSystem()).toBeDefined();
    }
  });
});
