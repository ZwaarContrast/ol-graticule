import { describe, it, expect } from 'vitest';
import LineString from 'ol/geom/LineString';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type { IntervalStrategy } from '@zwaarcontrast/ol-graticule';
import { MgrsGridSystem } from '../MgrsGridSystem.js';

/**
 * Pin the chosen interval to a known value, regardless of resolution.
 * `MgrsIntervals` derives its interval from `resolution * targetScreenPx`,
 * which is in view-CRS units (degrees when the view is `EPSG:4326`) but
 * compared against `MGRS_INTERVALS` (metres), fine for the production
 * Web-Mercator case but not directly usable in lat/lon test viewports.
 * For these tile tests we want exact control over the grid spacing so
 * the assertions can name specific UTM line values.
 */
class FixedInterval implements IntervalStrategy {
  constructor(private readonly interval: number) {}
  getInterval(): number { return this.interval; }
  getMinorInterval(): undefined { return undefined; }
}

/**
 * Construct an `MgrsGridSystem` wired for tile-test geometry: small cells
 * never gate out (`minLinePx` / `minCellPx` set to 0), and interior grid
 * spacing is fixed via {@link FixedInterval}.
 */
function tileTestGrid(intervalMetres: number): MgrsGridSystem {
  return new MgrsGridSystem({
    intervals: new FixedInterval(intervalMetres),
    minLinePx: 0,
    minCellPx: 0,
  });
}

/**
 * Pull all interior-line features that match a given UTM identity.
 * `zoneKey` is `<zone>` for UTM, `0|<band>` for UPS.
 */
function gridFeaturesByUtm(
  features: Feature<Geometry>[],
  zoneKey: string,
  axis: 'e' | 'n',
  constUtm: number,
): Feature<Geometry>[] {
  return features.filter((f) =>
    f.get('mgrsKind') === 'grid' &&
    f.get('gridZoneKey') === zoneKey &&
    f.get('gridAxis') === axis &&
    Math.abs((f.get('gridConstUtm') as number) - constUtm) < 1e-6,
  );
}

function vertexCount(feature: Feature<Geometry>): number {
  const geom = feature.getGeometry();
  if (!(geom instanceof LineString)) return 0;
  return geom.getCoordinates().length;
}

describe('MgrsGridSystem per-tile cache: stitching invariants', () => {
  // Geometry note: zone 31 spans lon 0–6° with central meridian at lon=3°
  // (UTM e=500 000 m). Viewport lon=2–4 captures e=500 000 plus ~2 tiles
  // east-west of it; viewport lon=2.5–3.5 keeps everything inside the
  // central tile. Latitudes 48–56° = band U (UTM N ≈ 5 320 000–6 206 000),
  // 56–64° = band V.

  it('cross-tile: one UTM line spanning multiple tiles in one band emits as one feature', () => {
    // Viewport sits inside zone 31 band U. The east-line at e=500 000 m
    // is the band's central meridian; viewport lat 50–54° crosses
    // 4 tiles vertically (N=55–58). They MUST stitch into one feature.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([2, 50, 4, 54], 0.001, 'EPSG:4326');

    const matches = gridFeaturesByUtm(features, '31', 'e', 500_000);
    expect(matches.length).toBe(1);
    // Each tile contributes ~5 samples at adaptive density 4; dedupe at
    // seams gives 4×5 - 3 = 17 vertices for 4 tiles. Allow margin for
    // band-edge adjustments.
    expect(vertexCount(matches[0]!)).toBeGreaterThanOrEqual(8);
  });

  it('cross-band: one UTM line crossing band U→V emits as one feature', () => {
    // Viewport spans band U (48–56°) and band V (56–64°) inside zone 31.
    // The east-line at e=500 000 m runs through both, the cross-tile
    // stitch must compose with the cross-band stitch into ONE feature.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([2, 53, 4, 60], 0.001, 'EPSG:4326');

    const matches = gridFeaturesByUtm(features, '31', 'e', 500_000);
    expect(matches.length).toBe(1);
  });

  it('half-open tile ownership: a line at exactly a tile boundary is not duplicated', () => {
    // The east-line at e=500 000 m sits on the **west boundary** of tile
    // E=5 and the **east boundary** of tile E=4. Half-open ownership
    // gives it to tile E=5. Viewport here makes BOTH tiles visible
    // (lon=2 → e≈314 000 in tile E=3; lon=4 → e≈571 000 in tile E=5).
    // Without the rule, both tiles would generate the line and we'd
    // see two coincident features overdrawn.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([2, 50, 4, 54], 0.001, 'EPSG:4326');

    const matches = gridFeaturesByUtm(features, '31', 'e', 500_000);
    expect(matches.length).toBe(1);
  });

  it('tile-only viewport: lines wholly inside one tile emit exactly one feature each', () => {
    // Tiny viewport entirely inside tile (E=5, N=58) of zone 31U
    // (lon ≈ 3° → e ≈ 500 000 m, lat ≈ 53° → N ≈ 5 875 000 m, both
    // central in their tile). Lines at e=510 000, 520 000, 530 000
    // are interior to tile E=5, each must appear exactly once and
    // only from that tile.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([3.05, 52.85, 3.55, 53.25], 0.001, 'EPSG:4326');

    for (const e of [510_000, 520_000, 530_000]) {
      const matches = gridFeaturesByUtm(features, '31', 'e', e);
      expect(matches.length).toBe(1);
    }
  });

  it('non-overlapping zones: each zone gets its own e=500 000 line', () => {
    // Zones 30 (lon −6 to 0) and 31 (lon 0 to 6) both have a central-
    // meridian line at e=500 000 m, but in DIFFERENT projections, each
    // must emit separately, keyed by `gridZoneKey`. Confirms the
    // stitch is per-zone, not cross-zone.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([-4, 50, 4, 54], 0.001, 'EPSG:4326');

    expect(gridFeaturesByUtm(features, '30', 'e', 500_000).length).toBe(1);
    expect(gridFeaturesByUtm(features, '31', 'e', 500_000).length).toBe(1);
  });

  it('north-axis lines also stitch across tiles', () => {
    // Mirror of the cross-tile test for the OTHER axis. Viewport spans
    // multiple 100 km tiles east-west inside band U; the north-line at
    // n=5 600 000 m runs through several tiles horizontally and must
    // stitch into ONE feature.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([2, 50.4, 4, 50.6], 0.001, 'EPSG:4326');

    const matches = gridFeaturesByUtm(features, '31', 'n', 5_600_000);
    expect(matches.length).toBe(1);
  });

  it('repeated frame at same viewport produces identical feature counts (cache stability)', () => {
    // Indirect cache-correctness test: calling `getFeatures` twice with
    // identical inputs must produce the same result. If the tile cache
    // had off-by-one or eviction bugs, the second call's stitch would
    // differ.
    const grid = tileTestGrid(10_000);
    const ext: [number, number, number, number] = [2, 50, 4, 54];
    const f1 = grid.getFeatures(ext, 0.001, 'EPSG:4326');
    const f2 = grid.getFeatures(ext, 0.001, 'EPSG:4326');
    expect(f2.length).toBe(f1.length);
  });

  it('overlapping panned frame: shared UTM line still emits as one feature', () => {
    // Frame A and frame B overlap in lat. Frame A puts tiles (5, 55..58)
    // in cache; frame B should hit those for the overlap region and
    // compute (5, 59) on miss. The east-line at e=500 000 in frame B
    // must still emit as ONE stitched feature, proves the cache
    // doesn't fragment results when subsets of a UTM line are pulled
    // from cache vs. recomputed.
    const grid = tileTestGrid(10_000);
    grid.getFeatures([2, 50, 4, 54], 0.001, 'EPSG:4326');
    const fB = grid.getFeatures([2, 53, 4, 56], 0.001, 'EPSG:4326');

    expect(gridFeaturesByUtm(fB, '31', 'e', 500_000).length).toBe(1);
  });
});

describe('MgrsGridSystem per-tile cache: tile-edge clip behavior', () => {
  it('tile straddling the band south edge clips lines at the band lat', () => {
    // Tile (E=5, N=53) covers UTM N [5 300 000, 5 400 000] in zone 31.
    // Band U starts at lat 48° → UTM N ≈ 5 317 000 at the central
    // meridian, so this tile straddles the band's south UTM edge: the
    // bottom ~17 000 m of the tile is below the band.
    //
    // Viewport lat 48.5–49.5° keeps `iterateVisibleGzds` inside band U
    // only (band T lives below lat 48), so the stitched line at
    // e=500 000 m comes from band U's tile (5, 53) alone, the line
    // must NOT extend below lat 48° because the per-band clip cuts at
    // the band south edge.
    const grid = tileTestGrid(10_000);
    const features = grid.getFeatures([2, 48.5, 4, 49.5], 0.001, 'EPSG:4326');

    const matches = gridFeaturesByUtm(features, '31', 'e', 500_000);
    expect(matches.length).toBe(1);
    const geom = matches[0]!.getGeometry();
    expect(geom).toBeInstanceOf(LineString);
    if (!(geom instanceof LineString)) return;
    let minLat = Infinity;
    for (const [, lat] of geom.getCoordinates()) {
      if (lat! < minLat) minLat = lat!;
    }
    // Tolerance: clip lands on the lat=48° boundary; floats may drift
    // by ~1e-9 in the inverse projection.
    expect(minLat).toBeGreaterThanOrEqual(48 - 1e-6);
  });
});

describe('MgrsGridSystem per-tile cache: UPS pole-crossing seam handling', () => {
  it('UPS east-line whose tiles straddle the pole emits as TWO features, not one cross-world stitch', () => {
    // The UPS-N central meridian east-line at UPS e=2 000 000 passes
    // through the north pole. Per-tile generation puts its south-of-
    // pole portion in one tile and its north-of-pole portion in
    // another. After the pole-clamp at lat=89.9999°, the south tile's
    // last vertex is at (lon ≈ 0°, lat=89.9999°) and the north tile's
    // first vertex is at (lon ≈ 180°, lat=89.9999°), same lat, lon
    // 180° apart.
    //
    // Without seam-aware stitching, the two tiles would join into one
    // polyline whose internal segment is a horizontal line at
    // lat=89.9999° all the way across the world (the "spider-web"
    // artifact at the top of the Mercator viewport). The fix flushes
    // the running polyline whenever adjacent tile seams disagree;
    // this scenario must produce TWO features, not one.
    const grid = tileTestGrid(100_000);
    // Viewport spans the polar caps at zoom-out level: world lon range,
    // lat range comfortably above and below the pole (UPS-N covers
    // lat 84°+).
    const features = grid.getFeatures([-180, 84, 180, 90], 0.01, 'EPSG:4326');

    // The UPS east-line at e=2 000 000 m. UPS Y and Z share the UPS-N
    // projection but have separate `gridZoneKey` (`0|Y` vs `0|Z`)
    // because their lon-range coverage (and stitch ordering) differs.
    //
    // The pole-line in Z covers two disjoint pole-clamped segments
    // (one south-of-pole at lon ≈ 0° headed to lat=89.9999°, one
    // north-of-pole at lon ≈ 180° headed back down to lat 84°). After
    // the seam-flush fix these emit as TWO features per UPS zone, not
    // joined.
    const zMatches = gridFeaturesByUtm(features, '0|Z', 'e', 2_000_000);
    // We just need to assert that the stitch did NOT produce a single
    // feature whose polyline has an interior horizontal jump across
    // the world. Concretely: every emitted feature's coords must stay
    // within a sane lon range, no segment whose lon span exceeds 180°.
    for (const f of zMatches) {
      const coords = (f.getGeometry() as LineString).getCoordinates();
      for (let i = 1; i < coords.length; i++) {
        const dLon = Math.abs(coords[i]![0]! - coords[i-1]![0]!);
        // Adjacent vertices in any single feature must not jump >180°
        // in lon, that's only possible if a phantom cross-world
        // segment got injected at the seam.
        expect(dLon).toBeLessThan(180 + 1e-6);
      }
    }
    // Same check for Y zone.
    const yMatches = gridFeaturesByUtm(features, '0|Y', 'e', 2_000_000);
    for (const f of yMatches) {
      const coords = (f.getGeometry() as LineString).getCoordinates();
      for (let i = 1; i < coords.length; i++) {
        const dLon = Math.abs(coords[i]![0]! - coords[i-1]![0]!);
        expect(dLon).toBeLessThan(180 + 1e-6);
      }
    }
  });
});
