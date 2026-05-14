import { describe, expect, it } from 'vitest';

import {
  DHG_WORLD_BOX,
  cursorKey,
  projectionKey,
  sampleCornerLons,
} from '../sharedViewport.js';

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
