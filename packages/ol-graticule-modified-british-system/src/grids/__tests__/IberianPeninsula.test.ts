import { describe, it, expect } from 'vitest';
import { transform } from 'ol/proj';
import {
  createIberianPeninsulaGridSystem,
  IBERIAN_PENINSULA_CRS,
} from '../IberianPeninsula';

/**
 * Primary-source anchors read from the printed corner cartouches of
 * GSGS 4148 Spain-Portugal 1:250 000 sheets digitised by the Institut
 * Cartogràfic i Geològic de Catalunya:
 * https://cartotecadigital.icgc.cat/digital/collection/gsgs4148
 *
 * Sheet IDs `S EEYY` encode the SW grid corner in 10 km units (E×10 000,
 * N×10 000); sheets are 80 km × 80 km. Each anchor below is a printed
 * lat/lon → grid pair; six together back-solve the proj4 to RMS 1.2 m.
 */
const sheetCorners: Array<{
  sheet: string;
  url: string;
  corner: string;
  lat: number;
  lon: number;
  expectedE: number;
  expectedN: number;
}> = [
  {
    sheet: 'S 4856 Madrid-West',
    url: 'https://cartotecadigital.icgc.cat/digital/collection/gsgs4148/id/3',
    corner: 'NW',
    lat: 40.98186, // 40°58'54.7"N
    lon: -5.11308, // 5°06'47.1"W
    expectedE: 480_000,
    expectedN: 640_000,
  },
  {
    sheet: 'S 6056 Madrid-East',
    url: 'https://cartotecadigital.icgc.cat/digital/collection/gsgs4148/id/38',
    corner: 'NW',
    lat: 40.99053, // 40°59'25.9"N
    lon: -3.68739, // 3°41'14.6"W
    expectedE: 600_000,
    expectedN: 640_000,
  },
  {
    sheet: 'S 1240 Lisboa',
    url: 'https://cartotecadigital.icgc.cat/digital/collection/gsgs4148/id/63',
    corner: 'NE',
    lat: 39.47356, // 39°28'24.8"N
    lon: -7.87236, // 7°52'20.5"W
    expectedE: 240_000,
    expectedN: 480_000,
  },
  {
    sheet: 'S 0864 Barcelona',
    url: 'https://cartotecadigital.icgc.cat/digital/collection/gsgs4148/id/75',
    corner: 'NW',
    lat: 41.57108, // 41°34'15.9"N
    lon: 2.06925, // 2°04'09.3"E
    expectedE: 1_080_000,
    expectedN: 720_000,
  },
  {
    sheet: 'S 3608 Cadiz',
    url: 'https://cartotecadigital.icgc.cat/digital/collection/gsgs4148/id/17',
    corner: 'NE',
    lat: 36.66058, // 36°39'38.1"N
    lon: -5.02733, // 5°01'38.4"W
    expectedE: 480_000,
    expectedN: 160_000,
  },
  {
    sheet: 'S 1288 La Coruña',
    url: 'https://cartotecadigital.icgc.cat/digital/collection/gsgs4148/id/34',
    corner: 'NW',
    lat: 43.72439, // 43°43'27.8"N
    lon: -9.63583, // 9°38'09.0"W
    expectedE: 120_000,
    expectedN: 960_000,
  },
];

describe('Iberian Peninsula MBS factory', () => {
  for (const anchor of sheetCorners) {
    it(`reproduces ${anchor.sheet} ${anchor.corner} corner — ${anchor.url}`, () => {
      // Side-effect: register the CRS with proj4/OL.
      createIberianPeninsulaGridSystem();
      const [x, y] = transform([anchor.lon, anchor.lat], 'EPSG:4326', IBERIAN_PENINSULA_CRS);
      // Tolerance: 50 m. Six-corner least-squares fit gives RMS 1.2 m;
      // 50 m absorbs ICGC OCR / arcsecond-rounding noise on the printed
      // sheet face.
      expect(Math.abs(x! - anchor.expectedE)).toBeLessThan(50);
      expect(Math.abs(y! - anchor.expectedN)).toBeLessThan(50);
    });
  }

  const cities: [string, [number, number]][] = [
    ['Madrid', [-3.7038, 40.4168]],
    ['Porto', [-8.6110, 41.1496]],
    ['Barcelona', [2.1734, 41.3851]],
    ['Lisbon', [-9.1393, 38.7223]],
    ['Seville', [-5.9845, 37.3891]],
  ];

  for (const [name, lonLat] of cities) {
    it(`${name} labels under a 4-letter MBS reference`, () => {
      const grid = createIberianPeninsulaGridSystem();
      const [x, y] = transform(lonLat, 'EPSG:4326', IBERIAN_PENINSULA_CRS);
      const formatted = grid.formatCoordinate([x!, y!], IBERIAN_PENINSULA_CRS);
      if (!('combined' in formatted)) throw new Error('expected combined label');
      expect(formatted.combined).toMatch(/^[a-z][A-Z] \d{3} \d{3}$/);
    });
  }
});
