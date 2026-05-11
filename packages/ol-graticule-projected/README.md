# @zwaarcontrast/ol-graticule-projected

Generic proj4-backed `GridSystem` for [`@zwaarcontrast/ol-graticule`](../ol-graticule).
Use it to render a graticule in any CRS, UTM zones, state planes, national
grids, on top of any OL view projection.

![UTM 33N grid pinched at the poles, rendered over a Web Mercator world map](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-projected/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-projected/>

## Install

```bash
npm install @zwaarcontrast/ol-graticule @zwaarcontrast/ol-graticule-projected ol proj4
```

Peers: `ol ^10`, `proj4 ^2.9`, `@zwaarcontrast/ol-graticule`.

## Usage

### UTM zone 33N (metres)

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { ProjectedGridSystem } from '@zwaarcontrast/ol-graticule-projected';

const gridSystem = new ProjectedGridSystem({
  crs: 'EPSG:32633',
  proj4Def: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
});

map.addLayer(new UniversalGraticule({ gridSystem, style: { edgeLabel: true } }));
```

`MetricIntervals` + `MetricFormatter` are auto-selected because the CRS uses
metres, so labels read `"500 km"`, `"20 km"`, etc.

### US State Plane, California Zone III (feet)

```ts
const gridSystem = new ProjectedGridSystem({
  crs: 'EPSG:2227',
  proj4Def:
    '+proj=lcc +lat_1=38.43333333333333 +lat_2=37.06666666666667 +lat_0=36.5 ' +
    '+lon_0=-120.5 +x_0=2000000.0001016 +y_0=500000.0001016001 +datum=NAD83 ' +
    '+units=us-ft +no_defs',
  // Optional: clip to the valid AoU so lines don't wander off.
  extent: [5905300, 1477700, 7540700, 2396900],
});
```

### Register the CRS up front

If several parts of your app talk to the same CRS, register it once at app
startup and omit `proj4Def` from the grid-system options:

```ts
import { registerCRS } from '@zwaarcontrast/ol-graticule-projected';

registerCRS('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs');

// Later, no proj4Def needed, the CRS is already in proj4/OL's registry.
new ProjectedGridSystem({ crs: 'EPSG:32633' });
```

`registerCRS` is idempotent; passing `proj4Def` to the constructor is a
convenience shortcut that calls it for you.

## Options

| Option | Type | Default | What it does |
|---|---|---|---|
| `crs` | `string` |, (required) | EPSG code or other proj4-known name. |
| `proj4Def` | `string` |, | proj4 definition. Registered via `registerCRS` if provided. Omit if already registered. |
| `extent` | `[minX, minY, maxX, maxY]` | projection's built-in extent | Axis-aligned validity bounds in CRS coordinates. Lines outside are clipped. |
| `clipPolygon` | `[x, y][]` |, | Irregular boundary polygon in CRS coordinates (for non-rectangular coverage). Overrides `extent` for drawing. |
| `intervals` | `IntervalStrategy` | auto from CRS units | Spacing strategy. Degrees → `DegreeIntervals`, metres → `MetricIntervals`. |
| `formatter` | `LabelFormatter` | auto from CRS units | Label formatter. Degrees → `DegreeFormatter`, metres → `MetricFormatter`. |
| `targetScreenPx` | `number` | `100` | Desired minimum spacing (px) between major lines. Drives interval selection. |
| `densificationPoints` | `number` | `100` | Points per grid line for curved rendering across projections. Higher = smoother, slower. |

### Reverse: parse a typed coordinate back

`ProjectedGridSystem.parseCoordinate` takes a label and returns view-projection
coords:

```ts
import { ParseError } from '@zwaarcontrast/ol-graticule';

try {
  const center = gridSystem.parseCoordinate('500000 5000000', map.getView().getProjection());
  map.getView().animate({ center });
} catch (err) {
  if (err instanceof ParseError) console.warn(err.reason);
}
```

For per-axis CRSs (the common case) it splits on whitespace or comma and
parses each half via the formatter (`"500000 5000000"`, `"500000, 5000000"`,
`"500000 m 5000000 m"`). For degree-units CRSs, hemisphere markers route the
two halves to lat/lon automatically; without markers, plain `"x y"` is
treated as `"lon lat"`. Compound formatters (e.g. `MBSFormatter` from
ol-graticule-modified-british-system) plug in via `formatter.parseCoordinate`
so you can type `"vK 617 517"` directly and the system transforms the result
to your view projection.

### `extent` vs `clipPolygon`

- Use `extent` when the CRS has a rectangular validity region (UTM zones,
  state planes with square AoUs). Cheaper and sufficient most of the time.
- Use `clipPolygon` when the coverage is irregularly shaped, e.g. the
  Netherlands outline for RD, the Nord de Guerre WWI coverage polygon. Lines
  are clipped to the polygon and cells outside it don't draw.

Both can coexist, the grid system intersects them.

## Loading NTv2 datum-shift grids

If your CRS needs a sub-metre NTv2 datum shift (e.g. `+nadgrids=@mygrid`),
register the grid file with proj4 once before constructing the system:

```ts
import { loadNadgrid } from '@zwaarcontrast/ol-graticule-projected';

await loadNadgrid('@mygrid', '/assets/mygrid.gsb');

new ProjectedGridSystem({
  crs: 'EPSG:1234',
  proj4Def: '+proj=… +nadgrids=@mygrid +…',
});
```

For Dutch RD (EPSG:28992/28991) with RDNAPTRANS 2018 pre-bundled, use
[`@zwaarcontrast/ol-graticule-rd`](../ol-graticule-rd) instead of wiring this
up yourself.

## Exports

- `ProjectedGridSystem`, `ProjectedGridSystemOptions`
- `registerCRS(code, proj4Def)`, idempotent proj4 + OL registration.
- `loadNadgrid(name, url)`, fetch + register an NTv2 `.gsb` file.
- `MetricIntervals`, `MetricFormatter`, re-exported from core for convenience.

## License

MIT.
