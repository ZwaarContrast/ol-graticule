# @zwaarcontrast/ol-graticule-os

## 0.2.0

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
