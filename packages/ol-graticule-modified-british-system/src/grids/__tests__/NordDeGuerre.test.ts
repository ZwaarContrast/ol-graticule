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
  NORD_DE_GUERRE_DEFAULT_TOWGS84,
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
   * Primary-source projection-geometry check. EPSG:27500 (ATF Paris /
   * Nord de Guerre) is the registered code for the WWI artillery grid
   * published by the French Service Géographique de l'Armée from 1915
   * onward; our LCC parameters match the EPSG canonical spec.
   * Reference: https://epsg.io/27500
   *
   * This test isolates LCC math from datum transformation. Source is
   * lat/lon ON the Plessis 1817 ellipsoid with the Paris meridian, so
   * no Helmert is applied either way — only the projection geometry
   * is exercised. (See the `+towgs84` tests below for datum coverage.)
   */
  it('LCC projection geometry matches EPSG:27500 canonical across the Western Front', () => {
    createNordDeGuerreGridSystem();
    // No-shift variant of our string — same LCC parameters as
    // NORD_DE_GUERRE_PROJ4 but without +towgs84, to compare geometry only.
    const oursNoShift =
      '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=5.4 +k_0=0.99950908 ' +
      '+x_0=500000 +y_0=300000 +a=6376523 +rf=308.64 +pm=2.33720833333333 ' +
      '+units=m +no_defs +type=crs';
    // EPSG:27500 canonical via PROJ (`projinfo EPSG:27500`). Same
    // physical projection — lon_0 is 5.4° east of the Paris meridian
    // (= 7°44'13.95" east of Greenwich) — written here with the
    // built-in `+pm=paris` string instead of our explicit numeric
    // value to exercise the equivalence.
    const epsgCanonical =
      '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=5.4 +k_0=0.99950908 ' +
      '+x_0=500000 +y_0=300000 +a=6376523 +rf=308.64 +pm=paris +units=m +no_defs';
    // Source: Plessis 1817 lat/lon, Paris meridian — no datum shift
    // applied, so we measure LCC math only.
    const plessisLL =
      '+proj=longlat +a=6376523 +rf=308.64 +pm=2.33720833333333 +no_defs';
    // Test points: WWI hotspots — Ypres, Verdun, Reims, Arras, Cambrai.
    const points: [number, number][] = [
      [2.8853, 50.8503],   // Ypres
      [5.3833, 49.1600],   // Verdun
      [4.0333, 49.2583],   // Reims
      [2.7770, 50.2925],   // Arras
      [3.2356, 50.1763],   // Cambrai
    ];
    for (const [lon, lat] of points) {
      const [ours_x, ours_y] = proj4(plessisLL, oursNoShift).forward([lon, lat]);
      const [epsg_x, epsg_y] = proj4(plessisLL, epsgCanonical).forward([lon, lat]);
      expect(Math.abs(ours_x - epsg_x)).toBeLessThan(2);
      expect(Math.abs(ours_y - epsg_y)).toBeLessThan(2);
    }
  });

  /**
   * The default proj4 string carries the empirical Helmert shift so
   * that EPSG:27500 ↔ EPSG:4326 round-trips don't degrade to PROJ's
   * "ballpark" no-shift fallback (~100 m error across the Western
   * Front). See {@link NORD_DE_GUERRE_DEFAULT_TOWGS84} for source.
   */
  it('NORD_DE_GUERRE_PROJ4 includes the default towgs84', () => {
    expect(NORD_DE_GUERRE_PROJ4).toContain(
      `+towgs84=${NORD_DE_GUERRE_DEFAULT_TOWGS84.join(',')}`,
    );
  });

  it('default factory call produces a measurable Helmert shift vs no-shift baseline', () => {
    createNordDeGuerreGridSystem();
    const noShift =
      '+proj=lcc +lat_1=49.5 +lat_0=49.5 +lon_0=5.4 +k_0=0.99950908 ' +
      '+x_0=500000 +y_0=300000 +a=6376523 +rf=308.64 +pm=2.33720833333333 ' +
      '+units=m +no_defs';
    // Verdun — well inside the area where the empirical Helmert was fitted.
    const [withShiftX, withShiftY] = proj4('EPSG:4326', NORD_DE_GUERRE_PROJ4)
      .forward([5.3833, 49.16]);
    const [noShiftX, noShiftY] = proj4('EPSG:4326', noShift)
      .forward([5.3833, 49.16]);
    const dx = withShiftX - noShiftX;
    const dy = withShiftY - noShiftY;
    // The empirical shift moves the projected point by ~100 m at Verdun.
    // Loose bounds — we're proving the towgs84 is wired up, not asserting
    // exact magnitude.
    expect(Math.hypot(dx, dy)).toBeGreaterThan(50);
    expect(Math.hypot(dx, dy)).toBeLessThan(200);
  });

  it('accepts a caller override for towgs84', () => {
    // Custom shift: doubled translations.
    const custom = [2767.6, 77.4, 784, 0, 0, 0, 0] as const;
    createNordDeGuerreGridSystem({ towgs84: custom });
    expect(proj4.defs(NORD_DE_GUERRE_CRS)).toBeTruthy();
    // The registered string should now reflect the custom values.
    expect(proj4.defs(NORD_DE_GUERRE_CRS)).toMatchObject({
      datum_params: [...custom],
    });
    // Restore default for subsequent tests.
    createNordDeGuerreGridSystem();
  });

  it('accepts towgs84: null to register the canonical EPSG:27500 with no shift', () => {
    createNordDeGuerreGridSystem({ towgs84: null });
    // proj4js parses +towgs84 into datum_params; absence means the field
    // is undefined or empty.
    const def = proj4.defs(NORD_DE_GUERRE_CRS) as { datum_params?: number[] };
    expect(def.datum_params === undefined || def.datum_params.length === 0).toBe(true);
    // Restore default for subsequent tests.
    createNordDeGuerreGridSystem();
  });

  it('rejects towgs84 arrays that are not 3 or 7 elements long', () => {
    expect(() =>
      createNordDeGuerreGridSystem({ towgs84: [1, 2] as readonly number[] }),
    ).toThrow(/3 or 7 elements/);
    expect(() =>
      createNordDeGuerreGridSystem({ towgs84: [1, 2, 3, 4] as readonly number[] }),
    ).toThrow(/3 or 7 elements/);
    // Restore default for subsequent tests.
    createNordDeGuerreGridSystem();
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
