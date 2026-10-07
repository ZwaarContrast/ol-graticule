---
'@zwaarcontrast/ol-graticule-ngo': minor
---

Add `printedValidityWgs84` to every strip: where German sheets print it. It is
the EPSG extent (`validityWgs84`) except where a sheet carries the strip past
its EPSG boundary: Røgden and Trysil print strip III out to 2°10' east of Oslo
(12°53' E). Grids are now clipped to the printed extent and `NGO_GRIDS`
reports it, so near a boundary two strips can both contain a point, as on the
sheets.
