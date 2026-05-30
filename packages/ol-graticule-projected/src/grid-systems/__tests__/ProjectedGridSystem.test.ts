import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { ProjectedGridSystem } from '../ProjectedGridSystem.js';
import { isAxisFormatted } from '@zwaarcontrast/ol-graticule';
import type { Extent } from 'ol/extent';

// EPSG:4326 and EPSG:3857 are registered by default in OL

describe('ProjectedGridSystem', () => {
  describe('constructor', () => {
    it('creates a system with a pre-registered CRS (EPSG:4326)', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      expect(system).toBeDefined();
    });

    it('throws for an unregistered CRS without proj4Def', () => {
      expect(() => new ProjectedGridSystem({ crs: 'EPSG:99999' }))
        .toThrow('CRS EPSG:99999 is not registered');
    });

    it('registers a CRS from proj4Def', () => {
      // EPSG:32633 - UTM zone 33N
      const system = new ProjectedGridSystem({
        crs: 'EPSG:32633',
        proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs',
      });
      expect(system).toBeDefined();
    });
  });

  describe('getFeatures with EPSG:4326 on EPSG:3857 view', () => {
    // A Web Mercator extent roughly covering Western Europe
    // ~0°E to ~10°E, ~45°N to ~55°N
    const extent: Extent = [0, 5621521, 1113195, 7361866];
    const resolution = 1000; // ~1km per pixel at this scale

    it('generates vertical and horizontal major grid lines', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const features = system.getFeatures(extent, resolution, 'EPSG:3857');

      const majorFeatures = features.filter(f => f.get('gridLineType') === 'major');
      expect(majorFeatures.length).toBeGreaterThan(0);

      const xLines = majorFeatures.filter(f => f.get('gridAxis') === 'x');
      const yLines = majorFeatures.filter(f => f.get('gridAxis') === 'y');
      expect(xLines.length).toBeGreaterThan(0);
      expect(yLines.length).toBeGreaterThan(0);
    });

    it('generates minor grid lines', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const features = system.getFeatures(extent, resolution, 'EPSG:3857');

      const minorFeatures = features.filter(f => f.get('gridLineType') === 'minor');
      expect(minorFeatures.length).toBeGreaterThan(0);
    });

    it('minor lines do not coincide with major lines', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const features = system.getFeatures(extent, resolution, 'EPSG:3857');

      const majorValues = new Set(
        features
          .filter(f => f.get('gridLineType') === 'major')
          .map(f => `${f.get('gridAxis')}_${f.get('gridValue') as number}`),
      );

      const minorFeatures = features.filter(f => f.get('gridLineType') === 'minor');
      for (const f of minorFeatures) {
        const key = `${f.get('gridAxis')}_${f.get('gridValue') as number}`;
        expect(majorValues.has(key)).toBe(false);
      }
    });

    it('sets gridValue, gridAxis, and gridLineType properties', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const features = system.getFeatures(extent, resolution, 'EPSG:3857');

      for (const f of features) {
        expect(f.get('gridValue')).toBeTypeOf('number');
        expect(['x', 'y']).toContain(f.get('gridAxis'));
        expect(['major', 'minor']).toContain(f.get('gridLineType'));
      }
    });

    it('densifies lines with intermediate points', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326', densificationPoints: 50 });
      const features = system.getFeatures(extent, resolution, 'EPSG:3857');

      const majorLine = features.find(f => f.get('gridLineType') === 'major');
      expect(majorLine).toBeDefined();

      const geometry = majorLine!.getGeometry() as import('ol/geom/LineString').default;
      const coords = geometry.getCoordinates();
      // Adaptive densification: at least 5 points (minimum 4 + 1), at most
      // densificationPoints + 1, scaled to the extent span / interval ratio.
      expect(coords.length).toBeGreaterThanOrEqual(5);
      expect(coords.length).toBeLessThanOrEqual(51);
    });
  });

  describe('foot-based CRS', () => {
    // EPSG:2227, California zone 3 (NAD83, US survey feet).
    // One of the most common foot-based projections.
    const californiaUsFtProj4 =
      '+proj=lcc +lat_1=38.43333333333333 +lat_2=37.06666666666667 ' +
      '+lat_0=36.5 +lon_0=-120.5 +x_0=2000000.0001016 +y_0=500000.0001016001 ' +
      '+ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 ' +
      '+no_defs +type=crs';

    it('labels metric-family projections by their CRS-native unit', () => {
      proj4.defs('EPSG:2227', californiaUsFtProj4);
      register(proj4);
      const system = new ProjectedGridSystem({ crs: 'EPSG:2227' });

      // A Web Mercator extent over California ~2 km span.
      const extent: Extent = [-13640000, 4500000, -13520000, 4570000];
      const labels = system.getLabels(extent, 100, 'EPSG:3857');

      expect(labels.length).toBeGreaterThan(0);
      // A US-survey-foot CRS should NOT produce "m" or "km" labels.
      for (const label of labels) {
        expect(label.text).not.toMatch(/ m$| km$/);
      }
      // And at least one should carry a foot suffix.
      expect(labels.some((l) => / ft$|us-ft$/.test(l.text))).toBe(true);
    });

    it('accepts a caller-supplied formatter override', () => {
      proj4.defs('EPSG:2227', californiaUsFtProj4);
      register(proj4);
      // Caller can force any formatter they want, overriding unit detection.
      const system = new ProjectedGridSystem({
        crs: 'EPSG:2227',
        formatter: {
          format: (v) => `${v.toFixed(0)} smoots`,
        },
      });
      const extent: Extent = [-13640000, 4500000, -13520000, 4570000];
      const labels = system.getLabels(extent, 100, 'EPSG:3857');
      expect(labels.some((l) => / smoots$/.test(l.text))).toBe(true);
    });
  });

  describe('getFeatures with UTM on EPSG:3857 view', () => {
    it('generates metric grid lines for a UTM projection', () => {
      // Ensure EPSG:32633 is registered
      proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs');
      register(proj4);

      const system = new ProjectedGridSystem({ crs: 'EPSG:32633' });

      // A Web Mercator extent over UTM zone 33 area (roughly Berlin area)
      // ~13°E to ~14°E, ~52°N to ~53°N
      const extent: Extent = [1446657, 6800125, 1557847, 6982997];
      const features = system.getFeatures(extent, 100, 'EPSG:3857');

      const majorFeatures = features.filter(f => f.get('gridLineType') === 'major');
      expect(majorFeatures.length).toBeGreaterThan(0);

      // Grid values should be in meters (large values like 300000+)
      const xValues = majorFeatures
        .filter(f => f.get('gridAxis') === 'x')
        .map(f => f.get('gridValue') as number);
      expect(xValues.every(v => v > 100)).toBe(true);
    });
  });

  describe('getLabels', () => {
    const extent: Extent = [0, 5621521, 1113195, 7361866];
    const resolution = 1000;

    it('generates x and y labels', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const labels = system.getLabels(extent, resolution, 'EPSG:3857');

      const xLabels = labels.filter(l => l.axis === 'x');
      const yLabels = labels.filter(l => l.axis === 'y');
      expect(xLabels.length).toBeGreaterThan(0);
      expect(yLabels.length).toBeGreaterThan(0);
    });

    it('formats labels using DMS for degree-based CRS', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const labels = system.getLabels(extent, resolution, 'EPSG:3857');

      // DMS labels should contain degree symbol (°)
      for (const label of labels) {
        expect(label.text).toContain('\u00B0');
      }
    });

    it('formats labels using meters/km for metric CRS', () => {
      proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs');
      register(proj4);

      const system = new ProjectedGridSystem({ crs: 'EPSG:32633' });
      const utmExtent: Extent = [1446657, 6800125, 1557847, 6982997];
      const labels = system.getLabels(utmExtent, 100, 'EPSG:3857');

      // Metric labels should contain 'm' or 'km'
      for (const label of labels) {
        expect(label.text).toMatch(/m|km/);
      }
    });
  });

  describe('formatCoordinate', () => {
    it('transforms and formats coordinate from view projection to target CRS', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      // Web Mercator coords for approximately 5°E, 50°N
      const result = system.formatCoordinate([556597, 6446275], 'EPSG:3857');

      // ProjectedGridSystem always returns the axis-separable variant.
      if (!isAxisFormatted(result)) throw new Error('expected axis-formatted result');
      expect(result.x).toContain('\u00B0');
      expect(result.x).toContain('E');
      expect(result.y).toContain('\u00B0');
      expect(result.y).toContain('N');
    });

    it('formats metric coordinates for UTM projection', () => {
      proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs');
      register(proj4);

      const system = new ProjectedGridSystem({ crs: 'EPSG:32633' });
      const result = system.formatCoordinate([1500000, 6900000], 'EPSG:3857');

      if (!isAxisFormatted(result)) throw new Error('expected axis-formatted result');
      expect(result.x).toMatch(/m|km/);
      expect(result.y).toMatch(/m|km/);
    });
  });

  describe('custom options', () => {
    it('respects custom densificationPoints', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326', densificationPoints: 10 });
      const extent: Extent = [0, 5621521, 1113195, 7361866];
      const features = system.getFeatures(extent, 1000, 'EPSG:3857');

      const majorLine = features.find(f => f.get('gridLineType') === 'major');
      expect(majorLine).toBeDefined();

      const geometry = majorLine!.getGeometry() as import('ol/geom/LineString').default;
      expect(geometry.getCoordinates().length).toBe(11);
    });

    it('respects custom targetScreenPx', () => {
      // Larger targetScreenPx = fewer, more spread-out grid lines
      const systemWide = new ProjectedGridSystem({ crs: 'EPSG:4326', targetScreenPx: 200 });
      const systemNarrow = new ProjectedGridSystem({ crs: 'EPSG:4326', targetScreenPx: 50 });

      const extent: Extent = [0, 5621521, 1113195, 7361866];
      const featuresWide = systemWide.getFeatures(extent, 1000, 'EPSG:3857');
      const featuresNarrow = systemNarrow.getFeatures(extent, 1000, 'EPSG:3857');

      const majorWide = featuresWide.filter(f => f.get('gridLineType') === 'major');
      const majorNarrow = featuresNarrow.filter(f => f.get('gridLineType') === 'major');

      // Wider spacing should produce fewer or equal major lines
      expect(majorWide.length).toBeLessThanOrEqual(majorNarrow.length);
    });
  });

  describe('extent clipping', () => {
    // EPSG:28992 (Amersfoort / RD New), Dutch national grid
    const rdNewProj4 = '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,1.9342,-1.6677,9.1019,4.0725 +units=m +no_defs +type=crs';
    // Valid extent for RD New in projected coordinates
    const rdNewExtent: Extent = [-7000, 289000, 300000, 629000];

    it('clips grid lines to the CRS valid extent', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:28992',
        proj4Def: rdNewProj4,
        extent: rdNewExtent,
      });

      // A Web Mercator extent covering the Netherlands (~3°E to ~7°E, ~51°N to ~54°N)
      const extent: Extent = [333958, 6621293, 779236, 7170157];
      const features = system.getFeatures(extent, 500, 'EPSG:3857');

      const majorFeatures = features.filter(f => f.get('gridLineType') === 'major');
      expect(majorFeatures.length).toBeGreaterThan(0);

      // Grid values should be within reasonable RD coordinate range (not wildly distorted)
      const xValues = majorFeatures
        .filter(f => f.get('gridAxis') === 'x')
        .map(f => f.get('gridValue') as number);
      const yValues = majorFeatures
        .filter(f => f.get('gridAxis') === 'y')
        .map(f => f.get('gridValue') as number);

      // RD New coordinates for the Netherlands are roughly:
      // X: 0 to 300,000 m, Y: 300,000 to 625,000 m
      for (const x of xValues) {
        expect(x).toBeGreaterThanOrEqual(-50000);
        expect(x).toBeLessThanOrEqual(350000);
      }
      for (const y of yValues) {
        expect(y).toBeGreaterThanOrEqual(250000);
        expect(y).toBeLessThanOrEqual(700000);
      }
    });

    it('returns no features when view is entirely outside the CRS valid area', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:28992',
        proj4Def: rdNewProj4,
        extent: rdNewExtent,
      });

      // Web Mercator extent over Australia, entirely outside RD's valid area
      const australiaExtent: Extent = [12000000, -5000000, 17000000, -1000000];
      const features = system.getFeatures(australiaExtent, 1000, 'EPSG:3857');
      expect(features.length).toBe(0);
    });

    it('returns no labels when view is entirely outside the CRS valid area', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:28992',
        proj4Def: rdNewProj4,
        extent: rdNewExtent,
      });

      const australiaExtent: Extent = [12000000, -5000000, 17000000, -1000000];
      const labels = system.getLabels(australiaExtent, 1000, 'EPSG:3857');
      expect(labels.length).toBe(0);
    });

    it('generates labels with metric formatting for RD New', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:28992',
        proj4Def: rdNewProj4,
        extent: rdNewExtent,
      });

      const extent: Extent = [333958, 6621293, 779236, 7170157];
      const labels = system.getLabels(extent, 500, 'EPSG:3857');

      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.text).toMatch(/m|km/);
      }
    });
  });

  describe('EPSG:28991 (RD Old)', () => {
    const rdOldProj4 = '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=0 +y_0=0 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,1.9342,-1.6677,9.1019,4.0725 +units=m +no_defs +type=crs';
    // RD Old has same origin but x_0=0, y_0=0, so coordinates are shifted
    const rdOldExtent: Extent = [-162000, -174000, 145000, 166000];

    it('registers and generates grid lines for RD Old', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:28991',
        proj4Def: rdOldProj4,
        extent: rdOldExtent,
      });

      // Web Mercator extent over the Netherlands
      const extent: Extent = [333958, 6621293, 779236, 7170157];
      const features = system.getFeatures(extent, 500, 'EPSG:3857');

      const majorFeatures = features.filter(f => f.get('gridLineType') === 'major');
      expect(majorFeatures.length).toBeGreaterThan(0);
    });

    it('uses metric formatting for labels', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:28991',
        proj4Def: rdOldProj4,
        extent: rdOldExtent,
      });

      const extent: Extent = [333958, 6621293, 779236, 7170157];
      const labels = system.getLabels(extent, 500, 'EPSG:3857');

      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.text).toMatch(/m|km/);
      }
    });
  });

  describe('parseCoordinate', () => {
    it('parses a metric pair and transforms to view projection (UTM 33N → 3857)', () => {
      const system = new ProjectedGridSystem({
        crs: 'EPSG:32633',
        proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs',
      });
      const [x, y] = system.parseCoordinate('500000 5000000', 'EPSG:3857');
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      // UTM 33N (500000, 5000000), central meridian 15°E, ~45.13°N.
      // 3857 longitude is exact (proj scaling), latitude depends on UTM↔WGS84.
      expect(x).toBeCloseTo(1669792, -2);
      expect(y).toBeGreaterThan(5_500_000);
      expect(y).toBeLessThan(5_700_000);
    });

    it('accepts a trailing-km pair (regression: 3-token "x y unit" used to fail)', () => {
      const utm = new ProjectedGridSystem({
        crs: 'EPSG:32633',
        proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs',
      });
      const [bareX, bareY] = utm.parseCoordinate('500000 5000000 m', 'EPSG:32633');
      expect(bareX).toBeCloseTo(500000, 6);
      expect(bareY).toBeCloseTo(5000000, 6);
      const [kmX, kmY] = utm.parseCoordinate('500 5000 km', 'EPSG:32633');
      expect(kmX).toBeCloseTo(500000, 6);
      expect(kmY).toBeCloseTo(5000000, 6);
    });

    it('routes hemispheres through DegreeFormatter when CRS is EPSG:4326', () => {
      const system = new ProjectedGridSystem({ crs: 'EPSG:4326' });
      const [x, y] = system.parseCoordinate('50.85N 4.35E', 'EPSG:4326');
      expect(x).toBeCloseTo(4.35, 6);
      expect(y).toBeCloseTo(50.85, 6);
    });

    it('round-trips formatCoordinate output', () => {
      const utm = new ProjectedGridSystem({
        crs: 'EPSG:32633',
        proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs +type=crs',
      });
      const original: [number, number] = [500000, 5000000];
      const formatted = utm.formatCoordinate(original, 'EPSG:32633');
      if (!isAxisFormatted(formatted)) throw new Error('expected axis formatting');
      const [px, py] = utm.parseCoordinate(`${formatted.x} ${formatted.y}`, 'EPSG:32633');
      expect(px).toBeCloseTo(original[0], 0);
      expect(py).toBeCloseTo(original[1], 0);
    });
  });

  describe('getCellLabels', () => {
    const formatter = {
      format: (v: number, _axis: 'x' | 'y'): string => String(v),
      formatCellLabel: (x: number, y: number): string | undefined => {
        if (x < 0 || y < 0) return undefined;
        return `${Math.round(x)},${Math.round(y)}`;
      },
    };

    it('returns an empty array when the formatter has no formatCellLabel', () => {
      const sys = new ProjectedGridSystem({
        crs: 'EPSG:4326',
        formatter: { format: (v) => String(v) },
      });
      const labels = sys.getCellLabels([0, 0, 10, 10], 0.1, 'EPSG:4326');
      expect(labels).toEqual([]);
    });

    it('emits one cell label per cell whose formatCellLabel returns a value', () => {
      const sys = new ProjectedGridSystem({ crs: 'EPSG:4326', formatter });
      const labels = sys.getCellLabels([0, 0, 5, 5], 0.05, 'EPSG:4326');
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.text).toMatch(/^\d+,\d+$/);
        const [x, y] = label.point.getCoordinates();
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(label.cellSizePx).toBeGreaterThan(0);
      }
    });

    it('skips cells where formatCellLabel returns undefined (negative-coord quadrant)', () => {
      const sys = new ProjectedGridSystem({ crs: 'EPSG:4326', formatter });
      const labels = sys.getCellLabels([-5, -5, 5, 5], 0.05, 'EPSG:4326');
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        const [x, y] = label.point.getCoordinates();
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns an empty array when every cell skips (no formatCellLabel hits)', () => {
      const sys = new ProjectedGridSystem({
        crs: 'EPSG:4326',
        formatter: {
          format: (v) => String(v),
          formatCellLabel: () => undefined,
        },
      });
      expect(sys.getCellLabels([0, 0, 10, 10], 0.1, 'EPSG:4326')).toEqual([]);
    });
  });
});
