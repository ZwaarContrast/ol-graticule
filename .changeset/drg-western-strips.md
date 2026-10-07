---
'@zwaarcontrast/ol-graticule-heeresgitter': patch
---

DRG strips west of Greenwich: Kennziffern now run modulo 120, so 60–119 are
the strips from 180° to 3°W, and Kennziffer 119 is the strip on 3°W. A German
1:10 000 sheet of Accrington prints "Streifen 3° westl. Greenwich, Kennziffer
119" with eastings like `119541`; such sheets previously failed with a
RangeError. Grids and strip lookups now hand over from strip 119 to strip 0
across Greenwich.
