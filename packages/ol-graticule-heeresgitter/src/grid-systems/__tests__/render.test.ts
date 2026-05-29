import { describe, expect, it } from 'vitest';

import { DhgGridSystem } from '../DhgGridSystem.js';
import { HmnGridSystem } from '../HmnGridSystem.js';

// A roughly-European viewport in EPSG:3857 (web-Mercator metres).
// Span ~ 0°E..30°E, 45°N..55°N.
const EUROPE_EXTENT: [number, number, number, number] = [
  0,
  5_621_521, // ≈ lat 45°
  3_339_584, // ≈ lon 30°
  7_361_866, // ≈ lat 55°
];
// Resolution at zoom 12 in EPSG:3857 (inside DHG's render gate).
const ZOOM12_RES = 38.2186;

describe('DhgGridSystem render smoke', () => {
  it('emits grid line features over a typical European viewport', () => {
    const grid = new DhgGridSystem({ zoneBoundary: 'single' });
    const features = grid.getFeatures(EUROPE_EXTENT, ZOOM12_RES, 'EPSG:3857');
    expect(features.length).toBeGreaterThan(0);
    // Each feature should carry an axis tag.
    const axes = new Set(features.map((f) => f.get('gridAxis')));
    expect(axes.has('x')).toBe(true);
    expect(axes.has('y')).toBe(true);
  });

  it('emits edge labels with Kennziffer-prefixed eastings', () => {
    const grid = new DhgGridSystem({ zoneBoundary: 'single' });
    const labels = grid.getLabels(EUROPE_EXTENT, ZOOM12_RES, 'EPSG:3857');
    expect(labels.length).toBeGreaterThan(0);
    // At lon ≈ 15°E, the zone is 3 (CM 15°E). Easting labels should start with "3"
    // or any adjacent strip we ended up rendering. Just check the format shape.
    const xLabels = labels.filter((l) => l.axis === 'x').map((l) => l.text);
    expect(xLabels.some((t) => /^[1-9]\d{3}$/.test(t))).toBe(true); // long form K|KKK
    const yLabels = labels.filter((l) => l.axis === 'y').map((l) => l.text);
    expect(yLabels.some((t) => /^\d+$/.test(t))).toBe(true); // plain km
  });

  it('emits no features over an out-of-theatre viewport (mid-Pacific)', () => {
    // EPSG:3857 metres for roughly (lon -160°..-150°, lat 10°N..20°N), open Pacific.
    const pacificExtent: [number, number, number, number] = [
      -17_811_120, // ≈ lon -160°
      1_118_890,  // ≈ lat 10°N
      -16_697_924, // ≈ lon -150°
      2_273_031,  // ≈ lat 20°N
    ];
    const grid = new DhgGridSystem();
    const features = grid.getFeatures(pacificExtent, ZOOM12_RES, 'EPSG:3857');
    const labels = grid.getLabels(pacificExtent, ZOOM12_RES, 'EPSG:3857');
    // PolygonClippedGridSystem still emits one 'boundary' feature per zone for
    // any zone that is reachable; the validity-envelope clamp collapses those
    // to degenerate triangles far from the viewport, so no grid lines or
    // axis labels reach the user.
    const gridLines = features.filter((f) => f.get('gridLineType') !== 'boundary');
    expect(gridLines).toHaveLength(0);
    expect(labels).toHaveLength(0);
  });

  it('emits strip-boundary outlines instead of detailed grid lines past maxRenderResolution', () => {
    const OVERVIEW_RES = 3000; // > 2000 (detail gate), ≤ 6000 (overview-label gate)
    const grid = new DhgGridSystem();
    const features = grid.getFeatures(EUROPE_EXTENT, OVERVIEW_RES, 'EPSG:3857');
    expect(features.length).toBeGreaterThan(0);
    for (const f of features) {
      expect(f.get('gridLineType')).toBe('boundary');
    }
  });

  it('emits Kennziffer overview labels between the two resolution gates', () => {
    const OVERVIEW_RES = 3000;
    const grid = new DhgGridSystem();
    const labels = grid.getLabels(EUROPE_EXTENT, OVERVIEW_RES, 'EPSG:3857');
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      expect(l.text).toMatch(/^([1-9]|[1-5]\d|60)$/);
    }
  });

  it('suppresses overview labels past the overviewLabelMaxResolution gate', () => {
    const FAR_RES = 8000; // > 6000
    const grid = new DhgGridSystem();
    const labels = grid.getLabels(EUROPE_EXTENT, FAR_RES, 'EPSG:3857');
    expect(labels).toHaveLength(0);
  });

  it('emits exactly one Y-axis label per northing line across multiple zones', () => {
    // Viewport spans lon ~20°E to ~32°E at lat ~47°N..50°N — covers zones 4, 5, 6
    // (CMs 21, 27, 33). Y labels are deduped by view-CRS pixel row so every
    // northing line gets exactly one label, not one per visible zone.
    const wideExtent: [number, number, number, number] = [
      2_226_390, 5_944_000, 3_562_224, 6_447_000,
    ];
    const grid = new DhgGridSystem();
    const yLabels = grid
      .getLabels(wideExtent, ZOOM12_RES, 'EPSG:3857')
      .filter((l) => l.axis === 'y');
    expect(yLabels.length).toBeGreaterThan(0);

    const counts = new Map<string, number>();
    for (const l of yLabels) {
      counts.set(l.text, (counts.get(l.text) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBe(1);
  });

  it('Y labels prefer the westernmost zone so they sit at the viewport left edge', () => {
    // Same multi-zone viewport: 20°E..32°E covers zones 4 (CM 21°E), 5 (CM 27°E), 6 (CM 33°E).
    // The leftmost zone (4) has its strip-left edge near 18°E ≈ x=2_003_751 in EPSG:3857.
    // Zone 5's strip-left edge is at 24°E ≈ x=2_671_667, well inside the viewport.
    // The deduped Y labels should land near zone 4's left edge, not zone 5's.
    const wideExtent: [number, number, number, number] = [
      2_226_390, 5_944_000, 3_562_224, 6_447_000,
    ];
    const grid = new DhgGridSystem();
    const yLabels = grid
      .getLabels(wideExtent, ZOOM12_RES, 'EPSG:3857')
      .filter((l) => l.axis === 'y');
    const xs = yLabels.map((l) => l.point.getCoordinates()[0]!);
    // Tightest test: the maximum x across all y-labels is closer to zone 4's
    // strip-left (~2_003_751) than to zone 5's (~2_671_667).
    const maxX = Math.max(...xs);
    expect(maxX).toBeLessThan(2_500_000);
  });

  it('overlap mode draws features from at least one zone', () => {
    // Centre this on the 30°E boundary so both zone 5 and zone 6 should render.
    const boundaryExtent: [number, number, number, number] = [
      3_006_625, // ≈ lon 27°
      5_621_521, // ≈ lat 45°
      3_672_543, // ≈ lon 33°
      7_361_866, // ≈ lat 55°
    ];
    const grid = new DhgGridSystem({ zoneBoundary: 'overlap' });
    const features = grid.getFeatures(boundaryExtent, ZOOM12_RES, 'EPSG:3857');
    expect(features.length).toBeGreaterThan(0);
  });
});

describe('HmnGridSystem render smoke', () => {
  it('emits cell features and labels over a European viewport', () => {
    // Zoomed in enough that 6 km cells are visible: ~200 m/px is fine.
    const tighter: [number, number, number, number] = [
      1_001_876, // lon ≈ 9°
      5_998_186, // lat ≈ 47°
      1_335_834, // lon ≈ 12°
      6_446_275, // lat ≈ 50°
    ];
    const resolution = 76.44; // EPSG:3857 m/px at zoom 11
    const grid = new HmnGridSystem({ maxDepth: 4 });
    const features = grid.getFeatures(tighter, resolution, 'EPSG:3857');
    const labels = grid.getCellLabels(tighter, resolution, 'EPSG:3857');
    expect(features.length).toBeGreaterThan(0);
    expect(labels.length).toBeGreaterThan(0);
    // Cell labels at this zoom should be 2-letter Kleinquadrat codes.
    const sample = labels[0]?.text ?? '';
    expect(sample).toMatch(/^[A-HJ-Z]{2}$/);
  });

  it('includes middle zones on wide viewports (0°-18°E covers zones 1, 2, 3)', () => {
    const wide: [number, number, number, number] = [
      0,           // lon 0°  -> zone 1 (CM 3°E)
      5_998_186,
      2_003_751,   // lon 18° -> zone 3 (CM 15°E)
      6_446_275,
    ];
    const resolution = 76.44;
    const grid = new HmnGridSystem({ maxDepth: 2 });
    const labels = grid.getCellLabels(wide, resolution, 'EPSG:3857');
    expect(labels.length).toBeGreaterThan(0);
    const lons = labels.map((l) => {
      const [x] = l.point.getCoordinates();
      return (x ?? 0);
    });
    const xMin = Math.min(...lons);
    const xMax = Math.max(...lons);
    // The labelled range should span beyond a single 6° zone width (~668 km in EPSG:3857
    // at this latitude); if zone 2 were dropped we'd see a gap.
    expect(xMax - xMin).toBeGreaterThan(1_500_000);
  });

  it('formatCoordinate produces a canonical HMN reference', () => {
    const grid = new HmnGridSystem();
    // (lon, lat) in EPSG:3857 metres for Hadres (~48.75°N, 16.17°E)
    const hadres3857: [number, number] = [1_799_725, 6_223_550];
    const formatted = grid.formatCoordinate(hadres3857, 'EPSG:3857');
    expect(formatted).toHaveProperty('combined');
    if ('combined' in formatted) {
      // Default maxDepth=4 → "<letter><letter> <digit><a..d>"
      expect(formatted.combined).toMatch(/^[A-HJ-Z]{2} \d[a-d]$/);
    }
  });
});
