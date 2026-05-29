import { describe, expect, it } from 'vitest';
import {
  encodeDhg,
  encodeDhgText,
  formatEasting,
  formatNorthing,
} from '../encode.js';
import { dms } from '@zwaarcontrast/test-utils';

describe('encodeDhg', () => {
  it('picks the nearest CM zone by default', () => {
    const berlin: [number, number] = [dms(52, 31), dms(13, 22)];
    const coord = encodeDhg(berlin);
    expect(coord.kennziffer).toBe(3);
    expect(coord.easting).toBeGreaterThan(350_000);
    expect(coord.easting).toBeLessThan(500_000);
    expect(coord.northing).toBeGreaterThan(5_800_000);
    expect(coord.northing).toBeLessThan(5_900_000);
  });

  it('honours an explicit Kennziffer override and places the easting on the expected side of CM', () => {
    // Lon 12°E is 3° east of zone 2's CM (9°E) and 3° west of zone 3's
    // CM (15°E). Easting carries the +500 km false offset.
    const onBoundary: [number, number] = [50, 12.0];
    const z2 = encodeDhg(onBoundary, 2);
    const z3 = encodeDhg(onBoundary, 3);
    expect(z2.kennziffer).toBe(2);
    expect(z3.kennziffer).toBe(3);
    expect(z2.easting).toBeGreaterThan(500_000); // east of CM 9°E
    expect(z3.easting).toBeLessThan(500_000); // west of CM 15°E
    // Same physical point in two strips → northings should agree within
    // a few hundred metres (different projection origins, near-identity
    // GK distortion at this latitude).
    expect(Math.abs(z2.northing - z3.northing)).toBeLessThan(500);
  });
});

describe('formatEasting / formatNorthing', () => {
  it('long-form easting prepends Kennziffer to 3-digit km', () => {
    expect(formatEasting({ kennziffer: 5, easting: 600_000, northing: 0 })).toBe('5600');
  });

  it('short-form easting writes only last 2 digits zero-padded', () => {
    expect(formatEasting(
      { kennziffer: 5, easting: 383_000, northing: 0 },
      { form: 'short' },
    )).toBe('83');
    expect(formatEasting(
      { kennziffer: 5, easting: 300_000, northing: 0 },
      { form: 'short' },
    )).toBe('00');
  });

  it('northing long form has no Kennziffer prefix', () => {
    expect(formatNorthing({ kennziffer: 5, easting: 0, northing: 5_760_000 })).toBe('5760');
  });

  it('northing short form is the last 2 km digits, padded', () => {
    expect(formatNorthing(
      { kennziffer: 5, easting: 0, northing: 5_703_000 },
      { form: 'short' },
    )).toBe('03');
  });
});

describe('encodeDhgText', () => {
  it('formats the canonical long-form pair "<KE>EEE <NNNN>"', () => {
    const berlin: [number, number] = [dms(52, 31), dms(13, 22)];
    const text = encodeDhgText(berlin);
    expect(text).toMatch(/^3\d{3} \d{4}$/);
  });
});
