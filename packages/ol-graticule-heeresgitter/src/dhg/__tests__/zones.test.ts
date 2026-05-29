import { describe, expect, it } from 'vitest';
import {
  ALL_ZONES,
  FALSE_EASTING,
  STRIP_HALF_WIDTH_DEG,
  STRIP_OVERLAP_DEG,
  cmForKennziffer,
  kennzifferForCm,
  zoneByKennziffer,
  zoneForLon,
  zonesContainingLon,
} from '../zones.js';

describe('DHG strip constants', () => {
  it('half-width is 3°, overlap is 30 arc-minutes, false easting is 500 km', () => {
    expect(STRIP_HALF_WIDTH_DEG).toBe(3);
    expect(STRIP_OVERLAP_DEG).toBe(0.5);
    expect(FALSE_EASTING).toBe(500_000);
  });
});

describe('cmForKennziffer / kennzifferForCm', () => {
  it('maps Kennziffer 1 → CM 3°E', () => {
    expect(cmForKennziffer(1)).toBe(3);
  });

  it('maps Kennziffer 30 → CM 177°E', () => {
    expect(cmForKennziffer(30)).toBe(177);
  });

  it('maps Kennziffer 31 → CM -177°E (across antimeridian)', () => {
    expect(cmForKennziffer(31)).toBe(-177);
  });

  it('maps Kennziffer 60 → CM -3°E', () => {
    expect(cmForKennziffer(60)).toBe(-3);
  });

  it('rejects out-of-range Kennziffern', () => {
    expect(() => cmForKennziffer(0)).toThrow(RangeError);
    expect(() => cmForKennziffer(61)).toThrow(RangeError);
    expect(() => cmForKennziffer(1.5)).toThrow(RangeError);
  });

  it('round-trips Kennziffer → CM → Kennziffer for all 60', () => {
    for (let kz = 1; kz <= 60; kz++) {
      const cm = cmForKennziffer(kz);
      expect(kennzifferForCm(cm)).toBe(kz);
    }
  });
});

describe('zoneForLon', () => {
  it('puts 0° (Greenwich) in zone 1 (CM 3°E)', () => {
    expect(zoneForLon(0).kennziffer).toBe(1);
  });

  it('puts 13° (Berlin) in zone 3 (CM 15°E)', () => {
    expect(zoneForLon(13).kennziffer).toBe(3);
  });

  it('handles negative longitudes (London at -0.1°E → zone 60 CM -3°E)', () => {
    expect(zoneForLon(-0.1).kennziffer).toBe(60);
  });

  it('handles antimeridian-adjacent longitudes', () => {
    expect(zoneForLon(179).kennziffer).toBe(30);
    expect(zoneForLon(-179).kennziffer).toBe(31);
  });
});

describe('zonesContainingLon', () => {
  it('returns one zone deep inside a strip', () => {
    const zones = zonesContainingLon(13);
    expect(zones.length).toBe(1);
    expect(zones[0]!.kennziffer).toBe(3);
  });

  it('returns two zones inside the 30\' overlap band west of CM', () => {
    const zones = zonesContainingLon(11.9);
    expect(zones.length).toBe(2);
    const kzs = zones.map((z) => z.kennziffer).sort();
    expect(kzs).toEqual([2, 3]);
  });

  it('returns two zones inside the 30\' overlap band east of CM', () => {
    const zones = zonesContainingLon(17.9);
    expect(zones.length).toBe(2);
    const kzs = zones.map((z) => z.kennziffer).sort();
    expect(kzs).toEqual([3, 4]);
  });
});

describe('zoneByKennziffer', () => {
  it('returns a fully-populated DhgZone', () => {
    const z = zoneByKennziffer(3);
    expect(z.kennziffer).toBe(3);
    expect(z.cm).toBe(15);
    expect(z.westLon).toBe(12);
    expect(z.eastLon).toBe(18);
  });
});

describe('ALL_ZONES', () => {
  it('has 60 entries', () => {
    expect(ALL_ZONES.length).toBe(60);
  });

  it('is ordered by Kennziffer', () => {
    for (let i = 0; i < 60; i++) {
      expect(ALL_ZONES[i]!.kennziffer).toBe(i + 1);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ALL_ZONES)).toBe(true);
  });
});
