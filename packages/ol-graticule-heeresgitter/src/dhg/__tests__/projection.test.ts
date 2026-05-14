import { afterEach, describe, expect, it } from 'vitest';

import { encodeDhg, encodeDhgText, formatEasting, formatNorthing } from '../encode.js';
import { parseDhg, parseShortDigits } from '../decode.js';
import {
  dhgCrsCode,
  forward,
  forwardInZone,
  inverse,
  registerAllZones,
  resetDhgDatumShift,
  setDhgDatumShift,
} from '../projection.js';
import type { DatumShift } from '../types.js';
import { ALL_ZONES, cmForKennziffer, kennzifferForCm, zoneByKennziffer, zoneForLon, zonesContainingLon } from '../zones.js';

describe('DHG zone math', () => {
  it('matches the Planheft Schweiz table', () => {
    expect(cmForKennziffer(1)).toBe(3);
    expect(cmForKennziffer(5)).toBe(27);
    expect(cmForKennziffer(6)).toBe(33);
    expect(cmForKennziffer(14)).toBe(81);
    expect(cmForKennziffer(55)).toBe(-33);
    expect(cmForKennziffer(59)).toBe(-9);
    expect(cmForKennziffer(60)).toBe(-3);
  });

  it('rejects Kennziffer outside [1, 60]', () => {
    expect(() => cmForKennziffer(0)).toThrow(RangeError);
    expect(() => cmForKennziffer(61)).toThrow(RangeError);
    expect(() => cmForKennziffer(1.5)).toThrow(RangeError);
  });

  it('round-trips cm ↔ kennziffer', () => {
    for (let n = 1; n <= 60; n++) {
      expect(kennzifferForCm(cmForKennziffer(n))).toBe(n);
    }
  });

  it('exposes 6° strip extents for every Kennziffer', () => {
    expect(zoneByKennziffer(1).westLon).toBe(0);
    expect(zoneByKennziffer(1).eastLon).toBe(6);
    expect(zoneByKennziffer(14).westLon).toBe(78);
    expect(zoneByKennziffer(14).eastLon).toBe(84);
    expect(zoneByKennziffer(55).westLon).toBe(-36);
    expect(zoneByKennziffer(55).eastLon).toBe(-30);
    expect(zoneByKennziffer(60).westLon).toBe(-6);
    expect(zoneByKennziffer(60).eastLon).toBe(0);
  });

  it('ALL_ZONES is 60 zones long, ordered by Kennziffer', () => {
    expect(ALL_ZONES).toHaveLength(60);
    expect(ALL_ZONES[0]!.kennziffer).toBe(1);
    expect(ALL_ZONES[59]!.kennziffer).toBe(60);
  });

  it('30°E falls in zone 6 (CM 33°E)', () => {
    expect(zoneForLon(30).kennziffer).toBe(6);
  });

  it('28°20\'E falls in zone 5 (CM 27°E)', () => {
    expect(zoneForLon(28 + 20 / 60).kennziffer).toBe(5);
  });

  it('zoneForLon wraps across the antimeridian', () => {
    // 175°E → zone 30 (CM 177°E), -175° → zone 31 (CM -177° = 183° in the
    // signed-east convention)
    expect(zoneForLon(175).kennziffer).toBe(30);
    expect(zoneForLon(-175).kennziffer).toBe(31);
  });

  it('30°E is inside the 30\' overlap of both adjacent zones', () => {
    const kzs = zonesContainingLon(30).map((z) => z.kennziffer).sort();
    expect(kzs).toEqual([5, 6]);
  });

  it('a longitude far from any boundary returns only one zone', () => {
    expect(zonesContainingLon(15)).toHaveLength(1);
    expect(zonesContainingLon(15)[0]!.kennziffer).toBe(3);
  });
});

describe('DHG forward projection', () => {
  // Easting at the WGS 84 central meridian should land within ~500 m of
  // the false easting 500 000 m. The residual is the Bessel-Potsdam
  // 7-parameter Helmert's east component; worst case at the equator is
  // ~300 m, smaller at mid-latitudes.
  it('Easting at CM is within ~500 m of 500 000', () => {
    for (const kennziffer of [1, 5, 6, 30, 31, 60]) {
      const cm = cmForKennziffer(kennziffer);
      const coord = forwardInZone([0, cm], kennziffer);
      expect(Math.abs(coord.easting - 500_000)).toBeLessThan(500);
    }
  });

  it('Northing at the equator is within ~1 km of 0', () => {
    const coord = forwardInZone([0, 33], 6);
    expect(Math.abs(coord.northing)).toBeLessThan(1000);
  });

  // Kolosjoki NW corner is annotated 30°00'E / 69°30'N. The corner Northing
  // grid label printed on the sheet reads "7715". On the Bessel ellipsoid
  // the meridian arc to 69.5°N is ~7716 km, so the print label is a few
  // metres off the true corner, close enough for a sanity check.
  it('Kolosjoki NW (30°E, 69°30\'N) lands near the printed 7715 / 383 km labels', () => {
    const coord = encodeDhg([69.5, 30.0]);
    expect(coord.kennziffer).toBe(6);
    expect(coord.easting / 1000).toBeGreaterThan(382);
    expect(coord.easting / 1000).toBeLessThan(384);
    expect(coord.northing / 1000).toBeGreaterThan(7714);
    expect(coord.northing / 1000).toBeLessThan(7717);
  });

  // Owrutsch NW corner is annotated 28°20'E / 52°N; the corner labels print
  // N = 5760 km (a grid line a hair south of lat 52°N) and E starts "5600"
  // (= zone 5, Rechtswert 600 km, on the grid line east of the actual corner).
  it('Owrutsch NW (28°20\'E, 52°N) is in zone 5, Northing ~5763 km', () => {
    const coord = encodeDhg([52, 28 + 20 / 60]);
    expect(coord.kennziffer).toBe(5);
    // Meridian arc to 52°N on Bessel ≈ 5763 km.
    expect(coord.northing / 1000).toBeGreaterThan(5760);
    expect(coord.northing / 1000).toBeLessThan(5765);
    // 28°20' is 1°20' east of 27°E CM → 1.333° × 111.32 × cos(52°) ≈ 91 km east → easting ≈ 591 km.
    expect(coord.easting / 1000).toBeGreaterThan(588);
    expect(coord.easting / 1000).toBeLessThan(595);
  });

  it('round-trips lat/lon ↔ DHG metres', () => {
    for (const point of [[69.5, 30.0], [48.75, 16.17], [52, 28.33], [40, -3]] as Array<[number, number]>) {
      const forward = encodeDhg(point);
      const [lat, lon] = inverse(forward);
      expect(lat).toBeCloseTo(point[0], 4);
      expect(lon).toBeCloseTo(point[1], 4);
    }
  });
});

describe('DHG formatters', () => {
  const coord = { kennziffer: 5, easting: 600_000, northing: 5_760_000 };
  it('prepends Kennziffer to long-form easting', () => {
    expect(formatEasting(coord)).toBe('5600');
  });
  it('drops zone prefix on short form', () => {
    expect(formatEasting(coord, { form: 'short' })).toBe('00');
  });
  it('does not prepend on northings', () => {
    expect(formatNorthing(coord)).toBe('5760');
    expect(formatNorthing(coord, { form: 'short' })).toBe('60');
  });

  it('encodeDhgText is stable', () => {
    // We just check the shape, not the exact value, since the Bessel-Potsdam
    // datum shift can move the result by ~5 m.
    const text = encodeDhgText([69.5, 30.0]);
    expect(text).toMatch(/^\d{4} \d{4}$/);
    expect(text.startsWith('6')).toBe(true); // zone 6
  });
});

describe('DHG decode', () => {
  it('parses a 3-token long form', () => {
    const r = parseDhg('5 600 5760');
    expect(r?.coord.kennziffer).toBe(5);
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('parses a 2-token zone-glued form', () => {
    const r = parseDhg('5600 5760');
    expect(r?.coord.kennziffer).toBe(5);
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('parses metres', () => {
    const r = parseDhg('5600000 5760000');
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('parses 3-token metres form', () => {
    const r = parseDhg('5 600000 5760000');
    expect(r?.coord.kennziffer).toBe(5);
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('parses 3-token mixed (km easting, metres northing)', () => {
    const r = parseDhg('5 600 5760000');
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('parses hyphen-separated', () => {
    expect(parseDhg('5-600-5760')?.coord.kennziffer).toBe(5);
  });

  it('parses comma-separated', () => {
    const r = parseDhg('5,600,5760');
    expect(r?.coord.kennziffer).toBe(5);
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('parses 2-token zone-glued metres with km northing', () => {
    const r = parseDhg('5600000 5760');
    expect(r?.coord.kennziffer).toBe(5);
    expect(r?.coord.easting).toBe(600_000);
    expect(r?.coord.northing).toBe(5_760_000);
  });

  it('rejects junk', () => {
    expect(parseDhg('foo')).toBeUndefined();
    expect(parseDhg('')).toBeUndefined();
    expect(parseDhg('999 600 5760')).toBeUndefined();
  });

  it('parses 2-digit short-form against a context', () => {
    expect(parseShortDigits('83', 383)).toBe(383);
    expect(parseShortDigits('00', 399)).toBe(400);
    expect(parseShortDigits('99', 600)).toBe(599);
  });
});

describe('DHG datum shift mutators', () => {
  const customShift: DatumShift = {
    translation: [600, 70, 420],
    rotation: [0.2, 0.05, -2.5],
    scale: 7,
  };

  afterEach(() => {
    resetDhgDatumShift();
  });

  it('dhgCrsCode encodes the shift so custom shifts get isolated proj4 codes', () => {
    const defaultCode = dhgCrsCode(5);
    const customCode = dhgCrsCode(5, customShift);
    expect(defaultCode).toBe('DHG:Z05');
    expect(customCode).not.toBe(defaultCode);
    expect(customCode.startsWith('DHG:Z05:')).toBe(true);
  });

  it('forward with an explicit custom shift produces a different easting', () => {
    const baseline = forward([50, 9]);
    const swapped = forward([50, 9], customShift);
    expect(swapped.kennziffer).toBe(baseline.kennziffer);
    expect(swapped.easting).not.toBe(baseline.easting);
  });

  it('setDhgDatumShift swaps the active default for subsequent calls', () => {
    const baseline = forward([50, 9]);
    setDhgDatumShift(customShift);
    const swapped = forward([50, 9]);
    expect(swapped.easting).not.toBe(baseline.easting);
    expect(swapped.easting).toBe(forward([50, 9], customShift).easting);
  });

  it('resetDhgDatumShift restores DEFAULT_DATUM_SHIFT', () => {
    const original = forward([50, 9]);
    setDhgDatumShift(customShift);
    resetDhgDatumShift();
    expect(forward([50, 9]).easting).toBe(original.easting);
  });

  it('registerAllZones is idempotent', () => {
    expect(() => registerAllZones(customShift)).not.toThrow();
    expect(() => registerAllZones(customShift)).not.toThrow();
  });
});
