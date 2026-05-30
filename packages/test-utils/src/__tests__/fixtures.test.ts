import { describe, it, expect } from 'vitest';
import {
  HMN_POINTS,
  MGRS_POINTS,
  GLOBE_LATITUDES,
  GLOBE_LONGITUDES,
  unitSquare,
} from '../fixtures.js';

describe('HMN_POINTS', () => {
  it('has the five wartime sample points', () => {
    expect(Object.keys(HMN_POINTS).sort()).toEqual(
      ['berlinReichstag', 'denHaag', 'kolosjoki', 'romfo', 'scheveningenLighthouse'].sort(),
    );
  });

  it('every point has a where label and finite WGS 84 lat/lon', () => {
    for (const [name, p] of Object.entries(HMN_POINTS)) {
      expect(p.where, name).toMatch(/.+/);
      expect(Number.isFinite(p.lat), name).toBe(true);
      expect(Number.isFinite(p.lon), name).toBe(true);
      expect(p.lat).toBeGreaterThanOrEqual(-90);
      expect(p.lat).toBeLessThanOrEqual(90);
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('MGRS_POINTS', () => {
  it('has the three landmark fixtures', () => {
    expect(Object.keys(MGRS_POINTS).sort()).toEqual(['eiffelTower', 'sydneyOpera', 'whiteHouse']);
  });

  it('Sydney Opera House is in the southern hemisphere', () => {
    expect(MGRS_POINTS.sydneyOpera.lat).toBeLessThan(0);
  });

  it('White House is in the western hemisphere', () => {
    expect(MGRS_POINTS.whiteHouse.lon).toBeLessThan(0);
  });
});

describe('GLOBE_LATITUDES / GLOBE_LONGITUDES', () => {
  it('lat spread covers polar, mid, and equatorial bands', () => {
    expect(GLOBE_LATITUDES).toContain(0);
    expect(Math.min(...GLOBE_LATITUDES)).toBeLessThan(-80);
    expect(Math.max(...GLOBE_LATITUDES)).toBeGreaterThan(80);
  });

  it('lon spread includes both sides of the antimeridian', () => {
    expect(Math.min(...GLOBE_LONGITUDES)).toBeLessThan(-170);
    expect(Math.max(...GLOBE_LONGITUDES)).toBeGreaterThan(170);
  });

  it('values are within [-90,90] for lats and [-180,180] for lons', () => {
    for (const lat of GLOBE_LATITUDES) {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
    for (const lon of GLOBE_LONGITUDES) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('unitSquare', () => {
  it('returns four CCW corners of the unit square', () => {
    expect(unitSquare()).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
  });

  it('returns a fresh array each call (mutating one does not affect another)', () => {
    const a = unitSquare();
    const b = unitSquare();
    expect(a).not.toBe(b);
    a[0]![0] = 999;
    expect(b[0]![0]).toBe(0);
  });
});
