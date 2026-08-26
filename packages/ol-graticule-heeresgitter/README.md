# @zwaarcontrast/ol-graticule-heeresgitter

WWII Wehrmacht map reference grids for
[`@zwaarcontrast/ol-graticule`](../ol-graticule): the **Deutsches
Heeresgitter** (DHG) metric kilometre grid, the **Deutsches
Reichsgitter** (DRG) 3°-strip grid it replaced, plus the
**Heeresmeldenetz** (HMN) orange letter-cell overprint, in both planar
and geographic variants.

![DHG kilometre grid with orange Heeresmeldenetz Kleinquadrat + Meldetrapez cells over Katwijk, Noordwijk, Leiden and the North Sea](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/preview.jpg)

**Live demo:** <https://zwaarcontrast.nl/ol-graticule/ol-graticule-heeresgitter/>

## Install

```bash
npm install \
  @zwaarcontrast/ol-graticule \
  @zwaarcontrast/ol-graticule-projected \
  @zwaarcontrast/ol-graticule-heeresgitter \
  ol proj4
```

Peers: `ol ^10`, `@zwaarcontrast/ol-graticule`,
`@zwaarcontrast/ol-graticule-projected`. The DHG projection is
registered via proj4 on first use.

## Usage

Stack both grid systems to reproduce the sheet appearance: a fine black
km grid with the orange HMN cells layered on top.

```ts
import Map from 'ol/Map';
import View from 'ol/View';
import { UniversalGraticule } from '@zwaarcontrast/ol-graticule';
import {
  DhgGridSystem,
  HmnGridSystem,
} from '@zwaarcontrast/ol-graticule-heeresgitter';

const dhg = new DhgGridSystem();
const hmn = new HmnGridSystem();

map.addLayer(new UniversalGraticule({
  gridSystem: dhg,
  style: { strokeColor: '#222', edgeLabel: true },
}));
map.addLayer(new UniversalGraticule({
  gridSystem: hmn,
  style: { strokeColor: '#d97706', cellLabel: true },
}));
```

You can render either grid on its own. DHG covers the full validity
envelope at every zoom (zone outlines at small scales, full km grid
once you zoom past `maxRenderResolution`). HMN only renders inside its
configured resolution band.

## The grids

A Wehrmacht sheet of the *Deutsche Heereskarte* standard (post-1942)
typically carries both grids superimposed:

| Grid | Drawn in | Spacing | Purpose |
|---|---|---|---|
| **DHG** Deutsches Heeresgitter | black, fine line | 1 km on 1:50 000 | metric coordinates for artillery, navigation |
| **HMN** Heeresmeldenetz | orange overprint | 6 km letter cells | verbal position reporting up the chain of command |

Both are derived from the same projection, so HMN cells align with DHG
kilometre lines.

Sheets printed before the DHG was standardised carry the **DRG**
instead: the same Gauß-Krüger family on the national 3° strips.

| Grid | Strips | Kennziffer | Rechtswert of the CM |
|---|---|---|---|
| **DRG** Deutsches Reichsgitter | 3° wide | `CM / 3°` | `Kennziffer × 1 000 000 + 500 000` |
| **DHG** Deutsches Heeresgitter | 6° wide | `(CM + 3°) / 6°` | `500 000`, Kennziffer quoted separately |

### DHG projection (Gauß-Krüger on Bessel 1841)

| Parameter | Value |
|---|---|
| Reference ellipsoid | Bessel 1841 |
| Projection | Gauß-Krüger (transverse Mercator) |
| Strip width | 6° |
| Scale factor on CM | 1.0 (no Maßstabsreduktion, unlike UTM's 0.9996) |
| False easting | 500 000 m |
| False northing | 0 (Hochwert = meridian arc from equator) |
| Strip overlap | 30' on each side beyond the nominal 6° |

Zone numbering (*Kennziffer*) follows `n = (L_m + 3°) / 6°` where `L_m`
is the central meridian. The inverse is `L_m = n × 6° − 3°`. Kennziffer
1 = CM 3°E; 6 = CM 33°E (Kolosjoki); 60 = CM 3°W.

Eastings on map sheets are written with the Kennziffer prepended:
e.g. `5600` on the Owrutsch sheet = zone 5, Rechtswert 600 000 m.
Inline grid ticks may show only the last two km digits (short form).

**Validity envelope.** The DHG was only specified for zones 55–14
(longitude −36° to +84°) and IMW rows SI–R (latitude −32° to +72°). The
renderer uses these as its hard clip envelope.

### DRG projection (Gauß-Krüger on the national 3° strips)

| Parameter | Value |
|---|---|
| Reference ellipsoid | Bessel 1841 |
| Projection | Gauß-Krüger (transverse Mercator) |
| Strip width | 3° |
| Scale factor on CM | 1.0 |
| False easting | `Kennziffer × 1 000 000 + 500 000` m |
| False northing | 0 (Hochwert = meridian arc from equator) |
| Strip overlap | 10' on each side beyond the nominal 3° |

Zone numbering is `n = L_m / 3°`, so Kennziffer 2 = CM 6°E, 3 = CM 9°E,
4 = CM 12°E, 5 = CM 15°E. Strips 2–5 are the German ones and match
EPSG:31466–31469.

The Kennziffer is not quoted apart from the coordinate the way it is on
DHG sheets: it is carried as the *leading digit of the Rechtswert*. A
grid line labelled `2512` is strip 2, Rechtswert 512 km. Point
references are given in metres, Rechtswert first, and may be shortened
by dropping the leading pair. From the *Planzeiger* note on sheet 5503
Elsenborn:

> Der Rechtswert ist stets zuerst zu nennen. Die Punktangabe erfolgt in
> Metern. Nicht ablesbare Werte sind bis zur Angabe des vollen Meters
> durch Nullen zu ersetzen.
>
> Beispiel: Punkt p liegt in Metern:
> „Rechts" ⁴⁵27000 + 200 = ⁴⁵27200 = (kurz:) 27200
> „Hoch" ⁵⁷96000 + 450 = ⁵⁷96450 = (kurz:) 96450
>
> \* Kennziffer des Meridianstreifens

There is no validity envelope: unlike the DHG, the DRG was a national
survey grid rather than a theatre-wide specification, so the renderer
clips each strip to its own band and nothing more. It draws only at
large scale (see `maxRenderResolution`).

### HMN (planar) hierarchy

The standardised *Deutsche Heereskarte* (1942 onwards) prints this
variant. Cells are 6 km Kleinquadrate keyed off the DHG km lattice.

| Level | Size | Labelling | Origin |
|---|---|---|---|
| Großquadrat | 150 km × 150 km | implicit, identified by sheet | intersection of CM with integer × 150 km Northing |
| **Kleinquadrat** | **6 km × 6 km** | **letter pair `AA`..`ZZ` (25 letters, `I` skipped)** | NW corner of Großquadrat |
| Meldetrapez | 2 km × 2 km | `1`..`9` (3 × 3, NW→SE row-major) | NW corner of Kleinquadrat |
| Arbeitstrapez | 1 km × 1 km | `a`..`d` (2 × 2, NW→SE row-major) | NW corner of Meldetrapez |
| (tenths) | 100 m precision | 2 digits, east + north | SW corner of Arbeitstrapez |

**Letter-pair rule.** 25-letter alphabet
`A B C D E F G H J K L M N O P Q R S T U V W X Y Z` (no `I`). First
letter = column, ascending W → E within the Großquadrat. Second
letter = row, ascending N → S.

**Sub-cell layout:**

```
Meldetrapez (2 km, inside Kleinquadrat)    Arbeitstrapez (1 km, inside Meldetrapez)
  1  2  3                                    a  b
  4  5  6                                    c  d
  7  8  9
```

The optional tenths suffix counts (east, north) from the **SW** corner
of the Arbeitstrapez at 100 m precision. Canonical grammar:
`([A-HJ-Z][A-HJ-Z]) ?([1-9])([a-d])?( ?\d{2})?`.

**Disambiguation.** `AA`..`ZZ` repeats every 150 km Großquadrat, so a
complete report includes the sheet number. The `parseHmn` API requires
either an explicit `grossquadrat` or a `near` location.

### HMN (geographic) hierarchy

The lat/lon-bounded variant. Sheets self-identify with a
`Heeresmeldenetz (geogr.)` header. Cells are degree-bounded so they
don't depend on a projection; the grid renders directly on any view
CRS.

| Level | Size | Labelling | Origin |
|---|---|---|---|
| Großtrapez | 2°30′ lon × 1°40′ lat | name of settlement | (0°40′N, 0°E), stepping ±2°30′ / ±1°40′ |
| **Kleintrapez** | **6′ lon × 4′ lat** | **letter pair `AA`..`ZZ` (no `I`)** | NW corner of Großtrapez |
| Meldetrapez | 2′ × 1′20″ | `1`..`9` (3 × 3, NW→SE row-major) | NW corner of Kleintrapez |
| Arbeitstrapez | 1′ × 40″ | `a`..`d` (2 × 2, NW→SE row-major) | NW corner of Meldetrapez |
| (tenths) | 6″ × 4″ | 2 digits, east + north | SW corner of Arbeitstrapez |

The anchor `0°40′N` is empirical. Buchroithner & Pfahlbusch (2016)
print `1°N (!)`, but every observed primary source fits an anchor 20′
south of that. See [VALIDATION.md](./VALIDATION.md) for the worked
Romfo example and a Den Haag cross-check.

## DHG options

| Option | Type | Default | What it does |
|---|---|---|---|
| `zoneBoundary` | `'tiled'` \| `'overlap'` \| `'single'` | `'tiled'` | Behaviour at 6° zone seams. `tiled` cuts hard at each meridian. `overlap` re-draws the 30' overlap band like wartime sheets that straddle a strip. `single` only renders the zone nearest the viewport centre. |
| `labelForm` | `'long'` \| `'short'` | `'long'` | `long` prints the Kennziffer-prefixed full km value (`"5600"`). `short` prints only the last two digits (`"00"`). Wartime corners use long form; inline ticks use short. |
| `maxRenderResolution` | `number` (m/px) | `2000` | Above this, only zone outlines + Kennziffer labels render. |
| `overviewLabelMaxResolution` | `number` (m/px) | `6000` | Strip-boundary lines always render, but Kennziffer labels are gated to avoid clutter. |
| `targetScreenPx` | `number` | `80` | Target pixel spacing between adjacent grid lines; drives the 1/2/6/30/150 km interval ladder. |
| `densificationPoints` | `number` | `60` | Vertices per grid line for non-affine view projections. |
| `datumShift` | `DatumShift` | Potsdam | Override the WGS 84 → Bessel-Potsdam Helmert transform. |

## DRG options

| Option | Type | Default | What it does |
|---|---|---|---|
| `zoneBoundary` | `'tiled'` \| `'overlap'` \| `'single'` | `'tiled'` | Behaviour at 3° strip seams. `tiled` cuts hard at each edge. `overlap` re-draws the 20' overlap band the way a sheet straddling a boundary prints two grids. `single` renders only the strip nearest the viewport centre. |
| `labelForm` | `'long'` \| `'short'` | `'long'` | `long` prints the full km value with its Kennziffer digit (`"2512"`). `short` prints the sheet's *kurz* form, last two digits only (`"12"`). |
| `maxRenderResolution` | `number` (m/px) | `2000` | Above this nothing is drawn. This is a large-scale sheet grid, not a world overview. |
| `targetScreenPx` | `number` | `80` | Target pixel spacing between adjacent grid lines; drives the 1/2/5/10/25/50/100 km interval ladder. |
| `densificationPoints` | `number` | `60` | Vertices per grid line for non-affine view projections. |
| `datumShift` | `DatumShift` | Potsdam | Override the WGS 84 → Bessel-Potsdam Helmert transform. |

## HMN options

| Option | Type | Default | What it does |
|---|---|---|---|
| `maxDepth` | `2` \| `3` \| `4` | `4` | `2` = Kleinquadrat only, `3` = + Meldetrapez, `4` = + Arbeitstrapez. |
| `maxRenderResolution` | `number` (m/px) | `300` | HMN hides itself at smaller scales (DHG carries the metric grid). |
| `targetScreenPx` | `number` | `80` | Pixel size at which a level subdivides into the next. |
| `zoneBoundary` | `'tiled'` \| `'overlap'` \| `'single'` | `'tiled'` | Same semantics as `DhgGridSystem`. |
| `datumShift` | `DatumShift` | Potsdam | Override the datum shift. |
| `densificationPoints` | `number` | `60` | Vertices per grid line. |

## Encoding and parsing

### DHG: `(lat, lon)` to printed kilometre labels

```ts
import { encodeDhg, encodeDhgText, formatEasting, formatNorthing }
  from '@zwaarcontrast/ol-graticule-heeresgitter';

const coord = encodeDhg([69.5, 30.0]);            // Kolosjoki NW corner
// -> { kennziffer: 6, easting: 383038.., northing: 7715567.. }

formatEasting(coord);                              // -> "6383" (long form)
formatEasting(coord, { form: 'short' });           // -> "83"   (inline tick)
formatNorthing(coord);                             // -> "7715"

encodeDhgText([52.0, 28 + 20 / 60]);               // Owrutsch NW corner
// -> "5591 5763"   (zone 5, ~91 km east of CM 27°E, Hochwert ~5763 km)
```

Input order is `[latitude, longitude]`. `encodeDhg` picks the zone
whose central meridian is nearest the longitude; pass an explicit
`kennziffer` to force a specific zone.

### DRG: `(lat, lon)` to printed Rechtswert / Hochwert

```ts
import { encodeDrg, encodeDrgText, parseDrg, formatDrgEasting }
  from '@zwaarcontrast/ol-graticule-heeresgitter';

const coord = encodeDrg([50.4, 6 + 10 / 60]);      // sheet 5503 SW corner
// -> { kennziffer: 2, easting: 2511892.., northing: 5584914.. }

formatDrgEasting(coord);                            // -> "2512" (corner label)
formatDrgEasting(coord, { form: 'short' });         // -> "12"   (inline tick)
formatDrgEasting(coord, { unit: 'm' });             // -> "2511892"

encodeDrgText([50.4514, 6.2076]);                   // Elsenborn
// -> "2514... 5590..."   (strip 2, Rechtswert / Hochwert in metres)

parseDrg('2512200 5585450');
// -> { coord: { kennziffer: 2, easting: 2512200, northing: 5585450 }, ... }
```

The sheet's printed *graticule* is Potsdam/Bessel, not WGS 84.
`encodeDrg` takes WGS 84 input and applies the Helmert shift, which
moves a corner by roughly 130 m in this region. Pass an identity
`datumShift` to `drgForwardInZone` to read a sheet's own lat/lon values
literally.

### HMN: `(lat, lon)` to letter-cell reference

```ts
import { encodeHmn, formatHmn } from '@zwaarcontrast/ol-graticule-heeresgitter';

// The Hadres sheet prints "PE 1b 52" as a worked Meldung; it resolves
// to approximately 48.509°N / 16.156°E:
const ref = encodeHmn([48.509, 16.156]);
// ref.canonical -> "PE 1b 52"
// ref.grossquadrat -> { kennziffer: 3, gx: 0, gy: 35 }
// ref.bbox -> [16.155.., 48.508.., 16.156.., 48.509..]   (100 m cell)

encodeHmn([48.509, 16.156], { depth: 2 }).canonical; // -> "PE"
encodeHmn([48.509, 16.156], { depth: 3 }).canonical; // -> "PE 1"
encodeHmn([48.509, 16.156], { depth: 4 }).canonical; // -> "PE 1b"
```

### Reverse: parse an HMN reference back to a coordinate

Because `AA`..`ZZ` repeats every 150 km Großquadrat, parsing needs
disambiguation. Pass either an explicit `grossquadrat`, or a `near`
location and the library picks the closest matching Großquadrat:

```ts
import { parseHmn } from '@zwaarcontrast/ol-graticule-heeresgitter';

parseHmn('PE 1b 52', { near: [48.6, 16.1] });
// -> { canonical: 'PE 1b 52',
//      kleinquadrat: 'PE', meldetrapez: 1, arbeitstrapez: 'b',
//      tenths: [5, 2], depth: 5,
//      grossquadrat: { kennziffer: 3, gx: 0, gy: 35 },
//      bbox: [16.155.., 48.508.., 16.156.., 48.509..],
//      center: [48.509.., 16.156..] }
```

Lenient input: case-insensitive, optional whitespace, optional sub-cell
parts.

## Theatres

The DHG is one global system. **All Planhefte use the same projection
and the same letter-cell rule**, so this package needs no
theatre-specific factory functions, in contrast to the Modified British
System which has one factory per theatre. Only local material differs
(source maps, height datums, place-name conventions). The package uses
a single global Helmert (Potsdam datum); override per call via
`datumShift` for the 50–150 m residuals between national triangulations.

## What this package doesn't implement

- **Luftwaffe `Gradnetzmeldeverfahren` (GNMV)** and `Jägermeldenetz`
  (JMN). Different grids; for those, see
  [`@zwaarcontrast/ol-graticule-luftwaffe-planquadrat`](../ol-graticule-luftwaffe-planquadrat).
- **UTM-REF / Deutscher Heeresblattschnitt**, the 1944 prototype that
  later became MGRS. Covered by
  [`@zwaarcontrast/ol-graticule-mgrs`](../ol-graticule-mgrs).

## Primary-source validation

The encoding rules are anchored to wartime *Deutsche Heereskarte*
sheets and the explicit DHG specification in the *Planheft Schweiz*
(OKH g 23/1, 16 March 1944). See [VALIDATION.md](./VALIDATION.md) for
worked checks against the Kolosjoki, Hadres, Owrutsch, Embenskij Post,
and Romfo sheets, the Planheft Schweiz world-coverage plate, and the
Den Haag cross-check against an Atlantikwall sector overprint.

## Sources

- **Planheft Schweiz** (OKH g 23/1, 16 March 1944), pages C 1–C 3: the
  explicit DHG projection specification.
- **Buchroithner & Pfahlbusch**, *Geodetic grids in authoritative maps:
  new findings about the origin of the UTM Grid*, Cartography &
  Geographic Information Science (2016),
  [DOI 10.1080/15230406.2015.1128851][buchroithner-doi]
  ([open-access PDF via Austria-Forum][buchroithner-pdf]): the explicit
  spec for both HMN variants, citing *RdLuObdL ChAusbW
  VorschLmAbtRLM/LIn12 76/40*.
- **Sheet 5503 (3207 alt) Elsenborn**, *Topographische Karte 1:25 000
  (4-cm-Karte), Planblatt A*, Geheim, Sonderdruck der Heeresplankammer,
  Ausgabe A 1939, Stand 1.10.1939: the DRG projection parameters, the
  *Planzeiger* reference rules, and the 2512–2523 / 5585–5595 km grid
  used as the regression fixture.
- **Powell & Mühr**, *Capturing the Complex Histories of German World
  War II Captured Maps* (UC Berkeley Library): provenance for the
  captured-map collection.
- Map sheet images courtesy of the **UC Berkeley Library**, German WWII
  Captured Maps digital collection,
  <https://digicoll.lib.berkeley.edu/record/105643>.

[buchroithner-doi]: https://doi.org/10.1080/15230406.2015.1128851
[buchroithner-pdf]: https://austria-forum.org/attach/Geography/Cross-country_information/Buchroithner.pdf

## License

MIT. See [LICENSE](./LICENSE).
