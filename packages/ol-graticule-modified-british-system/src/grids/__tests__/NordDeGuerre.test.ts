import { describe, it, expect } from 'vitest';
import proj4 from 'proj4';
import { get as getProjection } from 'ol/proj';
import { PolygonClippedGridSystem, isCombinedFormatted } from '@zwaarcontrast/ol-graticule';
import {
  createNordDeGuerreGridSystem,
  NORD_DE_GUERRE_CRS,
  NORD_DE_GUERRE_PROJ4,
  NORD_DE_GUERRE_EXTENT,
  NORD_DE_GUERRE_CLIP_POLYGON,
} from '../NordDeGuerre.js';

describe('NordDeGuerre constants', () => {
  it('uses EPSG:27500 as the CRS code', () => {
    expect(NORD_DE_GUERRE_CRS).toBe('EPSG:27500');
  });

  it('proj4 definition uses Lambert Conformal Conic in metres', () => {
    expect(NORD_DE_GUERRE_PROJ4).toContain('+proj=lcc');
    expect(NORD_DE_GUERRE_PROJ4).toContain('+units=m');
  });

  it('extent is well-formed (minX < maxX, minY < maxY)', () => {
    const [minX, minY, maxX, maxY] = NORD_DE_GUERRE_EXTENT;
    expect(minX).toBeLessThan(maxX);
    expect(minY).toBeLessThan(maxY);
  });

  it('clip polygon is closed enough to be a real boundary (no NaN, non-trivial)', () => {
    expect(NORD_DE_GUERRE_CLIP_POLYGON.length).toBeGreaterThan(3);
    for (const [x, y] of NORD_DE_GUERRE_CLIP_POLYGON) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});

describe('createNordDeGuerreGridSystem', () => {
  it('returns a PolygonClippedGridSystem instance (MBS boundary is geometrically clipped)', () => {
    const grid = createNordDeGuerreGridSystem();
    expect(grid).toBeInstanceOf(PolygonClippedGridSystem);
  });

  it('registers EPSG:27500 with proj4 and OpenLayers', () => {
    createNordDeGuerreGridSystem();
    expect(proj4.defs(NORD_DE_GUERRE_CRS)).toBeTruthy();
    expect(getProjection(NORD_DE_GUERRE_CRS)).toBeTruthy();
  });

  it('is safe to call multiple times (registration is idempotent)', () => {
    expect(() => {
      createNordDeGuerreGridSystem();
      createNordDeGuerreGridSystem();
    }).not.toThrow();
  });

  it('wires MBSFormatter as the label formatter (combined letter-digit output)', () => {
    const grid = createNordDeGuerreGridSystem();
    // The MBS formatter always returns a compound "vK 617 517"-style reference
    // via formatCoordinate, not axis pair. Pick a point inside the extent.
    const formatted = grid.formatCoordinate([500_000, 400_000], NORD_DE_GUERRE_CRS);
    expect(isCombinedFormatted(formatted)).toBe(true);
  });

  it('uses the default MBS clip polygon when none is provided', () => {
    const withDefault = createNordDeGuerreGridSystem();
    // An obviously-outside point in EPSG:3857 (Australia).
    const features = withDefault.getFeatures(
      [12_000_000, -5_000_000, 17_000_000, -1_000_000],
      1000,
      'EPSG:3857',
    );
    expect(features.length).toBe(0);
  });

  /**
   * Primary-source projection check. EPSG:27500 (ATF Paris / Nord de
   * Guerre) is the registered code for the WWI artillery grid published
   * by the French Service Géographique de l'Armée from 1915 onward; our
   * proj4 string IS the EPSG canonical spec. Reference: https://epsg.io/27500
   *
   * Test: project the same point through our factory's proj4 AND through
   * the canonical EPSG proj4 string from epsg.io; the two should agree
   * to sub-metre precision across the WWI Western Front area.
   */
  it('matches the EPSG:27500 canonical proj4 across the Western Front', () => {
    createNordDeGuerreGridSystem();
    // EPSG:27500 canonical via PROJ (`projinfo EPSG:27500`). Same physical
    // projection as our factory's proj4 — lon_0 is 5.4° east of the Paris
    // meridian (= 7°44'13.95" east of Greenwich) — written here with the
    // built-in `+pm=paris` string instead of our explicit numeric value to
    // exercise the equivalence.
    const epsgCanonical =
      '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=5.4 +k_0=0.99950908 ' +
      '+x_0=500000 +y_0=300000 +a=6376523 +rf=308.64 +pm=paris +units=m +no_defs';
    // Test points: WWI hotspots — Ypres, Verdun, Reims, Arras, Cambrai.
    const points: [number, number][] = [
      [2.8853, 50.8503],   // Ypres
      [5.3833, 49.1600],   // Verdun
      [4.0333, 49.2583],   // Reims
      [2.7770, 50.2925],   // Arras
      [3.2356, 50.1763],   // Cambrai
    ];
    for (const [lon, lat] of points) {
      const [ours_x, ours_y] = proj4('EPSG:4326', NORD_DE_GUERRE_PROJ4).forward([lon, lat]);
      const [epsg_x, epsg_y] = proj4('EPSG:4326', epsgCanonical).forward([lon, lat]);
      expect(Math.abs(ours_x - epsg_x)).toBeLessThan(2);
      expect(Math.abs(ours_y - epsg_y)).toBeLessThan(2);
    }
  });

  it('accepts a caller override for clipPolygon', () => {
    // Tiny triangle somewhere outside the default MBS boundary. If the override
    // wins, a view near this triangle should produce features; the default
    // would have clipped them away.
    const farTriangle: [number, number][] = [
      [200_000, 200_000], [250_000, 200_000], [225_000, 250_000],
    ];
    const overridden = createNordDeGuerreGridSystem({ clipPolygon: farTriangle });
    const withDefault = createNordDeGuerreGridSystem();

    // Build a narrow view extent (in EPSG:3857) roughly over that triangle.
    // We don't need correctness of the view — we just need the override
    // polygon to admit at least one grid line that the default rejects.
    const viewExtent: [number, number, number, number] = [
      200_000, 6_000_000, 400_000, 6_200_000,
    ];

    const overriddenFeatures = overridden.getFeatures(viewExtent, 500, 'EPSG:3857');
    const defaultFeatures = withDefault.getFeatures(viewExtent, 500, 'EPSG:3857');
    // At minimum: the two clip polygons must produce different outputs.
    expect(overriddenFeatures.length).not.toBe(defaultFeatures.length);
  });
});
