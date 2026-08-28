import { describe, it, expect } from 'vitest';
import { get as getProjection } from 'ol/proj';
import Projection from 'ol/proj/Projection';
import type { Extent } from 'ol/extent';
import {
  wrapParams,
  worldOffsets,
  visibleWorldOffsets,
  worldOffsetOf,
  canonicalizeExtent,
} from '../worldWrap.js';

// EPSG:4326 wraps in x with a 360°-wide world (projExtent [-180,-90,180,90]).
function wgs84(): Projection {
  const proj = getProjection('EPSG:4326');
  if (!proj) throw new Error('EPSG:4326 must be registered');
  return proj;
}

// A bounded, non-global projection: canWrapX() is false, so there is one world.
function nonWrapping(): Projection {
  return new Projection({ code: 'test-nowrap', units: 'm', extent: [0, 0, 100, 100] });
}

describe('wrapParams', () => {
  it('returns the extent and 360° width for a wrapping projection', () => {
    expect(wrapParams(wgs84())).toEqual({ projExtent: [-180, -90, 180, 90], worldWidth: 360 });
  });

  it('is null for a projection that does not wrap in x', () => {
    expect(wrapParams(nonWrapping())).toBeNull();
  });
});

describe('worldOffsets', () => {
  const world: Extent = [-180, -90, 180, 90];

  it('is just the base world for a view inside one copy', () => {
    expect(worldOffsets([-10, -10, 10, 10], world, 360)).toEqual([0]);
  });

  it('adds the +1 copy for an antimeridian-crossing view', () => {
    expect(worldOffsets([170, -10, 190, 10], world, 360)).toEqual([0, 360]);
  });

  it('spans every copy a wide view touches', () => {
    expect(worldOffsets([-400, -10, 400, 10], world, 360)).toEqual([-360, 0, 360]);
  });

  it('picks the single western copy for a view entirely past the antimeridian', () => {
    expect(worldOffsets([190, -10, 350, 10], world, 360)).toEqual([360]);
  });
});

describe('visibleWorldOffsets', () => {
  it('mirrors worldOffsets for a wrapping projection', () => {
    expect(visibleWorldOffsets([170, -10, 190, 10], wgs84())).toEqual([0, 360]);
  });

  it('is [0] for a non-wrapping projection regardless of extent', () => {
    expect(visibleWorldOffsets([-1000, -1000, 1000, 1000], nonWrapping())).toEqual([0]);
  });
});

describe('worldOffsetOf', () => {
  it('is 0 for a coordinate in the base world', () => {
    expect(worldOffsetOf(45, wgs84())).toBe(0);
  });

  it('snaps to the nearest world copy east and west', () => {
    expect(worldOffsetOf(200, wgs84())).toBe(360);
    expect(worldOffsetOf(-200, wgs84())).toBe(-360);
    expect(worldOffsetOf(600, wgs84())).toBe(720);
  });

  it('is 0 for a non-wrapping projection', () => {
    expect(worldOffsetOf(5000, nonWrapping())).toBe(0);
  });
});

describe('canonicalizeExtent', () => {
  it('leaves a within-world extent unchanged', () => {
    expect(canonicalizeExtent([-10, -10, 10, 10], wgs84())).toEqual([-10, -10, 10, 10]);
  });

  it('expands an antimeridian-crossing view to the base-world longitude span', () => {
    expect(canonicalizeExtent([170, -10, 190, 10], wgs84())).toEqual([-180, -10, 180, 10]);
  });

  it('collapses a multi-world view to the full base-world width', () => {
    expect(canonicalizeExtent([-400, -10, 400, 10], wgs84())).toEqual([-180, -10, 180, 10]);
  });

  it('leaves the extent unchanged for a non-wrapping projection', () => {
    expect(canonicalizeExtent([10, 20, 30, 40], nonWrapping())).toEqual([10, 20, 30, 40]);
  });

  it('keeps the y-extent untouched while canonicalising x', () => {
    const [, minY, , maxY] = canonicalizeExtent([170, -33, 190, 47], wgs84());
    expect([minY, maxY]).toEqual([-33, 47]);
  });
});
