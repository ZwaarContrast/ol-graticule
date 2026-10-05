---
'@zwaarcontrast/ol-graticule-os': minor
---

Initial release. Historical Ordnance Survey grids, starting with the 1930s yard
grid of Great Britain: transverse Mercator from 49°N 2°W on Airy, scale reduced
by one part in 2500, false origin 1 000 000 yards west and south, as printed on
the One-inch Fifth and Quarter-inch Fourth Editions. Clipped to the Quarter-inch
Fourth Edition sheet faces (Great Britain with Orkney and Shetland), with
full-figure yard labels.

`createOSYardGridSystem()` builds it, `OS_GRIDS` holds it keyed by CRS, and the
CRS, proj4 string, validity rings and `YardFormatter` are exported ol-free from
`/headless`.
