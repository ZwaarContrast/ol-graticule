# Primary-source validation

The renderer and the encode / decode helpers are anchored to wartime
*Deutsche Heereskarte* sheets held by the UC Berkeley Library
([digital collection, record 105643][berkeley]), and to the explicit DHG
specification in the *Planheft Schweiz* (OKH g 23/1, 16 March 1944,
pages C 1–C 3).

All map sheet reproductions on this page are courtesy of the UC Berkeley
Library, German WWII Captured Maps digital collection. If you reuse the
images, please cite Berkeley.

## Kolosjoki, *Norwegen / Finnland 1:50 000* sheet R-36-X-West-7, October 1943

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

## Hadres, *Alpen- und Donau-Reichsgaue 1:50 000* Blatt 4558 Ost

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

## Owrutsch, *Osteuropa 1:300 000* Zusammendruck V52/W50 Owrutsch-Tscherkassy

Confirms the DHG at a different theatre and a different scale, with no
HMN overprint (1:300 000 was too small for the orange grid). The NW
corner is labelled `28°20' E / 52° N`:

- Northing label `5760` → Bessel meridian arc to 52° N ≈ 5 763 km ✓
- Easting label `5600` → zone-prefixed (`5` | 600 000 m), at 1°20' E from
  CM 27° E ≈ 92 km east of CM → 592 km Rechtswert. The label sits on the
  600 km grid line itself ✓

## Embenskij Post, *Osteuropa 1:300 000* Zusammendruck II/49–III/47

Confirms the same projection over the Caspian steppe, a 6th theatre tag
on the system.

![Title bar of the Embenskij Post 1:300 000 Zusammendruck sheet over the Caspian steppe, with the kilometre grid visible in the body](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/berkeley-embenskij-post.jpg)

## Planheft Schweiz, p. C 2: the world-coverage plate

The *Streifen des Deutschen Heeresgitters und Einteilung der Weltkarte
1:1.000.000* plate enumerates the system's operational rectangle: zones
55 (CM 33° W) to 14 (CM 81° E), latitude band 32° S to 72° N. The
renderer uses these four numbers as its hard clip envelope.

![Planheft Schweiz world coverage plate showing DHG strip numbers 55 through 14 over a world outline with IMW row letters](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/planheft-streifen.jpg)

## E27O Romfo Bildplankarte: the geographic HMN

The cleanest published primary source for the geographic HMN is the
`E27O Romfo (Nordteil)` *Bildplankarte*. The sheet header literally
reads **`Heeresmeldenetz (geogr.)`**, removing any ambiguity about which
variant the orange overprint encodes.

![E27O Romfo (Nordteil) Bildplankarte 1:50 000, header reading "Heeresmeldenetz (geogr.) / Norwegen 1:50000 / OPDAL / E27O Romfo (Nordteil)", with the orange letter-pair grid NV through SX printed across the sheet and a face-of-sheet subdivision diagram showing the Meldetrapeze 1..9 and Arbeitstrapeze a..d](https://github.com/ZwaarContrast/ol-graticule/raw/main/packages/ol-graticule-heeresgitter/images/romfo-geogr-hmn.jpg)

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
  further split into Arbeitstrapeze a / b / c / d.

### Worked encoding for Romfo

Romfo town centre is at approximately **62°36′N, 9°30′E**:

```ts
import { encodeHmnGeo } from '@zwaarcontrast/ol-graticule-heeresgitter';

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

### Empirical anchor correction

Buchroithner & Pfahlbusch (2016) print the geographic-variant anchor
latitude as `1°N (!)`. That number fits no observed sheet. Every primary
source checked (the Romfo Bildplankarte above, an Atlantikwall sector
overprint on the Dutch coast) only fits an anchor 20′ south of the
printed value, suggesting a transcription error in the paper. The
package uses `0°40′N`.

### Den Haag cross-check

```ts
encodeHmnGeo([52.07944, 4.30833], { depth: 2 }).canonical; // -> "TD"
encodeHmnGeo([52.07944, 4.30833]).canonical;               // -> "TD 7c 03"
```

Cross-checked against a wartime Atlantikwall sector overprint on a
captured Dutch *Topografische kaart*: Den Haag reads `TD` and the
neighbouring Scheveningen reads `SD`, both inside Großtrapez
`(gx=1, gy=30)` with NW corner `(52°20′N, 2°30′E)`.

[berkeley]: https://digicoll.lib.berkeley.edu/record/105643
