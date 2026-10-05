# @zwaarcontrast/ol-graticule-nei

## 0.2.0

### Minor Changes

- 4ecca0b: Initial release. Netherlands East Indies WWII grids on the Batavia datum
  (Bessel 1841, EPSG:8452 shift to WGS84): the NEI Southern Zone (Java and the
  Lesser Sundas, Lambert conformal conic on 8°S 110°E) and the NEI Equatorial
  Zone (EPSG:3001, Mercator on 110°E), each clipped to its published limits.

  `NEI_GRIDS` holds both zones keyed by CRS, with
  `createNEISouthernZoneGridSystem` and `createNEIEquatorialZoneGridSystem`
  building them; the CRS codes, proj4 strings and validity rings are exported
  ol-free from `/headless`.

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
