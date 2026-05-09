# @zwaarcontrast/ol-graticule-rd

Dutch **Rijksdriehoekstelsel** (RD Amersfoort) grids for
[`@zwaarcontrast/ol-graticule`](../ol-graticule):

- **RD New** (EPSG:28992) — the current Dutch national grid.
- **RD Old** (EPSG:28991) — the pre-1989 grid, same projection with
  `x_0 = y_0 = 0`.

The **RDNAPTRANS 2018** NTv2 datum-shift grid is bundled inline — sub-centimetre
accuracy with no asset to fetch and no bundler configuration required.

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-rd/>

## Install

```bash
npm install \
  @zwaarcontrast/ol-graticule \
  @zwaarcontrast/ol-graticule-projected \
  @zwaarcontrast/ol-graticule-rd \
  ol proj4
```

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { createRDNewGridSystem } from '@zwaarcontrast/ol-graticule-rd';

const gridSystem = createRDNewGridSystem();
map.addLayer(new UniversalGraticule({ gridSystem, style: { edgeLabel: true } }));
```

Or RD Old:

```ts
import { createRDOldGridSystem } from '@zwaarcontrast/ol-graticule-rd';
const gridSystem = createRDOldGridSystem();
```

Both factories are synchronous and idempotent. They:

- register the CRS with proj4/OL;
- decode and register the bundled RDNAPTRANS 2018 grid on first call (~1 ms);
- pre-configure the valid extent and the Netherlands area-of-use polygon.

Options other than the baked-in ones (CRS, proj4, extent, clip polygon) are
forwarded to `ProjectedGridSystem` — e.g. `createRDNewGridSystem({ targetScreenPx: 120 })`.

### Reverse: parse a typed RD coordinate

The factories return a polygon-clipped `ProjectedGridSystem`, which inherits
`parseCoordinate`:

```ts
import { ParseError } from '@zwaarcontrast/ol-graticule';

try {
  const center = gridSystem.parseCoordinate('155000 463000', map.getView().getProjection());
  map.getView().animate({ center });
} catch (err) {
  if (err instanceof ParseError) console.warn(err.reason);
}
```

Accepted forms: `"155000 463000"`, `"155000, 463000"`, optional trailing
`m` or `km` (e.g. `"155 463 km"`). Validity against the NL clip polygon is
**not** enforced — call `isValidCoordinate(coord)` on the result if you need
to reject Amersfoort-relative locations outside the country.

## Exports

Factories (synchronous):

- `createRDNewGridSystem(options?) → ProjectedGridSystem`
- `createRDOldGridSystem(options?) → ProjectedGridSystem`

Constants:

- `RD_NEW_CRS`, `RD_NEW_PROJ4`, `RD_NEW_EXTENT`, `RD_NEW_CLIP_POLYGON`
- `RD_OLD_CRS`, `RD_OLD_PROJ4`, `RD_OLD_EXTENT`, `RD_OLD_CLIP_POLYGON`
- `RDNAPTRANS2018_GRID_NAME`

Low-level:

- `registerRDNAPTRANS2018()` — manually register the bundled grid. Called
  for you by the factories; use it if you're constructing a
  `ProjectedGridSystem` by hand with `RD_NEW_PROJ4` / `RD_OLD_PROJ4`.

---

## Why this package bundles an NTv2 grid

RD (Amersfoort, EPSG:28992) is a Bessel-1841 projection. To move between RD
metres and WGS84 / ETRS89 / EPSG:3857, proj4 has to shift between datums.
There are two ways to do that:

| Method | Residual error (across NL) | Applied where |
|---|---|---|
| **7-parameter Helmert** (the `+towgs84=...` string, EPSG:4833) | ~1 m | proj4's default when no grid is available |
| **RDNAPTRANS 2018 NTv2 grid** (`rdtrans2018.gsb`) | < 1 cm | when `+nadgrids=@rdtrans2018` can resolve the grid |

A 1 m residual is usually plenty for drawing a graticule on a slippy map, but
not for georeferencing maps, overlaying cadastral boundaries, or anything
pretending to be survey-grade. RDNAPTRANS 2018 is the grid published by
Kadaster and is the canonical WGS84 ↔ RD transformation used by all
authoritative Dutch geospatial tooling.

This package therefore:

1. **Inlines the grid** as a base64 string inside the package's compiled JS
   (~80 KB of source → ~60 KB gzipped on the wire — same order as the raw
   `.gsb`). No `.gsb` asset shipped in `dist/`, no `import.meta.url` asset
   resolution, no bundler-specific plumbing.
2. Embeds `+nadgrids=@rdtrans2018,@null` in the exported proj4 strings,
   with `@null` at the end so proj4 falls through to the `+towgs84`
   Helmert transform if the grid is somehow not registered (instead of
   silently degrading to identity, which would be a ~100 m error).
3. Calls `registerRDNAPTRANS2018()` from inside `createRDNewGridSystem()`
   and `createRDOldGridSystem()` on first use.

### Using a non-bundled grid source

If you need a newer RDNAPTRANS grid than the one bundled here, or prefer
to load it from a CDN, register it yourself before constructing the grid
system and the bundled copy will simply be unused:

```ts
import { loadNadgrid } from '@zwaarcontrast/ol-graticule-projected';
import {
  createRDNewGridSystem, RDNAPTRANS2018_GRID_NAME,
} from '@zwaarcontrast/ol-graticule-rd';

await loadNadgrid(RDNAPTRANS2018_GRID_NAME, '/my-assets/rdtrans2018-2024.gsb');
const gridSystem = createRDNewGridSystem();
```

The RD proj4 strings reference `@rdtrans2018` by name; whoever registered
the grid under that name first wins, and repeat `createRDNewGridSystem()`
calls won't clobber your custom registration.

## License

MIT. The included RDNAPTRANS 2018 grid is published by Kadaster (Dutch
Land Registry) and is redistributable; see
<https://www.nsgi.nl/rdnaptrans> for the upstream source and documentation.
