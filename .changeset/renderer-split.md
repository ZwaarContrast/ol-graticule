---
"@zwaarcontrast/ol-graticule": major
---

Split rendering into a Canvas 2D and a WebGL backend, with `UniversalGraticule`
as a thin facade over both. This decouples the grid logic from the rasterizer so
a non-OpenLayers backend (MapLibre) can be added without touching grid systems.

**Breaking:** `UniversalGraticule` now extends `LayerGroup` instead of
`VectorLayer`. `map.addLayer(graticule)` is unchanged, and `getGridSystem`,
`setGridSystem` and `setHoverLens` all still work, but the `VectorLayer` surface
is gone: `getSource()`, `setStyle()`, `getFeatures()`, the `postrender` event,
and the `style`, `declutter`, `renderBuffer`, `updateWhileAnimating` and
`updateWhileInteracting` options. `UniversalGraticuleOptions` now takes
`LayerGroup` options (`opacity`, `visible`, `extent`, `zIndex`, `minResolution`,
`maxResolution`, `minZoom`, `maxZoom`, `properties`) plus the graticule config.

If you relied on the layer internals, construct `CanvasGraticuleLayer` directly
to pin the old single-layer behaviour.

New `renderer` option: `'auto'` (default) probes for WebGL 2 and falls back to
canvas when it is absent or software-rendered, `'gl'` and `'canvas'` force a
backend. `CanvasGraticuleLayer` and `WebGLGraticuleLayer` are exported for
callers that want to skip the probe.

Adds `@mapbox/tiny-sdf` as a dependency, used to build the SDF glyph atlas for
GPU label rendering.
