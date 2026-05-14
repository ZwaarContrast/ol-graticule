import { describe, expect, it } from 'vitest';

import { inverse } from '../../dhg/projection.js';
import { encodeHmn, decomposeHmn, formatHmn } from '../encode.js';
import { parseHmn } from '../decode.js';
import { letterFromIndex, letterToIndex } from '../letters.js';

describe('HMN letter alphabet', () => {
  it('has 25 letters and skips I', () => {
    expect(letterFromIndex(0)).toBe('A');
    expect(letterFromIndex(7)).toBe('H');
    expect(letterFromIndex(8)).toBe('J');
    expect(letterFromIndex(24)).toBe('Z');
  });

  it('round-trips letter ↔ index', () => {
    for (let i = 0; i < 25; i++) {
      const letter = letterFromIndex(i);
      expect(letter).toBeDefined();
      expect(letterToIndex(letter!)).toBe(i);
    }
  });

  it('rejects I and out-of-range', () => {
    expect(letterToIndex('I')).toBe(-1);
    expect(letterFromIndex(25)).toBeUndefined();
  });
});

describe('HMN: Kolosjoki ground truth', () => {
  // Push a hair south-east of the printed NW corner so the result is
  // unambiguously inside cell FP rather than on its boundary.
  const insideFp: [number, number] = [69.498, 30.001];

  it('decomposes the NW area to Kleinquadrat FP', () => {
    const b = decomposeHmn(insideFp);
    expect(b.coord.kennziffer).toBe(6);
    expect(b.kleinquadrat).toBe('FP');
  });

  it('full formatHmn matches "FP <num><letter> <tenths>" shape', () => {
    const b = decomposeHmn(insideFp);
    expect(formatHmn(b)).toMatch(/^FP \d[a-d] \d{2}$/);
  });

  it('encodeHmn round-trips: parse(encode(p)).center ≈ p', () => {
    const ref = encodeHmn(insideFp);
    const parsed = parseHmn(ref.canonical, { grossquadrat: ref.grossquadrat });
    expect(parsed).toBeDefined();
    const [lat, lon] = parsed!.center;
    expect(lat).toBeCloseTo(insideFp[0], 2);
    expect(lon).toBeCloseTo(insideFp[1], 2);
  });
});

describe('HMN: Hadres ground truth (Meldung example "PE 1b 52")', () => {
  // Hadres (Blatt 4558 Ost, Alpen- und Donau-Reichsgaue 1:50k) sits around
  // 48°45'N / 16°10'E. The printed legend reads
  // `Meldung: PE 1b Wegkreuzung oder PE 1b 52`.
  const nearHadres: [number, number] = [48.75, 16.17];

  it('parses "PE 1b 52" against a hint near the sheet', () => {
    const ref = parseHmn('PE 1b 52', { near: nearHadres });
    expect(ref).toBeDefined();
    expect(ref!.kleinquadrat).toBe('PE');
    expect(ref!.meldetrapez).toBe(1);
    expect(ref!.arbeitstrapez).toBe('b');
    expect(ref!.tenths).toEqual([5, 2]);
    expect(ref!.depth).toBe(5);
    expect(ref!.canonical).toBe('PE 1b 52');
    // The Hadres area sits in zone 3 (CM 15°E). The `near` hint picks the
    // containing Großquadrat: gx=0 (east of CM by less than 150 km),
    // gy=floor(northing/150 km).
    expect(ref!.grossquadrat.kennziffer).toBe(3);
    expect(ref!.grossquadrat.gx).toBe(0);
  });

  it('forward-encodes points inside the parsed cell back to the same canonical', () => {
    const parsed = parseHmn('PE 1b 52', { near: nearHadres })!;
    // Any point inside the 100 m cell (the bbox) round-trips to "PE 1b 52".
    const [latC, lonC] = parsed.center;
    const reencoded = encodeHmn([latC, lonC]);
    expect(reencoded.canonical).toBe('PE 1b 52');
    expect(reencoded.grossquadrat).toEqual(parsed.grossquadrat);
  });

  it('parses against an explicit grossquadrat (no near hint)', () => {
    const viaNear = parseHmn('PE 1b 52', { near: nearHadres })!;
    const viaExplicit = parseHmn('PE 1b 52', { grossquadrat: viaNear.grossquadrat })!;
    expect(viaExplicit.canonical).toBe('PE 1b 52');
    expect(viaExplicit.center[0]).toBeCloseTo(viaNear.center[0], 6);
    expect(viaExplicit.center[1]).toBeCloseTo(viaNear.center[1], 6);
  });

  it('depth-2 form "PE" parses with a near hint', () => {
    const ref = parseHmn('PE', { near: nearHadres });
    expect(ref?.depth).toBe(2);
    expect(ref?.canonical).toBe('PE');
  });

  it('refuses parsing without disambiguation', () => {
    expect(parseHmn('PE 1b 52', {})).toBeUndefined();
  });

  it('rejects an "I" in the letter pair', () => {
    expect(parseHmn('AI', { near: nearHadres })).toBeUndefined();
    expect(parseHmn('IA', { near: nearHadres })).toBeUndefined();
  });

  it('round-trips sheetNumber through parse', () => {
    const ref = parseHmn('PE 1b 52', { near: nearHadres, sheetNumber: '4558 Ost' });
    expect(ref?.sheetNumber).toBe('4558 Ost');
  });
});

describe('HMN parseHmn input lenience', () => {
  const nearHadres: [number, number] = [48.75, 16.17];

  it.each([
    ['PE 1b 52', 'PE 1b 52'],
    ['pe 1b 52', 'PE 1b 52'],
    ['Pe1B52', 'PE 1b 52'],
    ['PE1b52', 'PE 1b 52'],
    ['  PE   1b   52  ', 'PE 1b 52'],
  ])('canonicalises "%s" → "%s"', (input, expected) => {
    expect(parseHmn(input, { near: nearHadres })?.canonical).toBe(expected);
  });

  it.each([
    ['PE', 2],
    ['PE 1', 3],
    ['PE 1b', 4],
    ['PE 1b 52', 5],
  ] as const)('"%s" yields depth %i', (input, depth) => {
    expect(parseHmn(input, { near: nearHadres })?.depth).toBe(depth);
  });

  it('rejects garbage input', () => {
    expect(parseHmn('', { near: nearHadres })).toBeUndefined();
    expect(parseHmn('PE 0b 52', { near: nearHadres })).toBeUndefined();
    expect(parseHmn('PE 1e 52', { near: nearHadres })).toBeUndefined();
    expect(parseHmn('PE 1b 5', { near: nearHadres })).toBeUndefined();
  });

  it('rejects tenths without an Arbeitstrapez', () => {
    expect(parseHmn('PE 1 52', { near: nearHadres })).toBeUndefined();
  });
});

describe('HMN encodeHmn depth option', () => {
  // Inside cell PE 1b on the Hadres sheet.
  const point: [number, number] = [48.509, 16.156];

  it('depth 2 returns just the Kleinquadrat', () => {
    expect(encodeHmn(point, { depth: 2 }).canonical).toBe('PE');
  });

  it('depth 3 returns Kleinquadrat + Meldetrapez', () => {
    expect(encodeHmn(point, { depth: 3 }).canonical).toBe('PE 1');
  });

  it('depth 4 returns Kleinquadrat + Meldetrapez + Arbeitstrapez', () => {
    expect(encodeHmn(point, { depth: 4 }).canonical).toBe('PE 1b');
  });

  it('depth 5 (default) adds tenths', () => {
    expect(encodeHmn(point).canonical).toBe('PE 1b 52');
  });

  it('separator option swaps the gap', () => {
    expect(encodeHmn(point, { separator: '' }).canonical).toBe('PE1b52');
    expect(encodeHmn(point, { separator: '/' }).canonical).toBe('PE/1b/52');
  });
});

describe('HMN: Meldetrapez subdivision (Hadres diagram, 1..9 row-major NW)', () => {
  // Anchor at the NW corner of Kleinquadrat "AA" inside Großquadrat (0, 36)
  // east of CM 27°E: E=500000 is the CM (FE-offset), N=5478000 is row 12 of
  // the Großquadrat (well inside its 25-row range). Both values land on an
  // exact 6 km grid line.
  const ZONE = 5;
  const KLEIN_NW_E = 500_000;
  const KLEIN_NW_N = 5_478_000;

  // (eOff, nOff) from Kleinquadrat NW corner → expected Meldetrapez digit.
  // Pick the centre of each sub-cell (1, 3, 5 km along each axis) so we
  // land squarely inside.
  const cases: Array<{ eOff: number; nOff: number; expected: number }> = [
    { eOff: 1000, nOff: 1000, expected: 1 },
    { eOff: 3000, nOff: 1000, expected: 2 },
    { eOff: 5000, nOff: 1000, expected: 3 },
    { eOff: 1000, nOff: 3000, expected: 4 },
    { eOff: 3000, nOff: 3000, expected: 5 },
    { eOff: 5000, nOff: 3000, expected: 6 },
    { eOff: 1000, nOff: 5000, expected: 7 },
    { eOff: 3000, nOff: 5000, expected: 8 },
    { eOff: 5000, nOff: 5000, expected: 9 },
  ];

  for (const { eOff, nOff, expected } of cases) {
    it(`Meldetrapez ${expected} at (+${eOff}E, +${nOff}S from Kleinquadrat NW)`, () => {
      const e = KLEIN_NW_E + eOff;
      const n = KLEIN_NW_N - nOff;
      const [lat, lon] = inverse({ kennziffer: ZONE, easting: e, northing: n });
      const b = decomposeHmn([lat, lon], ZONE);
      expect(b.meldetrapez).toBe(expected);
    });
  }
});

describe('HMN: Arbeitstrapez subdivision (a..d row-major NW)', () => {
  const ZONE = 5;
  // Inside Meldetrapez 5 of the same anchor Kleinquadrat (NW at 500000,5478000).
  // Meldetrapez 5 is the centre cell, covering E=502000..504000 and
  // N=5474000..5476000.
  const MT_NW_E = 502_000;
  const MT_NW_N = 5_476_000;

  const cases: Array<{ eOff: number; nOff: number; expected: 'a' | 'b' | 'c' | 'd' }> = [
    { eOff: 500,  nOff: 500,  expected: 'a' },
    { eOff: 1500, nOff: 500,  expected: 'b' },
    { eOff: 500,  nOff: 1500, expected: 'c' },
    { eOff: 1500, nOff: 1500, expected: 'd' },
  ];

  for (const { eOff, nOff, expected } of cases) {
    it(`Arbeitstrapez '${expected}' at (+${eOff}E, +${nOff}S from Meldetrapez NW)`, () => {
      const e = MT_NW_E + eOff;
      const n = MT_NW_N - nOff;
      const [lat, lon] = inverse({ kennziffer: ZONE, easting: e, northing: n });
      const b = decomposeHmn([lat, lon], ZONE);
      expect(b.arbeitstrapez).toBe(expected);
    });
  }
});

describe('HMN: tenths from SW corner', () => {
  const ZONE = 5;
  // Probe inside an Arbeitstrapez at E=502000..503000, N=5474000..5475000
  // (Meldetrapez 5 'a' inside the anchor Klein). Tenth (3 east, 7 north)
  // from the SW corner (E=502000, N=5474000) is the 100 m cell centred at
  // E=502350, N=5474750.
  it('tenths read as (east, north) from SW corner of Arbeitstrapez', () => {
    const e = 502_000 + 350;
    const n = 5_474_000 + 750;
    const [lat, lon] = inverse({ kennziffer: ZONE, easting: e, northing: n });
    const b = decomposeHmn([lat, lon], ZONE);
    expect(b.tenths).toEqual([3, 7]);
  });
});
