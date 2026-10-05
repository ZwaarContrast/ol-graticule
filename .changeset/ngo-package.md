---
'@zwaarcontrast/ol-graticule-ngo': minor
---

Initial release. The Norwegian Gauss-Krüger strips ("norweg. Gitterstreifen")
as German 1:50 000 sheets of Norway print them: all eight strips (I to VIII),
each transverse Mercator from the Oslo meridian on the modified Bessel
ellipsoid, with the sheets' own origins and false co-ordinates. Every strip is
checked against a scanned sheet to within 25 m.

`NGO_GRIDS` holds every strip keyed by CRS, `createNGOStripGridSystem(strip)`
builds one, and `NGO_STRIPS` is exported ol-free from `/headless`.
