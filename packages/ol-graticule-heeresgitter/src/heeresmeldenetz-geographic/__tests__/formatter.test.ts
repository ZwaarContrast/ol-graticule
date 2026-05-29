import { describe, expect, it } from 'vitest';
import { hmnGeoHierarchicalLabel } from '../formatter.js';
import { dms } from '@zwaarcontrast/test-utils';
import {
  ARBEITSTRAPEZ_LAT_SEC,
  ARBEITSTRAPEZ_LON_SEC,
  ARCSEC_PER_DEG,
  KLEINTRAPEZ_LON_SEC,
  MELDETRAPEZ_LAT_SEC,
  MELDETRAPEZ_LON_SEC,
} from '../levels.js';

function midSecOf(lat: number, lon: number): [number, number] {
  return [lat * ARCSEC_PER_DEG, lon * ARCSEC_PER_DEG];
}

describe('hmnGeoHierarchicalLabel', () => {
  it('returns the Kleintrapez letter pair at depth 2', () => {
    const [latSec, lonSec] = midSecOf(dms(52, 5), dms(4, 19));
    expect(hmnGeoHierarchicalLabel(lonSec, latSec, 2)).toBe('TD');
  });

  it('depth 3 appends Meldetrapez digit (1..9)', () => {
    const [latSec, lonSec] = midSecOf(dms(52, 5), dms(4, 19));
    const result = hmnGeoHierarchicalLabel(lonSec, latSec, 3);
    expect(result).toMatch(/^TD \d$/);
  });

  it('depth 4 appends Arbeitstrapez letter (a..d)', () => {
    const [latSec, lonSec] = midSecOf(dms(52, 5), dms(4, 19));
    const result = hmnGeoHierarchicalLabel(lonSec, latSec, 4);
    expect(result).toMatch(/^TD \d[a-d]$/);
  });

  it('walks each Meldetrapez 1..9 by stepping NW→SE inside a Kleintrapez', () => {
    const kleinNwLat = dms(52, 8);
    const kleinNwLon = dms(4, 18);
    const observed = new Set<number>();
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const midLatDeg =
          kleinNwLat - (row * MELDETRAPEZ_LAT_SEC + MELDETRAPEZ_LAT_SEC / 2) / ARCSEC_PER_DEG;
        const midLonDeg =
          kleinNwLon + (col * MELDETRAPEZ_LON_SEC + MELDETRAPEZ_LON_SEC / 2) / ARCSEC_PER_DEG;
        const result = hmnGeoHierarchicalLabel(
          midLonDeg * ARCSEC_PER_DEG,
          midLatDeg * ARCSEC_PER_DEG,
          3,
        );
        expect(result).not.toBeUndefined();
        observed.add(Number(result!.slice(-1)));
      }
    }
    expect([...observed].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('walks each Arbeitstrapez a..d inside a Meldetrapez', () => {
    const meldeNwLat = dms(52, 8);
    const meldeNwLon = dms(4, 18);
    const observed = new Set<string>();
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const midLatDeg =
          meldeNwLat - (row * ARBEITSTRAPEZ_LAT_SEC + ARBEITSTRAPEZ_LAT_SEC / 2) / ARCSEC_PER_DEG;
        const midLonDeg =
          meldeNwLon + (col * ARBEITSTRAPEZ_LON_SEC + ARBEITSTRAPEZ_LON_SEC / 2) / ARCSEC_PER_DEG;
        const result = hmnGeoHierarchicalLabel(
          midLonDeg * ARCSEC_PER_DEG,
          midLatDeg * ARCSEC_PER_DEG,
          4,
        );
        expect(result).not.toBeUndefined();
        observed.add(result!.slice(-1));
      }
    }
    expect([...observed].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('walks across two Kleintrapeze and sees the column letter advance', () => {
    const [latSec1, lonSec1] = midSecOf(dms(52, 5), dms(4, 19));
    const [latSec2, lonSec2] = midSecOf(
      dms(52, 5),
      dms(4, 19) + KLEINTRAPEZ_LON_SEC / ARCSEC_PER_DEG,
    );
    const label1 = hmnGeoHierarchicalLabel(lonSec1, latSec1, 2);
    const label2 = hmnGeoHierarchicalLabel(lonSec2, latSec2, 2);
    expect(label1).toBe('TD');
    expect(label2).toBe('UD');
  });
});
