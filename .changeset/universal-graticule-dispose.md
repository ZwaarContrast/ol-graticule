---
'@zwaarcontrast/ol-graticule': patch
---

`UniversalGraticule.dispose()` now disposes the layer it wraps, freeing the
WebGL layer's context, atlas and buffers.
