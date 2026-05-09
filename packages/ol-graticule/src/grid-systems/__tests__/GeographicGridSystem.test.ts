import { describe, it, expect, vi } from 'vitest';
import LineString from 'ol/geom/LineString';
import { GeographicGridSystem } from '../GeographicGridSystem.js';
import type { IntervalStrategy, LabelFormatter, FormattedCoordinate } from '../../types.js';
import type { Extent } from 'ol/extent';

// Web Mercator extent covering roughly Western Europe (~0°E to ~10°E, ~45°N to ~55°N).
const EUROPE_3857: Extent = [0, 5621521, 1113195, 7361866];
const RES_3857 = 1000; // ~1 km/px

describe('GeographicGridSystem', () => {
  describe('getFeatures', () => {
    it('generates major lines on both axes for a Web Mercator view', () => {
      const system = new GeographicGridSystem();
      const features = system.getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857');

      const major = features.filter((f) => f.get('gridLineType') === 'major');
      const xMajor = major.filter((f) => f.get('gridAxis') === 'x');
      const yMajor = major.filter((f) => f.get('gridAxis') === 'y');

      expect(xMajor.length).toBeGreaterThan(0);
      expect(yMajor.length).toBeGreaterThan(0);
    });

    it('generates minor lines that never coincide with major lines', () => {
      const system = new GeographicGridSystem();
      const features = system.getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857');

      const majorKeys = new Set(
        features
          .filter((f) => f.get('gridLineType') === 'major')
          .map((f) => `${f.get('gridAxis')}_${f.get('gridValue') as number}`),
      );

      const minor = features.filter((f) => f.get('gridLineType') === 'minor');
      expect(minor.length).toBeGreaterThan(0);
      for (const f of minor) {
        const key = `${f.get('gridAxis')}_${f.get('gridValue') as number}`;
        expect(majorKeys.has(key)).toBe(false);
      }
    });

    it('sets gridValue/gridAxis/gridLineType on every feature', () => {
      const system = new GeographicGridSystem();
      const features = system.getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857');
      for (const f of features) {
        expect(f.get('gridValue')).toBeTypeOf('number');
        expect(['x', 'y']).toContain(f.get('gridAxis'));
        expect(['major', 'minor']).toContain(f.get('gridLineType'));
      }
    });

    it('densifies lines into curved polylines for non-affine projections', () => {
      const system = new GeographicGridSystem({ densificationPoints: 20 });
      const features = system.getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857');
      const major = features.find((f) => f.get('gridLineType') === 'major')!;
      const coords = (major.getGeometry() as LineString).getCoordinates();
      // Densification clamps between 5 (min 4 + 1) and densificationPoints + 1.
      expect(coords.length).toBeGreaterThanOrEqual(5);
      expect(coords.length).toBeLessThanOrEqual(21);
    });

    it('produces straight 2-point lines on an identity 4326 view', () => {
      // On a 4326-over-4326 view the transform is identity, so densification
      // still runs but each line stays geometrically straight.
      const system = new GeographicGridSystem();
      const features = system.getFeatures([-10, 40, 10, 60], 0.1, 'EPSG:4326');
      const major = features.find((f) => f.get('gridLineType') === 'major')!;
      const coords = (major.getGeometry() as LineString).getCoordinates();
      // First and last sample should lie on an axis-aligned extreme.
      const first = coords[0]!;
      const last = coords[coords.length - 1]!;
      const axis = major.get('gridAxis') as 'x' | 'y';
      if (axis === 'x') expect(first[0]).toBe(last[0]);
      else expect(first[1]).toBe(last[1]);
    });
  });

  describe('getLabels', () => {
    it('emits x labels at max Y of the 4326 target extent and y labels at min X', () => {
      const system = new GeographicGridSystem();
      const labels = system.getLabels([-10, 40, 10, 60], 0.1, 'EPSG:4326');

      const xLabels = labels.filter((l) => l.axis === 'x');
      const yLabels = labels.filter((l) => l.axis === 'y');
      expect(xLabels.length).toBeGreaterThan(0);
      expect(yLabels.length).toBeGreaterThan(0);

      // On an identity 4326 view, the targetExtent after transformExtent is
      // the same as the input. Labels snap to tMaxY / tMinX respectively.
      for (const l of xLabels) {
        const [, y] = l.point.getCoordinates();
        expect(y).toBeCloseTo(60, 5);
      }
      for (const l of yLabels) {
        const [x] = l.point.getCoordinates();
        expect(x).toBeCloseTo(-10, 5);
      }
    });

    it('label text contains a degree sign (uses DegreeFormatter by default)', () => {
      const system = new GeographicGridSystem();
      const labels = system.getLabels(EUROPE_3857, RES_3857, 'EPSG:3857');
      expect(labels.length).toBeGreaterThan(0);
      for (const l of labels) expect(l.text).toContain('°');
    });

    it('normalizes x-label text across wrapped world copies', () => {
      // Extent spanning three world copies in 4326 space (-540°..540°).
      // Without normalization the DegreeFormatter would emit "400°W", "420°W",
      // "200°E", etc. — every x label must land in [-180, 180] instead.
      const system = new GeographicGridSystem();
      const labels = system.getLabels([-540, 40, 540, 60], 30, 'EPSG:4326');
      const xLabels = labels.filter((l) => l.axis === 'x');
      expect(xLabels.length).toBeGreaterThan(0);
      for (const l of xLabels) {
        const match = l.text.match(/^(\d+)°/);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBeLessThanOrEqual(180);
      }
    });
  });

  describe('formatCoordinate', () => {
    it('transforms view-projection coordinates to lon/lat before formatting', () => {
      const system = new GeographicGridSystem();
      // Web Mercator origin is 0°E / 0°N.
      const result = system.formatCoordinate([0, 0], 'EPSG:3857');
      if (!('x' in result)) throw new Error('expected axis-formatted result');
      expect(result.x).toContain('°');
      // 0° longitude renders with the E/W hemisphere suffix trimmed off;
      // don't over-assert exact string form, just sanity-check axes.
      expect(result.y).toContain('°');
    });

    it('delegates to formatter.formatCoordinate when provided', () => {
      const formatter: LabelFormatter = {
        format: (v) => `${v}`,
        formatCoordinate: vi
          .fn<(x: number, y: number) => FormattedCoordinate>()
          .mockReturnValue({ combined: 'CUSTOM' }),
      };
      const system = new GeographicGridSystem({ formatter });
      const result = system.formatCoordinate([0, 0], 'EPSG:4326');
      expect(result).toEqual({ combined: 'CUSTOM' });
      expect(formatter.formatCoordinate).toHaveBeenCalledWith(0, 0);
    });

    it('normalizes longitude from wrapped world copies', () => {
      // OpenLayers with wrapX returns pointer coordinates in whichever copy
      // of the world the user panned to. A raw lon of 294 must format as the
      // same 66°W label as lon=-66, not "294°E" or "66°E".
      const system = new GeographicGridSystem();
      const HALF_SIZE = 20037508.342789244;
      const real = system.formatCoordinate([(-66 / 180) * HALF_SIZE, 0], 'EPSG:3857');
      const wrappedE = system.formatCoordinate([(294 / 180) * HALF_SIZE, 0], 'EPSG:3857');
      const wrappedW = system.formatCoordinate([(-426 / 180) * HALF_SIZE, 0], 'EPSG:3857');
      expect(wrappedE).toEqual(real);
      expect(wrappedW).toEqual(real);
      if ('x' in real) expect(real.x).toContain('W');
    });

    it('passes normalized longitude to formatter.formatCoordinate', () => {
      const formatCoordinateFn = vi
        .fn<(x: number, y: number) => FormattedCoordinate>()
        .mockReturnValue({ combined: 'OK' });
      const formatter: LabelFormatter = {
        format: (v) => `${v}`,
        formatCoordinate: formatCoordinateFn,
      };
      const system = new GeographicGridSystem({ formatter });
      const HALF_SIZE = 20037508.342789244;
      system.formatCoordinate([(294 / 180) * HALF_SIZE, 0], 'EPSG:3857');
      const [lon] = formatCoordinateFn.mock.calls[0]!;
      expect(lon).toBeCloseTo(-66, 6);
    });
  });

  describe('options', () => {
    it('uses a caller-supplied IntervalStrategy', () => {
      // Fixed coarse interval so we can check line count is bounded.
      const intervals: IntervalStrategy = {
        getInterval: () => 10,
        getMinorInterval: () => undefined,
      };
      const system = new GeographicGridSystem({ intervals });
      const features = system.getFeatures([-10, 40, 10, 60], 0.1, 'EPSG:4326');
      // Minor pass is opted out, so everything is major.
      expect(features.every((f) => f.get('gridLineType') === 'major')).toBe(true);
      // x sweep spans 20°, y sweep spans 20°, interval=10° → 3 lines each
      // after snap (startX=-10, endX=10 inclusive in a `<=` loop).
      const xMajors = features.filter((f) => f.get('gridAxis') === 'x');
      const yMajors = features.filter((f) => f.get('gridAxis') === 'y');
      expect(xMajors.length).toBe(3);
      expect(yMajors.length).toBe(3);
    });

    it('honors densificationPoints on line construction', () => {
      const system = new GeographicGridSystem({ densificationPoints: 4 });
      const features = system.getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857');
      const major = features.find((f) => f.get('gridLineType') === 'major')!;
      const coords = (major.getGeometry() as LineString).getCoordinates();
      // densificationPoints caps the sample count; minimum floor is 5 points.
      expect(coords.length).toBeLessThanOrEqual(5);
    });

    it('passes targetScreenPx through to the default DegreeIntervals', () => {
      // Wider target → coarser interval → fewer grid lines. Compare counts.
      const wide = new GeographicGridSystem({ targetScreenPx: 400 });
      const narrow = new GeographicGridSystem({ targetScreenPx: 30 });
      const wideMajors = wide
        .getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857')
        .filter((f) => f.get('gridLineType') === 'major');
      const narrowMajors = narrow
        .getFeatures(EUROPE_3857, RES_3857, 'EPSG:3857')
        .filter((f) => f.get('gridLineType') === 'major');
      expect(wideMajors.length).toBeLessThanOrEqual(narrowMajors.length);
    });
  });

  describe('render context caching', () => {
    it('computes the interval once per (extent, resolution, projection) tuple', () => {
      const intervals: IntervalStrategy = {
        getInterval: vi.fn<IntervalStrategy['getInterval']>().mockReturnValue(5),
      };
      const system = new GeographicGridSystem({ intervals });

      // Same inputs: both calls should hit the memo → one underlying call.
      system.getFeatures([-10, 40, 10, 60], 0.1, 'EPSG:4326');
      system.getLabels([-10, 40, 10, 60], 0.1, 'EPSG:4326');
      expect(intervals.getInterval).toHaveBeenCalledTimes(1);

      // Changing any key invalidates the memo.
      system.getFeatures([-10, 40, 10, 70], 0.1, 'EPSG:4326');
      expect(intervals.getInterval).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseCoordinate', () => {
    it('returns view-projection coords (EPSG:3857) for a typed lat/lon', () => {
      const system = new GeographicGridSystem();
      const [x, y] = system.parseCoordinate('50.85N 4.35E', 'EPSG:3857');
      // Brussels (≈ 4.35°E, 50.85°N) lands in 3857 ~ (484240, 6594800).
      expect(x).toBeCloseTo(484240, -2);
      expect(y).toBeCloseTo(6594800, -2);
    });

    it('round-trips formatCoordinate output (DMS rounding ~30 m)', () => {
      const system = new GeographicGridSystem();
      const original: [number, number] = [484240, 6594800];
      const formatted = system.formatCoordinate(original, 'EPSG:3857');
      if (!('x' in formatted)) throw new Error('expected axis-formatted');
      const [px, py] = system.parseCoordinate(`${formatted.x} ${formatted.y}`, 'EPSG:3857');
      expect(px).toBeCloseTo(original[0], -2);
      expect(py).toBeCloseTo(original[1], -2);
    });

    it('treats unmarked pairs as "lon lat"', () => {
      const system = new GeographicGridSystem();
      const [x, y] = system.parseCoordinate('4.35 50.85', 'EPSG:3857');
      expect(x).toBeCloseTo(484240, -2);
      expect(y).toBeCloseTo(6594800, -2);
    });

    it('returns identity for EPSG:4326 view projection', () => {
      const system = new GeographicGridSystem();
      const [x, y] = system.parseCoordinate('4.35E 50.85N', 'EPSG:4326');
      expect(x).toBeCloseTo(4.35, 6);
      expect(y).toBeCloseTo(50.85, 6);
    });
  });
});
