# Changelog

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
