import { describe, expect, it } from 'vitest';

import {
  VALIDITY_EAST_LON,
  VALIDITY_NORTH_LAT,
  VALIDITY_SOUTH_LAT,
  VALIDITY_WEST_LON,
  pointInsideValidity,
  stripClipPolygon,
  zoneIntersectsValidity,
} from '../stripPolygon.js';
import { zoneByKennziffer } from '../zones.js';

describe('Validity envelope constants', () => {
  it('matches the Planheft Schweiz operational rectangle', () => {
    expect(VALIDITY_WEST_LON).toBe(-36);
    expect(VALIDITY_EAST_LON).toBe(84);
    expect(VALIDITY_SOUTH_LAT).toBe(-32);
    expect(VALIDITY_NORTH_LAT).toBe(72);
  });
});

describe('pointInsideValidity', () => {
  it('accepts points strictly inside the envelope', () => {
    expect(pointInsideValidity(0, 0)).toBe(true);
    expect(pointInsideValidity(20, 50)).toBe(true);
  });

  it('accepts the four corners (inclusive)', () => {
    expect(pointInsideValidity(VALIDITY_WEST_LON, VALIDITY_SOUTH_LAT)).toBe(true);
    expect(pointInsideValidity(VALIDITY_EAST_LON, VALIDITY_NORTH_LAT)).toBe(true);
    expect(pointInsideValidity(VALIDITY_WEST_LON, VALIDITY_NORTH_LAT)).toBe(true);
    expect(pointInsideValidity(VALIDITY_EAST_LON, VALIDITY_SOUTH_LAT)).toBe(true);
  });

  it('rejects points past each edge', () => {
    expect(pointInsideValidity(-37, 0)).toBe(false); // too far west
    expect(pointInsideValidity(85, 0)).toBe(false);  // too far east
    expect(pointInsideValidity(0, -33)).toBe(false); // too far south
    expect(pointInsideValidity(0, 73)).toBe(false);  // too far north
  });
});

describe('zoneIntersectsValidity', () => {
  it('includes every zone the Planheft assigns Kennziffer to', () => {
    // Zones 1..14 (CM 3°E..81°E) all overlap the +0°..+84° eastern half.
    for (let k = 1; k <= 14; k++) {
      expect(zoneIntersectsValidity(zoneByKennziffer(k))).toBe(true);
    }
    // Zones 55..60 (CM 33°W..3°W) all overlap the -36°..0° western half.
    for (let k = 55; k <= 60; k++) {
      expect(zoneIntersectsValidity(zoneByKennziffer(k))).toBe(true);
    }
  });

  it('excludes far-east zones outside the envelope', () => {
    // Zone 15 has CM 87°E (strip 84°-90°E), exactly at the eastern edge, so
    // the strip's western boundary is on the envelope edge and the
    // strict-inequality check returns false.
    expect(zoneIntersectsValidity(zoneByKennziffer(15))).toBe(false);
    expect(zoneIntersectsValidity(zoneByKennziffer(30))).toBe(false);
  });

  it('includes a neighbouring zone when extended by the 30\' strip overlap', () => {
    // Zone 54 (CM 39°W, strip 42°W..36°W) is on the western edge of the envelope
    // and excluded by default, but its overlap band extends to 35.5°W which is
    // inside the envelope.
    expect(zoneIntersectsValidity(zoneByKennziffer(54))).toBe(false);
    expect(zoneIntersectsValidity(zoneByKennziffer(54), 0.5)).toBe(true);
  });
});

describe('stripClipPolygon', () => {
  it('returns a 4-corner WGS 84 rectangle for an in-envelope zone', () => {
    const zone = zoneByKennziffer(3); // CM 15°E, strip 12°..18°E
    const clip = stripClipPolygon(zone);
    expect(clip.crs).toBe('EPSG:4326');
    expect(clip.rings).toHaveLength(1);
    const ring = clip.rings[0]!;
    expect(ring).toHaveLength(4);
    // Ring corners: SW, SE, NE, NW; longitudes clamp to strip edges, latitudes to envelope.
    expect(ring[0]).toEqual([12, VALIDITY_SOUTH_LAT]);
    expect(ring[1]).toEqual([18, VALIDITY_SOUTH_LAT]);
    expect(ring[2]).toEqual([18, VALIDITY_NORTH_LAT]);
    expect(ring[3]).toEqual([12, VALIDITY_NORTH_LAT]);
  });

  it('clamps strip edges to the validity envelope at the eastern boundary', () => {
    const zone = zoneByKennziffer(14); // CM 81°E, strip 78°..84°E (touches the envelope edge)
    const clip = stripClipPolygon(zone);
    const ring = clip.rings[0]!;
    expect(ring[1]![0]).toBe(VALIDITY_EAST_LON); // SE corner clamped to +84°
    expect(ring[2]![0]).toBe(VALIDITY_EAST_LON); // NE corner clamped to +84°
  });

  it('returns a degenerate triangle when the zone is fully outside the envelope', () => {
    const zone = zoneByKennziffer(20); // CM 117°E, strip 114°..120°E (way outside)
    const clip = stripClipPolygon(zone);
    const ring = clip.rings[0]!;
    expect(ring).toHaveLength(3);
    // Degenerate triangle is around the origin so PolygonClippedGridSystem
    // emits nothing for any practical view extent.
    expect(ring.every(([x, y]) => Math.abs(x!) < 0.01 && Math.abs(y!) < 0.01)).toBe(true);
  });

  it('widens the ring when overlap is applied', () => {
    const zone = zoneByKennziffer(3);
    const noOverlap = stripClipPolygon(zone).rings[0]!;
    const withOverlap = stripClipPolygon(zone, 0.5).rings[0]!;
    expect(withOverlap[0]![0]).toBe(noOverlap[0]![0] - 0.5);
    expect(withOverlap[1]![0]).toBe(noOverlap[1]![0] + 0.5);
  });
});
