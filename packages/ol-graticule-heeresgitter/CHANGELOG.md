# @zwaarcontrast/ol-graticule-heeresgitter

## 4.0.0

### Minor Changes

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
- Updated dependencies [6b960f9]
- Updated dependencies [f975503]
- Updated dependencies [f975503]
- Updated dependencies [af14ae4]
- Updated dependencies [28d9a14]
- Updated dependencies [f975503]
  - @zwaarcontrast/ol-graticule@4.0.0
  - @zwaarcontrast/ol-graticule-projected@4.0.0

## 3.0.0

### Patch Changes

- Updated dependencies [e397dfb]
  - @zwaarcontrast/ol-graticule@3.0.0
  - @zwaarcontrast/ol-graticule-projected@3.0.0

## 2.3.1

### Patch Changes

- c97c7c4: Fix broken Romfo image on the npm package page. The Geographic HMN
  section of the README used a relative path (`images/romfo-geogr-hmn.jpg`)
  which works on GitHub but not on npm's package page (npm doesn't resolve
  relative links to the source repo). Switched to the same absolute
  `https://github.com/ZwaarContrast/ol-graticule/raw/main/...` URL pattern
  the rest of the README's images use.

## 2.3.0

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
