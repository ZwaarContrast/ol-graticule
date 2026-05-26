---
"@zwaarcontrast/ol-graticule-heeresgitter": minor
---

Add `GeographicHmnGridSystem`, the lat/lon-bounded variant of the
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
