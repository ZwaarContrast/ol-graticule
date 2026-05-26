# @zwaarcontrast/ol-graticule-heeresgitter

WWII Wehrmacht map reference grids for
[`@zwaarcontrast/ol-graticule`](../ol-graticule).

Renders three grids that appear on wartime German map sheets:

- **Deutsches Heeresgitter (DHG)**, the black metric kilometre grid used
  for artillery and navigation. Gauß-Krüger transverse Mercator on the
  Bessel 1841 ellipsoid, 6° strips numbered by *Kennziffer*, scale factor
  1.0 on the central meridian, false easting 500 000 m.
- **Heeresmeldenetz (planar)**, the orange letter-cell overprint printed
  on the standardised *Deutsche Heereskarte* sheet series from 1942
  onwards. 150 km *Großquadrate* anchored to the DHG km lattice,
  subdivided into 6 km *Kleinquadrate* (letter pairs `AA`..`ZZ` with `I`
  skipped), 2 km *Meldetrapeze* (`1`..`9`), 1 km *Arbeitstrapeze*
  (`a`..`d`), and an optional 100 m tenths suffix.
- **Heeresmeldenetz (geographic)**, the lat/lon-bounded variant whose
  sheets self-identify with a `Heeresmeldenetz (geogr.)` header. Same
  hierarchy and alphabet, but Großtrapeze and cells are bounded by
  graticule lines (`2°30' lon × 1°40' lat` and `6' lon × 4' lat`
  respectively) instead of metres, anchored at `(0°40'N, 0°E)`.

The DHG and the planar HMN share a projection, so planar HMN cells snap
to the kilometre lattice. The geographic HMN is projection-agnostic and
renders directly on any view CRS.

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
`@zwaarcontrast/ol-graticule-projected`. The DHG projection is registered
via proj4 on first use; all 60 zones share the same definition with only
the central meridian and `+towgs84` parameters changing.

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
envelope at every zoom (zone outlines at small scales, full km grid once
you zoom past `maxRenderResolution`). HMN only renders inside its
configured resolution band.

## The two grids on a sheet

A Wehrmacht sheet of the *Deutsche Heereskarte* standard (post-1942)
typically carries both grids superimposed:

| Grid | Drawn in | Spacing | Purpose |
|---|---|---|---|
| **DHG** Deutsches Heeresgitter | black, fine line | 1 km on 1:50 000 (= 2 cm on paper) | metric coordinates for artillery, navigation |
| **HMN** Heeresmeldenetz | orange overprint | 6 km letter cells | verbal position reporting up the chain of command |

Both are derived from the same projection, so HMN cells align with DHG
kilometre lines.

### DHG projection spec

From the *Planheft Schweiz* (OKH g 23/1, 16 March 1944), page C 1:

| Parameter | Value |
|---|---|
| Reference ellipsoid | Bessel 1841 |
| Projection | Gauß-Krüger (transverse Mercator) |
| Strip width | 6° |
| Scale factor on CM | 1.0 (no Maßstabsreduktion, unlike UTM's 0.9996) |
| False easting | 500 000 m |
| False northing | 0 (Hochwert = meridian arc from equator) |
| Strip overlap | 30' on each side beyond the nominal 6° |
| Datum | each national triangulation preserved, no common adjustment |

Zone numbering (*Kennziffer*) follows `n = (L_m + 3°) / 6°` where `L_m`
is the central meridian in degrees east of Greenwich. The inverse is
`L_m = n × 6° − 3°`:

| Kennziffer | CM | Coverage |
|---|---|---|
| 1 | 3° E | 0°–6° E |
| 5 | 27° E | 24°–30° E |
| 6 | 33° E | 30°–36° E *(Kolosjoki)* |
| 14 | 81° E | 78°–84° E *(easternmost zone of the validity envelope)* |
| 55 | 33° W | 36°–30° W *(westernmost zone)* |
| 59 | 9° W | 12°–6° W |
| 60 | 3° W | 6° W–0° |

Eastings on map sheets are written with the Kennziffer prepended:
e.g. `5600` on the Owrutsch sheet = zone 5, Rechtswert 600 000 m. Inline
grid ticks may show only the last two km digits (short form).

### Validity envelope

The Planheft Schweiz prints an explicit world-coverage plate titled
*Streifen des Deutschen Heeresgitters und Einteilung der Weltkarte
1:1.000.000* (page C 2). It enumerates the operational extent rectangle:

| Axis | From | To |
|---|---|---|
| Kennziffer | 55 (CM 33° W) | 14 (CM 81° E) |
| Longitude (strip edges) | −36° | +84° |
| IMW row | SI (32° S) | R (68°–72° N) |
| Latitude | −32° | +72° |

Anything outside this rectangle was out of scope for the DHG (no
Planheft, no triangulation), so the renderer uses these four numbers as
its hard clip envelope.

### IMW 1:1 000 000 sheet indexing

The DHG strip number doubles as a sheet-index column on the
*Internationale Weltkarte 1:1 000 000* (IMW) layout that the German
Heereskarte series inherits, with a fixed offset:

- IMW columns 1–60 (180° W eastwards) number the same 6° strips but are
  offset by 30: `IMW_col = DHG_strip + 30 (mod 60)`.
- IMW rows: A, B, …, V (no I-skip at the row-letter level), so row `R`
  covers latitudes 68°–72° N.
- A sheet code like `R-36-X-West-7` decodes as: IMW row R × IMW
  column 36 (= DHG strip 6) → subdivision X → west half → 1:50 000
  sheet 7.

### HMN hierarchy

Two historical variants of the HMN existed: a **planar** one (keyed off
DHG metres) and a **geographic** one (with named *Großtrapeze* bounded
by lat/lon graticule lines). **This package implements both** as
separate grid systems:

| Variant   | Class                       | Cells          | Cell anchor                             |
|-----------|-----------------------------|----------------|------------------------------------------|
| Planar    | `HmnGridSystem`             | 6 km × 6 km    | DHG zone CM × integer 150 km Northing    |
| Geographic| `GeographicHmnGridSystem`   | 6' lon × 4' lat | 0°40′N × 0°E (latticed by 2°30′ × 1°40′) |

The planar variant is what's printed on the standardised *Deutsche
Heereskarte* sheets (Kolosjoki, Hadres, Owrutsch). The geographic
variant identifies itself with a `Heeresmeldenetz (geogr.)` sheet header;
see the *Geographic HMN* section below for a worked Romfo example.

The remainder of this section describes the planar variant. The
geographic variant is described under *Geographic HMN* further down.

| Level | Size | Labelling | Origin |
|---|---|---|---|
| Großquadrat | 150 km × 150 km | implicit, identified by sheet | intersection of CM with integer × 150 km Northing |
| **Kleinquadrat** | **6 km × 6 km** | **letter pair `AA`..`ZZ` (25 letters, `I` skipped)** | NW corner of containing Großquadrat |
| Meldetrapez | 2 km × 2 km | `1`..`9` (3 × 3, NW→SE row-major) | NW corner of Kleinquadrat |
| Arbeitstrapez | 1 km × 1 km | `a`..`d` (2 × 2, NW→SE row-major) | NW corner of Meldetrapez |
| (tenths) | 100 m precision | 2 digits, tenths east + tenths north | SW corner of Arbeitstrapez |

### Letter-pair labelling rule

- 25-letter alphabet: `A B C D E F G H J K L M N O P Q R S T U V W X Y Z` (no `I`).
- First letter = column, ascending **W → E** within the Großquadrat
  (`A` at west, `Z` at east).
- Second letter = row, ascending **N → S** (`A` at north, `Z` at south).

### Sub-cell layout

```
Meldetrapez (2 km, inside Kleinquadrat)    Arbeitstrapez (1 km, inside Meldetrapez)
  1  2  3                                    a  b
  4  5  6                                    c  d
  7  8  9
```

Both grids are row-major from the NW corner of the parent cell. The
optional tenths suffix counts (east, north) from the **SW** corner of the
Arbeitstrapez at 100 m precision.

Canonical reference grammar:
`([A-HJ-Z][A-HJ-Z]) ?([1-9])([a-d])?( ?\d{2})?`.

### Großquadrat repetition and disambiguation

Within a single Großquadrat each letter pair is unique. `AA`..`ZZ`
repeats every 150 km in both axes, though, so a complete report includes
the sheet number (or the Großquadrat designator) to resolve which 150 km
tile. Along 6° strip boundaries the labelling produces *Restquadrate*,
cut-off cells where the strip ends mid-cell.

The `parseHmn` API therefore requires either an explicit `grossquadrat`
or a `near` location for disambiguation.

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

## HMN options

| Option | Type | Default | What it does |
|---|---|---|---|
| `maxDepth` | `2` \| `3` \| `4` | `4` | `2` = Kleinquadrat only, `3` = + Meldetrapez, `4` = + Arbeitstrapez. |
| `maxRenderResolution` | `number` (m/px) | `300` | HMN hides itself at smaller scales (DHG carries the metric grid). |
| `targetScreenPx` | `number` | `80` | Pixel size at which a level subdivides into the next. |
| `zoneBoundary` | `'tiled'` \| `'overlap'` \| `'single'` | `'tiled'` | Same semantics as `DhgGridSystem`. |
| `datumShift` | `DatumShift` | Potsdam | Override the datum shift. |
| `densificationPoints` | `number` | `60` | Vertices per grid line. |

## Encoding and parsing references

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

// The "5600" label printed near the corner of the Owrutsch sheet is the
// 600 km grid line east of the corner; that line crosses 52°N at
// approximately 28.463°E:
encodeDhgText([52.0, 28.463]);                     // -> "5600 5763"
```

Input order is `[latitude, longitude]`. `encodeDhg` picks the zone whose
central meridian is nearest the longitude; pass an explicit `kennziffer`
to force a specific zone (useful when straddling a boundary).

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

parseHmn('JQ 4d 24', { near: [69.5, 30.0] });      // Kolosjoki river fork
```

Lenient input: case-insensitive, optional whitespace, optional sub-cell
parts.

## Primary-source validation

The renderer and the encode / decode helpers are anchored to wartime
*Deutsche Heereskarte* sheets held by the UC Berkeley Library
([digital collection, record 105643][berkeley]), and to the explicit DHG
specification in the *Planheft Schweiz* (OKH g 23/1, 16 March 1944,
pages C 1–C 3).

### Kolosjoki, *Norwegen / Finnland 1:50 000* sheet R-36-X-West-7, October 1943

Carries both grids. The black fine grid is the DHG km lattice; the
orange overprint is the HMN.

![Kolosjoki 1:50 000 sheet, fine black DHG kilometre grid with orange HMN letter cells F, G, H, J across the columns and Q, R, S down the rows](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/berkeley-kolosjoki.jpg)

DHG check at the NW corner labelled `30°00' E / 69°30' N`:

- Easting label `83` (short form, last two km digits) → DHG easting
  500 000 − 3° × 111.32 × cos(69.5°) ≈ 383 142 m ✓
- Northing label `7715` → Bessel meridian arc to 69°30' N ≈ 7 715 km ✓

HMN check on the top-left orange cell labelled `FP`:

- Column F = index 5 → 380 ≤ easting < 386 km — contains 383 km
  (= 30° E) ✓
- Row P = index 14 (with I-skip) → 7 710 ≤ northing < 7 716 km — contains
  7 715 km (= 69°30' N) ✓
- Implicit Großquadrat: NW corner at (E = 350 km, N = 7 800 km), the
  52nd 150 km row north of the equator, west of CM 33° E. The FP cell
  falls inside it ✓

The printed legend on the sheet gives `JQ 4d Flußgabel oder JQ 4d 24`
as a sample report, where `Flußgabel` ("river fork") substitutes for the
100 m tenths suffix.

### Hadres, *Alpen- und Donau-Reichsgaue 1:50 000* Blatt 4558 Ost

Letter cells `PA`, `QA`, `OB`, `PB`, `QB`, `OC`, `PC`, `QC` of the orange
HMN overprint, with the black DHG km grid underneath:

![Letter cells PA, QA, QB, OB of the Heeresmeldenetz overprint on the Hadres sheet of the Deutsche Heereskarte](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/berkeley-hadres.jpg)

Carries the explicit HMN subdivision legend printed in the margin:

![Marginal annotation on the Hadres sheet reading "Heeresmeldenetz / Meldung: PE 1b Wegkreuzung oder PE 1b 52"](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/hmn-meldung-legend.jpg)

The face of the sheet repeats the subdivision diagram with `PE` shown
as a 3 × 3 grid of digits `1`..`9` and Meldetrapez `1` further split
into the 2 × 2 grid `a b / c d`:

![Face-of-sheet subdivision diagram on the Hadres sheet showing the orange PE Kleinquadrat split into 9 Meldetrapeze numbered 1 to 9, and Meldetrapez 1 further split into Arbeitstrapeze a, b, c, d](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/hmn-subdivision-hadres.jpg)

This is the canonical row-major layout the encoder produces.

### Owrutsch, *Osteuropa 1:300 000* Zusammendruck V52/W50 Owrutsch-Tscherkassy

Confirms the DHG at a different theatre and a different scale, with no
HMN overprint (1:300 000 was too small for the orange grid). The NW
corner is labelled `28°20' E / 52° N`:

- Northing label `5760` → Bessel meridian arc to 52° N ≈ 5 763 km ✓
- Easting label `5600` → zone-prefixed (`5` | 600 000 m), at 1°20' E from
  CM 27° E ≈ 92 km east of CM → 592 km Rechtswert. The label sits on the
  600 km grid line itself ✓

### Embenskij Post, *Osteuropa 1:300 000* Zusammendruck II/49–III/47

Confirms the same projection over the Caspian steppe, a 6th theatre tag
on the system.

![Title bar of the Embenskij Post 1:300 000 Zusammendruck sheet over the Caspian steppe, with the kilometre grid visible in the body](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/berkeley-embenskij-post.jpg)

### Planheft Schweiz, p. C 2: the world-coverage plate

The *Streifen des Deutschen Heeresgitters und Einteilung der Weltkarte
1:1.000.000* plate enumerates the system's operational rectangle: zones
55 (CM 33° W) to 14 (CM 81° E), latitude band 32° S to 72° N. The
renderer uses these four numbers as its hard clip envelope.

![Planheft Schweiz world coverage plate showing DHG strip numbers 55 through 14 over a world outline with IMW row letters](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/planheft-streifen.jpg)

## Theatres

The Planheft Schweiz cross-references the full set of sister *Planhefte*.
**All use the same DHG.** Only local material differs: source maps,
height datums, place-name conventions, country-specific triangulation
notes.

| Merkblatt | Theatre |
|---|---|
| g 23/1 | Schweiz |
| g 23/2 | Fennoskandien (incl. the Kolosjoki sheet above) |
| 33/10 | Italien |
| 33/11 | Belgien |
| 33/11a/b | Südosteuropa (Balkan, north & south) |
| 33/12 | Übersichten Ost |
| 33/15 | Niederlande |
| 34/17 | Luxemburg |
| 34/18 | Großbritannien |
| 34/24 | Mittelmeergebiet |
| 34/25 | Spanien und Portugal |
| 34/27 | Afrika |
| 34/29 | Vorderasien |
| 34/31a/b/c | Osteuropa (Baltikum, ex-Polen, Rußland; incl. Owrutsch + Embenskij) |
| 34/32 | Dänemark / Island / Färöer / Grönland |
| 34/33 | Frankreich |

Because the projection and the letter-cell rule are universal, **this
package needs no theatre-specific factory functions**, in contrast to
the Modified British System which has one factory per theatre.

The Planheft notes that each national triangulation kept its own
astronomical origin, so the WGS 84 → Bessel transform varies slightly
per region (typically 50–150 m residuals at the border between two
triangulations). The package uses a single global Helmert (Potsdam
datum) and lets you override per call via the `datumShift` option.

## Geographic HMN (`GeographicHmnGridSystem`)

The lat/lon-bounded variant of the Heeresmeldenetz. Cells are degree-
bounded so they don't depend on a projection; the grid is defined
purely in `(lat, lon)` space and renders directly on any view
projection without going through DHG.

### Spec

Per Buchroithner & Pfahlbusch (2015), citing
*RdLuObdL ChAusbW VorschLmAbtRLM/LIn12 76/40*:

| Level         | Size                  | Labelling            | Origin               |
|---------------|-----------------------|----------------------|----------------------|
| Großtrapez    | 2°30′ lon × 1°40′ lat | name of settlement   | (0°40′N, 0°E), stepping ±2°30′ / ±1°40′ |
| **Kleintrapez** | **6′ lon × 4′ lat** | **letter pair `AA`..`ZZ` (25 letters, no `I`)** | NW corner of Großtrapez |
| Meldetrapez   | 2′ lon × 1′20″ lat    | `1`..`9` (3 × 3, NW→SE row-major) | NW corner of Kleintrapez |
| Arbeitstrapez | 1′ lon × 40″ lat      | `a`..`d` (2 × 2, NW→SE row-major) | NW corner of Meldetrapez |
| (tenths)      | 6″ lon × 4″ lat       | 2 digits, east + north | SW corner of Arbeitstrapez |

Cell labelling within a Großtrapez follows the same column-letter +
row-letter rule as the planar variant: first letter = column (W→E),
second letter = row (N→S).

The anchor `0°40′N` is empirical. The cited paper prints `1°N (!)`, but
that number fits no observed sheet. Every primary source we've checked
(the Bildplankarte *E27O Romfo*, an Atlantikwall sector overprint on
the Dutch coast) only fits an anchor 20′ south of the printed value,
suggesting a transcription error in the source.

### Primary-source example: Romfo Bildplankarte

The cleanest published primary source for the geographic HMN is the
`E27O Romfo (Nordteil)` *Bildplankarte*. The sheet header literally
reads **`Heeresmeldenetz (geogr.)`**, removing any ambiguity about which
variant the orange overprint encodes.

![E27O Romfo (Nordteil) Bildplankarte 1:50 000, header reading "Heeresmeldenetz (geogr.) / Norwegen 1:50000 / OPDAL / E27O Romfo (Nordteil)", with the orange letter-pair grid NV through SX printed across the sheet and a face-of-sheet subdivision diagram showing the Meldetrapeze 1..9 and Arbeitstrapeze a..d](images/romfo-geogr-hmn.jpg)

What the sheet tells us:

- **Header**: `Heeresmeldenetz (geogr.)` self-identifies this as the
  geographic variant (cells bounded by lat/lon, not by Bessel metres).
- **Großtrapez code**: `E27O`, the explicit identifier for the
  Großtrapez. `Romfo` is the named settlement inside it.
- **Visible Kleintrapeze**: `NV`, `OV`, `PV`, `QV`, `RV`, `SV` across the
  top row; `NW`..`SW` middle; `NX`..`SX` bottom (six columns × three
  rows of cells visible on the sheet).
- **Face-of-sheet subdivision diagram** (inside `PW`): the 3 × 3 grid of
  Meldetrapeze numbered 1..9 from the NW corner, with Meldetrapez 1
  further split into Arbeitstrapeze a / b / c / d. This is exactly the
  hierarchy the encoder produces.

### Working through `E27O Romfo` step by step

Romfo town centre is at approximately **62°36′N, 9°30′E**. Run that
through the encoder:

```ts
import { encodeHmnGeo, decomposeHmnGeo } from '@zwaarcontrast/ol-graticule-heeresgitter';

const ref = encodeHmnGeo([62 + 36/60, 9 + 30/60], { depth: 2 });
ref.canonical;     // -> "VW"
ref.grosstrapez;   // -> { gx: 3, gy: 37 }
```

Reproducing that by hand against the spec:

1. **Großtrapez selection.** From the anchor `(0°40′N, 0°E)` stepping by
   `(2°30′ lon × 1°40′ lat)`:
   - `gx = floor((9°30′ − 0°) / 2°30′) = 3` → NW lon = `3 × 2°30′ = 7°30′E`
   - `gy = floor((62°36′ − 0°40′) / 1°40′) = 37` → NW lat = `0°40′ + 38 × 1°40′ = 64°00′N`
2. **Cell within the Großtrapez** (cells are 6′ lon × 4′ lat, columns
   ascend W→E, rows ascend N→S):
   - column offset = `9°30′ − 7°30′ = 120′`; `floor(120 / 6) = 20` → letter index 20 → **`V`**
   - row offset = `64°00′ − 62°36′ = 84′`; `floor(84 / 4) = 21` → letter index 21 → **`W`**

So Romfo town centre lands in cell `VW`, just east of the printed
`NV..SX` block. That fits, because 1:50 000 sheets are typically named
after the most prominent settlement near (not necessarily inside) the
printed area.

### Another worked example: Den Haag

```ts
// Den Haag city centre (S'-Gravenhage, 52°04'46"N 4°18'30"E):
encodeHmnGeo([52.07944, 4.30833], { depth: 2 }).canonical; // -> "TD"
encodeHmnGeo([52.07944, 4.30833]).canonical;               // -> "TD 7c 03"
```

Cross-checked against a wartime Atlantikwall sector overprint on a
captured Dutch *Topografische kaart*: Den Haag reads `TD` and the
neighbouring Scheveningen reads `SD`, both inside Großtrapez
`(gx=1, gy=30)` with NW corner `(52°20′N, 2°30′E)`.

## What this package doesn't implement

- **Luftwaffe `Gradnetzmeldeverfahren` (GNMV)** with `Zusatzzahlgebiete`
  (10° × 10° add-on number areas, 1° Großtrapeze, 30′ Mittel, etc.).
  Different grid; for that, see
  [`@zwaarcontrast/ol-graticule-luftwaffe-planquadrat`](../ol-graticule-luftwaffe-planquadrat).
- **UTM-REF / Deutscher Heeresblattschnitt**, the 1944 prototype that
  later became MGRS. Covered by
  [`@zwaarcontrast/ol-graticule-mgrs`](../ol-graticule-mgrs).
- **DRG (Deutsches Reichsgitter)**, the civilian 3°-strip predecessor.
  Different grid; could be a future sibling package if anyone needs it.

## Credits and attribution

### Map sheet images

All four sheet reproductions in this README, plus the Planheft Schweiz
plate, are courtesy of the **UC Berkeley Library**, German WWII Captured
Maps digital collection: <https://digicoll.lib.berkeley.edu/record/105643>.
If you reuse the images, please cite Berkeley.

### Sources for the encoding rules

- **Planheft Schweiz** (OKH g 23/1, 16 March 1944), pages C 1–C 3: the
  explicit DHG projection specification (Bessel 1841, 6° Gauß-Krüger,
  scale factor 1.0, false easting 500 000 m, Kennziffer numbering, strip
  overlap, world-coverage rectangle).
- **Buchroithner & Pfahlbusch**, *Geodetic grids in authoritative maps:
  new findings about the origin of the UTM Grid*, Cartography &
  Geographic Information Science (2016),
  [DOI 10.1080/15230406.2015.1128851][buchroithner-doi]
  ([open-access PDF via Austria-Forum][buchroithner-pdf]): the explicit
  spec for both HMN variants (planar and geographic), citing
  *RdLuObdL ChAusbW VorschLmAbtRLM/LIn12 76/40*, and the UTM-REF
  lineage that eventually became MGRS. Note: the geographic-variant
  anchor latitude printed in the paper (`1°N (!)`) does not match any
  observed primary source; see *Geographic HMN* above for the
  empirical correction.
- **Powell & Mühr**, *Capturing the Complex Histories of German World
  War II Captured Maps* (UC Berkeley Library): provenance and
  cataloguing context for the captured-map collection.
- Sample sheets that anchor the implementation: *Norwegen / Finnland
  1:50 000* R-36-X-West-7 Kolosjoki (October 1943); *Alpen- und
  Donau-Reichsgaue 1:50 000* Blatt 4558 Ost Hadres; *Osteuropa 1:300 000*
  V52/W50 Owrutsch-Tscherkassy; *Osteuropa 1:300 000* Zusammendruck
  II/49–III/47 Embenskij Post – Osero Koschkar-Ata; *Norwegen 1:50 000*
  Bildplankarte `E27O Romfo (Nordteil)` (the only sheet I've seen
  carrying an explicit `Heeresmeldenetz (geogr.)` header).

[buchroithner-doi]: https://doi.org/10.1080/15230406.2015.1128851
[buchroithner-pdf]: https://austria-forum.org/attach/Geography/Cross-country_information/Buchroithner.pdf

## License

MIT. See [LICENSE](./LICENSE).

[berkeley]: https://digicoll.lib.berkeley.edu/record/105643
