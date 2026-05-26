import { describe, expect, it } from 'vitest';

import { dms } from '../../__tests__/util/dms.js';
import { encodeHmnGeo } from '../encode.js';
import { parseHmnGeo } from '../decode.js';

describe('parseHmnGeo', () => {
  const denHaag: [number, number] = [dms(52, 4, 46), dms(4, 18, 30)];
  const scheveningen: [number, number] = [dms(52, 6, 29), dms(4, 16, 30)];

  it('parses TD with a `near` hint', () => {
    const ref = parseHmnGeo('TD', { near: denHaag });
    expect(ref).toBeDefined();
    expect(ref!.kleintrapez).toBe('TD');
    expect(ref!.depth).toBe(2);
  });

  it('parses SD with a `near` hint', () => {
    const ref = parseHmnGeo('SD', { near: scheveningen });
    expect(ref?.kleintrapez).toBe('SD');
  });

  it('refuses to parse without disambiguation', () => {
    expect(parseHmnGeo('TD', {})).toBeUndefined();
  });

  it('rejects an "I" in the letter pair', () => {
    expect(parseHmnGeo('AI', { near: denHaag })).toBeUndefined();
    expect(parseHmnGeo('IA', { near: denHaag })).toBeUndefined();
  });

  it('round-trips parse(encode(p)).center ≈ p within one tenth (6" lon, 4" lat)', () => {
    const ref = encodeHmnGeo(denHaag);
    const parsed = parseHmnGeo(ref.canonical, { grosstrapez: ref.grosstrapez });
    expect(parsed).toBeDefined();
    const [lat, lon] = parsed!.center;
    // A depth-5 cell is 6" lon × 4" lat. The returned centre and the original
    // point can disagree by up to half a cell: 3" lon (≈ 8.3e-4°),
    // 2" lat (≈ 5.6e-4°). toBeCloseTo(..., 3) checks < 5e-4, which is too
    // tight for longitude; assert with explicit tolerances instead.
    expect(Math.abs(lat - denHaag[0])).toBeLessThan(2 / 3600 + 1e-9);
    expect(Math.abs(lon - denHaag[1])).toBeLessThan(3 / 3600 + 1e-9);
  });

  it.each([
    ['TD 5b 24', 'TD 5b 24'],
    ['td 5b 24', 'TD 5b 24'],
    ['Td5B24',   'TD 5b 24'],
    ['TD5b24',   'TD 5b 24'],
    ['  TD  5b   24  ', 'TD 5b 24'],
  ])('canonicalises %s → %s', (input, expected) => {
    expect(parseHmnGeo(input, { near: denHaag })?.canonical).toBe(expected);
  });

  it.each([
    ['TD', 2],
    ['TD 5', 3],
    ['TD 5b', 4],
    ['TD 5b 24', 5],
  ] as const)('depth("%s") = %i', (input, depth) => {
    expect(parseHmnGeo(input, { near: denHaag })?.depth).toBe(depth);
  });

  it('rejects garbage input', () => {
    expect(parseHmnGeo('', { near: denHaag })).toBeUndefined();
    expect(parseHmnGeo('TD 0b 24', { near: denHaag })).toBeUndefined();
    expect(parseHmnGeo('TD 5e 24', { near: denHaag })).toBeUndefined();
    expect(parseHmnGeo('TD 5b 5', { near: denHaag })).toBeUndefined();
    expect(parseHmnGeo('TD 5 24', { near: denHaag })).toBeUndefined();
  });

  it('round-trips sheetNumber verbatim', () => {
    const ref = parseHmnGeo('TD 5b 24', { near: denHaag, sheetNumber: 'Den Haag' });
    expect(ref?.sheetNumber).toBe('Den Haag');
  });
});
