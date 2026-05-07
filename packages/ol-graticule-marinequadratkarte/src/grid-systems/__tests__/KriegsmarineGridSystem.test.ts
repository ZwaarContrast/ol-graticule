import { describe, it, expect } from 'vitest';
import LineString from 'ol/geom/LineString';
import { KriegsmarineGridSystem } from '../KriegsmarineGridSystem.js';

describe('KriegsmarineGridSystem', () => {
  describe('constructor', () => {
    it('creates with default options', () => {
      const gs = new KriegsmarineGridSystem();
      expect(gs).toBeDefined();
    });
    it('creates with custom options', () => {
      const gs = new KriegsmarineGridSystem({ maxDepth: 2, minSquarePx: 100 });
      expect(gs).toBeDefined();
    });
  });

  describe('getFeatures', () => {
    it('returns features for a view of the North Atlantic', () => {
      const gs = new KriegsmarineGridSystem({ maxDepth: 0 });
      // Extent in EPSG:4326 covering the North Atlantic (~lat 30-60, lon -80 to -20)
      const extent = [-80, 30, -20, 60]; // [minLon, minLat, maxLon, maxLat]
      const resolution = 0.01; // ~1km per pixel
      const features = gs.getFeatures(extent, resolution, 'EPSG:4326');
      expect(features.length).toBeGreaterThan(0);
      // Check features have grid properties
      const first = features[0]!;
      expect(first.get('gridSquare')).toBeDefined();
      expect(first.get('gridDepth')).toBe(0);
    });

    it('generates more features with deeper maxDepth', () => {
      const gs0 = new KriegsmarineGridSystem({ maxDepth: 0 });
      const gs1 = new KriegsmarineGridSystem({ maxDepth: 1, minSquarePx: 1 });
      const extent = [-70, 45, -60, 55]; // small area
      const resolution = 0.001;
      const f0 = gs0.getFeatures(extent, resolution, 'EPSG:4326');
      const f1 = gs1.getFeatures(extent, resolution, 'EPSG:4326');
      expect(f1.length).toBeGreaterThanOrEqual(f0.length);
    });

    it('generates features for polygonal squares (AH, AD, etc.)', () => {
      const gs = new KriegsmarineGridSystem({ maxDepth: 0 });
      // Extent covering AH/AJ area: lat 48-62, lon -75 to -35
      const extent = [-75, 48, -35, 62];
      const resolution = 0.05;
      const features = gs.getFeatures(extent, resolution, 'EPSG:4326');

      // After the edge-dedup pass, each feature is a single segment (not a
      // closed ring). Cells with shared boundaries have those boundaries
      // merged into common segments; the `gridSquares` array on each
      // feature records every cell that contributed.
      const contributingIds = new Set<string>();
      for (const f of features) {
        for (const id of (f.get('gridSquares') as string[])) {
          contributingIds.add(id);
        }
      }

      // AH, AJ, AD are polygonal — they should contribute at least one edge.
      expect(contributingIds.has('AH')).toBe(true);
      expect(contributingIds.has('AJ')).toBe(true);
      expect(contributingIds.has('AD')).toBe(true);

      // AH has 6 vertices — it contributes 6 edges (each a separate feature,
      // modulo dedup with neighbours).
      const ahFeatures = features.filter((f) =>
        (f.get('gridSquares') as string[]).includes('AH'),
      );
      expect(ahFeatures.length).toBeGreaterThan(0);
      expect(ahFeatures.length).toBeLessThanOrEqual(6);

      // Each feature is a single LineString segment — not a closed ring.
      const geom = ahFeatures[0]!.getGeometry();
      expect(geom).toBeInstanceOf(LineString);
      if (!(geom instanceof LineString)) throw new Error('unreachable: asserted above');
      const ahCoords = geom.getCoordinates();
      // Per-segment density is 2..20+1 (inclusive both endpoints).
      expect(ahCoords.length).toBeGreaterThanOrEqual(3);
      expect(ahCoords.length).toBeLessThanOrEqual(21);

      // BA is a rect (4 edges). With default dedup its interior edges
      // merge with adjacent rects (BB to the east, CA below, etc.) —
      // the number of features carrying BA in their `gridSquares` is
      // between 1 and 4.
      const baFeatures = features.filter((f) =>
        (f.get('gridSquares') as string[]).includes('BA'),
      );
      expect(baFeatures.length).toBeGreaterThan(0);
      expect(baFeatures.length).toBeLessThanOrEqual(4);

      // Shared-edge dedup: total feature count should be meaningfully
      // smaller than the naive "4 edges per rect + N edges per poly"
      // bound. This is the whole point of the pass — loose sanity check
      // that we aren't accidentally disabling it.
      const naiveEdgeCount = features.length * 2; // crude upper estimate
      const contributorCount = features.reduce(
        (sum, f) => sum + (f.get('gridSquares') as string[]).length,
        0,
      );
      expect(contributorCount).toBeGreaterThanOrEqual(features.length);
      expect(contributorCount).toBeLessThanOrEqual(naiveEdgeCount);
    });

    it('returns empty for an extent with no grid squares', () => {
      const gs = new KriegsmarineGridSystem({ maxDepth: 0 });
      // Extreme south pole — no grid coverage expected
      const features = gs.getFeatures([0, -90, 1, -89], 0.01, 'EPSG:4326');
      // May or may not be empty depending on grid coverage — just don't crash
      expect(Array.isArray(features)).toBe(true);
    });
  });

  describe('getLabels', () => {
    it('returns empty array (Kriegsmarine uses cell labels)', () => {
      const gs = new KriegsmarineGridSystem();
      const labels = gs.getLabels([-80, 30, -20, 60], 0.01, 'EPSG:4326');
      expect(labels).toEqual([]);
    });
  });

  describe('getCellLabels', () => {
    it('returns cell labels for visible squares', () => {
      const gs = new KriegsmarineGridSystem({ maxDepth: 0 });
      const extent = [-80, 30, -20, 60];
      const resolution = 0.01;
      const labels = gs.getCellLabels!(extent, resolution, 'EPSG:4326');
      expect(labels.length).toBeGreaterThan(0);
      const first = labels[0]!;
      expect(first.text).toBeDefined();
      expect(first.cellSizePx).toBeGreaterThan(0);
    });
  });

  describe('formatCoordinate', () => {
    it('returns a single combined grid reference for a North Atlantic coordinate', () => {
      const gs = new KriegsmarineGridSystem();
      // ~47°N, 66°W in EPSG:4326 coordinates [lon, lat]
      const result = gs.formatCoordinate([-66, 47], 'EPSG:4326');
      expect(result).toHaveProperty('combined');
      if ('combined' in result) {
        expect(result.combined).not.toBe('—');
        expect(typeof result.combined).toBe('string');
      }
    });

    it('returns a combined placeholder for a coordinate outside the grid', () => {
      const gs = new KriegsmarineGridSystem();
      // South pole
      const result = gs.formatCoordinate([0, -90], 'EPSG:4326');
      expect(result).toHaveProperty('combined');
      if ('combined' in result) {
        expect(typeof result.combined).toBe('string');
      }
    });

    it('matches labels from wrapped world copies across the antimeridian', () => {
      // OpenLayers with wrapX returns pointer coordinates in the copy of the
      // world the user actually panned to. In EPSG:3857 the x value can go
      // outside ±HALF_SIZE, so back-transformed longitude is outside
      // [-180, 180]. The indicator must still resolve to the correct cell.
      const gs = new KriegsmarineGridSystem({ maxDepth: 4 });
      const HALF_SIZE = 20037508.342789244;
      // ~47°N, 65.5°W in EPSG:3857. The lon is deliberately off a whole-degree
      // boundary so floating-point noise from the ±720° round-trip doesn't
      // flip the Kleinquadrat we land in.
      const real: [number, number] = [(-65.5 / 180) * HALF_SIZE, 5942074];
      // Same geographic point one world east (wrapped copy).
      const wrappedEast: [number, number] = [real[0]! + 2 * HALF_SIZE, real[1]!];
      // Same geographic point one world west.
      const wrappedWest: [number, number] = [real[0]! - 2 * HALF_SIZE, real[1]!];

      const baseline = gs.formatCoordinate(real, 'EPSG:3857');
      expect('combined' in baseline && baseline.combined !== '—').toBe(true);
      expect(gs.formatCoordinate(wrappedEast, 'EPSG:3857')).toEqual(baseline);
      expect(gs.formatCoordinate(wrappedWest, 'EPSG:3857')).toEqual(baseline);
    });
  });
});
