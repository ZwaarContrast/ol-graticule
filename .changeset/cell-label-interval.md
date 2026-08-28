---
"@zwaarcontrast/ol-graticule": minor
"@zwaarcontrast/ol-graticule-projected": minor
---

Add an optional `getCellInterval` to `IntervalStrategy`, so a grid whose label
cells are a fixed size (a 100 km lettered cell over a finer km grid) can
enumerate cell labels on their own interval instead of once per major-line cell.
Optional, so existing strategies are unaffected.

`ProjectedGridSystem` also caches transformed grid-line polylines across pan
within a zoom band, re-slicing them instead of re-projecting every frame.
