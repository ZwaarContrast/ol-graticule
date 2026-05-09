import { describe, it, expect, vi } from 'vitest';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import type { Geometry } from 'ol/geom';
import type { GridSystem, GridLabel, GridCellLabel } from '../../types.js';
import { PolygonClippedGridSystem } from '../PolygonClippedGridSystem.js';

/**
 * Ring-only stub that lives in EPSG:3857 so everything below happens in one
 * coordinate space and we can write expected values directly in view coords.
 */
function makeSystem(
  features: Feature<Geometry>[],
  opts: {
    labels?: GridLabel[];
    cellLabels?: GridCellLabel[];
    formatter?: (coord: [number, number]) => { x: string; y: string } | { combined: string };
    isValidInner?: ((coord: [number, number]) => boolean) | undefined;
  } = {},
): GridSystem {
  const system: GridSystem = {
    getFeatures: vi.fn().mockReturnValue(features),
    getLabels: vi.fn().mockReturnValue(opts.labels ?? []),
    formatCoordinate: vi.fn((c: [number, number]) =>
      opts.formatter ? opts.formatter(c) : { x: String(c[0]), y: String(c[1]) },
    ),
  };
  if (opts.cellLabels) {
    system.getCellLabels = vi.fn().mockReturnValue(opts.cellLabels);
  }
  if (opts.isValidInner !== undefined) {
    system.isValidCoordinate = vi.fn((c) => opts.isValidInner!(c as [number, number]));
  }
  return system;
}

const square: [number, number][] = [
  [0, 0], [10, 0], [10, 10], [0, 10],
];

describe('PolygonClippedGridSystem', () => {
  describe('construction', () => {
    it('throws if the outer ring has fewer than 3 vertices', () => {
      const source = makeSystem([]);
      expect(() =>
        new PolygonClippedGridSystem({
          source,
          clipPolygon: { rings: [[[0, 0], [1, 1]]], crs: 'EPSG:3857' },
        }),
      ).toThrow();
    });

    it('throws if rings is empty', () => {
      const source = makeSystem([]);
      expect(() =>
        new PolygonClippedGridSystem({
          source,
          clipPolygon: { rings: [], crs: 'EPSG:3857' },
        }),
      ).toThrow();
    });
  });

  describe('getFeatures', () => {
    const buildLine = (coords: [number, number][], gridLineType = 'major'): Feature<Geometry> => {
      const f = new Feature<Geometry>({ geometry: new LineString(coords) });
      f.set('gridLineType', gridLineType);
      f.set('gridAxis', 'x');
      f.set('gridValue', 5);
      return f;
    };

    it('clips a crossing line at the polygon boundary', () => {
      const source = makeSystem([buildLine([[-5, 5], [15, 5]])]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      const features = clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      const lines = features.filter((f) => f.get('gridLineType') === 'major');
      expect(lines).toHaveLength(1);
      const coords = (lines[0]!.getGeometry() as LineString).getCoordinates();
      expect(coords[0]).toEqual([0, 5]);
      expect(coords[coords.length - 1]).toEqual([10, 5]);
    });

    it('drops lines entirely outside the polygon', () => {
      const source = makeSystem([buildLine([[100, 100], [200, 200]])]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
        emitBoundary: false,
      });
      const features = clipped.getFeatures([-10, -10, 300, 300], 1, 'EPSG:3857');
      expect(features).toHaveLength(0);
    });

    it('preserves grid-line metadata (gridLineType, gridAxis, gridValue) on clipped pieces', () => {
      const source = makeSystem([buildLine([[-5, 5], [15, 5]], 'minor')]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
        emitBoundary: false,
      });
      const features = clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      expect(features).toHaveLength(1);
      expect(features[0]!.get('gridLineType')).toBe('minor');
      expect(features[0]!.get('gridAxis')).toBe('x');
      expect(features[0]!.get('gridValue')).toBe(5);
    });

    it('emits the polygon boundary as a gridLineType=boundary feature by default', () => {
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      const features = clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      const boundary = features.filter((f) => f.get('gridLineType') === 'boundary');
      expect(boundary).toHaveLength(1);
      const coords = (boundary[0]!.getGeometry() as LineString).getCoordinates();
      // Ring is closed (first point duplicated at end).
      expect(coords[0]).toEqual(coords[coords.length - 1]);
      // Densified: 4 edges × 4 stepsPerEdge + 1 closing = 17 vertices.
      expect(coords.length).toBeGreaterThanOrEqual(5);
    });

    it('omits the boundary when emitBoundary: false', () => {
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
        emitBoundary: false,
      });
      const features = clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      expect(features).toHaveLength(0);
    });

    it('passes through non-LineString features untouched', () => {
      // Synthesise a Point feature (contrived: the library normally emits lines)
      const point = new Feature<Geometry>({ geometry: new Point([5, 5]) });
      point.set('gridLineType', 'major');
      const source = makeSystem([point]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
        emitBoundary: false,
      });
      const features = clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      expect(features).toHaveLength(1);
      expect(features[0]!.getGeometry()).toBe(point.getGeometry());
    });
  });

  describe('getLabels', () => {
    it('keeps labels whose point is inside the polygon, drops the rest', () => {
      const inner: GridLabel[] = [
        { point: new Point([5, 5]), text: 'in', axis: 'x' },
        { point: new Point([50, 50]), text: 'out', axis: 'y' },
      ];
      const source = makeSystem([], { labels: inner });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      const labels = clipped.getLabels([-10, -10, 100, 100], 1, 'EPSG:3857');
      expect(labels.map((l) => l.text)).toEqual(['in']);
    });

    it('keeps a snap-mode label whose grid line lands on a column boundary', () => {
      // Snap mode replaces the ring with a cell-aligned staircase whose
      // edges live at exact multiples of the snap interval. The visibility
      // filter must run against that polygon-CRS staircase (not the
      // inflated, projected copy used by the line clipper) so that a label
      // x value coinciding exactly with a column boundary still registers
      // as a hit. Regression for the disappearing-edge-labels bug.
      const ring: [number, number][] = [[0, 0], [10, 0], [10, 5], [0, 5]];
      const inner: GridLabel[] = [
        // x=5 is the interior column boundary of the snapped staircase.
        { point: new Point([5, 0]), text: '5', axis: 'x' },
      ];
      const source = makeSystem([], { labels: inner });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [ring], crs: 'EPSG:3857' },
        cellSnapInterval: () => 5,
      });
      // Populate the cached snap rings before getLabels reads them.
      clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      const labels = clipped.getLabels([-10, -10, 20, 20], 1, 'EPSG:3857');
      expect(labels.map((l) => l.text)).toEqual(['5']);
    });

    it('absorbs round-trip drift on snap-aligned label x values', () => {
      // Inverse-transforming a label point from view CRS back to polygon
      // CRS introduces a few ULPs of drift; without a small tolerance the
      // crossing test would skip a horizontal staircase edge that ends
      // *exactly* at the column boundary the label sits on. Simulates the
      // drift directly here so the test runs without any cross-CRS proj4
      // setup.
      const ring: [number, number][] = [[0, 0], [10, 0], [10, 5], [0, 5]];
      const drift = 1e-9;
      const inner: GridLabel[] = [
        { point: new Point([5 + drift, 0]), text: '5', axis: 'x' },
      ];
      const source = makeSystem([], { labels: inner });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [ring], crs: 'EPSG:3857' },
        cellSnapInterval: () => 5,
      });
      clipped.getFeatures([-10, -10, 20, 20], 1, 'EPSG:3857');
      const labels = clipped.getLabels([-10, -10, 20, 20], 1, 'EPSG:3857');
      expect(labels.map((l) => l.text)).toEqual(['5']);
    });

    it('keeps labels when zoomed in fully inside the polygon (ring outside viewport)', () => {
      // Big polygon, tiny visible extent fully contained inside it. The
      // ring is entirely outside the viewport, so no ring edge crosses
      // any grid line within the visible perpendicular range — yet every
      // grid line passes through the polygon along its visible portion.
      // Midpoint-inside-polygon fast path catches these.
      const big: [number, number][] = [
        [-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000],
      ];
      const inner: GridLabel[] = [
        { point: new Point([5, 0]), text: 'x', axis: 'x' },
        { point: new Point([0, 5]), text: 'y', axis: 'y' },
      ];
      const source = makeSystem([], { labels: inner });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [big], crs: 'EPSG:3857' },
      });
      // Tiny viewport at origin — ring sits 990 units away on every side.
      const labels = clipped.getLabels([-10, -10, 10, 10], 1, 'EPSG:3857');
      expect(labels.map((l) => l.text).sort()).toEqual(['x', 'y']);
    });

    it('drops a label whose grid line never enters the polygon (raw mode)', () => {
      // Sanity check: the new polygon-CRS test must still reject labels
      // whose grid line genuinely misses the polygon — otherwise the fix
      // would let everything through.
      const inner: GridLabel[] = [
        { point: new Point([50, 0]), text: 'far-x', axis: 'x' },
        { point: new Point([0, 50]), text: 'far-y', axis: 'y' },
      ];
      const source = makeSystem([], { labels: inner });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      const labels = clipped.getLabels([-100, -100, 100, 100], 1, 'EPSG:3857');
      expect(labels).toEqual([]);
    });
  });

  describe('getCellLabels', () => {
    it('filters cell labels by polygon membership', () => {
      const inner: GridCellLabel[] = [
        { point: new Point([5, 5]), text: 'in', cellSizePx: 100 },
        { point: new Point([-5, -5]), text: 'out', cellSizePx: 100 },
      ];
      const source = makeSystem([], { cellLabels: inner });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      const cellLabels = clipped.getCellLabels!([-10, -10, 100, 100], 1, 'EPSG:3857');
      expect(cellLabels.map((l) => l.text)).toEqual(['in']);
    });

    it('returns empty when the inner grid does not emit cell labels', () => {
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(clipped.getCellLabels!([-10, -10, 100, 100], 1, 'EPSG:3857')).toEqual([]);
    });
  });

  describe('isValidCoordinate / formatCoordinate', () => {
    it('returns true inside the polygon', () => {
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(clipped.isValidCoordinate!([5, 5], 'EPSG:3857')).toBe(true);
    });

    it('returns false outside the polygon', () => {
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(clipped.isValidCoordinate!([50, 50], 'EPSG:3857')).toBe(false);
    });

    it('AND-combines with the inner grid system\'s isValidCoordinate', () => {
      const source = makeSystem([], { isValidInner: () => false });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      // Point is inside our polygon, but the inner grid rejects it.
      expect(clipped.isValidCoordinate!([5, 5], 'EPSG:3857')).toBe(false);
    });

    it('formatCoordinate returns "—" outside the polygon, delegates inside', () => {
      const source = makeSystem([], {
        formatter: (c) => ({ x: `x=${c[0]}`, y: `y=${c[1]}` }),
      });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(clipped.formatCoordinate([5, 5], 'EPSG:3857')).toEqual({ x: 'x=5', y: 'y=5' });
      expect(clipped.formatCoordinate([50, 50], 'EPSG:3857')).toEqual({ x: '—', y: '—' });
    });

    it('formatCoordinate preserves the combined-label shape when the inner grid uses one', () => {
      const source = makeSystem([], {
        formatter: (c) => ({ combined: `${c[0]},${c[1]}` }),
      });
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(clipped.formatCoordinate([50, 50], 'EPSG:3857')).toEqual({ combined: '—' });
    });
  });

  describe('cell-snap mode', () => {
    const buildLine = (coords: [number, number][]): Feature<Geometry> => {
      const f = new Feature<Geometry>({ geometry: new LineString(coords) });
      f.set('gridLineType', 'major');
      return f;
    };

    it('clips grid lines to cell boundaries when cellSnapInterval returns a value', () => {
      // Source ring is 17 × 17 (NOT cell-aligned). With a 5-unit snap grid,
      // the snapped staircase is the 3×3 block of cells whose midpoints
      // fall inside the ring: x ∈ [0, 15], y ∈ [0, 15].
      const offAligned: [number, number][] = [[1, 1], [17, 1], [17, 17], [1, 17]];
      const source = makeSystem([
        buildLine([[-10, 7.5], [30, 7.5]]),
      ]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [offAligned], crs: 'EPSG:3857' },
        emitBoundary: false,
        cellSnapInterval: () => 5,
      });
      const features = clipped.getFeatures([-20, -20, 40, 40], 1, 'EPSG:3857');
      expect(features).toHaveLength(1);
      const coords = (features[0]!.getGeometry() as LineString).getCoordinates();
      // Should clip to the cell-aligned bounds [0, 15] on the x-axis, not
      // to the source ring's raw bounds [1, 17]. The boundary is inflated
      // outward by `interval × 1e-3` (= 0.005 here) to stabilise PIP at
      // grid-line-vs-ring-edge coincidences — see PolygonClippedGridSystem.
      expect(Math.abs(coords[0]![0]! - 0)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(coords[coords.length - 1]![0]! - 15)).toBeLessThanOrEqual(0.01);
    });

    it('falls back to smooth clipping when the callback returns undefined', () => {
      const offAligned: [number, number][] = [[1, 1], [17, 1], [17, 17], [1, 17]];
      const source = makeSystem([
        buildLine([[-10, 7.5], [30, 7.5]]),
      ]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [offAligned], crs: 'EPSG:3857' },
        emitBoundary: false,
        cellSnapInterval: () => undefined,
      });
      const features = clipped.getFeatures([-20, -20, 40, 40], 1, 'EPSG:3857');
      const coords = (features[0]!.getGeometry() as LineString).getCoordinates();
      // Smooth clip to the raw ring at x = 1 and x = 17.
      expect(coords[0]![0]).toBe(1);
      expect(coords[coords.length - 1]![0]).toBe(17);
    });

    it('suppresses the boundary feature in snap mode — grid lines already form the outline', () => {
      // Every snap-ring edge coincides with a cell-boundary grid line, so
      // rendering a separate boundary feature on top would paint a duplicate
      // staircase over those grid lines. The wrapper therefore skips the
      // boundary in snap mode even when `emitBoundary` defaults to true.
      const offAligned: [number, number][] = [[1, 1], [17, 1], [17, 17], [1, 17]];
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [offAligned], crs: 'EPSG:3857' },
        cellSnapInterval: () => 5,
      });
      const features = clipped.getFeatures([-20, -20, 40, 40], 1, 'EPSG:3857');
      expect(features.find((f) => f.get('gridLineType') === 'boundary')).toBeUndefined();
    });

    it('caches the snapped ring per interval and reuses it across renders', () => {
      const offAligned: [number, number][] = [[1, 1], [17, 1], [17, 17], [1, 17]];
      const source = makeSystem([]);
      const callCounts: number[] = [];
      let invocations = 0;
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [offAligned], crs: 'EPSG:3857' },
        cellSnapInterval: () => {
          invocations++;
          return 5;
        },
      });
      clipped.getFeatures([-20, -20, 40, 40], 1, 'EPSG:3857');
      callCounts.push(invocations);
      // Second call at the same interval should hit the cache — no new
      // snap-ring work, though the callback still fires (it's cheap).
      clipped.getFeatures([-10, -10, 30, 30], 1, 'EPSG:3857');
      callCounts.push(invocations);
      // Both renders happened, so the callback was consulted for each.
      expect(callCounts[1]).toBeGreaterThan(callCounts[0]!);
      // No boundary feature in snap mode (grid lines draw the outline); the
      // check here is just that the extra render didn't throw.
      const features = clipped.getFeatures([-20, -20, 40, 40], 1, 'EPSG:3857');
      expect(features.every((f) => f.get('gridLineType') !== 'boundary')).toBe(true);
    });
  });

  describe('cross-CRS clipping', () => {
    it('projects the ring on viewProjection change and caches it', () => {
      // 1° × 1° square around [5E, 51N] — small enough that Web Mercator
      // distortion is negligible at this latitude.
      const ringLonLat: [number, number][] = [
        [5, 51], [6, 51], [6, 52], [5, 52],
      ];
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [ringLonLat], crs: 'EPSG:4326' },
      });

      // Point inside the ring, given in Web Mercator: ~[5.5E, 51.5N]
      // lon=5.5 ≈ 612300, lat=51.5 ≈ 6708000
      expect(clipped.isValidCoordinate!([612300, 6708000], 'EPSG:3857')).toBe(true);
      // Point outside (in London)
      expect(clipped.isValidCoordinate!([-13000, 6710000], 'EPSG:3857')).toBe(false);
    });
  });

  describe('parseCoordinate', () => {
    it('delegates to source.parseCoordinate', () => {
      const source = makeSystem([]);
      source.parseCoordinate = vi.fn().mockReturnValue([42, 99]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(clipped.parseCoordinate!('whatever', 'EPSG:3857')).toEqual([42, 99]);
      expect(source.parseCoordinate).toHaveBeenCalledWith('whatever', 'EPSG:3857');
    });

    it('throws ParseError when source has no parseCoordinate', () => {
      const source = makeSystem([]);
      const clipped = new PolygonClippedGridSystem({
        source,
        clipPolygon: { rings: [square], crs: 'EPSG:3857' },
      });
      expect(() => clipped.parseCoordinate!('anything', 'EPSG:3857')).toThrow(
        /source grid system does not support parseCoordinate/,
      );
    });
  });
});
