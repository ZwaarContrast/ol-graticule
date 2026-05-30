---
"@zwaarcontrast/ol-graticule": major
---

Consolidated the clipping/geometry helpers around OpenLayers' own
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
