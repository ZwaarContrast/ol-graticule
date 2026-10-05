---
'@zwaarcontrast/ol-graticule': patch
'@zwaarcontrast/ol-graticule-projected': patch
'@zwaarcontrast/ol-graticule-mgrs': patch
'@zwaarcontrast/ol-graticule-luftwaffe-planquadrat': patch
'@zwaarcontrast/ol-graticule-heeresgitter': patch
---

Build against OpenLayers 10.11, whose `getTransform` may return `null` and
`Map.getViewport()` may return `undefined`. A missing transform now throws a
clear error naming both projections.
