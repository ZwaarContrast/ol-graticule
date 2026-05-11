import { describe, it, expect } from 'vitest';
import { get as getProjection, transform } from 'ol/proj';
import type { Extent } from 'ol/extent';
import {
  createRDNewGridSystem,
  RD_NEW_CRS,
  RD_NEW_PROJ4,
  RD_NEW_EXTENT,
  RD_NEW_CLIP_POLYGON,
} from '../RDNew.js';
import {
  createRDOldGridSystem,
  RD_OLD_CRS,
  RD_OLD_PROJ4,
  RD_OLD_EXTENT,
  RD_OLD_CLIP_POLYGON,
} from '../RDOld.js';

describe('@zwaarcontrast/ol-graticule-rd', () => {
  describe('constants', () => {
    it('RD New uses EPSG:28992', () => {
      expect(RD_NEW_CRS).toBe('EPSG:28992');
    });

    it('RD Old uses EPSG:28991', () => {
      expect(RD_OLD_CRS).toBe('EPSG:28991');
    });

    it('RD New proj4Def includes the canonical EPSG:4833 towgs84 fallback', () => {
      // Without +towgs84, `+nadgrids=@rdtrans2018,@null` falls back to
      // identity (~100 m error) instead of the 7-parameter transform.
      // The rotations must be in arc-seconds (proj4's expected unit) and
      // in Position Vector convention (sign-flipped from EPSG's Coordinate
      // Frame publication), the previous µrad / Coord-Frame values
      // produced ~170 m error through proj4's pipeline.
      expect(RD_NEW_PROJ4).toContain('+towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.87740,4.0725');
      expect(RD_NEW_PROJ4).toContain('+nadgrids=@rdtrans2018,@null');
    });

    it('RD Old proj4Def includes the canonical EPSG:4833 towgs84 fallback', () => {
      expect(RD_OLD_PROJ4).toContain('+towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.87740,4.0725');
      expect(RD_OLD_PROJ4).toContain('+nadgrids=@rdtrans2018,@null');
    });

    it('RD New extent matches its clip-polygon bounding box', () => {
      const [minX, minY, maxX, maxY] = RD_NEW_EXTENT;
      let pxMin = Infinity, pyMin = Infinity, pxMax = -Infinity, pyMax = -Infinity;
      for (const [x, y] of RD_NEW_CLIP_POLYGON) {
        if (x < pxMin) pxMin = x;
        if (y < pyMin) pyMin = y;
        if (x > pxMax) pxMax = x;
        if (y > pyMax) pyMax = y;
      }
      expect(minX).toBe(pxMin);
      expect(minY).toBe(pyMin);
      expect(maxX).toBe(pxMax);
      expect(maxY).toBe(pyMax);
    });

    it('RD Old extent matches its clip-polygon bounding box', () => {
      const [minX, minY, maxX, maxY] = RD_OLD_EXTENT;
      let pxMin = Infinity, pyMin = Infinity, pxMax = -Infinity, pyMax = -Infinity;
      for (const [x, y] of RD_OLD_CLIP_POLYGON) {
        if (x < pxMin) pxMin = x;
        if (y < pyMin) pyMin = y;
        if (x > pxMax) pxMax = x;
        if (y > pyMax) pyMax = y;
      }
      expect(minX).toBe(pxMin);
      expect(minY).toBe(pyMin);
      expect(maxX).toBe(pxMax);
      expect(maxY).toBe(pyMax);
    });

    it('RD Old polygon = RD New polygon shifted by the false-origin delta', () => {
      // RD Old has x_0 = y_0 = 0 while RD New has x_0 = 155000, y_0 = 463000.
      // Every vertex of RD_OLD_CLIP_POLYGON should equal the RD_NEW vertex
      // minus (155000, 463000) (up to rounding).
      expect(RD_NEW_CLIP_POLYGON.length).toBe(RD_OLD_CLIP_POLYGON.length);
      for (let i = 0; i < RD_NEW_CLIP_POLYGON.length; i++) {
        const [nx, ny] = RD_NEW_CLIP_POLYGON[i]!;
        const [ox, oy] = RD_OLD_CLIP_POLYGON[i]!;
        expect(nx - ox).toBeCloseTo(155000, -1);
        expect(ny - oy).toBeCloseTo(463000, -1);
      }
    });
  });

  describe('createRDNewGridSystem', () => {
    it('registers EPSG:28992 with OL/proj4', () => {
      createRDNewGridSystem();
      expect(getProjection(RD_NEW_CRS)).not.toBeNull();
    });

    it('produces labels for a Web Mercator viewport over the Netherlands', () => {
      const system = createRDNewGridSystem();
      // Web Mercator extent covering ~3°E to ~7°E, ~51°N to ~54°N.
      const extent: Extent = [333958, 6621293, 779236, 7170157];
      const labels = system.getLabels(extent, 500, 'EPSG:3857');
      expect(labels.length).toBeGreaterThan(0);
      // Labels should be metric (RD uses metres).
      expect(labels.every((l) => / m$| km$/.test(l.text))).toBe(true);
    });

    it('isValidCoordinate returns true for a point in central Netherlands', () => {
      const system = createRDNewGridSystem();
      // Amersfoort (town), the origin of the RD system:
      // lon 5.387°E, lat 52.156°N → Web Mercator (599700, 6828929).
      expect(system.isValidCoordinate([599700, 6828929], 'EPSG:3857')).toBe(true);
    });

    it('isValidCoordinate returns false for a point in Australia', () => {
      const system = createRDNewGridSystem();
      // Sydney ≈ Web Mercator (16814500, -4009750).
      expect(system.isValidCoordinate([16814500, -4009750], 'EPSG:3857')).toBe(false);
    });

    it('uses the RDNAPTRANS 2018 grid for WGS84 → RD conversions (sub-meter accuracy)', () => {
      // With the grid loaded, the Westertoren (Amsterdam), a well-published
      // RDNAPTRANS test point, maps from ETRS89 / WGS84 to its canonical
      // RD coordinates to within sub-meter precision. Without the grid, the
      // Helmert fallback produces ~150 m of error at this location, so this
      // assertion is a strong signal that the NTv2 grid is wired up.
      createRDNewGridSystem();
      const [x, y] = transform([4.883517, 52.374538], 'EPSG:4326', RD_NEW_CRS);
      // Canonical RD of Westertoren: (120700.72, 487525.50).
      expect(x).toBeCloseTo(120700.72, 0);
      expect(y).toBeCloseTo(487525.50, 0);
    });
  });

  describe('createRDOldGridSystem', () => {
    it('registers EPSG:28991 with OL/proj4', () => {
      createRDOldGridSystem();
      expect(getProjection(RD_OLD_CRS)).not.toBeNull();
    });

    it('produces labels for a Web Mercator viewport over the Netherlands', () => {
      const system = createRDOldGridSystem();
      const extent: Extent = [333958, 6621293, 779236, 7170157];
      const labels = system.getLabels(extent, 500, 'EPSG:3857');
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.every((l) => / m$| km$/.test(l.text))).toBe(true);
    });

    it('formatCoordinate on RD Old produces different coordinates than RD New for the same point', () => {
      const newSystem = createRDNewGridSystem();
      const oldSystem = createRDOldGridSystem();
      // Amersfoort town centre in Web Mercator.
      const pt: [number, number] = [599700, 6828929];
      const newFmt = newSystem.formatCoordinate(pt, 'EPSG:3857');
      const oldFmt = oldSystem.formatCoordinate(pt, 'EPSG:3857');
      // Both are axis-formatted (RD grids are metric, not compound).
      if (!('x' in newFmt) || !('x' in oldFmt)) throw new Error('expected axis-formatted');
      // Different false origins → different labels.
      expect(newFmt.x).not.toBe(oldFmt.x);
      expect(newFmt.y).not.toBe(oldFmt.y);
    });
  });

  describe('clipPolygon override', () => {
    it('accepts a user-supplied clip polygon override', () => {
      const tiny: [number, number][] = [[0, 300000], [1000, 300000], [1000, 301000], [0, 301000]];
      const system = createRDNewGridSystem({ clipPolygon: tiny });
      // A coordinate inside the NL outline but outside our tiny polygon
      // should now be invalid.
      // Approx Amsterdam in Web Mercator.
      const ams: [number, number] = [547000, 6867000];
      expect(system.isValidCoordinate(ams, 'EPSG:3857')).toBe(false);
    });
  });

  describe('parseCoordinate', () => {
    it('accepts "155000 463000" in metres on EPSG:28992 view', () => {
      const system = createRDNewGridSystem();
      const [x, y] = system.parseCoordinate!('155000 463000', 'EPSG:28992');
      expect(x).toBeCloseTo(155000, 6);
      expect(y).toBeCloseTo(463000, 6);
    });

    it('accepts "155 463 km" (regression: this used to fail through PolygonClipped→Projected→splitCoordinatePair)', () => {
      const system = createRDNewGridSystem();
      const [x, y] = system.parseCoordinate!('155 463 km', 'EPSG:28992');
      expect(x).toBeCloseTo(155000, 6);
      expect(y).toBeCloseTo(463000, 6);
    });

    it('accepts "155, 463 km" with comma', () => {
      const system = createRDNewGridSystem();
      const [x, y] = system.parseCoordinate!('155, 463 km', 'EPSG:28992');
      expect(x).toBeCloseTo(155000, 6);
      expect(y).toBeCloseTo(463000, 6);
    });

    it('accepts "155000 463000 m" with explicit metre suffix', () => {
      const system = createRDNewGridSystem();
      const [x, y] = system.parseCoordinate!('155000 463000 m', 'EPSG:28992');
      expect(x).toBeCloseTo(155000, 6);
      expect(y).toBeCloseTo(463000, 6);
    });

    it('transforms RD metres to a Web Mercator view projection', () => {
      const system = createRDNewGridSystem();
      const [x, y] = system.parseCoordinate!('155000 463000', 'EPSG:3857');
      // RD (155000, 463000) ≈ Amersfoort tower; lands roughly mid-Netherlands in 3857.
      expect(x).toBeGreaterThan(550_000);
      expect(x).toBeLessThan(650_000);
      expect(y).toBeGreaterThan(6_800_000);
      expect(y).toBeLessThan(6_900_000);
    });
  });
});
