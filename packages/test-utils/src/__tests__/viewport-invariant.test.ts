import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import type { Extent } from 'ol/extent';
import type { ProjectionLike } from 'ol/proj';
import type { Geometry } from 'ol/geom';
import {
  findOffScreenFeatures,
  epsg3857ResolutionAtZoom,
  viewportExtentAt,
} from '../viewport-invariant.js';

interface FakeGrid {
  getFeatures(extent: Extent, resolution: number, viewProjection: ProjectionLike): Feature<Geometry>[];
}

function lineFeature(coords: [number, number][], attrs: Record<string, unknown> = {}): Feature<Geometry> {
  const f = new Feature<Geometry>({ geometry: new LineString(coords) });
  for (const [k, v] of Object.entries(attrs)) f.set(k, v);
  return f;
}

describe('findOffScreenFeatures', () => {
  const viewport: Extent = [0, 0, 100, 100];

  it('returns empty when every feature intersects the viewport', () => {
    const grid: FakeGrid = {
      getFeatures: () => [
        lineFeature([[10, 10], [90, 90]]),
        lineFeature([[-10, 50], [110, 50]]),
      ],
    };
    expect(findOffScreenFeatures(grid, viewport, 1, 'EPSG:3857')).toEqual([]);
  });

  it('flags features whose bbox is entirely outside the viewport', () => {
    const grid: FakeGrid = {
      getFeatures: () => [
        lineFeature([[10, 10], [90, 90]]),
        lineFeature([[200, 200], [300, 300]], { gridLineType: 'minor', gridAxis: 'x', gridValue: 7 }),
      ],
    };
    const out = findOffScreenFeatures(grid, viewport, 1, 'EPSG:3857');
    expect(out.length).toBe(1);
    expect(out[0]!.bbox).toEqual([200, 200, 300, 300]);
    expect(out[0]!.gridLineType).toBe('minor');
    expect(out[0]!.gridAxis).toBe('x');
    expect(out[0]!.gridValue).toBe('7');
  });

  it('treats features that touch the viewport edge as on-screen', () => {
    const grid: FakeGrid = {
      getFeatures: () => [lineFeature([[100, 50], [200, 50]])],
    };
    expect(findOffScreenFeatures(grid, viewport, 1, 'EPSG:3857')).toEqual([]);
  });

  it('ignores non-LineString geometries (e.g. Points)', () => {
    const point = new Feature<Geometry>({ geometry: new Point([500, 500]) });
    const grid: FakeGrid = { getFeatures: () => [point] };
    expect(findOffScreenFeatures(grid, viewport, 1, 'EPSG:3857')).toEqual([]);
  });

  it('skips LineString features with no coordinates', () => {
    const empty = new Feature<Geometry>({ geometry: new LineString([]) });
    const grid: FakeGrid = { getFeatures: () => [empty] };
    expect(findOffScreenFeatures(grid, viewport, 1, 'EPSG:3857')).toEqual([]);
  });

  it('leaves missing grid* attributes as undefined (not the string "undefined")', () => {
    const grid: FakeGrid = {
      getFeatures: () => [lineFeature([[200, 200], [300, 300]])],
    };
    const out = findOffScreenFeatures(grid, viewport, 1, 'EPSG:3857');
    expect(out[0]!.gridLineType).toBeUndefined();
    expect(out[0]!.gridAxis).toBeUndefined();
    expect(out[0]!.gridValue).toBeUndefined();
  });
});

describe('epsg3857ResolutionAtZoom', () => {
  it('zoom 0 is the full-globe resolution (~156 km/px)', () => {
    expect(epsg3857ResolutionAtZoom(0)).toBeCloseTo(40075016.686 / 256, 3);
  });

  it('halves with each zoom level (zoom N = zoom 0 / 2^N)', () => {
    const z0 = epsg3857ResolutionAtZoom(0);
    expect(epsg3857ResolutionAtZoom(1)).toBeCloseTo(z0 / 2, 6);
    expect(epsg3857ResolutionAtZoom(8)).toBeCloseTo(z0 / 256, 6);
  });
});

describe('viewportExtentAt', () => {
  it('centres the extent on the lon/lat (in EPSG:3857)', () => {
    const { extent } = viewportExtentAt([0, 0], 4, 1280, 800);
    const cx = (extent[0]! + extent[2]!) / 2;
    const cy = (extent[1]! + extent[3]!) / 2;
    expect(cx).toBeCloseTo(0, 3);
    expect(cy).toBeCloseTo(0, 3);
  });

  it('extent width = widthPx × resolution', () => {
    const { extent, resolution } = viewportExtentAt([0, 0], 4, 1280, 800);
    expect(extent[2]! - extent[0]!).toBeCloseTo(1280 * resolution, 3);
    expect(extent[3]! - extent[1]!).toBeCloseTo(800 * resolution, 3);
  });

  it('respects custom viewport dimensions', () => {
    const { extent, resolution } = viewportExtentAt([4.895, 52.37], 10, 640, 480);
    expect(extent[2]! - extent[0]!).toBeCloseTo(640 * resolution, 3);
    expect(extent[3]! - extent[1]!).toBeCloseTo(480 * resolution, 3);
  });
});
