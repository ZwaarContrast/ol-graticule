import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ParseError } from '@zwaarcontrast/ol-graticule';
import {
  formatMgrs,
  lonLatToMgrs,
  lonLatToMgrsParts,
  mgrsPartsToLonLat,
  parseMgrsRef,
} from '../conversion.js';

describe('parseMgrsRef — canonical forms', () => {
  it('parses a full-precision UTM ref with spaces', () => {
    const out = parseMgrsRef('31U FT 12345 67890');
    expect(out.precision).toBe(5);
    expect(out.parts).toEqual({ zone: 31, band: 'U', square: 'FT', easting: 12345, northing: 67890 });
  });

  it('accepts the same ref without separators', () => {
    expect(parseMgrsRef('31UFT1234567890')).toEqual(parseMgrsRef('31U FT 12345 67890'));
  });

  it('accepts slash, hyphen, comma, and underscore separators', () => {
    expect(parseMgrsRef('31U/FT/12345/67890')).toEqual(parseMgrsRef('31U FT 12345 67890'));
    expect(parseMgrsRef('31U-FT-12345-67890')).toEqual(parseMgrsRef('31U FT 12345 67890'));
    expect(parseMgrsRef('31U,FT,12345,67890')).toEqual(parseMgrsRef('31U FT 12345 67890'));
    expect(parseMgrsRef('31U_FT_12345_67890')).toEqual(parseMgrsRef('31U FT 12345 67890'));
  });

  it('parses each supported precision level (1..5)', () => {
    expect(parseMgrsRef('31UFT16').precision).toBe(1);
    expect(parseMgrsRef('31UFT1268').precision).toBe(2);
    expect(parseMgrsRef('31UFT123678').precision).toBe(3);
    expect(parseMgrsRef('31UFT12346789').precision).toBe(4);
    expect(parseMgrsRef('31UFT1234567890').precision).toBe(5);
  });

  it('precision N digits represent N×10^(5-N) metre cells (SW corner)', () => {
    expect(parseMgrsRef('31UFT16').parts).toMatchObject({ easting: 10000, northing: 60000 });
    expect(parseMgrsRef('31UFT123678').parts).toMatchObject({ easting: 12300, northing: 67800 });
  });

  it('parses bare GZD as precision 0 with empty square', () => {
    expect(parseMgrsRef('31U')).toEqual({
      parts: { zone: 31, band: 'U', square: '', easting: 0, northing: 0 },
      precision: 0,
    });
  });

  it('parses GZD + square (no digits) as precision 0 with the square', () => {
    expect(parseMgrsRef('31UFT')).toEqual({
      parts: { zone: 31, band: 'U', square: 'FT', easting: 0, northing: 0 },
      precision: 0,
    });
  });

  it('parses a UPS ref (Y band, no zone number)', () => {
    const out = parseMgrsRef('Y RB 12345 67890');
    expect(out.parts.zone).toBe(0);
    expect(out.parts.band).toBe('Y');
    expect(out.parts.square).toBe('RB');
    expect(out.precision).toBe(5);
  });

  it('parses bare UPS zone (Z) as precision 0', () => {
    expect(parseMgrsRef('Z')).toEqual({
      parts: { zone: 0, band: 'Z', square: '', easting: 0, northing: 0 },
      precision: 0,
    });
  });
});

describe('parseMgrsRef — rejection (negative cases)', () => {
  const garbageOf = (s: string): string => s;

  it('rejects the empty string and whitespace-only input', () => {
    expect(() => parseMgrsRef('')).toThrow(ParseError);
    expect(() => parseMgrsRef('   ')).toThrow(ParseError);
    expect(() => parseMgrsRef('\t\n')).toThrow(ParseError);
  });

  it('rejects an odd number of trailing digits (uneven half-split)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }).chain((odd) =>
          fc.tuple(fc.constant(odd), fc.integer({ min: 1, max: 4 }).map((n) => 2 * n + 1)),
        ),
        ([_, len]) => {
          const digits = '1'.repeat(len);
          expect(() => parseMgrsRef(`31UFT${digits}`)).toThrow(ParseError);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('rejects more than 10 digits (above 1 m precision)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 10 }), (halfLen) => {
        const digits = '1'.repeat(halfLen * 2 + 2);
        expect(() => parseMgrsRef(`31UFT${digits}`)).toThrow(ParseError);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects an invalid UTM zone (0 or > 60)', () => {
    expect(() => parseMgrsRef('0U')).toThrow(ParseError);
    expect(() => parseMgrsRef('61U')).toThrow(ParseError);
  });

  it('rejects I and O as band/square letters (reserved exclusions)', () => {
    expect(() => parseMgrsRef('31I')).toThrow(ParseError);
    expect(() => parseMgrsRef('31O')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UIT')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UOT')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UFI')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UFO')).toThrow(ParseError);
  });

  it('rejects W, X, Y, Z as the row letter (only A-V minus I/O are valid rows)', () => {
    expect(() => parseMgrsRef('31UFW')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UFX')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UFY')).toThrow(ParseError);
    expect(() => parseMgrsRef('31UFZ')).toThrow(ParseError);
  });

  it('property: digit-free strings outside the GZD shape throw (excluding bare A/B/Y/Z which are valid UPS GZDs)', () => {
    fc.assert(
      fc.property(
        // Exclude a/b/y/z because those uppercase to valid UPS GZDs.
        fc.string({
          minLength: 2,
          maxLength: 8,
          unit: fc.constantFrom(...'cdefghijklmnopqrstuvwx'),
        }),
        (s) => {
          expect(() => parseMgrsRef(garbageOf(s))).toThrow(ParseError);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: punctuation-only inputs always throw', () => {
    fc.assert(
      fc.property(
        fc.string({
          minLength: 1,
          maxLength: 6,
          unit: fc.constantFrom(...'!@#$%^&*()+=<>?~`|'),
        }),
        (s) => {
          expect(() => parseMgrsRef(garbageOf(s))).toThrow(ParseError);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: any non-empty, non-MGRS suffix after a valid GZD+square throws', () => {
    fc.assert(
      fc.property(
        fc.string({
          minLength: 1,
          maxLength: 4,
          unit: fc.constantFrom(...'!@#$%^&*()+=<>?~`|abc'),
        }),
        (garbage) => {
          expect(() => parseMgrsRef(`31UFT${garbage}`)).toThrow(ParseError);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('mgrsPartsToLonLat — known reference points', () => {
  it('Eiffel Tower (48.85829°N, 2.29438°E) round-trips through MGRS', () => {
    const lat = 48.85829;
    const lon = 2.29438;
    const text = lonLatToMgrs(lon, lat, 5);
    expect(text).toBeDefined();
    const { parts, precision } = parseMgrsRef(text!);
    const [backLon, backLat] = mgrsPartsToLonLat(parts, precision)!;
    // ~1 m precision: parsed centre is within ~1m of the original.
    expect(Math.abs(backLat - lat)).toBeLessThan(2e-5);
    expect(Math.abs(backLon - lon)).toBeLessThan(2e-5);
  });

  it('Sydney Opera House (southern hemisphere) round-trips', () => {
    const lat = -33.857;
    const lon = 151.215;
    const text = lonLatToMgrs(lon, lat, 5);
    const { parts, precision } = parseMgrsRef(text!);
    const [backLon, backLat] = mgrsPartsToLonLat(parts, precision)!;
    expect(Math.abs(backLat - lat)).toBeLessThan(2e-5);
    expect(Math.abs(backLon - lon)).toBeLessThan(2e-5);
  });

  it('North polar UPS point (88°N, 30°E) round-trips', () => {
    const lat = 88;
    const lon = 30;
    const text = lonLatToMgrs(lon, lat, 5);
    const { parts, precision } = parseMgrsRef(text!);
    const [backLon, backLat] = mgrsPartsToLonLat(parts, precision)!;
    expect(Math.abs(backLat - lat)).toBeLessThan(2e-5);
    expect(Math.abs(backLon - lon)).toBeLessThan(1e-3);
  });

  it('bare GZD (31U) returns the centre of the GZD bbox', () => {
    const { parts, precision } = parseMgrsRef('31U');
    const [lon, lat] = mgrsPartsToLonLat(parts, precision)!;
    expect(lon).toBeCloseTo(3, 6);
    expect(lat).toBeCloseTo(52, 6);
  });

  it('GZD + square (31U FT) returns a point inside the 100 km cell', () => {
    const { parts, precision } = parseMgrsRef('31UFT');
    const [lon, lat] = mgrsPartsToLonLat(parts, precision)!;
    // Re-forward should give back the same square.
    const back = lonLatToMgrsParts(lon, lat)!;
    expect(back.zone).toBe(31);
    expect(back.band).toBe('U');
    expect(back.square).toBe('FT');
  });

  it('rejects a polar (zone 0) reference whose band is not a UPS band', () => {
    // Zone 0 is UPS; only Y/Z/A/B are valid there. 'M' is a UTM band letter,
    // not a UPS one, so the reference must not resolve.
    expect(
      mgrsPartsToLonLat(
        { zone: 0, band: 'M', square: 'AB', easting: 0, northing: 0 },
        5,
      ),
    ).toBeUndefined();
  });
});

describe('parse ↔ format round-trip (property)', () => {
  const safeLon = fc.double({ min: -179, max: 179, noNaN: true, noDefaultInfinity: true });
  const utmLat = fc.double({ min: -78, max: 82, noNaN: true, noDefaultInfinity: true });

  it('parse(format(p)) returns the [lon, lat] within the cell tolerance', () => {
    // Cells that straddle a UTM zone boundary (e.g. column A in any zone)
    // round-trip to the other zone within proj4 rounding — that's a
    // boundary-aliasing artefact, not a parser bug. Asserting on cell-sized
    // distance dodges it cleanly.
    fc.assert(
      fc.property(
        safeLon,
        utmLat,
        fc.integer({ min: 1, max: 5 }),
        (lon, lat, precN) => {
          const precision = precN as 1 | 2 | 3 | 4 | 5;
          const text = lonLatToMgrs(lon, lat, precision);
          if (text === undefined) return;
          const parsed = parseMgrsRef(text);
          expect(parsed.precision).toBe(precision);
          const ll = mgrsPartsToLonLat(parsed.parts, parsed.precision);
          if (!ll) return;
          // Cell side at precision N is 10^(5-N) metres; allow one cell of slop.
          const cellMetres = 10 ** (5 - precision);
          const degLat = cellMetres / 111_000;
          const degLon = cellMetres / (111_000 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
          expect(Math.abs(ll[1] - lat)).toBeLessThan(degLat);
          expect(Math.abs(ll[0] - lon)).toBeLessThan(degLon);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('parts → format → parse preserves zone/band/square (no boundary aliasing on the symbolic round-trip)', () => {
    fc.assert(
      fc.property(safeLon, utmLat, (lon, lat) => {
        const original = lonLatToMgrsParts(lon, lat);
        if (!original) return;
        const text = formatMgrs(original, 5);
        const { parts } = parseMgrsRef(text);
        expect(parts.zone).toBe(original.zone);
        expect(parts.band).toBe(original.band);
        expect(parts.square).toBe(original.square);
        expect(parts.easting).toBe(original.easting);
        expect(parts.northing).toBe(original.northing);
      }),
      { numRuns: 200 },
    );
  });
});

describe('formatMgrs ↔ parseMgrsRef pure-parts round-trip', () => {
  it('parts → formatted → parsed has the same zone/band/square', () => {
    const original = lonLatToMgrsParts(2.29438, 48.85829)!;
    const text = formatMgrs(original, 5);
    const { parts } = parseMgrsRef(text);
    expect(parts.zone).toBe(original.zone);
    expect(parts.band).toBe(original.band);
    expect(parts.square).toBe(original.square);
    expect(parts.easting).toBe(original.easting);
    expect(parts.northing).toBe(original.northing);
  });
});
