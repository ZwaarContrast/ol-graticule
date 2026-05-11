# @zwaarcontrast/ol-graticule-mgrs

Military Grid Reference System (MGRS / NATO grid) for
[`@zwaarcontrast/ol-graticule`](../ol-graticule).

Renders Grid Zone Designators (e.g. `32U`) and 100 km squares (e.g. `WL`)
worldwide, with cursor readout of the full MGRS reference. Handles the
Norway and Svalbard zone exceptions and falls back to UPS (Universal Polar
Stereographic) above 84°N and below 80°S.

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-mgrs/>

## Install

```bash
npm install \
  @zwaarcontrast/ol-graticule \
  @zwaarcontrast/ol-graticule-projected \
  @zwaarcontrast/ol-graticule-mgrs \
  ol proj4
```

Peers: `ol ^10`, `proj4 ^2.9`, `@zwaarcontrast/ol-graticule`,
`@zwaarcontrast/ol-graticule-projected`.

## Usage

```ts
import { UniversalGraticule, CursorPositionControl } from '@zwaarcontrast/ol-graticule';
import { MgrsGridSystem } from '@zwaarcontrast/ol-graticule-mgrs';

const gridSystem = new MgrsGridSystem();

map.addLayer(new UniversalGraticule({ gridSystem, style: { edgeLabel: true } }));
map.addControl(new CursorPositionControl({ gridSystem }));
```

What you'll see:

- **Grid Zone Designators** at low zoom, the 6° × 8° UTM zones with their
  letter band suffix (`32U`, `33T`, etc.).
- **100 km squares** as you zoom in (`WL`, `XM`, …), with the column-letter
  set rotating per zone per the MGRS spec.
- **Norway / Svalbard exceptions** drawn correctly (zone 32V is widened to
  cover western Norway; zones 31X / 33X / 35X / 37X cover Svalbard while
  32X / 34X / 36X are absent).
- **UPS regions** above 84°N and below 80°S, with their A/B/Y/Z grid
  letters and 100 km squares.

The `CursorPositionControl` reads out a full MGRS reference like
`32U LB 12345 67890` (variable precision based on zoom).

## Options

| Option | Type | Default | What it does |
|---|---|---|---|
| `targetScreenPx` | `number` | `100` | Desired minimum spacing (px) between major lines. Drives interval selection. |
| `densificationPoints` | `number` | `100` | Points per grid line for curved rendering. |

## Coordinate conversion helpers

For non-rendering use (e.g. showing an MGRS string in a popup), the
package re-exports its low-level conversion utilities:

```ts
import { lonLatToMgrs, formatMgrs } from '@zwaarcontrast/ol-graticule-mgrs';

const ref = lonLatToMgrs([7.0, 48.5], 5);  // -> "32U LB 12345 67890"
formatMgrs(ref);                           // -> "32U LB 12345 67890"
```

Precision is the number of digits per axis: `0` (GZD only) through `5`
(1 m precision).

## Exports

### Grid system

- `MgrsGridSystem`, `MgrsGridSystemOptions`, plug into `UniversalGraticule`
  / `CursorPositionControl`.
- `MgrsIntervals`, the spacing strategy used internally (re-export).

### Coordinate conversion

- `lonLatToMgrs(lonLat, precision)`, `[lon, lat]` → MGRS string.
- `lonLatToMgrsParts(lonLat)`, structured parts (`{ zone, band, square, easting, northing }`).
- `formatMgrs(ref, options?)`, pretty-print with spaces between groups.
- `lonLatToUtm`, `utmToLonLat`, `lonLatToUps`, `upsToLonLat`, round-trip
  helpers between geographic and UTM/UPS coordinates.

### Zone / band / square helpers

- UTM: `bandLetterFromLatitude`, `bandLatBounds`, `zoneBandLonBounds`,
  `zoneNumberFromLonLat`, `utmCrsCode`, `utmProj4`, `BAND_LETTERS`.
- 100 km squares: `columnLetter`, `columnSetForZone`, `rowLetter`,
  `rowOffsetForZone`, `squareLetters`.
- UPS: `upsColumnLetter`, `upsRowLetter`, `upsSquareLetters`,
  `upsZoneLetter`, `upsZoneLonLatBounds`, `upsCrsCode`, `upsProj4`,
  `upsIsNorth`.
- Iteration: `iterateVisibleGzds`, `Gzd`.

## License

MIT.
