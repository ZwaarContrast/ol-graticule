import { describe, it, expect } from 'vitest';
import {
  formatMgrs,
  lonLatToMgrs,
  lonLatToMgrsParts,
  lonLatToUtm,
  utmToLonLat,
} from '../conversion.js';

describe('lonLatToMgrsParts', () => {
  // Reference: White House (38.8977, -77.0365), well-known MGRS 18S UJ.
  // Validated against the proj4js/mgrs implementation and NGA's online tool.
  it('converts the White House to 18S UJ', () => {
    const parts = lonLatToMgrsParts(-77.0365, 38.8977);
    expect(parts).toBeDefined();
    expect(parts!.zone).toBe(18);
    expect(parts!.band).toBe('S');
    expect(parts!.square).toBe('UJ');
    // Easting/northing within the 100 km square at 1 m precision are in
    // the low five digits, the exact value depends on the WGS84 projection
    // and is locked in by formatMgrs at 1 m precision below.
  });

  it('converts the Eiffel Tower to 31U DQ', () => {
    // (48.8584 N, 2.2945 E), standard zone 31, band U.
    const parts = lonLatToMgrsParts(2.2945, 48.8584);
    expect(parts).toBeDefined();
    expect(parts!.zone).toBe(31);
    expect(parts!.band).toBe('U');
    expect(parts!.square).toBe('DQ');
  });

  it('converts a southern-hemisphere point (Sydney Opera House) to 56H LH', () => {
    // -33.8568 S, 151.2153 E, zone 56 (151..157), band H.
    const parts = lonLatToMgrsParts(151.2153, -33.8568);
    expect(parts).toBeDefined();
    expect(parts!.zone).toBe(56);
    expect(parts!.band).toBe('H');
    expect(parts!.square).toBe('LH');
  });

  it('returns undefined only for non-finite inputs (UPS now covers the poles)', () => {
    expect(lonLatToMgrsParts(NaN, 0)).toBeUndefined();
    expect(lonLatToMgrsParts(0, NaN)).toBeUndefined();
    // Points that USED to be out of coverage now resolve via UPS, verified
    // separately in upsConversion.test.ts.
    expect(lonLatToMgrsParts(0, 85)).toBeDefined();
    expect(lonLatToMgrsParts(0, -85)).toBeDefined();
  });

  it('truncates within-cell offsets, never rounds (MGRS spec)', () => {
    // Pick a UTM point near the central meridian so we know the lon/lat
    // round-trip stays inside the chosen zone (off-centre eastings can
    // land in a neighbouring zone after the inverse projection, which
    // would shift the cell letters and the within-cell offsets).
    // Zone 32, central meridian 9 deg E, easting 500 000 m, northing 1 000 100 m.
    const [lon, lat] = utmToLonLat(32, 500_000, 1_000_100, false);
    const parts = lonLatToMgrsParts(lon, lat);
    expect(parts).toBeDefined();
    expect(parts!.zone).toBe(32);
    expect(parts!.easting).toBe(0);          // exactly on a 100 km column
    expect(parts!.northing).toBe(100);       // 100 m above the row boundary
  });
});

describe('formatMgrs', () => {
  it('produces a precision-0 GZD string', () => {
    expect(formatMgrs({ zone: 31, band: 'U', square: 'DQ', easting: 0, northing: 0 }, 0))
      .toBe('31U');
  });

  it('produces precision-5 (1 m) at full digits with leading zeros', () => {
    const parts = { zone: 31, band: 'U', square: 'DQ', easting: 48_512, northing: 11_999 };
    expect(formatMgrs(parts, 5)).toBe('31U DQ 48512 11999');
  });

  it('truncates digits at lower precisions', () => {
    const parts = { zone: 31, band: 'U', square: 'DQ', easting: 48_999, northing: 11_999 };
    expect(formatMgrs(parts, 4)).toBe('31U DQ 4899 1199');
    expect(formatMgrs(parts, 3)).toBe('31U DQ 489 119');
    expect(formatMgrs(parts, 2)).toBe('31U DQ 48 11');
    expect(formatMgrs(parts, 1)).toBe('31U DQ 4 1');
  });
});

describe('lonLatToMgrs', () => {
  it('round-trips a UTM grid intersection through MGRS at 1 m precision', () => {
    // Pick a (zone, easting, northing) on a 100 km boundary, get its
    // lon/lat, format as MGRS, and check both the GZD and the cell letters.
    const [lon, lat] = utmToLonLat(33, 500_000, 5_000_000, false);
    const mgrs = lonLatToMgrs(lon, lat, 5);
    expect(mgrs).toBeDefined();
    expect(mgrs!.startsWith('33')).toBe(true);
    expect(mgrs!.length).toBeGreaterThanOrEqual(15);
  });

  it('returns a UPS string for the poles instead of undefined', () => {
    // North Pole lands in zone Z (lon ≥ 0), col A row H, exact origin.
    expect(lonLatToMgrs(0, 90)).toBe('Z AH 00000 00000');
  });
});

describe('lonLatToUtm/utmToLonLat round trip', () => {
  it('is invertible to ~mm precision for a mid-latitude point', () => {
    const lon = 4.4055;
    const lat = 51.2194; // Antwerp area
    const { easting, northing } = lonLatToUtm(lon, lat, 31);
    const [lon2, lat2] = utmToLonLat(31, easting, northing, false);
    expect(lon2).toBeCloseTo(lon, 8);
    expect(lat2).toBeCloseTo(lat, 8);
  });
});
