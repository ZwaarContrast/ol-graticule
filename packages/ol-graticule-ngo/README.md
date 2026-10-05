# @zwaarcontrast/ol-graticule-ngo

The Norwegian Gauss-Krüger strips ("norweg. Gitterstreifen") as German WWII
1:50 000 sheets of Norway print them, for
[`@zwaarcontrast/ol-graticule`](../ol-graticule).

![All eight Norwegian strip grids over Norway, each clipped to its EPSG zone](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-ngo/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-ngo/>

Each strip is transverse Mercator with scale 1 on its central meridian, given
east of the Oslo meridian (10°43'22.5" E of Greenwich), on the modified Bessel
ellipsoid:

| Strip | CRS              | Central meridian | Origin | False E / N         | Checked on                                                       |
| ----- | ---------------- | ---------------- | ------ | ------------------- | ---------------------------------------------------------------- |
| I     | `NGO:STRIP_I`    | 4°40' W of Oslo  | 58°N   | 200 000 / 100 000 m | B 34-W Fana, B 38 W-O Stavanger                                  |
| II    | `NGO:STRIP_II`   | 2°20' W of Oslo  | 58°N   | 400 000 / 100 000 m | E 26 O Trollheimen, E 26 W Stangvik, E 27 W Aura, E 24 W Kvenvär |
| III   | `NGO:STRIP_III`  | Oslo             | 58°N   | 600 000 / 100 000 m | H 38 Enningdal                                                   |
| IV    | `NGO:STRIP_IV`   | 2°30' E of Oslo  | 64°N   | 100 000 / 100 000 m | Jot 18 Hattfjelldal                                              |
| V     | `NGO:STRIP_V`    | 6°10' E of Oslo  | 66°N   | 300 000 / 100 000 m | M 6 Torsken                                                      |
| VI    | `NGO:STRIP_VI`   | 10°10' E of Oslo | 68°N   | 500 000 / 100 000 m | T 7 Kautokeino                                                   |
| VII   | `NGO:STRIP_VII`  | 14°10' E of Oslo | 68°N   | 700 000 / 100 000 m | X 4 Laksfjordvidda                                               |
| VIII  | `NGO:STRIP_VIII` | 18°20' E of Oslo | 68°N   | 900 000 / 100 000 m | Y 3 Vestertana                                                   |

Each sheet's margin names its strip and central meridian. The origins and
false co-ordinates are fitted to the grid printed against the graticule; every
measured corner matches to within 25 m. The sheets name no ellipsoid or datum;
the shift to WGS84 is the NGO 1948 seven-parameter one.

From the EPSG registry: the Oslo meridian (EPSG:8913), the Bessel Modified
ellipsoid (EPSG:7005), every central meridian (NGO zones, EPSG:27391-27398),
the strip boundaries (extents 1741-1748) and the WGS84 shift (EPSG:1654, 3 m).
EPSG's zones put every origin at 58°N with no false co-ordinates; the origins
and false co-ordinates here are the German sheets' own, and no published
source for them has been found yet.

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { createNGOStripGridSystem } from '@zwaarcontrast/ol-graticule-ngo';

map.addLayer(
  new UniversalGraticule({ gridSystem: createNGOStripGridSystem('V') }),
);
```

`createNGOStripGridSystem(strip, options)` takes the `ProjectedGridSystem`
options except `crs`, `proj4Def` and `extent`, which the strip fixes.
`NGO_GRIDS` holds every strip keyed by CRS (`crs`, `name`, `proj4`,
`validityWgs84`, `createGridSystem()`). `NGO_STRIPS` (strip parameters, proj4
strings and WGS84 validity bands) is also exported ol-free from
`@zwaarcontrast/ol-graticule-ngo/headless`.

Each strip is clipped to a band between the EPSG zone boundaries (the
midpoints of adjacent central meridians), over the latitudes of that zone's
EPSG area of use (extents 1741-1748): strip V, for instance, runs from 66.15°N
to 70.27°N. The sheets do not print strip boundaries, and a sheet near one
carries its own strip past it.
