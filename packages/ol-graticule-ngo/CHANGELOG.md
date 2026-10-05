# @zwaarcontrast/ol-graticule-ngo

## 0.2.0

### Minor Changes

- 926ead5: Initial release. The Norwegian Gauss-Krüger strips ("norweg. Gitterstreifen")
  as German 1:50 000 sheets of Norway print them: all eight strips (I to VIII),
  each transverse Mercator from the Oslo meridian on the modified Bessel
  ellipsoid, with the sheets' own origins and false co-ordinates. Every strip is
  checked against a scanned sheet to within 25 m.

  `NGO_GRIDS` holds every strip keyed by CRS, `createNGOStripGridSystem(strip)`
  builds one, and `NGO_STRIPS` is exported ol-free from `/headless`.

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
