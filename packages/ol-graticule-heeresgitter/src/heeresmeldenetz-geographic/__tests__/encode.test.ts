import { describe, expect, it } from 'vitest';

import { dms } from '../../__tests__/util/dms.js';
import {
  decomposeHmnGeo,
  encodeHmnGeo,
  formatHmnGeo,
} from '../encode.js';
import { parseHmnGeo } from '../decode.js';

// Two primary-source ground truths pin both axes of the (0°40'N, 0°E) anchor.

describe('Den Haag — primary-source ground truth', () => {
  // 52°04'46"N, 4°18'30"E. Labelled "TD" on a wartime Atlantikwall sector
  // overprint of the Dutch coast.
  const denHaag: [number, number] = [dms(52, 4, 46), dms(4, 18, 30)];

  it('encodes to cell TD', () => {
    expect(encodeHmnGeo(denHaag, { depth: 2 }).kleintrapez).toBe('TD');
  });

  it('lands in Großtrapez (gx=1, gy=30) at NW corner (52°20\'N, 2°30\'E)', () => {
    expect(decomposeHmnGeo(denHaag).grosstrapez).toEqual({ gx: 1, gy: 30 });
  });
});

describe('Scheveningen — primary-source ground truth', () => {
  // 52°06'29"N, 4°16'30"E. Labelled "SD" on the same Atlantikwall overprint.
  const scheveningen: [number, number] = [dms(52, 6, 29), dms(4, 16, 30)];

  it('encodes to cell SD', () => {
    expect(encodeHmnGeo(scheveningen, { depth: 2 }).kleintrapez).toBe('SD');
  });

  it('shares Großtrapez with Den Haag (= one cell west of TD)', () => {
    const here = decomposeHmnGeo(scheveningen);
    const denHaag = decomposeHmnGeo([dms(52, 4, 46), dms(4, 18, 30)]);
    expect(here.grosstrapez).toEqual(denHaag.grosstrapez);
  });
});

describe('Romfo — primary-source ground truth', () => {
  // Bildplankarte "E27O Romfo (Nordteil)"; sheet header reads
  // "Heeresmeldenetz (geogr.)" and prints cells NV..SX. Romfo town centre at
  // 62°36'N, 9°30'E sits east of the printed area in cell VW.
  it('Romfo town centre → cell VW in Großtrapez (gx=3, gy=37)', () => {
    const ref = encodeHmnGeo([dms(62, 36), dms(9, 30)], { depth: 2 });
    expect(ref.kleintrapez).toBe('VW');
    expect(ref.grosstrapez).toEqual({ gx: 3, gy: 37 });
  });

  // Cell-centre coordinates derived independently from the printed-sheet
  // index (the spec's W→E / N→S letter ordering) rather than from the
  // encoder's own constants, so a wrong anchor or letter order would
  // make this test fail.
  it.each([
    // Cell centres in the Großtrapez (NW = 64°00'N, 7°30'E), row V (index 20).
    [dms(62, 38), dms(8, 45), 'NV'],
    [dms(62, 38), dms(8, 51), 'OV'],
    [dms(62, 38), dms(8, 57), 'PV'],
    [dms(62, 38), dms(9,  3), 'QV'],
    [dms(62, 38), dms(9,  9), 'RV'],
    [dms(62, 38), dms(9, 15), 'SV'],
    // Two rows down (different row letter confirms the row axis).
    [dms(62, 30), dms(8, 45), 'NX'],
    [dms(62, 30), dms(9, 15), 'SX'],
  ])('cell at (%s, %s) → %s', (lat, lon, expected) => {
    const ref = encodeHmnGeo([lat, lon], { depth: 2 });
    expect(ref.kleintrapez).toBe(expected);
    expect(ref.grosstrapez).toEqual({ gx: 3, gy: 37 });
  });
});

describe('hierarchy: Meldetrapez 1..9 numbering inside cell TD', () => {
  // Kleintrapez TD NW: (52°08'N, 4°18'E). Meldetrapeze are 2' lon × 1'20" lat.
  // Probe the centre of each of the nine cells (offsets 1'/3'/5' lon,
  // 40"/2'/3'20" lat) and read back the digit.
  const NW_LAT = dms(52, 8);
  const NW_LON = dms(4, 18);
  it.each([
    [1, 1, 40],
    [2, 3, 40],
    [3, 5, 40],
    [4, 1, 120],
    [5, 3, 120],
    [6, 5, 120],
    [7, 1, 200],
    [8, 3, 200],
    [9, 5, 200],
  ])('Meldetrapez %i at offset (%i\' E, %i" S) from NW', (mt, offMinE, offSecS) => {
    const b = decomposeHmnGeo([NW_LAT - offSecS / 3600, NW_LON + offMinE / 60]);
    expect(b.kleintrapez).toBe('TD');
    expect(b.meldetrapez).toBe(mt);
  });
});

describe('hierarchy: Arbeitstrapez a/b/c/d inside Meldetrapez 5', () => {
  // Meldetrapez 5 NW (TD): (52°08' − 1'20", 4°18' + 2') = (52°06'40", 4°20').
  // Arbeitstrapeze are 1' lon × 40" lat; probe each centre.
  const NW_LAT = dms(52, 8) - dms(0, 1, 20);
  const NW_LON = dms(4, 18) + dms(0, 2);
  it.each([
    ['a', 0.5, 20],
    ['b', 1.5, 20],
    ['c', 0.5, 60],
    ['d', 1.5, 60],
  ] as const)('Arbeitstrapez %s at (%i\' E, %i" S) from MT5 NW', (at, offMinE, offSecS) => {
    const b = decomposeHmnGeo([NW_LAT - offSecS / 3600, NW_LON + offMinE / 60]);
    expect(b.meldetrapez).toBe(5);
    expect(b.arbeitstrapez).toBe(at);
  });
});

describe('hierarchy: tenths from Arbeitstrapez SW corner', () => {
  // Arbeitstrapez 'a' of MT5 in TD: SW corner at (52°06'00"N, 4°20'00"E).
  // Tenths are 6" lon × 4" lat; (te, tn) = (3, 7) → centre at (52°06'30", 4°20'21").
  // Use asymmetric tenths so an east/north swap can't pass.
  it.each([
    // [expected te, expected tn, lat, lon]
    [3, 7, dms(52, 6) + 30 / 3600, dms(4, 20) + 21 / 3600],
    [0, 0, dms(52, 6) +  2 / 3600, dms(4, 20) +  3 / 3600],
    [9, 9, dms(52, 6) + 38 / 3600, dms(4, 20) + 57 / 3600],
    // (te=1, tn=8) tests the asymmetric case: east must NOT equal north.
    [1, 8, dms(52, 6) + 34 / 3600, dms(4, 20) +  9 / 3600],
  ])('tenths (%i, %i) at lat %s, lon %s', (te, tn, lat, lon) => {
    expect(decomposeHmnGeo([lat, lon]).tenths).toEqual([te, tn]);
  });
});

describe('encodeHmnGeo: bbox at every depth', () => {
  const point: [number, number] = [dms(52, 4, 46), dms(4, 18, 30)];

  it.each([
    [2, 'TD',                 6 / 60,    4 / 60],
    [3, /^TD \d$/,            2 / 60,   80 / 3600],
    [4, /^TD \d[a-d]$/,       1 / 60,   40 / 3600],
    [5, /^TD \d[a-d] \d{2}$/, 6 / 3600,  4 / 3600],
  ] as const)('depth %i: width %s°, height %s°', (depth, expected, widthDeg, heightDeg) => {
    const ref = encodeHmnGeo(point, { depth });
    if (typeof expected === 'string') expect(ref.canonical).toBe(expected);
    else expect(ref.canonical).toMatch(expected);
    expect(ref.bbox[2] - ref.bbox[0]).toBeCloseTo(widthDeg, 9);
    expect(ref.bbox[3] - ref.bbox[1]).toBeCloseTo(heightDeg, 9);
  });

  it('bbox actually contains the input point at every depth', () => {
    for (const depth of [2, 3, 4, 5] as const) {
      const ref = encodeHmnGeo(point, { depth });
      const [minLon, minLat, maxLon, maxLat] = ref.bbox;
      expect(point[1] >= minLon && point[1] <= maxLon, `depth ${depth} lon`).toBe(true);
      expect(point[0] >= minLat && point[0] <= maxLat, `depth ${depth} lat`).toBe(true);
    }
  });
});

describe('formatHmnGeo and separator handling', () => {
  const point: [number, number] = [dms(52, 4, 46), dms(4, 18, 30)];

  it('emits the correct length at each depth', () => {
    const b = decomposeHmnGeo(point);
    expect(formatHmnGeo(b, { depth: 2 })).toBe('TD');
    expect(formatHmnGeo(b, { depth: 3 })).toMatch(/^TD \d$/);
    expect(formatHmnGeo(b, { depth: 4 })).toMatch(/^TD \d[a-d]$/);
    expect(formatHmnGeo(b, { depth: 5 })).toMatch(/^TD \d[a-d] \d{2}$/);
  });

  it('round-trips through parseHmnGeo back to the same cell', () => {
    const ref = encodeHmnGeo(point);
    const parsed = parseHmnGeo(ref.canonical, { grosstrapez: ref.grosstrapez });
    expect(parsed?.kleintrapez).toBe(ref.kleintrapez);
    expect(parsed?.meldetrapez).toBe(ref.meldetrapez);
    expect(parsed?.arbeitstrapez).toBe(ref.arbeitstrapez);
    expect(parsed?.tenths).toEqual(ref.tenths);
  });

  it('separator option appears between groups but not within them', () => {
    expect(encodeHmnGeo(point, { separator: '' }).canonical).toMatch(/^TD\d[a-d]\d{2}$/);
    expect(encodeHmnGeo(point, { separator: '/' }).canonical).toMatch(/^TD\/\d[a-d]\/\d{2}$/);
  });
});

describe('cross-Großtrapez behaviour', () => {
  it('one arcsecond either side of the SD/TD boundary at 4°18\'E selects the right cell', () => {
    const lat = 52.07;
    expect(encodeHmnGeo([lat, dms(4, 17, 59)], { depth: 2 }).kleintrapez).toBe('SD');
    expect(encodeHmnGeo([lat, dms(4, 18, 1)], { depth: 2 }).kleintrapez).toBe('TD');
  });

  it('crossing into the Großtrapez immediately south increments gy by 1', () => {
    const north = decomposeHmnGeo([dms(52, 8), dms(4, 18)]);
    const south = decomposeHmnGeo([dms(50, 30), dms(4, 18)]);
    expect(north.grosstrapez.gy - south.grosstrapez.gy).toBe(1);
  });

  it('points west of Greenwich produce negative gx', () => {
    // Anything west of 0°E is gx < 0 by spec — easy to break with `Math.floor`
    // on a positive remainder if someone refactors.
    const west = decomposeHmnGeo([dms(52, 0), dms(-3, 0)]);
    expect(west.grosstrapez.gx).toBeLessThan(0);
  });

  it('points south of the (0°40\'N) anchor produce gy ≤ -1', () => {
    // Pick a lat well inside a southern Großtrapez (avoid landing on the
    // boundary, which would put `ky` outside the 0..24 letter range).
    const south = decomposeHmnGeo([dms(-3, 0), dms(1, 0)]);
    expect(south.grosstrapez.gy).toBeLessThanOrEqual(-1);
  });
});
