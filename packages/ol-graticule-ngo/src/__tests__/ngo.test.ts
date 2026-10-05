import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { NGO_GRIDS, NGO_STRIPS } from '../index.js';
import type { NGOStripNumber } from '../index.js';

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

const OSLO_LON = 10 + 43 / 60 + 22.5 / 3600;

/** Sheet-native geographic co-ordinates: same datum, so no shift applied. */
const NGO_GEOGRAPHIC =
  '+proj=longlat +a=6377492.018 +rf=299.1528128 ' +
  '+towgs84=278.3,93,474.5,7.889,0.05,-6.61,6.21 +no_defs';

function project(
  strip: NGOStripNumber,
  lonFromOslo: number,
  lat: number,
): [number, number] {
  const [x, y] = proj4(NGO_GEOGRAPHIC, NGO_STRIPS[strip].proj4).forward([
    OSLO_LON + lonFromOslo,
    lat,
  ]);
  return [x ?? 0, y ?? 0];
}

// Neatline corners measured on the scans against the two nearest labelled
// grid lines each way: [strip, sheet, corner lon east of Oslo, lat, E, N].
const CORNERS: Array<[NGOStripNumber, string, number, number, number, number]> =
  [
    ['I', 'B 34-W Fana NE', -5, 60 + 20 / 60, 181_599, 359_945],
    ['I', 'B 38 W-O Stavanger NW', -(5 + 20 / 60), 59, 161_675, 211_573],
    ['II', 'E 26 O Trollheimen NW', -2, 63, 416_893, 657_064],
    ['II', 'E 26 W Stangvik NW', -2.5, 63, 391_557, 657_046],
    ['II', 'E 27 W Aura NW', -2.5, 62 + 40 / 60, 391_454, 619_908],
    ['II', 'E 24 W Kvenvär NW', -2.5, 63 + 40 / 60, 391_741, 731_353],
    ['III', 'H 38 Enningdal NW', 0.5, 59, 628_717, 211_499],
    ['IV', 'Jot 18 Hattfjelldal NW', 2.5, 65 + 40 / 60, 99_994, 285_787],
    ['IV', 'Jot 18 Hattfjelldal NE', 3.5, 65 + 40 / 60, 146_000, 286_161],
    ['V', 'M 6 Torsken NW', 6, 69 + 40 / 60, 293_534, 508_917],
    ['VI', 'T 7 Kautokeino NW', 11.5, 69 + 20 / 60, 552_523, 249_270],
    ['VII', 'X 4 Laksfjordvidda NW', 15.5, 70 + 20 / 60, 750_080, 360_802],
    ['VIII', 'Y 3 Vestertana NW', 16.5, 70 + 40 / 60, 832_254, 398_465],
  ];

describe('Norwegian strips', () => {
  it.each(CORNERS)(
    'strip %s puts %s where the sheet prints it',
    (strip, _sheet, lonFromOslo, lat, e, n) => {
      const [x, y] = project(strip, lonFromOslo, lat);
      expect(Math.abs(x - e)).toBeLessThan(30);
      expect(Math.abs(y - n)).toBeLessThan(30);
    },
  );

  it('places the printed Greenwich ticks, fixing Oslo at 10°43\'22.5"E', () => {
    // Trollheimen's 8°50' tick at E 422 504 on its 63°N neatline;
    // Hattfjelldal's 14°10' tick at E 143 414 on its 65°40'N neatline.
    const [x2] = project('II', 8 + 50 / 60 - OSLO_LON, 63);
    expect(Math.abs(x2 - 422_504)).toBeLessThan(30);
    const [x4] = project('IV', 14 + 10 / 60 - OSLO_LON, 65 + 40 / 60);
    expect(Math.abs(x4 - 143_414)).toBeLessThan(30);
  });

  it('keeps every measured sheet inside its own strip only', () => {
    const sheets: Array<[NGOStripNumber, number, number]> = [
      ['I', 5.3, 60.2],
      ['II', 8.6, 62.9],
      ['III', 11.4, 58.9],
      ['IV', 13.7, 65.5],
      ['V', 16.9, 69.5],
      ['VI', 22.5, 69.2],
      ['VII', 26.4, 70.2],
      ['VIII', 27.7, 70.5],
    ];
    for (const [strip, lon, lat] of sheets) {
      for (const def of Object.values(NGO_STRIPS)) {
        expect(inside([lon, lat], def.validityWgs84)).toBe(def.strip === strip);
      }
    }
  });

  it("limits each strip to its EPSG area's latitudes", () => {
    // Stockholm lies in strip V's longitudes but far south of EPSG:27395.
    expect(inside([18.07, 59.33], NGO_STRIPS.V.validityWgs84)).toBe(false);
    // Oslo itself is inside strip III's area.
    expect(inside([10.75, 59.91], NGO_STRIPS.III.validityWgs84)).toBe(true);
  });

  it('registers each strip by its CRS code', () => {
    expect(Object.keys(NGO_GRIDS).sort()).toEqual([
      'NGO:STRIP_I',
      'NGO:STRIP_II',
      'NGO:STRIP_III',
      'NGO:STRIP_IV',
      'NGO:STRIP_V',
      'NGO:STRIP_VI',
      'NGO:STRIP_VII',
      'NGO:STRIP_VIII',
    ]);
    const grid = NGO_GRIDS['NGO:STRIP_V'];
    if (!grid) throw new Error('expected strip V');
    expect(grid.name).toBe('Norwegian strip V');
    expect(grid.createGridSystem()).toBeDefined();
  });
});
