---
"@zwaarcontrast/ol-graticule-modified-british-system": minor
---

Apply empirical Helmert shift to Nord de Guerre proj4 by default.

EPSG and IGN publish no transformation from ATF (Paris) to WGS84 — PROJ
falls back to a "ballpark" no-shift operation, off by ~100 m across the
Western Front. `NORD_DE_GUERRE_PROJ4` now carries
`+towgs84=1383.8,38.7,392,0,0,0,0`, derived by Bill Sayers from 13 WWI
Initial Point survey plats (residuals: 10/13 within 20 m). Source: [The
Wandering Cartographer, *Transforming French WW1 Lambert Coordinates to
WGS84*](https://wanderingcartographer.wordpress.com/2024/01/16/transforming-french-ww1-lambert-coordinates-to-wgs84/).

**Behaviour change:** `EPSG:27500 ↔ EPSG:4326` round-trips now shift by
~100 m relative to prior versions — the new positions are closer to
truth, but if you have downstream data calibrated against the old
output, opt out with `createNordDeGuerreGridSystem({ towgs84: null })`.

**New API:**

- `createNordDeGuerreGridSystem({ towgs84 })` — `undefined` (default),
  `null` (canonical EPSG:27500, no shift), or a 3- or 7-element Helmert
  array.
- `NORD_DE_GUERRE_DEFAULT_TOWGS84` is now exported.
