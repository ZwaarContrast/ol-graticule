import { describe, it, expect } from 'vitest';
import { PixelGridSystem } from '../PixelGridSystem.js';
import type { Extent } from 'ol/extent';

describe('PixelGridSystem', () => {
  const extent: Extent = [0, -1000, 2000, 0]; // typical IIIF: y goes from -height to 0

  describe('getFeatures', () => {
    it('generates vertical and horizontal major grid lines', () => {
      const system = new PixelGridSystem();
      // resolution=1 → interval=120 (1*120=120, first interval ≥120 is 200)
      const features = system.getFeatures(extent, 1, '');

      const majorFeatures = features.filter(f => f.get('gridLineType') === 'major');
      expect(majorFeatures.length).toBeGreaterThan(0);

      const xLines = majorFeatures.filter(f => f.get('gridAxis') === 'x');
      const yLines = majorFeatures.filter(f => f.get('gridAxis') === 'y');
      expect(xLines.length).toBeGreaterThan(0);
      expect(yLines.length).toBeGreaterThan(0);
    });

    it('generates minor grid lines between major lines', () => {
      const system = new PixelGridSystem();
      const features = system.getFeatures(extent, 1, '');

      const minorFeatures = features.filter(f => f.get('gridLineType') === 'minor');
      expect(minorFeatures.length).toBeGreaterThan(0);
    });

    it('minor lines do not coincide with major lines', () => {
      const system = new PixelGridSystem();
      const features = system.getFeatures(extent, 1, '');

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

    it('sets gridValue and gridAxis properties on features', () => {
      const system = new PixelGridSystem();
      const features = system.getFeatures([0, 0, 500, 500], 0.5, '');

      for (const f of features) {
        expect(f.get('gridValue')).toBeTypeOf('number');
        expect(['x', 'y']).toContain(f.get('gridAxis'));
        expect(['major', 'minor']).toContain(f.get('gridLineType'));
      }
    });

    it('covers the full extent with lines starting before or at minX', () => {
      const system = new PixelGridSystem();
      const testExtent: Extent = [100, -500, 900, -100];
      const features = system.getFeatures(testExtent, 1, '');

      const xMajors = features
        .filter(f => f.get('gridLineType') === 'major' && f.get('gridAxis') === 'x')
        .map(f => f.get('gridValue') as number);

      // First line should be at or before the extent start
      expect(Math.min(...xMajors)).toBeLessThanOrEqual(100);
      // Lines should exist within the visible area
      expect(xMajors.length).toBeGreaterThan(0);
    });
  });

  describe('getLabels', () => {
    it('generates x and y labels', () => {
      const system = new PixelGridSystem();
      const labels = system.getLabels([0, 0, 2000, 1000], 1, '');

      const xLabels = labels.filter(l => l.axis === 'x');
      const yLabels = labels.filter(l => l.axis === 'y');
      expect(xLabels.length).toBeGreaterThan(0);
      expect(yLabels.length).toBeGreaterThan(0);
    });

    it('positions x labels at the top edge of the viewport', () => {
      const testExtent: Extent = [0, 0, 2000, 1000];
      const system = new PixelGridSystem();
      const labels = system.getLabels(testExtent, 1, '');

      const xLabels = labels.filter(l => l.axis === 'x');
      for (const label of xLabels) {
        const coords = label.point.getCoordinates();
        expect(coords[1]).toBe(1000); // maxY
      }
    });

    it('positions y labels at the left edge of the viewport', () => {
      const testExtent: Extent = [0, 0, 2000, 1000];
      const system = new PixelGridSystem();
      const labels = system.getLabels(testExtent, 1, '');

      const yLabels = labels.filter(l => l.axis === 'y');
      for (const label of yLabels) {
        const coords = label.point.getCoordinates();
        expect(coords[0]).toBe(0); // minX
      }
    });

    it('formats labels as pixel integers', () => {
      const system = new PixelGridSystem();
      const labels = system.getLabels([0, 0, 2000, 1000], 1, '');

      for (const label of labels) {
        expect(label.text).toMatch(/^-?\d+ px$/);
      }
    });

    it('filters out negative pixel values', () => {
      const system = new PixelGridSystem();
      // Extent includes negative x and positive y (non-inverted)
      const labels = system.getLabels([-500, -500, 500, 500], 1, '');

      for (const label of labels) {
        const value = parseInt(label.text, 10);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles yInverted: negates y values in labels', () => {
      const system = new PixelGridSystem({ yInverted: true });
      // IIIF-style: OL y is negative, but display y should be positive
      const labels = system.getLabels([0, -1000, 2000, 0], 1, '');

      const yLabels = labels.filter(l => l.axis === 'y');
      expect(yLabels.length).toBeGreaterThan(0);
      for (const label of yLabels) {
        const value = parseInt(label.text, 10);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('formatCoordinate', () => {
    it('formats x and y as pixel values', () => {
      const system = new PixelGridSystem();
      const result = system.formatCoordinate([1234.5, 567.8], '');
      expect(result).toEqual({ x: '1235 px', y: '568 px' });
    });

    it('negates y when yInverted is true', () => {
      const system = new PixelGridSystem({ yInverted: true });
      const result = system.formatCoordinate([100, -250], '');
      expect(result).toEqual({ x: '100 px', y: '250 px' });
    });
  });
});
