---
'@zwaarcontrast/ol-graticule-nei': minor
---

Initial release. Netherlands East Indies WWII grids on the Batavia datum
(Bessel 1841, EPSG:8452 shift to WGS84): the NEI Southern Zone (Java and the
Lesser Sundas, Lambert conformal conic on 8°S 110°E) and the NEI Equatorial
Zone (EPSG:3001, Mercator on 110°E), each clipped to its published limits.

`NEI_GRIDS` holds both zones keyed by CRS, with
`createNEISouthernZoneGridSystem` and `createNEIEquatorialZoneGridSystem`
building them; the CRS codes, proj4 strings and validity rings are exported
ol-free from `/headless`.
