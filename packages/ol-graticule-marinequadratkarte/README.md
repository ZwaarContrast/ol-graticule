# @zwaarcontrast/ol-graticule-marinequadratkarte

WWII Kriegsmarine **Marinequadratkarte** (naval quadrant map) grid for
[`@zwaarcontrast/ol-graticule`](../ol-graticule).

Renders the hierarchical two-letter-plus-digits grid ("BC 6175", "vK", etc.)
used by the German Navy during the Second World War. Works globally,
including the irregular polygonal squares around Britain and Iceland and
the anti-meridian-crossing squares in the Pacific.

> **This package would not exist without [navalgrid.com](https://www.navalgrid.com/)
> by Jan Kockrow ([@Nylle](https://github.com/Nylle)).** The reconstructed
> grid data, subdivision logic, and irregular-square handling are all
> ported from his [cljs-navalgrid](https://github.com/Nylle/cljs-navalgrid)
> implementation, which is itself the result of an enormous amount of
> archival work piecing the Marinequadratkarte rules back together from
> primary sources. If you use this package, please visit
> <https://www.navalgrid.com/> and acknowledge the upstream effort.

> **Status: not yet published.** Because this package is a port of
> `cljs-navalgrid` and that project has no declared license, we can't
> distribute on npm yet. See [LICENSE.TODO.md](./LICENSE.TODO.md) for
> the steps needed before public release.

**Live demo:** <https://zwaarcontrast.github.io/ol-graticule/ol-graticule-marinequadratkarte/>

## Install (once published)

```bash
npm install @zwaarcontrast/ol-graticule @zwaarcontrast/ol-graticule-marinequadratkarte ol
```

Peers: `ol >=9 <11`, `@zwaarcontrast/ol-graticule`. **No proj4
dependency** — all transforms go through OL's built-in 4326 ↔ 3857.

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { KriegsmarineGridSystem } from '@zwaarcontrast/ol-graticule-marinequadratkarte';

const gridSystem = new KriegsmarineGridSystem();
map.addLayer(new UniversalGraticule({ gridSystem }));
```

The grid draws cell-centered codes (not edge-axis labels) and progressively
subdivides as you zoom in, down to the Kleinquadrat (6-character code like
`BC6175`).

### Options

| Option | Type | Default | What it does |
|---|---|---|---|
| `maxDepth` | `0`–`4` | `4` | Subdivision depth. `0` = large squares only, `4` = Kleinquadrat. |
| `minSquarePx` | `number` | `80` | Squares smaller than this won't subdivide further. |

### Looking up a grid reference for a coordinate

Two helpers are exported for non-rendering use (e.g. showing a location's
naval grid square in a popup):

```ts
import {
  coordinateToGridRef,
  formatGridRef,
} from '@zwaarcontrast/ol-graticule-marinequadratkarte';

const ref = coordinateToGridRef([54.5, 5.2]);        // -> "AN3828"
formatGridRef(ref!);                                  // -> "AN 3828"

// Cap the resolution — handy for text like "ship operating in AN".
coordinateToGridRef([54.5, 5.2], 0);                  // -> "AN"
```

Input order is `[latitude, longitude]`. Returns `undefined` when the point
is outside the grid's covered area (there are a few such gaps near the poles).

## Credits

### Jan Kockrow — navalgrid.com

The grid data, the subdivision logic, the irregular-polygon handling
around Britain/Iceland, and the anti-meridian-crossing logic in the
Pacific — essentially everything specific to the Marinequadratkarte —
is ported from **Jan Kockrow**'s
**[navalgrid.com](https://www.navalgrid.com/)** and his
[cljs-navalgrid](https://github.com/Nylle/cljs-navalgrid) implementation.

Reconstructing the Marinequadratkarte from primary sources is an enormous
amount of patient archival work. This package is essentially a TypeScript
re-implementation of Jan's research, integrated into the ol-graticule
ecosystem. If you find this package useful, please go visit
<https://www.navalgrid.com/> and acknowledge his work.

### Chris Veness — spherical geodesy formulae

The shortest-longitude-difference helper in `src/kriegsmarine/latlon.ts`
(`smallestLonDiff`) is adapted from
[Chris Veness's "Latitude/Longitude spherical geodesy formulae"](https://www.movable-type.co.uk/scripts/latlong.html),
© 2002-2022 Chris Veness, MIT Licence.

## License

TBD — see [LICENSE.TODO.md](./LICENSE.TODO.md).
