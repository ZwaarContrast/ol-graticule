---
"@zwaarcontrast/ol-graticule-heeresgitter": minor
---

Add the **Deutsches Reichsgitter** (DRG), the Gauß-Krüger 3°-strip grid printed
on German Reich map sheets before the 6° Heeresgitter replaced it. Same Bessel
1841 / Potsdam family and the same `k=1`, but the strips are 3° wide, the
Kennziffer is the central meridian divided by 3, and it is carried as the
leading digit of the Rechtswert rather than quoted separately: false easting is
`Kennziffer × 1 000 000 + 500 000`, so a corner label reading `2512` is strip 2
(CM 6° E), Rechtswert 512 km. Strips 2–5 match EPSG:31466–31469.

New exports: `DrgGridSystem`, `encodeDrg`, `encodeDrgText`, `decodeDrg`,
`parseDrg`, `formatDrgEasting`, `formatDrgNorthing`, the `drg*` zone and
projection helpers, and the `DrgCoord` / `DrgZone` types. Labels follow the
sheet's *Planzeiger* rules: kilometres on grid lines (`2512`, or `12` in the
*kurz* form), metres for point references, Rechtswert first.

Encoding and geometry are anchored to sheet 5503 (3207 alt) Elsenborn,
*Planblatt A*, Geheim, Sonderdruck der Heeresplankammer, Stand 1.10.1939, whose
printed grid runs 2512–2523 km east and 5585–5595 km north. Note that a sheet's
printed graticule is Potsdam/Bessel, not WGS 84; `encodeDrg` takes WGS 84 and
applies the Helmert shift, which moves a corner by roughly 130 m in the Eifel.
