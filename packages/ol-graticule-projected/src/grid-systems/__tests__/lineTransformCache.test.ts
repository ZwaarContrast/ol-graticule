import { describe, it, expect } from 'vitest';
import type { Extent } from 'ol/extent';
import LineString from 'ol/geom/LineString';
import type Feature from 'ol/Feature';
import type { Geometry } from 'ol/geom';
import { LineTransformCache, type LinePolyline } from '../lineTransformCache.js';
import { ProjectedGridSystem } from '../ProjectedGridSystem.js';

const entry = (band: number, pMin: number, pMax: number): LinePolyline => ({
  band,
  pMin,
  pMax,
  perps: [pMin, pMax],
  coords: [0, 0, 0, 0],
});

describe('LineTransformCache', () => {
  it('returns a hit only when the band matches and the window covers the span', () => {
    const cache = new LineTransformCache();
    cache.set('x100', entry(9, 0, 100));

    // Covered span in the same band: hit.
    expect(cache.get('x100', 9, 20, 80)).toBeDefined();
    // Span reaching the exact window edges: still a hit.
    expect(cache.get('x100', 9, 0, 100)).toBeDefined();
    // Different band: miss (sampling density changed).
    expect(cache.get('x100', 8, 20, 80)).toBeUndefined();
    // Span extends past the cached window: miss (must re-project the extension).
    expect(cache.get('x100', 9, -10, 80)).toBeUndefined();
    expect(cache.get('x100', 9, 20, 110)).toBeUndefined();
  });

  it('clears when the view projection changes', () => {
    const cache = new LineTransformCache();
    cache.ensureProjection('EPSG:3857');
    cache.set('y50', entry(9, 0, 100));
    expect(cache.get('y50', 9, 10, 90)).toBeDefined();

    cache.ensureProjection('EPSG:3857'); // unchanged: kept
    expect(cache.get('y50', 9, 10, 90)).toBeDefined();

    cache.ensureProjection('EPSG:4326'); // changed: dropped (coords were in 3857)
    expect(cache.get('y50', 9, 10, 90)).toBeUndefined();
  });
});

/**
 * The cached line path re-slices a window polyline instead of re-projecting, so
 * its exact vertices differ from a cold render (different adaptive samples over a
 * different window) — but the ON-SCREEN curve must agree to within a pixel, which
 * is what the pixel-level visual-regression suite relies on. These tests assert
 * that on-screen agreement at the viewport centre-lines, plus structural sanity.
 */
describe('ProjectedGridSystem cached lines equivalence', () => {
  // RD (EPSG:28992): a bounded, genuinely curved projected grid on a 3857 view.
  const RD =
    '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 ' +
    '+x_0=155000 +y_0=463000 +ellps=bessel ' +
    '+towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
  const RD_EXTENT: Extent = [-7000, 289000, 300000, 629000];

  const make = (): ProjectedGridSystem =>
    new ProjectedGridSystem({ crs: 'EPSG:28992', proj4Def: RD, extent: RD_EXTENT });

  const lineKey = (f: Feature<Geometry>): string =>
    `${f.get('gridAxis')}:${f.get('gridValue')}:${f.get('gridLineType')}`;

  /** Where a polyline crosses a constant-`axis` view line (`x` or `y` = `at`). */
  const crossing = (
    f: Feature<Geometry>,
    axis: 'x' | 'y',
    at: number,
  ): [number, number] | undefined => {
    const g = f.getGeometry();
    if (!(g instanceof LineString)) return undefined;
    const c = g.getCoordinates();
    const i = axis === 'y' ? 1 : 0; // vertical line: interpolate along y; horizontal: along x
    for (let k = 0; k + 1 < c.length; k++) {
      const a = c[k]!;
      const b = c[k + 1]!;
      const lo = Math.min(a[i]!, b[i]!);
      const hi = Math.max(a[i]!, b[i]!);
      if (at < lo || at > hi || hi === lo) continue;
      const t = (at - a[i]!) / (b[i]! - a[i]!);
      return [a[0]! + t * (b[0]! - a[0]!), a[1]! + t * (b[1]! - a[1]!)];
    }
    return undefined;
  };

  /** Assert warm and cold agree on-screen: same lines, crossing the viewport
   * centre-line within `tolPx`. */
  const expectOnScreenAgreement = (
    warm: Feature<Geometry>[],
    cold: Feature<Geometry>[],
    frame: Extent,
    res: number,
    tolPx: number,
  ): void => {
    expect(cold.length).toBeGreaterThan(0);
    const warmBy = new Map(warm.map((f) => [lineKey(f), f]));
    expect(new Set(warm.map(lineKey))).toEqual(new Set(cold.map(lineKey)));

    const cx = (frame[0] + frame[2]) / 2;
    const cy = (frame[1] + frame[3]) / 2;
    for (const cf of cold) {
      const wf = warmBy.get(lineKey(cf))!;
      const axis = cf.get('gridAxis') === 'x' ? 'y' : 'x'; // vertical line crosses the horizontal centre-line
      const at = axis === 'y' ? cy : cx;
      const cc = crossing(cf, axis, at);
      const wc = crossing(wf, axis, at);
      if (!cc || !wc) continue; // line does not reach the centre-line this frame
      const dPx = Math.hypot(wc[0] - cc[0], wc[1] - cc[1]) / res;
      expect(dPx).toBeLessThan(tolPx);
    }
  };

  it('warm-cache render agrees on-screen with a cold render at the same frame', () => {
    // A Netherlands view in Web Mercator, ~mid zoom.
    const frame: Extent = [520000, 6800000, 720000, 6950000];
    const res = 200;

    const cold = make().getFeatures(frame, res, 'EPSG:3857');

    const warm = make();
    // Pan around the frame (same zoom band) to populate + exercise the cache.
    warm.getFeatures([500000, 6790000, 700000, 6940000], res, 'EPSG:3857');
    warm.getFeatures([540000, 6810000, 740000, 6960000], res, 'EPSG:3857');
    const warmFeatures = warm.getFeatures(frame, res, 'EPSG:3857');

    expectOnScreenAgreement(warmFeatures, cold, frame, res, 1);
  });

  it('re-render after a zoom (band change) agrees on-screen with a cold render', () => {
    const frame: Extent = [520000, 6800000, 720000, 6950000];
    const system = make();
    system.getFeatures(frame, 200, 'EPSG:3857'); // warm at one band
    const zoomed = system.getFeatures(frame, 25, 'EPSG:3857'); // deeper band

    const cold = make().getFeatures(frame, 25, 'EPSG:3857');
    expectOnScreenAgreement(zoomed, cold, frame, 25, 1);
  });
});
