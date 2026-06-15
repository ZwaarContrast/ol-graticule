---
"@zwaarcontrast/ol-graticule": minor
---

Add an optional pointer "hover lens". As the cursor moves over the grid, lines
swell toward it and taper away in all directions, with a clear hole at the
crossing under the pointer so the aim point stays uncovered. Enable it through
`GraticuleStyle.hoverLens`, or toggle it at runtime with
`UniversalGraticule.setHoverLens`; omit it or pass `false` to disable.
