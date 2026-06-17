import { describe, expect, it } from 'vitest';
import { viewportExtentAt } from '@zwaarcontrast/test-utils';

import {
  DHG_WORLD_BOX,
  activeZonesFor,
  cursorKey,
  projectionKey,
  sampleCornerLons,
  toFiniteLonLat,
} from '../sharedViewport.js';
import { zoneForLon } from '../../dhg/zones.js';

describe('DHG_WORLD_BOX', () => {
  it('covers the operational theatre in DHG metres', () => {
    const [minX, minY, maxX, maxY] = DHG_WORLD_BOX;
    expect(maxX).toBeGreaterThan(minX);
    expect(maxY).toBeGreaterThan(minY);
    // Theatre maxes out around 7 800 km North (Kolosjoki area) and bottoms
    // out below the equator: any reasonable wartime coordinate should fit.
    expect(minY).toBeLessThanOrEqual(-1_000_000);
    expect(maxY).toBeGreaterThanOrEqual(13_000_000);
  });
});

describe('projectionKey', () => {
  it('returns the string projection verbatim', () => {
    expect(projectionKey('EPSG:3857')).toBe('EPSG:3857');
    expect(projectionKey('EPSG:4326')).toBe('EPSG:4326');
  });

  it('returns the empty string for nullish input', () => {
    // ProjectionLike permits string | undefined-ish; the function is defensive.
    expect(projectionKey(undefined)).toBe('');
  });
});

describe('cursorKey', () => {
  it('encodes the projection and integer-rounded coordinates', () => {
    expect(cursorKey([12345.4, 67890.6], 'EPSG:3857')).toBe('EPSG:3857|12345|67891');
  });

  it('produces distinct keys for distinct projections at the same coordinate', () => {
    const c: [number, number] = [100, 200];
    expect(cursorKey(c, 'EPSG:3857')).not.toBe(cursorKey(c, 'EPSG:4326'));
  });

  it('collapses sub-metre cursor movement into a stable cache key', () => {
    expect(cursorKey([1000.1, 2000.2], 'EPSG:3857')).toBe(
      cursorKey([1000.4, 1999.9], 'EPSG:3857'),
    );
  });
});

describe('sampleCornerLons', () => {
  it('returns four longitudes for a typical EPSG:3857 viewport', () => {
    // Roughly Europe in web Mercator metres.
    const extent: [number, number, number, number] = [
      0, 5_621_521, 3_339_584, 7_361_866,
    ];
    const lons = sampleCornerLons(extent, 'EPSG:3857');
    expect(lons).toHaveLength(4);
    for (const lon of lons) expect(Number.isFinite(lon)).toBe(true);
    // Two corners at minX=0 → lon 0; two at maxX=3 339 584 → lon ≈ 30.
    expect(Math.min(...lons)).toBeCloseTo(0, 3);
    expect(Math.max(...lons)).toBeCloseTo(30, 1);
  });

  it('passes through a degenerate (single-point) extent', () => {
    const point: [number, number, number, number] = [0, 5_621_521, 0, 5_621_521];
    const lons = sampleCornerLons(point, 'EPSG:3857');
    expect(lons).toHaveLength(4);
    for (const lon of lons) expect(lon).toBeCloseTo(0, 3);
  });
});

describe('toFiniteLonLat', () => {
  it('returns [lon, lat] for a finite view coordinate', () => {
    // EPSG:3857 metres for ~9°E on the equator.
    const ll = toFiniteLonLat([1_001_875.417, 0], 'EPSG:3857');
    if (ll === null) throw new Error('expected a coordinate, got null');
    expect(ll[0]).toBeCloseTo(9, 4);
    expect(ll[1]).toBeCloseTo(0, 6);
  });

  it('returns null when the transform yields a non-finite coordinate', () => {
    expect(toFiniteLonLat([NaN, NaN], 'EPSG:3857')).toBeNull();
    expect(toFiniteLonLat([Number.POSITIVE_INFINITY, 0], 'EPSG:3857')).toBeNull();
  });
});

describe('activeZonesFor', () => {
  const BERLIN: [number, number] = [13.4, 52.5];
  const berlinZone = zoneForLon(13.4).kennziffer;

  it('single mode returns only the centre zone', () => {
    const { extent } = viewportExtentAt(BERLIN, 8);
    expect(activeZonesFor(extent, 'EPSG:3857', 'single')).toEqual([berlinZone]);
  });

  it('tiled mode over a tight view includes the centre zone', () => {
    const { extent } = viewportExtentAt(BERLIN, 14);
    expect(activeZonesFor(extent, 'EPSG:3857', 'tiled')).toContain(berlinZone);
  });

  it('tiled mode over a wide view returns multiple ascending zones', () => {
    const { extent } = viewportExtentAt(BERLIN, 4);
    const zones = activeZonesFor(extent, 'EPSG:3857', 'tiled');
    expect(zones.length).toBeGreaterThan(1);
    expect(zones).toContain(berlinZone);
    expect([...zones].sort((a, b) => a - b)).toEqual(zones);
  });

  it('overlap mode covers at least as many zones as tiled', () => {
    const { extent } = viewportExtentAt(BERLIN, 6);
    const tiled = activeZonesFor(extent, 'EPSG:3857', 'tiled');
    const overlap = activeZonesFor(extent, 'EPSG:3857', 'overlap');
    expect(overlap.length).toBeGreaterThanOrEqual(tiled.length);
  });

  it('returns no zones for a view outside the DHG validity envelope', () => {
    // Mid-Pacific: lon ≈ 150°, well east of the 84°E validity bound.
    const { extent } = viewportExtentAt([150, 0], 6);
    expect(activeZonesFor(extent, 'EPSG:3857', 'tiled')).toEqual([]);
    expect(activeZonesFor(extent, 'EPSG:3857', 'single')).toEqual([]);
  });
});
