import { describe, expect, it } from 'vitest';
import proj4 from 'proj4';

import {
  ALL_ZONES,
  FALSE_EASTING,
  MAX_KENNZIFFER,
  STRIP_HALF_WIDTH_DEG,
  STRIP_OVERLAP_DEG,
  cmForKennziffer,
  falseEastingFor,
  kennzifferForCm,
  zoneByKennziffer,
  zoneForLon,
  zonesContainingLon,
} from '../zones.js';
import { registerZone } from '../projection.js';
import type { DatumShift, DrgCoord } from '../types.js';
import {
  decodeDrg,
  encodeDrg,
  encodeDrgText,
  formatEasting,
  formatNorthing,
  parseDrg,
} from '../codec.js';

describe('strip constants', () => {
  it('half-width is 1°30\', overlap is 10 arc-minutes, false easting is 500 km', () => {
    expect(STRIP_HALF_WIDTH_DEG).toBe(1.5);
    expect(STRIP_OVERLAP_DEG).toBeCloseTo(1 / 6, 12);
    expect(FALSE_EASTING).toBe(500_000);
  });

  it('Kennziffer is the central meridian divided by 3', () => {
    expect(cmForKennziffer(2)).toBe(6);
    expect(cmForKennziffer(5)).toBe(15);
    expect(kennzifferForCm(9)).toBe(3);
    expect(ALL_ZONES).toHaveLength(MAX_KENNZIFFER + 1);
  });

  it('carries the Kennziffer in the false easting', () => {
    expect(falseEastingFor(2)).toBe(2_500_000);
    expect(zoneByKennziffer(4).falseEasting).toBe(4_500_000);
  });

  it('picks the nearest strip and both strips inside the overlap band', () => {
    expect(zoneForLon(6.2).kennziffer).toBe(2);
    expect(zoneForLon(7.6).kennziffer).toBe(3);
    expect(zonesContainingLon(6).map((z) => z.kennziffer)).toEqual([2]);
    // 7°25' E is within 10' of the 7°30' strip edge.
    expect(zonesContainingLon(7 + 25 / 60).map((z) => z.kennziffer)).toEqual([2, 3]);
  });

  it('rejects Kennziffern outside the supported range', () => {
    expect(() => cmForKennziffer(-1)).toThrow(RangeError);
    expect(() => cmForKennziffer(MAX_KENNZIFFER + 1)).toThrow(RangeError);
  });
});

/**
 * Sheet 5503 Elsenborn, Planblatt A (Geheim), Sonderdruck der Heeresplankammer,
 * Stand 1.10.1939. The sheet spans 6°10'–6°20' E, 50°24'–50°30' N, and its
 * printed grid runs 2512–2523 km east, 5585–5595 km north.
 *
 * The printed graticule is Potsdam/Bessel, so the geometry check feeds the
 * corner lat/lon through an identity datum shift; the WGS 84 case is asserted
 * separately, where the ~1.2" latitude shift moves the corners by ~130 m.
 */
describe('sheet 5503 Elsenborn', () => {
  const corners = {
    sw: [50 + 24 / 60, 6 + 10 / 60],
    nw: [50.5, 6 + 10 / 60],
    se: [50.4, 6 + 20 / 60],
    ne: [50.5, 6 + 20 / 60],
  } as const;

  const POTSDAM_NATIVE: DatumShift = {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 0,
  };

  // The sheet prints Potsdam lat/lon, so project from a Bessel geographic CRS
  // rather than EPSG:4326: a zero `towgs84` still changes the ellipsoid, moving
  // the latitude ~65 m.
  const POTSDAM_GEOGRAPHIC =
    '+proj=longlat +ellps=bessel +towgs84=0,0,0,0,0,0,0 +no_defs';

  const nativeCorner = (latLon: readonly [number, number]): DrgCoord => {
    const code = registerZone(zoneByKennziffer(2), POTSDAM_NATIVE);
    const [easting, northing] = proj4(POTSDAM_GEOGRAPHIC, code, [
      latLon[1],
      latLon[0],
    ]);
    return { kennziffer: 2, easting, northing };
  };

  it('projects into strip 2 on the 6° E central meridian', () => {
    const coord = encodeDrg(corners.sw);
    expect(coord.kennziffer).toBe(2);
    expect(zoneByKennziffer(coord.kennziffer).cm).toBe(6);
  });

  it('encloses exactly the printed lines 2512..2523 and 5585..5595', () => {
    const sw = nativeCorner(corners.sw);
    const nw = nativeCorner(corners.nw);
    const se = nativeCorner(corners.se);
    const ne = nativeCorner(corners.ne);

    // Westmost and southmost printed lines are the first inside the neatline.
    expect(Math.ceil(Math.max(sw.easting, nw.easting) / 1000)).toBe(2512);
    expect(Math.ceil(Math.max(sw.northing, se.northing) / 1000)).toBe(5585);
    // Eastmost and northmost printed lines are the last inside it.
    expect(Math.floor(Math.min(se.easting, ne.easting) / 1000)).toBe(2523);
    expect(Math.floor(Math.min(nw.northing, ne.northing) / 1000)).toBe(5595);
  });

  it('places the neatline corners where the sheet says', () => {
    const sw = nativeCorner(corners.sw);
    expect(sw.easting).toBeCloseTo(2_511_848, -1);
    expect(sw.northing).toBeCloseTo(5_584_781, -1);
    const ne = nativeCorner(corners.ne);
    expect(ne.easting).toBeCloseTo(2_523_647, -1);
    expect(ne.northing).toBeCloseTo(5_595_943, -1);
  });

  it('applies the Potsdam datum shift for WGS 84 input', () => {
    const sw = encodeDrg(corners.sw);
    expect(sw.easting).toBeCloseTo(2_511_892, -1);
    expect(sw.northing).toBeCloseTo(5_584_914, -1);
  });

  it('round-trips through the inverse projection', () => {
    for (const latLon of Object.values(corners)) {
      const [lat, lon] = decodeDrg(encodeDrg(latLon));
      expect(lat).toBeCloseTo(latLon[0], 7);
      expect(lon).toBeCloseTo(latLon[1], 7);
    }
  });
});

describe('label and reference formatting', () => {
  const coord = { kennziffer: 2, easting: 2_512_200, northing: 5_585_450 };

  it('prints corner kilometre labels long and inline ticks short', () => {
    expect(formatEasting(coord)).toBe('2512');
    expect(formatNorthing(coord)).toBe('5585');
    expect(formatEasting(coord, { form: 'short' })).toBe('12');
    expect(formatNorthing(coord, { form: 'short' })).toBe('85');
  });

  it('prints metre point references in the Planzeiger long and kurz forms', () => {
    expect(formatEasting(coord, { unit: 'm' })).toBe('2512200');
    expect(formatNorthing(coord, { unit: 'm' })).toBe('5585450');
    expect(formatEasting(coord, { unit: 'm', form: 'short' })).toBe('12200');
    expect(formatNorthing(coord, { unit: 'm', form: 'short' })).toBe('85450');
  });

  it('matches the Planzeiger worked example on sheet 5503', () => {
    const p = { kennziffer: 4, easting: 4_527_200, northing: 5_796_450 };
    expect(formatEasting(p, { unit: 'm' })).toBe('4527200');
    expect(formatNorthing(p, { unit: 'm' })).toBe('5796450');
    expect(formatEasting(p, { unit: 'm', form: 'short' })).toBe('27200');
    expect(formatNorthing(p, { unit: 'm', form: 'short' })).toBe('96450');
  });

  it('encodes a point to sheet text', () => {
    expect(encodeDrgText([50.4514, 6.2076])).toMatch(/^25\d{5} 55\d{5}$/);
  });
});

describe('parseDrg', () => {
  it('reads metres, kilometres and a split Kennziffer alike', () => {
    expect(parseDrg('2512200 5585450')?.coord).toEqual({
      kennziffer: 2, easting: 2_512_200, northing: 5_585_450,
    });
    expect(parseDrg('2512 5585')?.coord).toEqual({
      kennziffer: 2, easting: 2_512_000, northing: 5_585_000,
    });
    expect(parseDrg('2 512200 5585450')?.coord).toEqual({
      kennziffer: 2, easting: 2_512_200, northing: 5_585_450,
    });
    expect(parseDrg('2-512-5585')?.coord.easting).toBe(2_512_000);
  });

  it('canonicalises to the metre-precision long form', () => {
    expect(parseDrg('2512 5585')?.canonical).toBe('2512000 5585000');
  });

  it('rejects the ambiguous kurz form and out-of-range strips', () => {
    expect(parseDrg('12200 85450')?.coord.kennziffer).not.toBe(2);
    expect(parseDrg('99512 5585')).toBeUndefined();
    expect(parseDrg('nonsense')).toBeUndefined();
    expect(parseDrg('2512')).toBeUndefined();
  });

  it('lands back on the sheet it came from', () => {
    const parsed = parseDrg('2512200 5585450');
    expect(parsed).toBeDefined();
    if (!parsed) return;
    const [lat, lon] = decodeDrg(parsed.coord);
    expect(lat).toBeCloseTo(50.4, 1);
    expect(lon).toBeCloseTo(6.17, 1);
  });
});
