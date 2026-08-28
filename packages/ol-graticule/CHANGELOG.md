# @zwaarcontrast/ol-graticule

## 4.0.0

### Major Changes

- f975503: Split rendering into a Canvas 2D and a WebGL backend, with `UniversalGraticule`
  as a thin facade over both. This decouples the grid logic from the rasterizer so
  a non-OpenLayers backend (MapLibre) can be added without touching grid systems.

  **Breaking:** `UniversalGraticule` now extends `LayerGroup` instead of
  `VectorLayer`. `map.addLayer(graticule)` is unchanged, and `getGridSystem`,
  `setGridSystem` and `setHoverLens` all still work, but the `VectorLayer` surface
  is gone: `getSource()`, `setStyle()`, `getFeatures()`, the `postrender` event,
  and the `style`, `declutter`, `renderBuffer`, `updateWhileAnimating` and
  `updateWhileInteracting` options. `UniversalGraticuleOptions` now takes
  `LayerGroup` options (`opacity`, `visible`, `extent`, `zIndex`, `minResolution`,
  `maxResolution`, `minZoom`, `maxZoom`, `properties`) plus the graticule config.

  If you relied on the layer internals, construct `CanvasGraticuleLayer` directly
  to pin the old single-layer behaviour.

  New `renderer` option: `'auto'` (default) probes for WebGL 2 and falls back to
  canvas when it is absent or software-rendered, `'gl'` and `'canvas'` force a
  backend. `CanvasGraticuleLayer` and `WebGLGraticuleLayer` are exported for
  callers that want to skip the probe.

  Adds `@mapbox/tiny-sdf` as a dependency, used to build the SDF glyph atlas for
  GPU label rendering.

### Minor Changes

- 6b960f9: Adaptive grid-line densification. Grid lines are now sampled only where they
  curve in the view projection: straight lines collapse to 2 points and points
  cluster where the line bends, cutting coordinate-transform work during pan and
  zoom. PolygonClippedGridSystem snap mode no longer re-densifies every line each
  render, which made rapid scroll-zoom on clipped grids (e.g. MBS) far smoother.

  Low-level gridline helpers changed as part of this: `adaptiveAxisTs` and
  `uniformTs` replace `densifyCount`, and `pushAxisGridLineSpecs`,
  `emitFlatLineFeatures`, and `FlatLineSpec` now take per-axis `t` samples instead
  of a point count.

- f975503: Add an optional `getCellInterval` to `IntervalStrategy`, so a grid whose label
  cells are a fixed size (a 100 km lettered cell over a finer km grid) can
  enumerate cell labels on their own interval instead of once per major-line cell.
  Optional, so existing strategies are unaffected.

  `ProjectedGridSystem` also caches transformed grid-line polylines across pan
  within a zoom band, re-slicing them instead of re-projecting every frame.

- 28d9a14: Add an optional pointer "hover lens". As the cursor moves over the grid, lines
  swell toward it and taper away in all directions, with a clear hole at the
  crossing under the pointer so the aim point stays uncovered. Enable it through
  `GraticuleStyle.hoverLens`, or toggle it at runtime with
  `UniversalGraticule.setHoverLens`; omit it or pass `false` to disable.

### Patch Changes

- f975503: Relax the adaptive densification tolerance from 0.25 px to 0.5 px. Grid lines
  are densified until they sit within this distance of the true projected curve,
  so this halves the vertex count on curved lines at the cost of up to half a
  pixel of deviation. Pass a smaller `maxDevPx` to `adaptiveAxisTs` to restore the
  previous fidelity.

  `LruCache.get` also skips MRU promotion while the cache is below capacity, where
  nothing can be evicted yet.

- af14ae4: fix: remove redundant unanchored `\s*` from PixelFormatter pixel-suffix strip, eliminating a polynomial-ReDoS backtracking path (no behavior change)

## 3.0.0

### Major Changes

- e397dfb: Consolidated the clipping/geometry helpers around OpenLayers' own
  primitives, removed duplicate implementations between core and MGRS, and
  landed a wave of test/bench infrastructure plus per-package perf
  optimizations.

  **Highlights**
  - **Better label placement on clipped cells.** `PolygonClippedGridSystem`
    and `MgrsGridSystem` now use OpenLayers' `Polygon.getFlatInteriorPoint()`
    for label positioning on partial cells — a label point that's always
    inside the visible shape, with the horizontal-chord length available as
    a free size hint. Replaces the prior area-weighted centroid, which could
    land in awkward spots on concave/sliver clipped cells.
  - **One polygon clipper instead of two.** The MGRS-specific
    `clipPolygonToRect` has been removed in favour of the general
    `clipPolygonToConvex` (now with a built-in bbox-disjoint fast path).
    Benchmarks show the general version is faster on the half-overlap case
    and competitive on fast-exit cases.
  - **One polyline clipper API.** `clipPolylineToPolygon` and the
    internal-only `clipPolylineFlat` have collapsed into a single
    flat-coordinate function (the form OL geometries already give you via
    `getFlatCoordinates()`). The dead `rings` parameter has been removed.
  - **Shared `polygonArea` / `signedArea` / `densifyAndProject` helpers.**
    Previously duplicated between core and MGRS; now exported once from
    `@zwaarcontrast/ol-graticule` and consumed by MGRS via the package
    dependency. `signedArea` delegates to OL's `linearRing` (translation-
    relative shoelace) for better numerical stability on large-coord
    projections such as Web Mercator.
  - **Pervasive switch to `ol/extent` for bbox math.** Hand-rolled
    `minX/minY/maxX/maxY` loops across the clipping helpers, util/geo,
    MGRS, marinequadratkarte, heeresgitter, and test-utils have all been
    replaced with `boundingExtent`, `createEmpty` + `extendXY`,
    `createOrUpdateFromFlatCoordinates`, `intersects`, and `containsExtent`
    from OpenLayers. The duplicated `transformExtentSampled` /
    `sampleLatLonRectInUtm_` logic in core and MGRS is now a single shared
    helper that MGRS wraps with its antimeridian edge-nudging.
  - **Internal types aligned with OpenLayers.** Clipping and area helpers
    now take and return `Coordinate` (= OL's `number[]`) so they compose
    naturally with the rest of the OL geometry surface.
    `GridCellLabel.cellRing` is now `Coordinate[]` to match.
  - **New test + bench coverage.** Added an internal `@zwaarcontrast/test-utils`
    package (viewport-invariant helpers, shared fixtures), Playwright e2e
    smoke + profiling suites across the demos, and unit/bench coverage
    across heeresgitter, formatters, clipping, transform/render caches,
    and projection scratch buffers.

  **Breaking changes**
  - `inspectBboxRelToRect`, `clipPolygonToRect`, and `polygonCentroid` are
    no longer exported. Use `intersects`/`containsExtent` from `ol/extent`,
    `clipPolygonToConvex` with a 4-vertex rect ring, and
    `Polygon.getFlatInteriorPoint()` respectively.
  - `clipPolylineToPolygon` now takes flat coordinates
    (`flatCoordinates, offset, end, stride, index, scratch?`) instead of a
    tuple polyline + rings. The dead `rings` parameter is gone.
  - `clipPolygonToConvex`, `signedArea`, `polygonArea` now take
    `Coordinate[]` (mutable) rather than `ReadonlyArray<readonly [number, number]>`.
  - `GridCellLabel.cellRing` is `Coordinate[]` rather than
    `ReadonlyArray<readonly [number, number]>`.
  - `polygonArea` / `polygonCentroid` are no longer exported from
    `@zwaarcontrast/ol-graticule-mgrs` — import from
    `@zwaarcontrast/ol-graticule` instead.

## 2.3.1

## 2.3.0

## 2.2.0

## 2.1.3

## 2.1.2

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

## 2.1.1

## 2.1.0

### Minor Changes

- ce473c8: Add `parseCoordinate` for typed coordinate input — wire a search box up to
  `gridSystem.parseCoordinate(text, projection)` and fly the map to a typed
  reference. All built-in grid systems and formatters support it; parsing is
  lenient (DMS/DDM/DD with hemisphere markers, metric pairs with km/m
  suffixes, MBS letter-cells like `vK 617 517`, RD `155 463 km`).
  - New: `ParseError` (thrown on unparseable input) and `parseCoordinate` on
    every built-in `GridSystem` (`Geographic`, `Projected`, `Pixel`,
    `PolygonClipped`, plus the MBS factories via `Projected`).
  - New: `parse` and `parseCoordinate` on `DegreeFormatter`, `MetricFormatter`,
    `PixelFormatter`, `MBSFormatter`. `DegreeFormatter` routes hemisphere
    markers internally; `MetricFormatter` accepts trailing units that apply
    to both halves (`"155 463 km"`) or per-half units (`"500 km 5000 km"`).
  - New utility exports: `splitCoordinatePair`, `parsePairViaFormatter`,
    `parseLinear`.
  - Each demo gains a coordinate-input widget exercising the parser.

## 2.0.0

## 1.0.0

### Minor Changes

- be0c565: Initial public release. Five packages covering everything from a generic
  graticule layer to historical artillery grids.
  - **`@zwaarcontrast/ol-graticule`** — flexible OpenLayers graticule layer
    with a pluggable `GridSystem` strategy plus a `CursorPositionControl`.
    Built-in `PixelGridSystem` (for IIIF image-pixel grids) and
    `GeographicGridSystem` (EPSG:4326, no proj4 needed). Ships with
    `DegreeFormatter` / `MetricFormatter` / `PixelFormatter`,
    `DegreeIntervals` / `MetricIntervals` / `PixelIntervals` zoom-adaptive
    strategies, and `PolygonClippedGridSystem` for irregular coverage.
    Implement the small `GridSystem` interface to draw any grid describable
    in code.
  - **`@zwaarcontrast/ol-graticule-projected`** — generic `ProjectedGridSystem`
    for any proj4 CRS (UTM, state plane, national grids). Includes
    `registerCRS` (idempotent proj4 + OL registration) and `loadNadgrid`
    (NTv2 datum-shift grid loader with `ArrayBuffer` / `URL` / URL-string
    sources, cached per name).
  - **`@zwaarcontrast/ol-graticule-mgrs`** — Military Grid Reference System
    (NATO grid) over UTM, world-wide. Grid Zone Designators (`6° × 8°`
    cells, `12°`-tall `X` band) with the standard Norway and Svalbard
    exceptions; 100 km cell labels using the modern WGS84 lettering scheme.
    Per-zone interior grid lines clipped via Liang-Barsky so a single clean
    line draws at every zone boundary. Cell labels positioned at the centroid
    of each cell's GZD-clipped lat/lon footprint to prevent adjacent-zone
    label collisions at high latitudes. Cursor reads out a full MGRS
    reference at 1 m precision; `lonLatToMgrs` / `lonLatToMgrsParts` /
    `formatMgrs` exported for direct use.
  - **`@zwaarcontrast/ol-graticule-rd`** — Dutch RD Amersfoort grids
    (EPSG:28991 Old, EPSG:28992 New). **Bundles RDNAPTRANS 2018** — the
    authoritative Kadaster NTv2 datum-shift grid — inlined as base64 inside
    the package's JS. Sub-centimetre accurate with zero bundler
    configuration. `+towgs84` fallback uses canonical EPSG:4833 parameters
    (~1 m accuracy) if the grid is unregistered. Factories are synchronous;
    the full NL area-of-use polygon is baked in.
  - **`@zwaarcontrast/ol-graticule-modified-british-system`** — WWII Modified
    British System letter-cell artillery grids for **ten theatres**
    documented on Thierry Arsicaud's
    [Echo Delta](https://www.echodelta.net/mbs/eng-welcome.php), without
    whose decades of archival research this package would not exist:
    Nord de Guerre, French Lambert I/II/III, British Cassini (Delamere),
    Irish Cassini (Lough Foyle), War Office Cassini (Dunnose, period-correct
    for actual WWII GSGS sheets, sourced from Hellyer _Sheetlines_ 55),
    Scandinavian Zone 3, Italian Northern, Italian Southern, Iberian
    Peninsula. Each theatre ships with hand-traced coverage polygon,
    pre-wired letter scheme, and 100 km / 20 km interval strategy.
    Includes shared family-letter constants for building custom theatres.

  **Not in this release:**
  `@zwaarcontrast/ol-graticule-marinequadratkarte` (WWII Kriegsmarine naval
  grid, ported from Jan Kockrow's [navalgrid.com](https://www.navalgrid.com/))
  — functional but held back pending resolution of the upstream
  cljs-navalgrid licensing. See the package's `LICENSE.TODO.md`.
