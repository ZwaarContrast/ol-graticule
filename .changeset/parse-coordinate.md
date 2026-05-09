---
'@zwaarcontrast/ol-graticule': minor
'@zwaarcontrast/ol-graticule-projected': minor
'@zwaarcontrast/ol-graticule-modified-british-system': minor
'@zwaarcontrast/ol-graticule-rd': minor
'@zwaarcontrast/ol-graticule-mgrs': minor
---

Add `parseCoordinate` for typed coordinate input — wire a search box up to
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
