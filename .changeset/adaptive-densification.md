---
"@zwaarcontrast/ol-graticule": minor
---

Adaptive grid-line densification. Grid lines are now sampled only where they
curve in the view projection: straight lines collapse to 2 points and points
cluster where the line bends, cutting coordinate-transform work during pan and
zoom. PolygonClippedGridSystem snap mode no longer re-densifies every line each
render, which made rapid scroll-zoom on clipped grids (e.g. MBS) far smoother.

Low-level gridline helpers changed as part of this: `adaptiveAxisTs` and
`uniformTs` replace `densifyCount`, and `pushAxisGridLineSpecs`,
`emitFlatLineFeatures`, and `FlatLineSpec` now take per-axis `t` samples instead
of a point count.
