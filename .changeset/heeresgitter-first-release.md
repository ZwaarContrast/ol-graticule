---
"@zwaarcontrast/ol-graticule-heeresgitter": patch
---

First public release of `@zwaarcontrast/ol-graticule-heeresgitter`:
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
