---
"@zwaarcontrast/ol-graticule-modified-british-system": minor
---

Add `NORD_DE_GUERRE_BBOX_WGS84`. Every other MBS family already published a
WGS84 bbox; Nord de Guerre had only projected metres, so it was the one family a
consumer could not give a lon/lat validity to.

It is derived by projecting `NORD_DE_GUERRE_CLIP_POLYGON` out of EPSG:27500
(1.00°W to 20.49°E, 46.10°N to 56.50°N) and rounding outward, with tests
asserting it contains every vertex of that polygon and the theatre's obvious
cities.

Deriving rather than copying matters here: this grid is EPSG:27500, the French
civil definition with a false easting of 500 000, while the British wartime Nord
de Guerre Zone re-origined to 600 000. The same projected metres name ground
100 km apart in the two conventions, so a bbox borrowed from the wartime grid
would be wrong by that much.
