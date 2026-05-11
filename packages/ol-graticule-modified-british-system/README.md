# @zwaarcontrast/ol-graticule-modified-british-system

[Modified British System](https://en.wikipedia.org/wiki/British_Grid_Reference_System#Modified_British_System)
artillery grids for [`@zwaarcontrast/ol-graticule`](../ol-graticule). Covers
all ten WWII MBS theatres documented on Thierry Arsicaud's
[Echo Delta, Modified British System](https://www.echodelta.net/mbs/eng-welcome.php),
plus the period-correct British War Office (Dunnose) variant.

> **This package would not exist without [Thierry Arsicaud's
> Echo Delta site](https://www.echodelta.net/mbs/eng-welcome.php).**
> His meticulous research into the Modified British System,
> letter-cell addressing, subdivisions, theatre-specific origins, and the
> hundred quirks that aren't documented anywhere else in one place, is
> the foundation every theatre in this package is built on. If you find
> this package useful, please go read his work and tip your hat.

![Nord de Guerre MBS grid overlaid on Belgium and northern France](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-modified-british-system/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-modified-british-system/>

## Theatres

| Theatre | Factory | CRS | Projection |
|---|---|---|---|
| Nord de Guerre | `createNordDeGuerreGridSystem` | `EPSG:27500` | LCC near-conformal, Paris meridian |
| French Lambert Zone I | `createFrenchLambert1GridSystem` | `EPSG:27561` | LCC, lat_0=49.5° |
| French Lambert Zone II | `createFrenchLambert2GridSystem` | `EPSG:27562` | LCC, lat_0=46.8° |
| French Lambert Zone III | `createFrenchLambert3GridSystem` | `EPSG:27563` | LCC, lat_0=44.1° |
| British Cassini (OS Delamere) | `createBritishCassiniGridSystem` | `MBS:BRITISH_CASSINI` | Cassini-Soldner, Delamere origin |
| Irish Cassini (OSI 1825) | `createIrishCassiniGridSystem` | `MBS:IRISH_CASSINI` | Cassini-Soldner, Lough Foyle origin |
| War Office Cassini (Dunnose, WWII) | `createWarOfficeCassiniGridSystem` | `MBS:WAR_OFFICE_CASSINI` | Cassini-Soldner, Dunnose origin |
| Scandinavian Zone 3 | `createScandinavianZone3GridSystem` | `MBS:SCANDINAVIAN_ZONE_3` | LCC on Bessel 1841, lat_0=57.5°, lon_0=20° |
| Italian Northern | `createItalianNorthernGridSystem` | `MBS:ITALIAN_NORTHERN` | LCC on Bessel 1841, lat_0=45°55', lon_0=14° |
| Italian Southern | `createItalianSouthernGridSystem` | `MBS:ITALIAN_SOUTHERN` | LCC on Bessel 1841, lat_0=39.5°, lon_0=14° |
| Iberian Peninsula | `createIberianPeninsulaGridSystem` | `MBS:IBERIAN_PENINSULA` | LCC on Bessel 1841, lat_0=41°, lon_0=-4° |

Each factory ships with a hand-traced coverage polygon, the correct MBS
letter scheme, and `cellSnapInterval` wired up so cell labels snap to the
100 km grid. The two British Cassini variants ship side-by-side: the
Delamere (`createBritishCassiniGridSystem`) matches what Thierry's
translator publishes; the Dunnose (`createWarOfficeCassiniGridSystem`) is
period-correct for actual WWII British Army GSGS sheets, sourced from
Hellyer, *Sheetlines* 55 (Charles Close Society, 2001).

### MBS letter families

The 25-letter MBS alphabet (A–Z minus I) lays out as a 5 × 5 grid in two
ways: a **first-letter** grid for 500 km squares and a **second-letter**
grid for 100 km cells inside. The first-letter grid is universal across
every theatre (`VWXYZ / QRSTU / LMNOP / FGHJK / ABCDE` S→N). The
second-letter grid varies, every observed theatre uses one of four
cyclic rotations of the same 5-row alphabet stack, distinguished by which
row sits on the NORTH of any 500 km square:

| Family constant | N row | Theatres |
|---|---|---|
| `NORD_DE_GUERRE_FAMILY_LETTERS` | FGHJK | Nord de Guerre, French Lambert I/II/III |
| `BRITISH_CASSINI_FAMILY_LETTERS` | ABCDE | British/Irish/War Office Cassini, Italian Southern, Iberian Peninsula |
| `ITALIAN_NORTHERN_FAMILY_LETTERS` | LMNOP | Italian Northern |
| `SCANDINAVIAN_ZONE_3_FAMILY_LETTERS` | QRSTU | Scandinavian Zone 3 |

(A fifth rotation with VWXYZ on the north row would complete the cyclic
group but isn't observed in any theatre Thierry catalogues.)

## Install

```bash
npm install \
  @zwaarcontrast/ol-graticule \
  @zwaarcontrast/ol-graticule-projected \
  @zwaarcontrast/ol-graticule-modified-british-system \
  ol proj4
```

## Usage

```ts
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import { createNordDeGuerreGridSystem } from '@zwaarcontrast/ol-graticule-modified-british-system';

const gridSystem = createNordDeGuerreGridSystem();

map.addLayer(new UniversalGraticule({ gridSystem, style: { edgeLabel: true } }));
```

Swap in any other factory the same way:

```ts
import { createWarOfficeCassiniGridSystem } from '@zwaarcontrast/ol-graticule-modified-british-system';
const gridSystem = createWarOfficeCassiniGridSystem();
```

What you'll see:

- Major grid lines at the 100 km MBS interval (with minor lines at the
  20 km subdivisions when you zoom in).
- **Letter-cell codes** centred in each cell, `vK`, `wL`, `aT`, etc., fading in / out with zoom so they appear only when readable.
- Drawing clipped to the theatre's historical coverage polygon, nothing
  spills into the surrounding seas or neighbouring zones.

### Tweaking a factory

Every `ProjectedGridSystem` option except the MBS-specific ones (`crs`,
`proj4Def`, `extent`, `formatter`, `intervals`) passes through:

```ts
const gridSystem = createNordDeGuerreGridSystem({
  targetScreenPx: 120,        // rarer grid lines
  densificationPoints: 60,    // coarser curves, slightly cheaper
});
```

You can also override the default clip polygon:

```ts
const gridSystem = createBritishCassiniGridSystem({
  clipPolygon: myCustomPolygonInCassiniMetres,
});
```

### Reverse: parse an MBS reference back to a coordinate

The factories return a `GridSystem` with `parseCoordinate` wired up, type
in any reference and get back view-projection metres for `view.animate(...)`:

```ts
import { ParseError } from '@zwaarcontrast/ol-graticule';

const grid = createNordDeGuerreGridSystem();

try {
  const center = grid.parseCoordinate('vK 617 517', map.getView().getProjection());
  map.getView().animate({ center, duration: 400 });
} catch (err) {
  if (err instanceof ParseError) console.warn(err.reason);
}
```

Lenient input forms accepted:

- `vK`, `vK6175`, `vK 617 517`, `VK90449926`, case-insensitive 2-letter
  prefix + `0/2/4/6/8/10` digits, with optional whitespace. Returns the
  cell **centre** at the precision implied by the digit count (100 km / 10 km
  / 1 km / 100 m / 10 m / 1 m). Round-trips with `formatMBS`.
- Numeric fallback: `309.02 296.80`, `309.02, 296.80`, optional trailing
  `km` (default) or `m`.

`MBSFormatter.parseCoordinate(text)` is also available standalone, it
returns `[easting, northing]` in CRS metres without the projection
transform, useful when you're consuming the package outside of OpenLayers.

### Building a custom theatre

Compose `MBSFormatter` with one of the family-letter constants (or a
custom `MBSLetterScheme`) and any `ProjectedGridSystem`:

```ts
import { ProjectedGridSystem, registerCRS } from '@zwaarcontrast/ol-graticule-projected';
import {
  MBSFormatter,
  MBSIntervals,
  BRITISH_CASSINI_FAMILY_LETTERS,
} from '@zwaarcontrast/ol-graticule-modified-british-system';

registerCRS('MBS:PALESTINE', '+proj=cass …');

const palestine = new ProjectedGridSystem({
  crs: 'MBS:PALESTINE',
  extent: [/* … */],
  formatter: new MBSFormatter({
    ...BRITISH_CASSINI_FAMILY_LETTERS,
    eOriginKm: /* … */,
    nOriginKm: /* … */,
  }),
  intervals: new MBSIntervals(),
});
```

## Exports

### Pre-wired grid factories

`createNordDeGuerreGridSystem`, `createFrenchLambert{1,2,3}GridSystem`,
`createBritishCassiniGridSystem`, `createIrishCassiniGridSystem`,
`createWarOfficeCassiniGridSystem`, `createScandinavianZone3GridSystem`,
`createItalianNorthernGridSystem`, `createItalianSouthernGridSystem`,
`createIberianPeninsulaGridSystem`.

### CRS / proj4 / bbox / clip-polygon constants

For each theatre `<T>`:
- `<T>_CRS`, the CRS code under which the projection is registered.
- `<T>_PROJ4`, the proj4 definition string.
- `<T>_BBOX_WGS84`, `[lonMin, latMin, lonMax, latMax]` for `view.fit()`.
- `<T>_CLIP_POLYGON`, the hand-traced coverage polygon in the theatre's
  projected metres (open ring).

### Letter schemes

- Per-theatre full schemes: `NORD_DE_GUERRE_SCHEME`,
  `FRENCH_LAMBERT_{1,2,3}_SCHEME`, `BRITISH_CASSINI_SCHEME`,
  `IRISH_CASSINI_SCHEME`, `WAR_OFFICE_CASSINI_SCHEME`,
  `SCANDINAVIAN_ZONE_3_SCHEME`, `ITALIAN_NORTHERN_SCHEME`,
  `ITALIAN_SOUTHERN_SCHEME`, `IBERIAN_PENINSULA_SCHEME`.
- Shared family-letter constants: `NORD_DE_GUERRE_FAMILY_LETTERS`,
  `BRITISH_CASSINI_FAMILY_LETTERS`, `ITALIAN_NORTHERN_FAMILY_LETTERS`,
  `SCANDINAVIAN_ZONE_3_FAMILY_LETTERS`.

### Building blocks

- `MBSFormatter`, takes an `MBSLetterScheme`; compose with
  `ProjectedGridSystem` to wire up a theatre not already covered by a
  factory.
- `MBSIntervals`, fixed 100 km major / 20 km minor interval strategy.
- Types: `MBSLetterGrids`, `MBSLetterScheme`, plus per-factory
  `<T>GridSystemOptions`.

## Confidence notes

All theatres have been smoke-tested against either Thierry's translator
or a primary documentary anchor:

- **Nord de Guerre**, LCC parameters match EPSG:27500 canonical to
  sub-metre precision. Datum tie to WGS84 uses an empirical 3-parameter
  Helmert (`+towgs84=1383.8,38.7,392,0,0,0,0`) baked into the default
  proj4 string; EPSG/IGN publish no transformation for ATF Paris ↔
  WGS84, so this is the best published estimate. Source: Bill Sayers,
  [*Transforming French WW1 Lambert Coordinates to WGS84*][nde-towgs84]
  (16 January 2024), fitted across 13 WWI Initial Point survey plats,
  10/13 within 20 m, three outliers up to ~100 m. Override per call via
  `createNordDeGuerreGridSystem({ towgs84: ... })`, or pass `null` to
  fall back to the canonical no-shift definition.

[nde-towgs84]: https://wanderingcartographer.wordpress.com/2024/01/16/transforming-french-ww1-lambert-coordinates-to-wgs84/
- **French Lambert I/II/III**, origins back-solved from Thierry's
  translator at metre-level precision.
- **British Cassini (OS Delamere)**, matches Thierry's translator. NOT
  the period-correct WWII Army grid; that's the Dunnose variant.
- **Irish Cassini**, proj4 reproduces Thierry's translator to within
  ~2 m across 9 sample points.
- **War Office Cassini (Dunnose, WWII)**, proj4 + origin from Hellyer
  *Sheetlines* 55 (Charles Close Society, 2001) primary source. Asserted
  in tests against Hellyer's `wQ`-at-(500 km, 100 km) reference point.
- **Scandinavian Zone 3**, back-solved from Thierry's translator,
  ~13 m mean error across 61 probes.
- **Italian Northern**, back-solved, 6.3 m mean error across 62 probes.
- **Italian Southern**, back-solved, 4.4 m mean error across 77 probes.
- **Iberian Peninsula**, *moderate confidence*. Thierry's translator
  doesn't support this theatre, so parameters were inferred from the
  GSGS 4148 Spain-Portugal 1:250 000 series (held by ICGC Barcelona at
  <https://cartotecadigital.icgc.cat/digital/collection/gsgs4148>).
  Anchored to the Madrid-West sheet's printed Monterrubio reference
  ("LETTER Q REF Q 4425"). Cell labels far from the anchor may disagree
  with Thierry's GIF by one 100 km cell, verify against the GSGS sheets
  if precision matters.

## Acknowledgements

### Thierry Arsicaud, Echo Delta

Indispensable, foundational, and the reason this package exists at all:
**Thierry Arsicaud**'s site
**[Echo Delta, Modified British System](https://www.echodelta.net/mbs/eng-welcome.php)**.
Every theatre in this package, the letter schemes, the projection
parameters, the coverage polygons, the subdivision rules, comes either
directly from Echo Delta or was validated against his interactive
translator. Patient archival research that nobody else has done in one
place. If you use this package professionally, send him a note, and read
his pages.

### Roger Hellyer & the Charles Close Society

The **War Office Cassini (Dunnose)** grid is sourced from Roger
Hellyer's article in *Sheetlines* issue 55 (Charles Close Society,
2001), which gave us the period-correct WWII British Army origin and
the `wQ`-at-(500 km, 100 km) reference point used as a regression test.
The broader *Sheetlines* archive was invaluable for cross-referencing
the WWII GSGS series.

## License

MIT.
</content>
