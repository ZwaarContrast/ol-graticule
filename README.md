# ol-graticule

Flexible graticule (grid overlay) for OpenLayers, with pluggable grid systems.

Ship a lat/lon grid on a web map, overlay a national grid (RD, UTM), add a
historical artillery grid, or render an image-pixel grid on top of an IIIF
viewer — all from the same layer class and a small `GridSystem` interface.

**Live demos:** <https://zwaarcontrast.nl/ol-graticule/> — bare-bones
demo per package.

## Packages

| Package | What it gives you |
|---|---|
| [`@zwaarcontrast/ol-graticule`](./packages/ol-graticule) | `UniversalGraticule` layer, `CursorPositionControl`, `PixelGridSystem`, `GeographicGridSystem` (EPSG:4326). No proj4 dependency. |
| [`@zwaarcontrast/ol-graticule-projected`](./packages/ol-graticule-projected) | `ProjectedGridSystem` — any CRS via proj4. |
| [`@zwaarcontrast/ol-graticule-modified-british-system`](./packages/ol-graticule-modified-british-system) | Modified British System artillery grids (Nord de Guerre for now). |
| [`@zwaarcontrast/ol-graticule-rd`](./packages/ol-graticule-rd) | Dutch RD Amersfoort grids (EPSG:28991 Old, EPSG:28992 New). Netherlands coverage polygon baked in. |
| [`@zwaarcontrast/ol-graticule-mgrs`](./packages/ol-graticule-mgrs) | Military Grid Reference System (MGRS / NATO grid) over UTM, with Norway and Svalbard exceptions. |
| `@zwaarcontrast/ol-graticule-marinequadratkarte` | WWII Kriegsmarine naval grid. *Not yet published* — see [the package's LICENSE.TODO.md](./packages/ol-graticule-marinequadratkarte/LICENSE.TODO.md). |

Each add-on package depends on `@zwaarcontrast/ol-graticule`; install only
what you need.

## Install matrix

| If you want… | Install |
|---|---|
| Lat/lon graticule on a web map | `@zwaarcontrast/ol-graticule` |
| Pixel ruler on an IIIF viewer | `@zwaarcontrast/ol-graticule` |
| UTM / state plane / custom proj4 CRS | `@zwaarcontrast/ol-graticule` + `@zwaarcontrast/ol-graticule-projected` + `proj4` |
| Nord de Guerre artillery grid | `@zwaarcontrast/ol-graticule` + `@zwaarcontrast/ol-graticule-modified-british-system` (+ `@zwaarcontrast/ol-graticule-projected` + `proj4`) |
| Dutch RD grid | `@zwaarcontrast/ol-graticule` + `@zwaarcontrast/ol-graticule-rd` (+ `@zwaarcontrast/ol-graticule-projected` + `proj4`) |
| MGRS / NATO grid | `@zwaarcontrast/ol-graticule` + `@zwaarcontrast/ol-graticule-mgrs` (+ `@zwaarcontrast/ol-graticule-projected` + `proj4`) |

`ol` is a peer dependency of every package (>=9 <11).

## Quick example

```ts
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {
  UniversalGraticule,
  GeographicGridSystem,
  CursorPositionControl,
} from '@zwaarcontrast/ol-graticule';

const gridSystem = new GeographicGridSystem();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    new UniversalGraticule({ gridSystem, style: { edgeLabel: true } }),
  ],
  controls: [new CursorPositionControl({ gridSystem })],
  view: new View({ center: [0, 0], zoom: 2 }),
});
```

## Custom grid systems

The `GridSystem` interface has four methods — implement it yourself to draw
any grid you can describe in code. See [`src/types.ts`](./packages/ol-graticule/src/types.ts).

## Development

```bash
npm install
npm run build        # topological build of every package in the workspace
npm test             # vitest across all packages
npm run type-check   # tsc --noEmit everywhere
npm run demo:dev     # run the demos site locally (Vite dev server)
npm run demo:build   # build the demos site (goes to demos/dist)
```

Demos deploy to GitHub Pages automatically from `main` via
`.github/workflows/demos.yml`.

This repo uses npm workspaces and [changesets](https://github.com/changesets/changesets)
for versioning. The four published packages (everything except
`ol-graticule-marinequadratkarte`, see its [LICENSE.TODO.md](./packages/ol-graticule-marinequadratkarte/LICENSE.TODO.md))
bump in lockstep (`fixed` group) so their versions always match. The
Kriegsmarine package is in the changesets `ignore` list and is marked
`"private": true` in its `package.json` — both as belt-and-suspenders
safeguards against accidental publication.

```bash
npx changeset          # record a new change
npm run version        # apply pending changesets + regenerate root CHANGELOG.md
npm run release        # build + publish
```

## License

MIT — see [LICENSE](./LICENSE).
