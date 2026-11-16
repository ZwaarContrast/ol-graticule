# Changelog

## 4.0.1

### @zwaarcontrast/ol-graticule

No changes in this release.

### @zwaarcontrast/ol-graticule-heeresgitter

### Patch Changes

- d4024d0: Document that the default Potsdam datum shift is only right for sheets drawn
  from German survey: German sheets of other countries carry the local survey's
  datum (a Finnish sheet is about 445 m off with the Potsdam shift). Also
  documents `setDhgDatumShift`, the ellipsoid limit of a substituted
  `datumShift`, and the rotation convention `DatumShift` expects.
- 5bc742c: DRG strips west of Greenwich: Kennziffern now run modulo 120, so 60–119 are
  the strips from 180° to 3°W, and Kennziffer 119 is the strip on 3°W. A German
  1:10 000 sheet of Accrington prints "Streifen 3° westl. Greenwich, Kennziffer
  119" with eastings like `119541`; such sheets previously failed with a
  RangeError. Grids and strip lookups now hand over from strip 119 to strip 0
  across Greenwich.

### @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

No changes in this release.

### @zwaarcontrast/ol-graticule-mgrs

No changes in this release.

### @zwaarcontrast/ol-graticule-modified-british-system

No changes in this release.

### @zwaarcontrast/ol-graticule-projected

No changes in this release.

### @zwaarcontrast/ol-graticule-rd

No changes in this release.

## 4.0.0

### @zwaarcontrast/ol-graticule

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

- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

- 28d9a14: Add an optional pointer "hover lens". As the cursor moves over the grid, lines
  swell toward it and taper away in all directions, with a clear hole at the
  crossing under the pointer so the aim point stays uncovered. Enable it through
  `GraticuleStyle.hoverLens`, or toggle it at runtime with
  `UniversalGraticule.setHoverLens`; omit it or pass `false` to disable.

### Patch Changes

- 579f34a: Fix two clipped-grid rendering defects.

  Grid lines that run along a snapped coverage edge (the MBS theatre staircases,
  the GSGS per-grid validity edges) were chopped into fragments when zoomed out,
  because the clip ring was inflated by a fixed ground distance while a line's own
  densification error is a fixed fraction of a pixel. The slack is now measured in
  screen pixels, capped at 5% of the snap interval, so an edge line survives whole
  at every zoom.

  The WebGL hover lens drew every grid's swell and crossing dots in the first
  grid's ink; each grid now lenses in its own colour, matching Canvas. Its
  crossing holes and cell size are no longer overwritten by the last grid built,
  and multi-touch no longer double-draws the swell.

- f975503: Relax the adaptive densification tolerance from 0.25 px to 0.5 px. Grid lines
  are densified until they sit within this distance of the true projected curve,
  so this halves the vertex count on curved lines at the cost of up to half a
  pixel of deviation. Pass a smaller `maxDevPx` to `adaptiveAxisTs` to restore the
  previous fidelity.

  `LruCache.get` also skips MRU promotion while the cache is below capacity, where
  nothing can be evicted yet.

- af14ae4: fix: remove redundant unanchored `\s*` from PixelFormatter pixel-suffix strip, eliminating a polynomial-ReDoS backtracking path (no behavior change)
- ea57c4e: Build against OpenLayers 10.11, whose `getTransform` may return `null` and
  `Map.getViewport()` may return `undefined`. A missing transform now throws a
  clear error naming both projections.
- c901af8: `UniversalGraticule.dispose()` now disposes the layer it wraps, freeing the
  WebGL layer's context, atlas and buffers.

### @zwaarcontrast/ol-graticule-heeresgitter

### Major Changes

- 24941be: **Breaking:** `proj4` moves from `dependencies` to `peerDependencies`, matching
  every other package in the monorepo. Install it alongside this package:

  ```bash
  npm install @zwaarcontrast/ol-graticule-heeresgitter proj4
  ```

  proj4 keeps its CRS registry in module-level state. This package registers its
  Gauß-Krüger strip definitions through `registerCRS` from
  `@zwaarcontrast/ol-graticule-projected` (a peer, so it uses the caller's proj4),
  then projects through its own `proj4` import. As a plain dependency those two
  could resolve to separate copies, leaving the strip definition registered on one
  instance and looked up on the other, so the transform failed. A peer guarantees
  one shared instance.

### Minor Changes

- 579f34a: Anchor the DRG (3° Reichsgitter) specification to the Planheft. Its _Das Deutsche Reichsgitter_ section (Planheft Schweiz OKH g 23/1 p. C 3, same text in Planheft Osteuropa Merkblatt 34/31b) states every projection parameter the package already used, so the DRG now rests on two independent sources rather than on sheet 5503 Elsenborn alone. The Planheft also tabulates exactly five strips, central meridians 3° to 15°E against Kennziffern 1-5, in the Osteuropa edition too, so `DRG_PUBLISHED_KENNZIFFERN` and `isPublishedDrgKennziffer()` are exported to separate a strip the sources attest from one the formula merely admits. The published list is documented as a fact to know rather than a filter to run: a sheet printing an unlisted Kennziffer is the only evidence that could extend the list, so a check built on it would reject exactly that sheet. The 10' strip overlap is now marked as the one unsourced DRG constant, with the Planheft passage that appears to contradict it recorded beside it.
- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

- c1ab985: Add the **Deutsches Reichsgitter** (DRG), the Gauß-Krüger 3°-strip grid printed
  on German Reich map sheets before the 6° Heeresgitter replaced it. Same Bessel
  1841 / Potsdam family and the same `k=1`, but the strips are 3° wide, the
  Kennziffer is the central meridian divided by 3, and it is carried as the
  leading digit of the Rechtswert rather than quoted separately: false easting is
  `Kennziffer × 1 000 000 + 500 000`, so a corner label reading `2512` is strip 2
  (CM 6° E), Rechtswert 512 km. Strips 2–5 match EPSG:31466–31469.

  New exports: `DrgGridSystem`, `encodeDrg`, `encodeDrgText`, `decodeDrg`,
  `parseDrg`, `formatDrgEasting`, `formatDrgNorthing`, the `drg*` zone and
  projection helpers, and the `DrgCoord` / `DrgZone` types. Labels follow the
  sheet's _Planzeiger_ rules: kilometres on grid lines (`2512`, or `12` in the
  _kurz_ form), metres for point references, Rechtswert first.

  Encoding and geometry are anchored to sheet 5503 (3207 alt) Elsenborn,
  _Planblatt A_, Geheim, Sonderdruck der Heeresplankammer, Stand 1.10.1939, whose
  printed grid runs 2512–2523 km east and 5585–5595 km north. Note that a sheet's
  printed graticule is Potsdam/Bessel, not WGS 84; `encodeDrg` takes WGS 84 and
  applies the Helmert shift, which moves a corner by roughly 130 m in the Eifel.

### Patch Changes

- 4fa53bb: fix: remove ambiguous `\s*` overlap in the HMN label pattern, eliminating a polynomial-ReDoS backtracking path (no behavior change)
- ea57c4e: Build against OpenLayers 10.11, whose `getTransform` may return `null` and
  `Map.getViewport()` may return `undefined`. A missing transform now throws a
  clear error naming both projections.
- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

### @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

### Minor Changes

- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

### Patch Changes

- ea57c4e: Build against OpenLayers 10.11, whose `getTransform` may return `null` and
  `Map.getViewport()` may return `undefined`. A missing transform now throws a
  clear error naming both projections.
- Updated dependencies [6b960f9]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0

### @zwaarcontrast/ol-graticule-mgrs

### Minor Changes

- 24941be: Raise the `proj4` peer range from `^2.9.0` to `^2.12.0`, matching the `^2.12.0`
  that `ol-graticule-heeresgitter` already declares.

  proj4 keeps its CRS registry in module-level state, so a consumer combining
  heeresgitter (which depends on proj4 directly) with these packages could resolve
  two proj4 copies when the ranges did not overlap, leaving definitions registered
  through one copy invisible to the other. A single range across the monorepo
  dedupes to one instance.

- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

### Patch Changes

- ea57c4e: Build against OpenLayers 10.11, whose `getTransform` may return `null` and
  `Map.getViewport()` may return `undefined`. A missing transform now throws a
  clear error naming both projections.
- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

### @zwaarcontrast/ol-graticule-modified-british-system

### Minor Changes

- 24941be: Raise the `proj4` peer range from `^2.9.0` to `^2.12.0`, matching the `^2.12.0`
  that `ol-graticule-heeresgitter` already declares.

  proj4 keeps its CRS registry in module-level state, so a consumer combining
  heeresgitter (which depends on proj4 directly) with these packages could resolve
  two proj4 copies when the ranges did not overlap, leaving definitions registered
  through one copy invisible to the other. A single range across the monorepo
  dedupes to one instance.

- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

- 579f34a: Add `NORD_DE_GUERRE_BBOX_WGS84`. Every other MBS family already published a
  WGS84 bbox; Nord de Guerre had only projected metres, so it was the one family a
  consumer could not give a lon/lat validity to.

  It is derived by projecting `NORD_DE_GUERRE_CLIP_POLYGON` out of EPSG:27500
  (1.00°W to 20.49°E, 46.10°N to 56.50°N) and rounding outward, with tests
  asserting it contains every vertex of that polygon and the theatre's obvious
  cities.

  Deriving rather than copying matters here: this grid is EPSG:27500, the French
  civil definition with a false easting of 500 000, while the British wartime Nord
  de Guerre Zone re-origined to 600 000. The same projected metres name ground
  100 km apart in the two conventions, so a bbox borrowed from the wartime grid
  would be wrong by that much.

### Patch Changes

- fa9475c: fix: remove `\s*` that overlapped `[\d\s]*` in the MBS compound-reference pattern, eliminating a polynomial-ReDoS backtracking path (no behavior change)
- 55201f5: refactor: extract a shared MBS grid factory, collapsing the duplicated theatre wiring across the nine grid modules into createMBSGridSystem and assembleMBSGridSystem (no public API change)
- 579f34a: Pin the Irish Cassini false northing to the sheet that states it, after a
  proposal to change it from 250 000 to 425 661 m.

  GSGS 3982 Ireland Sheet 3 Dublin (2nd ed. 2.1942) says its position twice, and
  both agree with 250 000: the margin works an example — "Full Co-ordinates of
  BALLIVOR 269254", i.e. 269 km E / 254 km N, where this definition gives
  269.6 / 254.2 — and the west margin labels a 300 km northing line just below the
  54° parallel, where this definition puts 305.6 km. The proposed value would make
  that same sheet read 269430 and label its margin ~480.

  GSGS 4136 Ireland One Inch sheet 307 confirms it from a second series: its NW
  corner is printed W. Lon 7°59' / Lat 55°1' and its west margin labels that spot
  "420,000 m.N.", where this definition gives 418.8 km. The proposed value would
  need that margin to read 595,000.

  It also agrees with the War Office's 1948 grid-systems diagram, which draws the
  Irish Grid's 500 km northing across northern Ireland: 250 000 puts that line at
  55.75°N, just off the north coast, where 425 661 would put it at 54.17°N,
  through the middle of the island.

  Both checks are now tests, so the value cannot be quietly changed back.

- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

### @zwaarcontrast/ol-graticule-projected

### Minor Changes

- 24941be: Raise the `proj4` peer range from `^2.9.0` to `^2.12.0`, matching the `^2.12.0`
  that `ol-graticule-heeresgitter` already declares.

  proj4 keeps its CRS registry in module-level state, so a consumer combining
  heeresgitter (which depends on proj4 directly) with these packages could resolve
  two proj4 copies when the ranges did not overlap, leaving definitions registered
  through one copy invisible to the other. A single range across the monorepo
  dedupes to one instance.

- f975503: Add an optional `getCellInterval` to `IntervalStrategy`, so a grid whose label
  cells are a fixed size (a 100 km lettered cell over a finer km grid) can
  enumerate cell labels on their own interval instead of once per major-line cell.
  Optional, so existing strategies are unaffected.

  `ProjectedGridSystem` also caches transformed grid-line polylines across pan
  within a zoom band, re-slicing them instead of re-projecting every frame.

- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

- c054d7f: Add `createProjectedGridSystemFromEPSG(code, options)`: a projected grid for
  any EPSG code, fetched at runtime. The proj4 definition comes from epsg.io
  (datum shifts included) and the EPSG area of use from spatialreference.org;
  the grid is clipped to that area. Lookups are cached per code for the session,
  and a code already registered with proj4 is not fetched again. A `+nadgrids`
  shift becomes `+nadgrids=@grid,@null`, so it applies once `loadNadgrid` has
  loaded the grid and falls back to no shift until then. `sources` overrides
  where definitions and areas of use are fetched from.

  `lookupEPSG(code)` returns the spatialreference.org record for a code, through
  the same cache: name, type, area of use in words and as a box, scope, and the
  axes with their units. A CRS that lists several usages reports the first, so
  its grid is clipped too. A code neither service knows rejects with
  `Unknown EPSG code: <code>`.

### Patch Changes

- ea57c4e: Build against OpenLayers 10.11, whose `getTransform` may return `null` and
  `Map.getViewport()` may return `undefined`. A missing transform now throws a
  clear error naming both projections.
- Updated dependencies [6b960f9]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0

### @zwaarcontrast/ol-graticule-rd

### Minor Changes

- 24941be: Raise the `proj4` peer range from `^2.9.0` to `^2.12.0`, matching the `^2.12.0`
  that `ol-graticule-heeresgitter` already declares.

  proj4 keeps its CRS registry in module-level state, so a consumer combining
  heeresgitter (which depends on proj4 directly) with these packages could resolve
  two proj4 copies when the ranges did not overlap, leaving definitions registered
  through one copy invisible to the other. A single range across the monorepo
  dedupes to one instance.

- 0d86e43: Add an ol-free `/headless` subpath to every package. It exports the grid
  codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
  without importing `ol` anywhere in its graph, so it runs under plain Node and in
  workers. The main entry re-exports everything from `/headless`; nothing is
  removed from it.

  `@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
  with proj4 only) and `syncOlProjections` (push proj4's definitions into
  OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
  headless path registered first.

### Patch Changes

- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

## 3.0.0

### @zwaarcontrast/ol-graticule

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

### @zwaarcontrast/ol-graticule-heeresgitter

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0
  - @zwaarcontrast/ol-graticule-projected@3.0.0

### @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0

### @zwaarcontrast/ol-graticule-mgrs

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0
  - @zwaarcontrast/ol-graticule-projected@3.0.0

### @zwaarcontrast/ol-graticule-modified-british-system

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0
  - @zwaarcontrast/ol-graticule-projected@3.0.0

### @zwaarcontrast/ol-graticule-projected

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0

### @zwaarcontrast/ol-graticule-rd

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0
  - @zwaarcontrast/ol-graticule-projected@3.0.0

## 2.3.1

### @zwaarcontrast/ol-graticule-heeresgitter

### Patch Changes

- c97c7c4: Fix broken Romfo image on the npm package page. The Geographic HMN
  section of the README used a relative path (`images/romfo-geogr-hmn.jpg`)
  which works on GitHub but not on npm's package page (npm doesn't resolve
  relative links to the source repo). Switched to the same absolute
  `https://github.com/ZwaarContrast/ol-graticule/raw/main/...` URL pattern
  the rest of the README's images use.

## 2.3.0

### @zwaarcontrast/ol-graticule-heeresgitter

### Minor Changes

- ba8864d: Add `GeographicHmnGridSystem`, the lat/lon-bounded variant of the
  Heeresmeldenetz. Distinct from the existing `HmnGridSystem` (which is
  the DHG-metric planar variant): the geographic variant is identified on
  a wartime sheet by a `Heeresmeldenetz (geogr.)` header and tiles the
  world directly in `(lat, lon)` rather than on the DHG kilometre lattice.

  Spec (per Buchroithner & Pfahlbusch 2015, with the source paper's `1°N`
  anchor empirically corrected to `0°40'N` against the Bildplankarte E27O
  Romfo and an Atlantikwall sector overprint of the Dutch coast):
  - Großtrapez: 2°30' lon × 1°40' lat, anchored at (0°40'N, 0°E), stepping
    both directions.
  - Kleintrapez: 6' lon × 4' lat, 25 × 25 per Großtrapez, NW→SE letter
    pair (same `A..Z` minus `I` alphabet as the planar variant).
  - Meldetrapez: 2' lon × 1'20" lat, 3 × 3, digits `1..9` NW→SE.
  - Arbeitstrapez: 1' lon × 40" lat, 2 × 2, letters `a..d` NW→SE.
  - Optional 2-digit tenths suffix from the SW corner of the Arbeitstrapez
    (6" lon × 4" lat).

  Public API additions:
  - `GeographicHmnGridSystem` and `GeographicHmnGridSystemOptions`.
  - `encodeHmnGeo`, `decomposeHmnGeo`, `formatHmnGeo` for forward
    encoding.
  - `parseHmnGeo` (with `ParseHmnGeoOptions`) for parsing a canonical
    reference back to a bounding box, centre, and Großtrapez. Like the
    planar `parseHmn`, the caller supplies an explicit `grosstrapez` or
    a `near` location to disambiguate the Großtrapez-wide `AA..ZZ` repeat.
  - `hmnGeoHierarchicalLabel` and `HmnGeoRenderDepth` for renderer
    integration.
  - Type aliases `DecodedHmnGeoRef`, `Grosstrapez`, `HmnGeoEncodeOptions`.
  - Arcsecond constants (`GROSSTRAPEZ_LON_SEC` / `GROSSTRAPEZ_LAT_SEC` /
    `KLEINTRAPEZ_LON_SEC` / `KLEINTRAPEZ_LAT_SEC` / `MELDETRAPEZ_LON_SEC`
    / `MELDETRAPEZ_LAT_SEC` / `ARBEITSTRAPEZ_LON_SEC` /
    `ARBEITSTRAPEZ_LAT_SEC` / `TENTH_LON_SEC` / `TENTH_LAT_SEC` /
    `ANCHOR_LAT_SEC` / `ANCHOR_LON_SEC` / `ARCSEC_PER_DEG`) and per-level
    cell counts (`KLEIN_PER_GROSSTRAPEZ`, `MELDE_PER_KLEINTRAPEZ`,
    `ARBEIT_PER_MELDETRAPEZ`).

  Ground truths in the test suite: Den Haag → `TD`, Scheveningen → `SD`
  (both in Großtrapez `gx=1, gy=30`, NW corner `(52°20'N, 2°30'E)`); the
  Bildplankarte `E27O Romfo (Nordteil)` confirming Großtrapez `gx=3,
gy=37` with NW corner `(64°00'N, 7°30'E)` and the printed `NV..SX` block
  all landing in the same Großtrapez.

  Bug fix included: `GeographicHmnGridSystem`'s line-emit loop tolerates
  the ~1e-14 IEEE-754 drift that accumulates when stepping by
  non-terminating fractions like `240/3600` arcseconds; previously the
  topmost horizontal grid line could silently disappear when the
  extent's north edge sat near (but not exactly on) a cell boundary.

## 2.2.0

### @zwaarcontrast/ol-graticule-heeresgitter

### Minor Changes

- 14607a1: `DhgGridSystem`: fix duplicated Y-axis (northing) labels in `tiled` mode.
  Previously every visible DHG zone contributed its own northing labels
  along the viewport's left edge, producing pairs (or triples) of the same
  label stacked at slightly different vertical positions because adjacent
  zones project the same latitude to slightly different northings. The
  viewport's left edge now sources its Y-axis labels from one zone only:
  the westernmost active zone, whose 6° strip is the one actually at the
  left edge. X-axis (easting) labels are unaffected — each zone continues
  to contribute its own eastings across the top edge in its own longitude
  range.

## 2.1.3

### @zwaarcontrast/ol-graticule-heeresgitter

### Patch Changes

- 1b4b180: First public release of `@zwaarcontrast/ol-graticule-heeresgitter`:
  WWII Wehrmacht map reference grids for the `UniversalGraticule`.

  Two grid systems:
  - **Deutsches Heeresgitter (DHG)**, 6° Gauß-Krüger strips on the Bessel
    1841 ellipsoid via a 7-parameter Helmert shift. 60 zones (Kennziffer
    1..60) with Kennziffer-prefixed eastings (e.g. `"5600"` = zone 5,
    Rechtswert 600 km). Selectable behaviour at the 6° strip boundaries
    (`tiled` / `overlap` / `single`). An overview mode renders strip
    outlines and Kennziffer labels when zoomed out past the km-grid gate.
  - **Heeresmeldenetz (HMN)**, the letter-cell reporting overprint built
    on top of DHG. 6 km Kleinquadrate (letter pairs `AA..ZZ`, alphabet
    without `I`) → 2 km Meldetrapeze (digits 1..9) → 1 km Arbeitstrapeze
    (letters a..d), with an optional tenths suffix (e.g. `"PE 1b 52"`).

  Public API: `DhgGridSystem`, `HmnGridSystem`, `encodeDhg` / `parseDhg`
  (zone-prefixed and full-metre forms, comma / hyphen / underscore / slash
  separators), `encodeHmn` / `parseHmn` for round-trip parsing against a
  `near` hint or an explicit Großquadrat, and zone-math helpers
  (`zoneForLon`, `zoneByKennziffer`, `cmForKennziffer`,
  `zonesContainingLon`). Configurable datum shift via `setDhgDatumShift`
  for region-specific fidelity; the default BKG Rauenberg-Potsdam
  parameters are accurate to ~5 m globally, with each registered zone
  getting a shift-specific proj4 code so multiple instances with different
  shifts can coexist without overwriting one another.

  Sources: Planheft Schweiz (OKH g 23/1, 16 March 1944) for the zone
  arithmetic and validity envelope, with reference sheets Kolosjoki
  (1:50k), Owrutsch (1:300k), and Hadres (1:50k, Alpen- und
  Donau-Reichsgaue) used as ground truths in the test suite.

## 2.1.2

### @zwaarcontrast/ol-graticule

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

### @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

### @zwaarcontrast/ol-graticule-mgrs

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

### @zwaarcontrast/ol-graticule-modified-british-system

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

### @zwaarcontrast/ol-graticule-projected

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

### @zwaarcontrast/ol-graticule-rd

### Patch Changes

- 7feec96: Docs: every package now ships with a 1200 × 675 preview image at the
  top of its README (and as `og:image` / `twitter:image` on its demo page,
  so npm and Twitter / Open Graph cards render a proper visual). Image
  URLs are absolute GitHub raw URLs so they resolve on npmjs.com.

## 2.1.1

### @zwaarcontrast/ol-graticule-luftwaffe-planquadrat

### Patch Changes

- 0c94209: First public release of `@zwaarcontrast/ol-graticule-luftwaffe-planquadrat`:
  WWII Luftwaffe Planquadrat reference grids for the `UniversalGraticule`.

  Two grid systems:
  - **Gradnetzmeldeverfahren (GNMV)**, the Luftwaffe's hierarchical
    geographic grid. Six levels from the 10° Zusatzzahlgebiet (ZZG) down
    to the ~33" Arbeitstrapez, with selectable `pre-1943` (2×2 MelT and
    AT) and `post-1943` (3×3 MelT and AT) era.
  - **Jägermeldenetz (JMN)**, the fighter reporting network introduced
    on 1 May 1943. Replaces the GNMV Großtrapez with a 5°×10° Jagdtrapez
    (Nord / Süd halves) and a 20×20 letter-pair Mitteltrapez (AA..UU,
    with `I` omitted). Shares Kleintrapez, Meldetrapez, and Arbeitstrapez
    with the post-1943 GNMV.

  Public API: `LuftwaffeGridSystem` (renders both systems, progressively
  subdividing on zoom), `encodeGnmv([lat, lon], era?, depth?)`,
  `encodeJmn([lat, lon], depth?)`, `parseRef(text, era?)` for round-trip
  parsing back to a cell bbox plus centre, and the supporting types
  `LuftwaffeSystem`, `LuftwaffeEra`, `DecodedRef`, `GeoBox`, `LatLon`,
  `ParseResult`. Lenient input: case-insensitive, whitespace and `/`
  ignored, umlauts (`Süd` / `Sud` / `Sued`) and abbreviations (`O` / `SO`)
  all accepted. Auto-detects GNMV vs JMN when both grammars accept the
  input.

  No proj4 dependency; all transforms go through OL's built-in 4326
  conversion. Peers on `ol ^10` and `@zwaarcontrast/ol-graticule ^2`.

  Reference rules sourced from prwg.co.uk's Halifax JB837 page
  (Ron Birch) and aircrewremembered.com's "Luftwaffe Grid Reference
  System" article. Primary-source validation across NARA Abschussmeldung
  references near Katwijk (JMN, all six levels), Generalstab der
  Luftwaffe _Weltkarte K-34 Sofia_ (1942), Deutsche Heereskarte
  _I 35 NW Kreta_ (1942), and Bundesarchiv RL 12/143. See the package
  README for the worked examples and citation details.

## 2.1.0

### @zwaarcontrast/ol-graticule

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

### @zwaarcontrast/ol-graticule-mgrs

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

### @zwaarcontrast/ol-graticule-modified-british-system

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

### @zwaarcontrast/ol-graticule-projected

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

### @zwaarcontrast/ol-graticule-rd

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

### @zwaarcontrast/ol-graticule-mgrs

### Patch Changes

- @zwaarcontrast/ol-graticule@2.0.0
- @zwaarcontrast/ol-graticule-projected@2.0.0

### @zwaarcontrast/ol-graticule-modified-british-system

### Minor Changes

- a492278: Apply empirical Helmert shift to Nord de Guerre proj4 by default.

  EPSG and IGN publish no transformation from ATF (Paris) to WGS84 — PROJ
  falls back to a "ballpark" no-shift operation, off by ~100 m across the
  Western Front. `NORD_DE_GUERRE_PROJ4` now carries
  `+towgs84=1383.8,38.7,392,0,0,0,0`, derived by Bill Sayers from 13 WWI
  Initial Point survey plats (residuals: 10/13 within 20 m). Source: [The
  Wandering Cartographer, _Transforming French WW1 Lambert Coordinates to
  WGS84_](https://wanderingcartographer.wordpress.com/2024/01/16/transforming-french-ww1-lambert-coordinates-to-wgs84/).

  **Behaviour change:** `EPSG:27500 ↔ EPSG:4326` round-trips now shift by
  ~100 m relative to prior versions — the new positions are closer to
  truth, but if you have downstream data calibrated against the old
  output, opt out with `createNordDeGuerreGridSystem({ towgs84: null })`.

  **New API:**
  - `createNordDeGuerreGridSystem({ towgs84 })` — `undefined` (default),
    `null` (canonical EPSG:27500, no shift), or a 3- or 7-element Helmert
    array.
  - `NORD_DE_GUERRE_DEFAULT_TOWGS84` is now exported.

### Patch Changes

- @zwaarcontrast/ol-graticule@2.0.0
- @zwaarcontrast/ol-graticule-projected@2.0.0

### @zwaarcontrast/ol-graticule-projected

### Patch Changes

- @zwaarcontrast/ol-graticule@2.0.0

### @zwaarcontrast/ol-graticule-rd

### Patch Changes

- @zwaarcontrast/ol-graticule@2.0.0
- @zwaarcontrast/ol-graticule-projected@2.0.0

## 1.0.0

### @zwaarcontrast/ol-graticule

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

### @zwaarcontrast/ol-graticule-mgrs

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

### Patch Changes

- Updated dependencies [be0c565]
  - @zwaarcontrast/ol-graticule@1.0.0
  - @zwaarcontrast/ol-graticule-projected@1.0.0

### @zwaarcontrast/ol-graticule-modified-british-system

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

### Patch Changes

- Updated dependencies [be0c565]
  - @zwaarcontrast/ol-graticule@1.0.0
  - @zwaarcontrast/ol-graticule-projected@1.0.0

### @zwaarcontrast/ol-graticule-projected

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

### Patch Changes

- Updated dependencies [be0c565]
  - @zwaarcontrast/ol-graticule@1.0.0

### @zwaarcontrast/ol-graticule-rd

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

### Patch Changes

- Updated dependencies [be0c565]
  - @zwaarcontrast/ol-graticule@1.0.0
  - @zwaarcontrast/ol-graticule-projected@1.0.0

## 0.3.0

### @zwaarcontrast/ol-graticule-ngo

### Minor Changes

- e1acd98: Add `printedValidityWgs84` to every strip: where German sheets print it. It is
  the EPSG extent (`validityWgs84`) except where a sheet carries the strip past
  its EPSG boundary: Røgden and Trysil print strip III out to 2°10' east of Oslo
  (12°53' E). Grids are now clipped to the printed extent and `NGO_GRIDS`
  reports it, so near a boundary two strips can both contain a point, as on the
  sheets.

## 0.2.0

### @zwaarcontrast/ol-graticule-nei

### Minor Changes

- 4ecca0b: Initial release. Netherlands East Indies WWII grids on the Batavia datum
  (Bessel 1841, EPSG:8452 shift to WGS84): the NEI Southern Zone (Java and the
  Lesser Sundas, Lambert conformal conic on 8°S 110°E) and the NEI Equatorial
  Zone (EPSG:3001, Mercator on 110°E), each clipped to its published limits.

  `NEI_GRIDS` holds both zones keyed by CRS, with
  `createNEISouthernZoneGridSystem` and `createNEIEquatorialZoneGridSystem`
  building them; the CRS codes, proj4 strings and validity rings are exported
  ol-free from `/headless`.

### Patch Changes

- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

### @zwaarcontrast/ol-graticule-ngo

### Minor Changes

- 926ead5: Initial release. The Norwegian Gauss-Krüger strips ("norweg. Gitterstreifen")
  as German 1:50 000 sheets of Norway print them: all eight strips (I to VIII),
  each transverse Mercator from the Oslo meridian on the modified Bessel
  ellipsoid, with the sheets' own origins and false co-ordinates. Every strip is
  checked against a scanned sheet to within 25 m.

  `NGO_GRIDS` holds every strip keyed by CRS, `createNGOStripGridSystem(strip)`
  builds one, and `NGO_STRIPS` is exported ol-free from `/headless`.

### Patch Changes

- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

### @zwaarcontrast/ol-graticule-os

### Minor Changes

- 0a8dbfa: Initial release. Historical Ordnance Survey grids, starting with the 1930s yard
  grid of Great Britain: transverse Mercator from 49°N 2°W on Airy, scale reduced
  by one part in 2500, false origin 1 000 000 yards west and south, as printed on
  the One-inch Fifth and Quarter-inch Fourth Editions. Clipped to the Quarter-inch
  Fourth Edition sheet faces (Great Britain with Orkney and Shetland), with
  full-figure yard labels.

  `createOSYardGridSystem()` builds it, `OS_GRIDS` holds it keyed by CRS, and the
  CRS, proj4 string, validity rings and `YardFormatter` are exported ol-free from
  `/headless`.

### Patch Changes

- Updated dependencies [6b960f9]
- Updated dependencies [24941be]
- Updated dependencies [f975503]
- Updated dependencies [579f34a]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [0d86e43]
- Updated dependencies [28d9a14]
- Updated dependencies [ea57c4e]
- Updated dependencies [c054d7f]
- Updated dependencies [f975503]
- Updated dependencies [c901af8]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0
