---
'@zwaarcontrast/ol-graticule': minor
'@zwaarcontrast/ol-graticule-projected': minor
'@zwaarcontrast/ol-graticule-mgrs': minor
'@zwaarcontrast/ol-graticule-luftwaffe-planquadrat': minor
'@zwaarcontrast/ol-graticule-rd': minor
'@zwaarcontrast/ol-graticule-modified-british-system': minor
'@zwaarcontrast/ol-graticule-heeresgitter': minor
---

Add an ol-free `/headless` subpath to every package. It exports the grid
codecs (parsing, formatting, CRS definitions, validity rings and plane geometry)
without importing `ol` anywhere in its graph, so it runs under plain Node and in
workers. The main entry re-exports everything from `/headless`; nothing is
removed from it.

`@zwaarcontrast/ol-graticule-projected` adds `registerProj4` (register a CRS
with proj4 only) and `syncOlProjections` (push proj4's definitions into
OpenLayers afterwards). `registerCRS` now also syncs OpenLayers for a code the
headless path registered first.
