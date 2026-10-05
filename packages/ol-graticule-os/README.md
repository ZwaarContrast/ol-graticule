# @zwaarcontrast/ol-graticule-os

Historical Ordnance Survey grids for
[`@zwaarcontrast/ol-graticule`](../ol-graticule). The first is the **yard
grid** of the 1930s, the Ordnance Survey's transverse Mercator grid before the
metric National Grid.

![The OS yard grid over Great Britain, clipped to the Quarter-inch Fourth Edition sheets](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-os/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-os/>

## The yard grid

| Parameter    | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| CRS          | `OS:YARD_GRID`                                               |
| Projection   | Transverse Mercator, true origin 49°N 2°W                    |
| Ellipsoid    | Airy                                                         |
| Scale factor | 0.9996 (reduced by one part in 2500 on the central meridian) |
| False origin | 1 000 000 yards west and 1 000 000 yards south of the origin |
| Unit         | British yard, 0.9143984 m                                    |
| Coverage     | Great Britain with Orkney and Shetland; not Ireland          |

It was printed on the One-inch Fifth Edition (1931, lines every 5 000 yards),
the ten-mile maps (1932) and the Quarter-inch Fourth Edition (1934, lines every
10 000 yards), and dropped after the Davidson Committee recommended a metric
grid in 1938. The maps never named it; instructions in the margin explain it
as "the position of a point ... defined by its distance in yards East and North
of a point lying to the S.W. of England". The German 1940 reprints of the
quarter-inch sheets call it "das englische Gitternetz".

Sources: R. Oliver, "The evolution of the Ordnance Survey National Grid",
_Sheetlines_ 43 (1995) 25-46 (origin and scale factor, p. 36); the OS sheet
instructions quoted by R. Hellyer, "The first National Grid map?",
_Sheetlines_ 55 (1999) 31-34 (false origin, and coverage "to the very north of
the Shetland Islands" with Ireland omitted).

It is the National Grid projection (EPSG:27700) in yards with another false
origin. EPSG gives the National Grid a scale factor of 0.9996012717 rather than
0.9996; the two differ by less than 2 yards anywhere in Great Britain.

The grid is clipped to the faces of the Quarter-inch Fourth Edition sheets,
whose sheet lines it laid out (union of the 1934-39 coloured edition footprints
in the National Library of Scotland catalogue). The worked examples printed on
those sheets, Helensburgh (Upper) station at E 813,800 N 1,856,600 and Horse
Isle at 804,400 1,812,200, are in the tests.

The shift to WGS84 is the OSGB36 one (EPSG:1314). The grid predates OSGB36, so
positions on the original maps carry the older triangulation's offsets.

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { createOSYardGridSystem } from '@zwaarcontrast/ol-graticule-os';

map.addLayer(new UniversalGraticule({ gridSystem: createOSYardGridSystem() }));
```

`createOSYardGridSystem(options)` takes the `ProjectedGridSystem` options
except `crs`, `proj4Def` and `extent`. Labels are full figures in yards
(`813,800 yd`) from `YardFormatter`, which also parses `E 813,800` style input.

`OS_GRIDS` holds every grid keyed by CRS (`crs`, `name`, `proj4`,
`validityWgs84`, `createGridSystem()`). The CRS code, proj4 string, validity
rings (in yards and in WGS84) and `YardFormatter` are exported ol-free from
`@zwaarcontrast/ol-graticule-os/headless`.
