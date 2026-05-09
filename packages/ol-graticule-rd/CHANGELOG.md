# @zwaarcontrast/ol-graticule-rd

## 2.0.0

### Patch Changes

- @zwaarcontrast/ol-graticule@2.0.0
- @zwaarcontrast/ol-graticule-projected@2.0.0

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

### Patch Changes

- Updated dependencies [be0c565]
  - @zwaarcontrast/ol-graticule@1.0.0
  - @zwaarcontrast/ol-graticule-projected@1.0.0
