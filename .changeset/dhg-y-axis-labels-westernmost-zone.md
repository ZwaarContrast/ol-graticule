---
"@zwaarcontrast/ol-graticule-heeresgitter": minor
---

`DhgGridSystem`: fix duplicated Y-axis (northing) labels in `tiled` mode.
Previously every visible DHG zone contributed its own northing labels
along the viewport's left edge, producing pairs (or triples) of the same
label stacked at slightly different vertical positions because adjacent
zones project the same latitude to slightly different northings. The
viewport's left edge now sources its Y-axis labels from one zone only:
the westernmost active zone, whose 6° strip is the one actually at the
left edge. X-axis (easting) labels are unaffected — each zone continues
to contribute its own eastings across the top edge in its own longitude
range.
