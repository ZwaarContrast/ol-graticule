import { describe, it, expect } from 'vitest';
import { lonLatToMgrs } from '../conversion.js';

/**
 * UPS (Universal Polar Stereographic) reference points. Computed by
 * projecting (lat, lon) → UPS metres with the exact EPSG:5041 / EPSG:5042
 * proj4 strings used by `ups.ts`, then formatting through the
 * GeographicLib UPS letter tables. The hand-derived corner cases (North
 * Pole, South Pole, the cell-aligned 85°N -45°W) double as a sanity
 * check on the column/row offset arithmetic.
 *
 * GZD format note: UPS GZDs are a single letter (Y/Z/A/B), no zone
 * number, `formatMgrs` outputs them without a numeric prefix.
 */

interface UpsPoint {
  name: string;
  lat: number;
  lon: number;
  expected: string;
}

const POINTS: UpsPoint[] = [
  { name: 'North Pole',                 lat:  90,        lon:    0,    expected: 'Z AH 00000 00000' },
  { name: 'Greenland ice cap',          lat:  85,        lon:  -45,    expected: 'Y UD 07232 07232' },
  { name: 'Severnaya Zemlya',           lat:  85,        lon:   90,    expected: 'Z HH 55457 00000' },
  { name: 'Arctic Ocean E of pole',     lat:  86,        lon:   45,    expected: 'Z FD 14145 85854' },
  { name: 'Ellsworth Land (Antarctica)',lat: -85,        lon:  -90,    expected: 'A SN 44542 00000' },
  { name: 'Wilkes Land (Antarctica)',   lat: -85,        lon:  135,    expected: 'B FJ 92767 07232' },
  { name: 'South Pole (89.9999°S)',     lat: -89.9999,   lon:    0,    expected: 'B AN 00000 00011' },
];

describe('UPS reference points (cross-check vs GeographicLib)', () => {
  for (const p of POINTS) {
    it(`${p.name}: (${p.lat}, ${p.lon}) → ${p.expected}`, () => {
      const got = lonLatToMgrs(p.lon, p.lat, 5);
      expect(got).toBe(p.expected);
    });
  }
});

describe('UPS / UTM dispatch boundary', () => {
  it('lat=83.999999° still routes to UTM (band X)', () => {
    const got = lonLatToMgrs(0, 83.999999, 5);
    expect(got).toBeDefined();
    // Must contain a UTM-style numeric zone prefix, not just a polar letter.
    expect(got!).toMatch(/^\d/);
    expect(got!.split(' ')[0]).toMatch(/X$/);
  });

  it('lat=84° crosses into UPS (zone Z for lon ≥ 0)', () => {
    const got = lonLatToMgrs(0, 84, 5)!;
    expect(got.startsWith('Z ')).toBe(true);
  });

  it('lat=-80° still routes to UTM (band C)', () => {
    const got = lonLatToMgrs(0, -80, 5);
    expect(got).toBeDefined();
    expect(got!).toMatch(/^\d/);
    expect(got!.split(' ')[0]).toMatch(/C$/);
  });

  it('lat=-80.0001° crosses into UPS (zone A for lon < 0)', () => {
    const got = lonLatToMgrs(-1, -80.0001, 5)!;
    expect(got.startsWith('A ')).toBe(true);
  });

  it('lon=0 chooses east zone (Z / B), lon<0 chooses west zone (Y / A)', () => {
    expect(lonLatToMgrs( 0.001, 85, 5)!.startsWith('Z ')).toBe(true);
    expect(lonLatToMgrs(-0.001, 85, 5)!.startsWith('Y ')).toBe(true);
    expect(lonLatToMgrs( 0.001, -85, 5)!.startsWith('B ')).toBe(true);
    expect(lonLatToMgrs(-0.001, -85, 5)!.startsWith('A ')).toBe(true);
  });
});

describe('antimeridian-wrapped longitudes', () => {
  // OpenLayers' inverse projection from a Web Mercator viewport panned
  // past the antimeridian returns un-wrapped longitudes (e.g. +225°
  // instead of -135°, or -270° instead of +90°). The MGRS converter
  // must wrap before dispatch so the cursor readout still works.
  it('UPS-N at lon=+225° equals lon=-135°', () => {
    const wrapped = lonLatToMgrs(225, 85, 5);
    const expected = lonLatToMgrs(-135, 85, 5);
    expect(wrapped).toBe(expected);
    expect(wrapped).toBeDefined();
  });

  it('UPS-S at lon=-270° equals lon=+90°', () => {
    const wrapped = lonLatToMgrs(-270, -85, 5);
    const expected = lonLatToMgrs(90, -85, 5);
    expect(wrapped).toBe(expected);
    expect(wrapped).toBeDefined();
  });

  it('UPS-N at lon=+450° equals lon=+90°', () => {
    const wrapped = lonLatToMgrs(450, 85, 5);
    const expected = lonLatToMgrs(90, 85, 5);
    expect(wrapped).toBe(expected);
    expect(wrapped).toBeDefined();
  });

  it('UTM-band readout still wraps correctly past the antimeridian', () => {
    // Eiffel Tower (lat 48.86, lon 2.29) panned right past 360° comes
    // back as lon=362.29 from the WM inverse projection.
    const wrapped = lonLatToMgrs(362.29, 48.86, 0);
    const direct = lonLatToMgrs(2.29, 48.86, 0);
    expect(wrapped).toBe(direct);
    expect(wrapped).toBe('31U');
  });
});
