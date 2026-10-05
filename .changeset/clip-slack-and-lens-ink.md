---
'@zwaarcontrast/ol-graticule': patch
---

Fix two clipped-grid rendering defects.

Grid lines that run along a snapped coverage edge (the MBS theatre staircases,
the GSGS per-grid validity edges) were chopped into fragments when zoomed out,
because the clip ring was inflated by a fixed ground distance while a line's own
densification error is a fixed fraction of a pixel. The slack is now measured in
screen pixels, capped at 5% of the snap interval, so an edge line survives whole
at every zoom.

The WebGL hover lens drew every grid's swell and crossing dots in the first
grid's ink; each grid now lenses in its own colour, matching Canvas. Its
crossing holes and cell size are no longer overwritten by the last grid built,
and multi-touch no longer double-draws the swell.
