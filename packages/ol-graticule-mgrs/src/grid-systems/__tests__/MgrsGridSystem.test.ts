import { describe, it, expect } from 'vitest';
import LineString from 'ol/geom/LineString';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import { MgrsGridSystem } from '../MgrsGridSystem.js';

/**
 * Project the GZD-outline meridians onto the meridian map and return,
 * keyed by longitude, the disjoint [latLo, latHi] segments that the grid
 * actually drew. Uses `EPSG:4326` as the view CRS so points come back
 * pre-projected to lat/lon, no inverse transform needed.
 */
function meridianSegmentsAt(
  features: Feature<Geometry>[],
  lon: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const f of features) {
    if (f.get('mgrsKind') !== 'gzd') continue;
    if (f.get('gridAxis') !== 'x') continue;
    if (Math.abs((f.get('gridValue') as number) - lon) > 1e-9) continue;
    const geom = f.getGeometry();
    if (!(geom instanceof LineString)) continue;
    const coords = geom.getCoordinates();
    if (coords.length === 0) continue;
    let lo = Infinity, hi = -Infinity;
    for (const [, lat] of coords) {
      if (lat! < lo) lo = lat!;
      if (lat! > hi) hi = lat!;
    }
    out.push([lo, hi]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

describe('MgrsGridSystem GZD outlines', () => {
  it('does NOT bridge lon=6 across V band (Norway exception)', () => {
    // Viewport spans U (48-56), V (56-64), and most of W (64-72) at the
    // longitudes around the 31/32 zone seam. The lon=6 meridian exists
    // in U and W (standard 31/32 boundary) but vanishes in V because
    // 32V is widened to lon 3-12 (Norway exception). Drawing one straight
    // line from lat 50 to 70 at lon=6 would be a phantom boundary inside
    // the widened 32V, we must instead emit two disjoint segments.
    const grid = new MgrsGridSystem();
    const features = grid.getFeatures(
      [-12, 50, 18, 70],
      0.05,
      'EPSG:4326',
    );

    const segs = meridianSegmentsAt(features, 6);
    expect(segs.length).toBe(2);

    const [u, w] = segs;
    // U-band segment: clipped to viewport [50,56].
    expect(u![0]).toBeCloseTo(50, 6);
    expect(u![1]).toBeCloseTo(56, 6);
    // W-band segment: clipped to viewport [64,70].
    expect(w![0]).toBeCloseTo(64, 6);
    expect(w![1]).toBeCloseTo(70, 6);
  });

  it('emits the Norway 31V/32V boundary at lon=3 (only in V band)', () => {
    const grid = new MgrsGridSystem();
    const features = grid.getFeatures(
      [-12, 50, 18, 70],
      0.05,
      'EPSG:4326',
    );

    const segs = meridianSegmentsAt(features, 3);
    expect(segs.length).toBe(1);
    expect(segs[0]![0]).toBeCloseTo(56, 6);
    expect(segs[0]![1]).toBeCloseTo(64, 6);
  });

  it('merges contiguous bands (lon=12 spans U+V+W as one polyline)', () => {
    // lon=12 is the standard 32/33 zone boundary; it exists in U, V, and
    // W. The merge step must collapse the three touching segments into a
    // single polyline (otherwise we double-draw at the touch points).
    const grid = new MgrsGridSystem();
    const features = grid.getFeatures(
      [-12, 50, 18, 70],
      0.05,
      'EPSG:4326',
    );

    const segs = meridianSegmentsAt(features, 12);
    expect(segs.length).toBe(1);
    expect(segs[0]![0]).toBeCloseTo(50, 6);
    expect(segs[0]![1]).toBeCloseTo(70, 6);
  });

  it('omits the dropped Svalbard meridians {6,12,18,24,30,36} in X band only', () => {
    // Viewport is X-band only (lat 73-83). At those latitudes none of
    // the standard 6° meridians 6/12/18/24/30/36 are GZD boundaries,
    // the widened odd zones (31X 0-9, 33X 9-21, 35X 21-33, 37X 33-42)
    // make 9, 21, 33 the actual boundaries instead.
    const grid = new MgrsGridSystem();
    const features = grid.getFeatures(
      [-1, 73, 43, 83],
      0.05,
      'EPSG:4326',
    );

    for (const dropped of [6, 12, 18, 24, 30, 36]) {
      expect(meridianSegmentsAt(features, dropped)).toEqual([]);
    }
    // The Svalbard widened-zone boundaries must be present.
    for (const present of [9, 21, 33]) {
      const segs = meridianSegmentsAt(features, present);
      expect(segs.length).toBe(1);
    }
  });
});
