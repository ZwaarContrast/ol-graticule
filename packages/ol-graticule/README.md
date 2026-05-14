# @zwaarcontrast/ol-graticule

Flexible graticule layer for OpenLayers with a pluggable `GridSystem` strategy.

Ships with two built-in grid systems (pixel and geographic lat/lon) and a
cursor position control. Other CRSs and historical grids are published as
add-on packages, see the [add-ons](#add-ons) section below.

![Geographic lat/lon graticule rendered over a world map](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule/>

## Install

```bash
npm install @zwaarcontrast/ol-graticule ol
```

Peer: `ol ^10`. No other runtime dependencies.

## Usage

### Lat/lon graticule on a web map

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

new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    new UniversalGraticule({ gridSystem, style: { edgeLabel: true } }),
  ],
  controls: [new CursorPositionControl({ gridSystem })],
  view: new View({ center: [0, 0], zoom: 2 }),
});
```

### Pixel ruler on a canvas / IIIF view

```ts
import Map from 'ol/Map';
import View from 'ol/View';
import { UniversalGraticule, PixelGridSystem } from '@zwaarcontrast/ol-graticule';

const rulers = new UniversalGraticule({
  gridSystem: new PixelGridSystem({ yInverted: true }),
  style: { edgeLabel: true },
});

new Map({
  target: 'map',
  layers: [/* your IIIF / image layer */, rulers],
  view: new View({ center: [0, 0], zoom: 0 }),
});
```

`yInverted: true` is for image coordinate systems (IIIF `zDirection: -1`)
where the Y axis goes down in image space but OL's Y axis goes up.

### Switching or disabling the grid

Both `UniversalGraticule` and `CursorPositionControl` treat their grid-system
slot as the single source of truth for what (and whether) they render. Pass a
new grid to switch, pass `null` to deactivate, pass a grid again to reactivate, no separate visibility toggle required.

```ts
const graticule = new UniversalGraticule({ gridSystem: new GeographicGridSystem() });
const cursor = new CursorPositionControl({ gridSystem: new GeographicGridSystem() });

// Switch to a different grid, both update in place.
graticule.setGridSystem(new PixelGridSystem());
cursor.setGridSystem(new PixelGridSystem());

// Turn them off without removing them from the map.
graticule.setGridSystem(null);
cursor.setGridSystem(null);

// Turn them back on.
graticule.setGridSystem(new GeographicGridSystem());
cursor.setGridSystem(new GeographicGridSystem());
```

Both constructors accept `null` (or an omitted `gridSystem`) so you can wire
the layer and control into your map up front and activate them later.

## `UniversalGraticule` options

| Option | Type | Default | What it does |
|---|---|---|---|
| `gridSystem` | `GridSystem \| null` | `null` | The grid to draw. `null` = inactive layer. |
| `style` | `GraticuleStyle` | library defaults | Line / edge-label / cell-label config, see [Styling](#styling). |
| `xLabelPosition` | `'top' \| 'bottom'` | `'top'` | Which edge gets x-axis (lon/easting) labels. |
| `yLabelPosition` | `'left' \| 'right'` | `'left'` | Which edge gets y-axis (lat/northing) labels. |
| `xLabelOffset` | `number` (px) | `2` | Inset for x-axis labels from the top/bottom edge. |
| `yLabelOffset` | `number` (px) | `2` | Inset for y-axis labels from the left/right edge. |
| `maxLines` | `number` | `100` | Safety cap on lines per axis per frame. |

Plus every `VectorLayer` option except `source` and `style` (they're managed
internally).

## Styling

All styling flows through one `GraticuleStyle` shape:

```ts
import Stroke from 'ol/style/Stroke';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';

new UniversalGraticule({
  gridSystem,
  style: {
    line: {
      major: new Stroke({ color: 'rgba(0,0,0,0.4)', width: 1 }),
      minor: new Stroke({ color: 'rgba(0,0,0,0.15)', width: 0.5 }),
    },
    edgeLabel: new Text({
      font: '600 11px system-ui',
      fill: new Fill({ color: 'white' }),
      stroke: new Stroke({ color: 'black', width: 3 }),
    }),
    // cellLabel: false    // suppress cell codes on MBS / Kriegsmarine grids
    // cellLabel: createDefaultCellLabelHandler({ fontFamily: 'Inter' })
  },
});
```

- **`line`**, one `Stroke` (same for major + minor), a `{ major, minor? }`
  pair, or a custom OL `StyleLike` that inspects each feature's
  `gridLineType` property.
- **`edgeLabel`**, omit to hide; `true` for library defaults; a `Text` for a
  styled template (cloned per label); or a full `EdgeLabelStyleHandler` for
  pooled custom rendering.
- **`cellLabel`**, omit for library defaults (used by MBS, Kriegsmarine);
  `false` to suppress; or a `CellLabelStyleHandler` for custom rendering.
  Tweak the defaults with
  `createDefaultCellLabelHandler({ fontFamily, fadeStops, … })`.

The `CursorPositionControl` has its own small `style` shape:

```ts
new CursorPositionControl({
  gridSystem,
  style: {
    color: 'rgba(249, 115, 22, 0.9)',
    labelCss: 'font: 600 10px system-ui; color: white;',
  },
});
```

## Add-ons

These packages plug their own `GridSystem` into `UniversalGraticule`:

| Package | What it draws |
|---|---|
| [`@zwaarcontrast/ol-graticule-projected`](https://www.npmjs.com/package/@zwaarcontrast/ol-graticule-projected) | Any proj4 CRS (UTM, state plane, national grids). |
| [`@zwaarcontrast/ol-graticule-rd`](https://www.npmjs.com/package/@zwaarcontrast/ol-graticule-rd) | Dutch RD Amersfoort (EPSG:28992 / 28991) with bundled RDNAPTRANS 2018 datum-shift grid. |
| [`@zwaarcontrast/ol-graticule-mgrs`](https://www.npmjs.com/package/@zwaarcontrast/ol-graticule-mgrs) | Military Grid Reference System (MGRS / NATO grid) over UTM, with Norway/Svalbard exceptions. |
| [`@zwaarcontrast/ol-graticule-modified-british-system`](https://www.npmjs.com/package/@zwaarcontrast/ol-graticule-modified-british-system) | Modified British System letter-cell artillery grids for ten WWII theatres (Nord de Guerre, French Lambert I/II/III, British/Irish Cassini, War Office Cassini, Scandinavian Zone 3, Italian Northern/Southern, Iberian Peninsula). |
| [`@zwaarcontrast/ol-graticule-luftwaffe-planquadrat`](https://www.npmjs.com/package/@zwaarcontrast/ol-graticule-luftwaffe-planquadrat) | WWII Luftwaffe Planquadrat reference grids: Gradnetzmeldeverfahren (GNMV, pre/post-1943) and Jägermeldenetz (JMN) fighter reporting network. |
| [`@zwaarcontrast/ol-graticule-heeresgitter`](https://www.npmjs.com/package/@zwaarcontrast/ol-graticule-heeresgitter) | WWII Wehrmacht map reference grids: Deutsches Heeresgitter (DHG, 6° Gauß-Krüger on Bessel 1841) and the Heeresmeldenetz (HMN) letter-cell reporting overprint. |
| `@zwaarcontrast/ol-graticule-marinequadratkarte` | WWII Kriegsmarine naval grid (not yet published, see [repo](https://github.com/zwaarcontrast/ol-graticule)). |

### Reverse: parse a label back to a coordinate

Every built-in grid system also implements the optional `parseCoordinate`
method, which turns a typed label back into view-projection coordinates, useful for "go to" search inputs.

```ts
import { ParseError } from '@zwaarcontrast/ol-graticule';

const gridSystem = new GeographicGridSystem();

try {
  const [x, y] = gridSystem.parseCoordinate('50°51′N 4°21′E', map.getView().getProjection());
  map.getView().animate({ center: [x, y], duration: 400 });
} catch (err) {
  if (err instanceof ParseError) console.warn(err.reason);
}
```

Parsing is lenient: hemisphere markers route axes for `GeographicGridSystem`
(`50°N 4°E` and `4°E 50°N` both work); plain pairs default to `"x y"` order
(lon-lat for geographic, easting-northing for linear). Compound formats
(MBS letter-cells, Kriegsmarine references) round-trip via the formatter's
own `parseCoordinate`. Spatial validity is intentionally **not** checked, call `isValidCoordinate` on the result if you need it.

The underlying single-axis `parse` lives on the formatter:

```ts
new DegreeFormatter().parse("50°37'02\"N", 'y');   // 50.6172…
new MetricFormatter().parse('1.2345 km');           // 1234.5
new PixelFormatter().parse('123 px');               // 123
```

## API reference

- **`UniversalGraticule(options)`**, `VectorLayer` subclass. `setGridSystem(grid | null)` to swap/disable.
- **`CursorPositionControl(options)`**, OL `Control`. Renders edge labels (axis grids) or a floating compound label (MBS/Kriegsmarine) depending on the grid system.
- **`GridSystem`**, interface with `getFeatures`, `getLabels`, `formatCoordinate`, optional `parseCoordinate`, `getCellLabels`, `isValidCoordinate`. Implement it to draw any grid describable in code.
- **`LabelFormatter`**, `format` / optional `formatCoordinate` / optional `parse` / optional `parseCoordinate` / optional `formatCellLabel`.
- **`ParseError`**, thrown by `parse*` methods on unparseable input. Has `text` and `reason` fields.
- **Built-in grids**: `PixelGridSystem`, `GeographicGridSystem`, `PolygonClippedGridSystem`.
- **Built-in formatters**: `PixelFormatter`, `DegreeFormatter` (DMS / DD / DDM), `MetricFormatter`.
- **Built-in intervals**: `PixelIntervals`, `DegreeIntervals`, `MetricIntervals`.
- **Style helpers**: `createDefaultEdgeLabelHandler`, `createDefaultCellLabelHandler`, `resolveLineStyle`, `DEFAULT_LINE_STROKE`, `DEFAULT_CURSOR_COLOR`.

See [`src/types.ts`](./src/types.ts) and [`src/style.ts`](./src/style.ts) for
full type signatures.

## License

MIT.
